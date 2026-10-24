import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Warehouse,
  Percent,
  Tag,
  DollarSign,
  BarChart3,
  Sliders,
  AlertCircle,
  Save,
  X,
  Layers,
  Award,
  ChevronLeft,
  Info,
  Check,
  Building,
  Link as LinkIcon,
  ShieldAlert,
  ArrowUpDown,
  Store,
} from "lucide-react";
import { api } from "../../utils/api";
import { useAuth } from "../../contexts/AuthContext";

export interface SalesProductItem {
  sales_product_id: number;
  product_id: number;
  ingredient_id: number | null;
  is_active_for_sales: boolean;
  sales_unit: string;
  default_price_list_id: number | null;
  sales_notes?: string;
  created_at: string;
  updated_at: string;
  product_name: string;
  sku: string;
  barcode: string;
  core_unit: string;
  category: string;
  image?: string;
  base_core_price: number;
  core_stock: number;
  ingredient_name?: string;
  ingredient_code?: string;
  ingredient_unit?: string;
  inventory_stock: number;
  inventory_available: number;
  default_price_list_name?: string;
  retail_price: number;
  wholesale_price: number;
  isPosLinked?: boolean;
  is_pos_linked?: boolean;
  posPrice?: number;
  pos_price?: number;
  productType?: string;
  prices: {
    priceListId: number;
    priceListName: string;
    priceListCode: string;
    price: number;
    minQuantity: number;
  }[];
}

export interface PriceList {
  id: number;
  code: string;
  name: string;
  type: string;
  discount_percent: number;
  is_default: boolean;
  is_active: boolean;
  notes?: string;
  products_count?: number;
}

interface SalesProductsViewProps {
  onBack?: () => void;
  showToast?: (msg: string) => void;
}

export const SalesProductsView: React.FC<SalesProductsViewProps> = ({
  onBack,
  showToast,
}) => {
  const { user, hasPermission } = useAuth();

  // Permission checks
  const canView = true;
  const canCreate = hasPermission("sales.products_create") || hasPermission("sales") || user?.role === "admin";
  const canEdit = hasPermission("sales.products_edit") || hasPermission("sales") || user?.role === "admin";
  const canDisable = hasPermission("sales.products_disable") || hasPermission("sales") || user?.role === "admin";
  const canManagePrices = hasPermission("sales.manage_prices") || hasPermission("sales") || user?.role === "admin";
  const canManagePriceLists = hasPermission("sales.manage_pricelists") || hasPermission("sales") || user?.role === "admin";

  const [products, setProducts] = useState<SalesProductItem[]>([]);
  const [priceLists, setPriceLists] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "inactive">("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<"all" | "pos" | "sales">("all");
  const [selectedPriceListFilter, setSelectedPriceListFilter] = useState<number | "all">("all");

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPriceListsModal, setShowPriceListsModal] = useState(false);
  const [activeEditingProduct, setActiveEditingProduct] = useState<SalesProductItem | null>(null);

  // Add Product Form state
  const [availableCoreProducts, setAvailableCoreProducts] = useState<any[]>([]);
  const [coreSearchQuery, setCoreSearchQuery] = useState("");
  const [loadingCore, setLoadingCore] = useState(false);
  const [selectedCoreProduct, setSelectedCoreProduct] = useState<any | null>(null);

  const [addForm, setAddForm] = useState({
    salesUnit: "قطعة",
    isActiveForSales: true,
    defaultPriceListId: "" as number | string,
    notes: "",
    prices: {} as Record<number, number>, // priceListId -> price
  });

  const [savingProduct, setSavingProduct] = useState(false);

  // Price List Create/Edit state
  const [newPriceListForm, setNewPriceListForm] = useState({
    name: "",
    code: "",
    type: "جملة",
    discountPercent: 0,
    isDefault: false,
    notes: "",
  });
  const [savingPriceList, setSavingPriceList] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchSalesProducts(), fetchPriceLists()]);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSalesProducts(), fetchPriceLists()]);
      if (showToast) showToast("🟢 تم تحديث بيانات منتجات المبيعات وقوائم الأسعار");
    } finally {
      setRefreshing(false);
    }
  };

  const fetchSalesProducts = async () => {
    try {
      const res = await api.get("/api/v2/sales/products");
      if (res.ok) {
        const data = await res.json();
        const rawList = Array.isArray(data) ? data : (data.products || []);
        const normalized = rawList.map((item: any) => ({
          sales_product_id: item.sales_product_id || item.id,
          product_id: item.product_id || item.id,
          product_name: item.product_name || item.name || "منتج بدون اسم",
          sku: item.sku || item.code || "",
          barcode: item.barcode || "",
          core_unit: item.core_unit || item.unit || "قطعة",
          sales_unit: item.sales_unit || item.unit || "قطعة",
          category: item.category || "عام",
          image: item.image || "",
          base_core_price: item.base_core_price || item.basePrice || item.retailPrice || 0,
          core_stock: item.core_stock ?? item.totalStock ?? 0,
          ingredient_id: item.ingredient_id ?? item.masterItemId ?? null,
          ingredient_name: item.ingredient_name || item.masterItemName || "",
          ingredient_code: item.ingredient_code || item.masterItemCode || "",
          ingredient_unit: item.ingredient_unit || item.masterItemUnit || "",
          inventory_stock: item.inventory_stock ?? item.totalStock ?? 0,
          inventory_available: item.inventory_available ?? item.availableStock ?? 0,
          default_price_list_name: item.default_price_list_name || "",
          retail_price: item.retail_price ?? item.retailPrice ?? item.basePrice ?? 0,
          wholesale_price: item.wholesale_price ?? item.wholesalePrice ?? 0,
          is_active_for_sales: item.is_active_for_sales !== undefined ? item.is_active_for_sales : (item.isActive !== false),
          isPosLinked: item.isPosLinked || item.productType === "pos_linked",
          is_pos_linked: item.isPosLinked || item.productType === "pos_linked",
          posPrice: item.posPrice ?? item.pos_price,
          pos_price: item.posPrice ?? item.pos_price,
          productType: item.productType || (item.isPosLinked ? "pos_linked" : "standard"),
          prices: item.prices || [],
          created_at: item.created_at || item.createdAt || "",
          updated_at: item.updated_at || item.updatedAt || "",
          default_price_list_id: item.default_price_list_id || null,
        }));
        setProducts(normalized);
      }
    } catch (err) {
      console.error("Error fetching sales products:", err);
    }
  };

  const fetchPriceLists = async () => {
    try {
      const res = await api.get("/api/v2/sales/price-lists");
      if (res.ok) {
        const data = await res.json();
        setPriceLists(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error fetching price lists:", err);
    }
  };

  const searchCoreProducts = async (term: string) => {
    setLoadingCore(true);
    try {
      const res = await api.get(`/api/v2/sales/core-products-available?q=${encodeURIComponent(term)}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableCoreProducts(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Error searching core products:", err);
    } finally {
      setLoadingCore(false);
    }
  };

  const openAddModal = () => {
    setSelectedCoreProduct(null);
    setCoreSearchQuery("");
    setAddForm({
      salesUnit: "قطعة",
      isActiveForSales: true,
      defaultPriceListId: priceLists.find((pl) => pl.is_default)?.id || (priceLists[0]?.id ?? ""),
      notes: "",
      prices: {},
    });
    searchCoreProducts("");
    setShowAddModal(true);
  };

  const handleSelectCoreProduct = (coreP: any) => {
    setSelectedCoreProduct(coreP);
    const initialPrices: Record<number, number> = {};
    const basePrice = parseFloat(coreP.price || 0);

    priceLists.forEach((pl) => {
      const discount = parseFloat(pl.discount_percent as any || 0);
      const calculated = Math.max(0, Math.round(basePrice * (1 - discount / 100)));
      initialPrices[pl.id] = calculated;
    });

    setAddForm((prev) => ({
      ...prev,
      salesUnit: coreP.unit || "قطعة",
      prices: initialPrices,
    }));
  };

  const handleSaveNewSalesProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoreProduct) {
      alert("يرجى اختيار المنتج الأساسي (Core Product) أولاً");
      return;
    }

    setSavingProduct(true);
    try {
      const priceArray = Object.entries(addForm.prices).map(([plId, priceVal]) => ({
        priceListId: Number(plId),
        price: Number(priceVal) || 0,
        minQuantity: 1,
      }));

      const payload = {
        productId: selectedCoreProduct.id,
        ingredientId: selectedCoreProduct.ingredient_id || null,
        salesUnit: addForm.salesUnit || selectedCoreProduct.unit || "قطعة",
        isActiveForSales: addForm.isActiveForSales,
        defaultPriceListId: addForm.defaultPriceListId ? Number(addForm.defaultPriceListId) : null,
        notes: addForm.notes,
        prices: priceArray,
      };

      const res = await api.post("/api/v2/sales/products", payload);
      if (res.ok) {
        if (showToast) showToast(`✅ تم إضافة المنتج "${selectedCoreProduct.name}" إلى منتجات المبيعات بنجاح!`);
        setShowAddModal(false);
        fetchSalesProducts();
      } else {
        const err = await res.json();
        alert(`❌ فشل إضافة المنتج: ${err.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const openEditModal = (p: SalesProductItem) => {
    setActiveEditingProduct(p);
    const initialPrices: Record<number, number> = {};
    p.prices.forEach((pr) => {
      initialPrices[pr.priceListId] = pr.price;
    });

    // Ensure all existing price lists have a field
    priceLists.forEach((pl) => {
      if (initialPrices[pl.id] === undefined) {
        initialPrices[pl.id] = p.base_core_price || 0;
      }
    });

    setAddForm({
      salesUnit: p.sales_unit || p.core_unit || "قطعة",
      isActiveForSales: p.is_active_for_sales,
      defaultPriceListId: p.default_price_list_id || "",
      notes: p.sales_notes || "",
      prices: initialPrices,
    });
    setShowEditModal(true);
  };

  const handleUpdateSalesProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditingProduct) return;

    setSavingProduct(true);
    try {
      const priceArray = Object.entries(addForm.prices).map(([plId, priceVal]) => ({
        priceListId: Number(plId),
        price: Number(priceVal) || 0,
        minQuantity: 1,
      }));

      const payload = {
        salesUnit: addForm.salesUnit,
        isActiveForSales: addForm.isActiveForSales,
        defaultPriceListId: addForm.defaultPriceListId ? Number(addForm.defaultPriceListId) : null,
        notes: addForm.notes,
        prices: priceArray,
      };

      const res = await api.put(`/api/v2/sales/products/${activeEditingProduct.sales_product_id}`, payload);
      if (res.ok) {
        if (showToast) showToast(`✅ تم حفظ تعديلات منتج المبيعات بنجاح!`);
        setShowEditModal(false);
        fetchSalesProducts();
      } else {
        const err = await res.json();
        alert(`❌ فشل التعديل: ${err.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleToggleStatus = async (p: SalesProductItem) => {
    if (!canDisable) {
      alert("ليس لديك صلاحية تفعيل أو تعطيل منتجات المبيعات");
      return;
    }

    try {
      const res = await api.patch(`/api/v2/sales/products/${p.sales_product_id}/toggle-status`, {});
      if (res.ok) {
        const newStatus = !p.is_active_for_sales;
        setProducts((prev) =>
          prev.map((item) =>
            item.sales_product_id === p.sales_product_id
              ? { ...item, is_active_for_sales: newStatus }
              : item
          )
        );
        if (showToast) {
          showToast(
            newStatus
              ? `🟢 تم تفعيل المنتج "${p.product_name}" للبيع`
              : `⏸️ تم إيقاف المنتج "${p.product_name}" عن البيع مؤقتاً`
          );
        }
      } else {
        const err = await res.json();
        alert(`❌ فشل تغيير الحالة: ${err.error || ""}`);
      }
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    }
  };

  const handleDeleteProduct = async (p: SalesProductItem) => {
    if (!confirm(`هل أنت متأكد من إزالة منتج "${p.product_name}" من إعدادات المبيعات؟ لن يتم حذف المنتج الأساسي أو أوامر البيع السابقة.`)) {
      return;
    }

    try {
      const res = await api.delete(`/api/v2/sales/products/${p.sales_product_id}`);
      if (res.ok) {
        setProducts((prev) => prev.filter((item) => item.sales_product_id !== p.sales_product_id));
        if (showToast) showToast("🗑️ تم إزالة المنتج من إعدادات المبيعات");
      } else {
        const err = await res.json();
        alert(`❌ فشل الحذف: ${err.error || ""}`);
      }
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    }
  };

  const handleCreatePriceList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPriceListForm.name.trim()) return;

    setSavingPriceList(true);
    try {
      const res = await api.post("/api/v2/sales/price-lists", newPriceListForm);
      if (res.ok) {
        if (showToast) showToast("✅ تم إضافة قائمة الأسعار الجديدة بنجاح!");
        setNewPriceListForm({
          name: "",
          code: "",
          type: "جملة",
          discountPercent: 0,
          isDefault: false,
          notes: "",
        });
        fetchPriceLists();
      } else {
        const err = await res.json();
        alert(`❌ فشل إضافة قائمة الأسعار: ${err.error || ""}`);
      }
    } catch (err: any) {
      alert(`❌ خطأ: ${err.message}`);
    } finally {
      setSavingPriceList(false);
    }
  };

  // Categories list for filter
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (p.product_name && p.product_name.toLowerCase().includes(q)) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        (p.ingredient_name && p.ingredient_name.toLowerCase().includes(q));

      const matchCategory =
        selectedCategory === "all" || p.category === selectedCategory;

      const matchStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" && p.is_active_for_sales) ||
        (selectedStatus === "inactive" && !p.is_active_for_sales);

      const matchSource =
        selectedSourceFilter === "all" ||
        (selectedSourceFilter === "pos" && (p.isPosLinked || p.is_pos_linked || p.productType === "pos_linked")) ||
        (selectedSourceFilter === "sales" && !(p.isPosLinked || p.is_pos_linked || p.productType === "pos_linked"));

      const matchPriceList =
        selectedPriceListFilter === "all" ||
        p.prices.some((pr) => pr.priceListId === Number(selectedPriceListFilter) && pr.price > 0);

      return matchSearch && matchCategory && matchStatus && matchSource && matchPriceList;
    });
  }, [products, searchQuery, selectedCategory, selectedStatus, selectedSourceFilter, selectedPriceListFilter]);

  // Statistics
  const activeCount = useMemo(() => products.filter((p) => p.is_active_for_sales).length, [products]);
  const inactiveCount = useMemo(() => products.filter((p) => !p.is_active_for_sales).length, [products]);
  const posCount = useMemo(() => products.filter((p) => p.isPosLinked || p.is_pos_linked || p.productType === "pos_linked").length, [products]);

  return (
    <div className="space-y-6 text-right font-cairo">
      {/* 1. Header & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-sm">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900">
                منتجات المبيعات | Sales Products
              </h2>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full">
                Core Connected
              </span>
            </div>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              تهيئة المنتجات المتاحة للبيع، ربطها بالأصناف المخزنية، وتحديد أسعارها في قوائم الأسعار المتعددة
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManagePriceLists && (
            <button
              type="button"
              onClick={() => setShowPriceListsModal(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200/80"
            >
              <Percent className="w-4 h-4 text-slate-600" />
              <span>قوائم الأسعار ({priceLists.length})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer border border-slate-200/80"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={openAddModal}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة منتج للمبيعات</span>
            </button>
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

      {/* 2. Stat KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setSelectedSourceFilter("all")}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-300 transition-all"
        >
          <div>
            <span className="text-[10px] text-slate-400 font-black">إجمالي منتجات المبيعات</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{products.length}</h3>
            <p className="text-[10px] text-indigo-600 font-bold mt-0.5">معرفة في مديول المبيعات</p>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
            <Package className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setSelectedStatus("active")}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div>
            <span className="text-[10px] text-slate-400 font-black">متاح للبيع (نشط)</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">{activeCount}</h3>
            <p className="text-[10px] text-emerald-600 font-bold mt-0.5">تظهر بأوامر وعروض البيع</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div
          onClick={() => setSelectedSourceFilter("pos")}
          className={`p-5 rounded-2xl border shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            selectedSourceFilter === "pos" ? "bg-purple-50/70 border-purple-300 ring-2 ring-purple-500/20" : "bg-white border-slate-200/80 hover:border-purple-300"
          }`}
        >
          <div>
            <span className="text-[10px] text-purple-600 font-black">منتجات نقطة البيع (POS)</span>
            <h3 className="text-2xl font-black text-purple-700 mt-1">{posCount}</h3>
            <p className="text-[10px] text-purple-600 font-bold mt-0.5">مرتبطة ومشارَكة مع الكاشير</p>
          </div>
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-black">قوائم الأسعار المعرفة</span>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{priceLists.length}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-0.5">تجزئة، جملة، VIP، شركات...</p>
          </div>
          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-2xl flex items-center justify-center">
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Search & Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، كود الصنف / SKU، الباركود، أو الصنف المخزني..."
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Source Filter (All / POS / Sales) */}
          <div className="flex items-center gap-1.5 text-xs bg-purple-50 border border-purple-200 rounded-xl px-2.5 py-1.5 text-purple-900 font-bold">
            <Store className="w-3.5 h-3.5 text-purple-600" />
            <select
              value={selectedSourceFilter}
              onChange={(e) => setSelectedSourceFilter(e.target.value as any)}
              className="bg-transparent font-bold text-purple-900 outline-none text-xs cursor-pointer"
            >
              <option value="all">جميع المصادر (POS + Sales)</option>
              <option value="pos">منتجات نقطة البيع (POS) فقط</option>
              <option value="sales">منتجات المبيعات المستقلة فقط</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent font-bold text-slate-700 outline-none text-xs"
            >
              <option value="all">كل التصنيفات</option>
              {categories.map((c, idx) => (
                <option key={`cat-${c || idx}-${idx}`} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="bg-transparent font-bold text-slate-700 outline-none text-xs"
            >
              <option value="all">كل الحالات</option>
              <option value="active">متاح للبيع (نشط)</option>
              <option value="inactive">معطل عن البيع</option>
            </select>
          </div>

          {/* Price List Filter */}
          <div className="flex items-center gap-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
            <Percent className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedPriceListFilter}
              onChange={(e) => setSelectedPriceListFilter(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-transparent font-bold text-slate-700 outline-none text-xs"
            >
              <option value="all">كل قوائم الأسعار</option>
              {priceLists.map((pl, idx) => (
                <option key={`pl-filter-${pl.id ?? pl.code ?? idx}-${idx}`} value={pl.id}>
                  {pl.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Products Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-black">
              <tr>
                <th className="p-3.5">المنتج</th>
                <th className="p-3.5">SKU / الكود</th>
                <th className="p-3.5">الباركود</th>
                <th className="p-3.5">التصنيف</th>
                <th className="p-3.5">الصنف المخزني المرتبط</th>
                <th className="p-3.5 text-center">حالة البيع</th>
                <th className="p-3.5">قائمة السعر الافتراضية</th>
                <th className="p-3.5 text-left">سعر التجزئة</th>
                <th className="p-3.5 text-left">سعر الجملة</th>
                <th className="p-3.5 text-center">آخر تعديل</th>
                <th className="p-3.5 text-center w-28">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400 font-bold">
                    جاري تحميل منتجات المبيعات...
                  </td>
                </tr>
              ) : filteredProducts.length > 0 ? (
                filteredProducts.map((p, idx) => (
                  <tr key={`sales-prod-${p.sales_product_id || p.product_id || p.sku || idx}-${idx}`} className="hover:bg-slate-50/60 transition-colors">
                    {/* Product Name */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 overflow-hidden ${
                          p.isPosLinked || p.is_pos_linked
                            ? "bg-purple-50 border-purple-200 text-purple-600"
                            : "bg-slate-100 border-slate-200 text-slate-500"
                        }`}>
                          {p.image ? (
                            <img src={p.image} alt={p.product_name} className="w-full h-full object-cover" />
                          ) : p.isPosLinked || p.is_pos_linked ? (
                            <Store className="w-4 h-4 text-purple-600" />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-slate-900 block leading-tight">
                              {p.product_name}
                            </span>
                            {(p.isPosLinked || p.is_pos_linked) && (
                              <span className="bg-purple-100 text-purple-800 border border-purple-200 text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1">
                                <Store className="w-2.5 h-2.5 text-purple-600" />
                                نقطة البيع (POS)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            الوحدة: {p.sales_unit || p.core_unit || "قطعة"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="p-3.5 font-mono text-slate-700">
                      {p.sku || `PRD-${p.product_id}`}
                    </td>

                    {/* Barcode */}
                    <td className="p-3.5 font-mono text-slate-500 text-[11px]">
                      {p.barcode || "—"}
                    </td>

                    {/* Category */}
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-slate-200">
                        {p.category || "عام"}
                      </span>
                    </td>

                    {/* Linked Inventory Item */}
                    <td className="p-3.5">
                      {p.ingredient_name ? (
                        <div className="flex items-center gap-1.5">
                          <Warehouse className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <div>
                            <span className="font-bold text-slate-800 block text-[11px] leading-tight">
                              {p.ingredient_name}
                            </span>
                            <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded">
                              رصيد: {p.inventory_stock} {p.ingredient_unit || p.core_unit}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[10px]">غير مربوط بصنف خام</span>
                      )}
                    </td>

                    {/* Sales Active Toggle */}
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(p)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black transition-all cursor-pointer ${
                          p.is_active_for_sales
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                        }`}
                        title="انقر لتغيير حالة توفر المنتج للبيع"
                      >
                        {p.is_active_for_sales ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            <span>متاح للبيع</span>
                          </>
                        ) : (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            <span>معطل</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Default Price List */}
                    <td className="p-3.5 text-slate-700 text-[11px]">
                      {p.default_price_list_name || "الافتراضية"}
                    </td>

                    {/* Retail Price */}
                    <td className="p-3.5 text-left font-mono">
                      <span className="font-black text-slate-900 block">
                        {Number(p.retail_price || 0).toLocaleString()} ج.م
                      </span>
                      {(p.isPosLinked || p.is_pos_linked) && (p.posPrice !== undefined || p.pos_price !== undefined) && (
                        <span className="text-[10px] text-purple-700 font-bold block mt-0.5">
                          الكاشير: {Number(p.posPrice ?? p.pos_price).toLocaleString()} ج.م
                        </span>
                      )}
                    </td>

                    {/* Wholesale Price */}
                    <td className="p-3.5 text-left font-black text-indigo-700 font-mono">
                      {p.wholesale_price > 0
                        ? `${Number(p.wholesale_price).toLocaleString()} ج.م`
                        : "—"}
                    </td>

                    {/* Last Modified */}
                    <td className="p-3.5 text-center text-slate-400 font-mono text-[10px]">
                      {p.updated_at ? p.updated_at.split("T")[0] : "—"}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            className="p-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                            title="تعديل إعدادات وأسعار المنتج"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="إزالة من منتجات المبيعات"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400 font-bold">
                    لا توجد منتجات مبيعات مطابقة لمعايير البحث. انقر على "إضافة منتج للمبيعات" لإضافة أصناف جديدة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. ADD PRODUCT TO SALES MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-indigo-600" />
                  <span>إضافة منتج لمديول المبيعات</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                  اختر من المنتجات الأساسية الموجودة بالـ Core لتفعيلها للمبيعات دون تكرار
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewSalesProduct} className="space-y-5">
              {/* Step 1: Select Core Product */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 block">
                  1. اختيار المنتج الأساسي (Core Product) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                  <input
                    type="text"
                    value={coreSearchQuery}
                    onChange={(e) => {
                      setCoreSearchQuery(e.target.value);
                      searchCoreProducts(e.target.value);
                    }}
                    placeholder="ابحث في منتجات الـ Core بالاسم، الكود، أو الباركود..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Available Core Products List */}
                <div className="border border-slate-200 rounded-2xl max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {loadingCore ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">
                      جاري جلب المنتجات المتاحة من Core...
                    </div>
                  ) : availableCoreProducts.length > 0 ? (
                    availableCoreProducts.map((cp, idx) => {
                      const isSelected = selectedCoreProduct?.id === cp.id;
                      return (
                        <div
                          key={`core-prod-${cp.id || cp.sku || idx}-${idx}`}
                          onClick={() => handleSelectCoreProduct(cp)}
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-indigo-50/80 border-r-4 border-indigo-600"
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <div>
                            <span className="text-xs font-black text-slate-900 block">
                              {cp.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>كود: {cp.sku}</span>
                              {cp.barcode && <span>باركود: {cp.barcode}</span>}
                              <span>تصنيف: {cp.category}</span>
                            </div>
                          </div>

                          <div className="text-left">
                            <span className="text-xs font-black text-indigo-600 block">
                              {Number(cp.price || 0).toLocaleString()} ج.م
                            </span>
                            {cp.ingredient_name && (
                              <span className="text-[9px] text-emerald-600 font-bold">
                                مربوط بالمخزن ({cp.inventory_stock} {cp.unit})
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400 font-bold">
                      {coreSearchQuery
                        ? "لا توجد منتجات مطابقة في Core غير مفعلة بالمبيعات"
                        : "جميع منتجات الـ Core مفعلة حالياً في المبيعات، أو لا توجد منتجات مسجلة."}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Show Selected Product Details */}
              {selectedCoreProduct && (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-700 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>المنتج المحدد: {selectedCoreProduct.name}</span>
                    </span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 font-black px-2 py-0.5 rounded-full">
                      سعر الأساس: {Number(selectedCoreProduct.price || 0).toLocaleString()} ج.م
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                    <div>
                      <span className="text-[10px] text-slate-400 block">الكود / SKU:</span>
                      <span className="font-mono font-bold">{selectedCoreProduct.sku}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">الباركود:</span>
                      <span className="font-mono font-bold">{selectedCoreProduct.barcode || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">التصنيف:</span>
                      <span className="font-bold">{selectedCoreProduct.category}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">الرصيد بالمخازن:</span>
                      <span className="font-bold text-emerald-700">
                        {selectedCoreProduct.inventory_stock} {selectedCoreProduct.unit}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Sales Configuration Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    الوحدة المستخدمة في البيع
                  </label>
                  <select
                    value={addForm.salesUnit}
                    onChange={(e) => setAddForm({ ...addForm, salesUnit: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="قطعة">قطعة (Piece)</option>
                    <option value="علبة">علبة (Box)</option>
                    <option value="كرتونة">كرتونة (Carton)</option>
                    <option value="كيلو">كيلو (Kg)</option>
                    <option value="لتر">لتر (Liter)</option>
                    <option value="متر">متر (Meter)</option>
                    <option value="طقم">طقم (Set)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    قائمة السعر الافتراضية
                  </label>
                  <select
                    value={addForm.defaultPriceListId}
                    onChange={(e) => setAddForm({ ...addForm, defaultPriceListId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {priceLists.map((pl, idx) => (
                      <option key={`add-pl-select-${pl.id ?? pl.code ?? idx}-${idx}`} value={pl.id}>
                        {pl.name} {pl.is_default ? "(الافتراضية)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    حالة الإتاحة للبيع
                  </label>
                  <select
                    value={addForm.isActiveForSales ? "1" : "0"}
                    onChange={(e) => setAddForm({ ...addForm, isActiveForSales: e.target.value === "1" })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1">متاح للبيع (Active)</option>
                    <option value="0">معطل عن البيع (Inactive)</option>
                  </select>
                </div>
              </div>

              {/* Step 4: Price Lists Pricing Matrix */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    <span>تحديد أسعار المنتج في قوائم أسعار المبيعات (Price Lists)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">
                    بدون إدخال تكلفة - التكلفة تحسب آلياً من المخازن
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {priceLists.map((pl, idx) => (
                    <div key={`add-price-card-${pl.id ?? pl.code ?? idx}-${idx}`} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-slate-700">{pl.name}</span>
                        <span className="text-[9px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                          {pl.type}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={addForm.prices[pl.id] ?? ""}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              prices: {
                                ...addForm.prices,
                                [pl.id]: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full pr-3 pl-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left font-mono"
                          placeholder="0.00"
                        />
                        <span className="absolute left-2.5 top-1.5 text-[10px] font-bold text-slate-400">
                          ج.م
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || !selectedCoreProduct}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {savingProduct ? (
                    <span>جاري الحفظ...</span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ وإضافة للمبيعات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. EDIT SALES PRODUCT MODAL */}
      {showEditModal && activeEditingProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-indigo-600" />
                  <span>تعديل إعدادات وأسعار المنتج: {activeEditingProduct.product_name}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                  كود الصنف: {activeEditingProduct.sku} | التصنيف: {activeEditingProduct.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateSalesProduct} className="space-y-5">
              {/* Product Info Banner */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">الصنف المخزني المرتبط:</span>
                  <span className="font-bold text-slate-800">
                    {activeEditingProduct.ingredient_name || "لا يوجد صنف مخزني مرتبط"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">الرصيد الفعلي بالمخازن:</span>
                  <span className="font-bold text-emerald-700">
                    {activeEditingProduct.inventory_stock} {activeEditingProduct.sales_unit || "قطعة"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">سعر الأساس في Core:</span>
                  <span className="font-bold text-indigo-700">
                    {Number(activeEditingProduct.base_core_price || 0).toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              {/* General settings */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    الوحدة المستخدمة في البيع
                  </label>
                  <select
                    value={addForm.salesUnit}
                    onChange={(e) => setAddForm({ ...addForm, salesUnit: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="قطعة">قطعة (Piece)</option>
                    <option value="علبة">علبة (Box)</option>
                    <option value="كرتونة">كرتونة (Carton)</option>
                    <option value="كيلو">كيلو (Kg)</option>
                    <option value="لتر">لتر (Liter)</option>
                    <option value="متر">متر (Meter)</option>
                    <option value="طقم">طقم (Set)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    قائمة السعر الافتراضية
                  </label>
                  <select
                    value={addForm.defaultPriceListId}
                    onChange={(e) => setAddForm({ ...addForm, defaultPriceListId: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {priceLists.map((pl, idx) => (
                      <option key={`edit-pl-select-${pl.id ?? pl.code ?? idx}-${idx}`} value={pl.id}>
                        {pl.name} {pl.is_default ? "(الافتراضية)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700 block mb-1">
                    حالة الإتاحة للبيع
                  </label>
                  <select
                    value={addForm.isActiveForSales ? "1" : "0"}
                    onChange={(e) => setAddForm({ ...addForm, isActiveForSales: e.target.value === "1" })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="1">متاح للبيع (Active)</option>
                    <option value="0">معطل عن البيع (Inactive)</option>
                  </select>
                </div>
              </div>

              {/* Price lists price inputs */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-indigo-600" />
                    <span>تعديل أسعار المنتج في قوائم أسعار المبيعات</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-bold">
                    تتغير تلقائياً في أوامر البيع عند اختيار القائمة
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {priceLists.map((pl, idx) => (
                    <div key={`edit-price-card-${pl.id ?? pl.code ?? idx}-${idx}`} className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] font-black text-slate-700">{pl.name}</span>
                        <span className="text-[9px] bg-slate-200/70 text-slate-600 px-1.5 py-0.2 rounded font-bold">
                          {pl.type}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={addForm.prices[pl.id] ?? ""}
                          onChange={(e) =>
                            setAddForm({
                              ...addForm,
                              prices: {
                                ...addForm.prices,
                                [pl.id]: parseFloat(e.target.value) || 0,
                              },
                            })
                          }
                          className="w-full pr-3 pl-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left font-mono"
                        />
                        <span className="absolute left-2.5 top-1.5 text-[10px] font-bold text-slate-400">
                          ج.م
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  {savingProduct ? (
                    <span>جاري التعديل...</span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. MANAGE PRICE LISTS MODAL */}
      {showPriceListsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Percent className="w-5 h-5 text-indigo-600" />
                  <span>إدارة قوائم أسعار المبيعات (Sales Price Lists)</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                  إضافة وتخصيص قوائم الأسعار لشرائح العملاء المختلفة دون تعديل الكود
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPriceListsModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price Lists Table */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 font-black text-slate-700">
                  <tr>
                    <th className="p-3">اسم القائمة</th>
                    <th className="p-3">الكود</th>
                    <th className="p-3">النوع</th>
                    <th className="p-3 text-center">نسبة الخصم %</th>
                    <th className="p-3 text-center">الحالة</th>
                    <th className="p-3 text-center">عدد المنتجات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold">
                  {priceLists.map((pl, idx) => (
                    <tr key={`pl-mgmt-row-${pl.id ?? pl.code ?? idx}-${idx}`} className="hover:bg-slate-50/50">
                      <td className="p-3 font-black text-slate-900">
                        {pl.name}
                        {pl.is_default && (
                          <span className="mr-2 text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                            افتراضية
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-500">{pl.code}</td>
                      <td className="p-3 text-slate-600">{pl.type}</td>
                      <td className="p-3 text-center font-mono text-indigo-600">{pl.discount_percent}%</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${pl.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {pl.is_active ? "نشط" : "معطل"}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-700">
                        {pl.products_count || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add new Price List form */}
            <form onSubmit={handleCreatePriceList} className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>إضافة قائمة أسعار جديدة</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    اسم قائمة الأسعار <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newPriceListForm.name}
                    onChange={(e) => setNewPriceListForm({ ...newPriceListForm, name: e.target.value })}
                    placeholder="مثال: أسعار التصدير"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    الكود التعريفي (Slug)
                  </label>
                  <input
                    type="text"
                    value={newPriceListForm.code}
                    onChange={(e) => setNewPriceListForm({ ...newPriceListForm, code: e.target.value })}
                    placeholder="مثال: export_prices"
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-left"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    نوع القائمة
                  </label>
                  <select
                    value={newPriceListForm.type}
                    onChange={(e) => setNewPriceListForm({ ...newPriceListForm, type: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="جملة">جملة</option>
                    <option value="تجزئة">تجزئة</option>
                    <option value="موزع">موزع</option>
                    <option value="VIP">VIP</option>
                    <option value="شركات">شركات</option>
                    <option value="تصدير">تصدير</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={newPriceListForm.isDefault}
                    onChange={(e) => setNewPriceListForm({ ...newPriceListForm, isDefault: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>تعيين كقائمة أسعار افتراضية للمبيعات</span>
                </label>

                <button
                  type="submit"
                  disabled={savingPriceList || !newPriceListForm.name.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة القائمة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
