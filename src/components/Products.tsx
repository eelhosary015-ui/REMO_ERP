import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Barcode,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Coffee,
  Copy,
  DollarSign,
  Download,
  Edit2,
  Eye,
  EyeOff,
  Factory,
  Filter,
  Folder,
  FolderTree,
  Grid3X3,
  Image as ImageIcon,
  Layers,
  List,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Shirt,
  ShoppingBasket,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Upload,
  Utensils,
  Warehouse,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Category, Ingredient, Product, ProductIngredient, ProductSize } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { api, authFetch, authHeaders } from "../utils/api";
import * as XLSX from "xlsx";

interface ProductsProps {
  onBack: () => void;
  onRefresh: () => void;
  initialTab?: "products" | "categories" | "ingredients";
  initialCategories?: Category[];
  initialProducts?: Product[];
}

type BusinessProfile = "restaurant" | "clothing" | "supermarket" | "general";
type ProductKind = "sale" | "manufactured" | "raw_material" | "service" | "bundle";

type ProductRecord = Product & {
  is_active?: boolean;
  show_in_pos?: boolean;
  is_available_in_pos?: boolean;
  show_in_sales?: boolean;
  is_available_in_sales?: boolean;
  sales_price?: number | null;
  is_favorite?: boolean;
  warehouse_id?: number;
  ingredient_id?: number | null;
  master_item_id?: number | null;
  master_item_name?: string | null;
  master_item_unit?: string | null;
  live_stock?: number;
  properties?: any;
  cost?: number;
  tax_rate?: number;
  min_stock?: number;
  max_stock?: number;
  item_type?: ProductKind;
  business_profile?: BusinessProfile;
  preparation_time?: number;
  kitchen_station?: string;
  size_label?: string;
  color?: string;
  material?: string;
  supplier?: string;
  shelf_life_days?: number;
  allow_discount?: boolean;
  track_inventory?: boolean;
  display_order?: number;
};

type CategoryRecord = Category & {
  is_active?: boolean;
  show_in_pos?: boolean;
  color?: string;
  icon?: string;
  description?: string;
  sort_order?: number;
  printer_id?: number | null;
};

type IngredientRecord = Ingredient & {
  is_active?: boolean;
};

const PRODUCTS_CACHE_KEY = "erp_products_manage_cache_v1";

let memoryProductsCache: {
  categories: CategoryRecord[];
  products: ProductRecord[];
  ingredients: IngredientRecord[];
  warehouses: { id: number; name: string }[];
  updatedAt: number;
} | null = null;

const readStoredProductsCache = () => {
  if (memoryProductsCache) return memoryProductsCache;
  try {
    const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.categories)) {
      memoryProductsCache = parsed;
      return parsed;
    }
  } catch {
    // ignore storage read error
  }
  return null;
};

const writeStoredProductsCache = (data: {
  categories: CategoryRecord[];
  products: ProductRecord[];
  ingredients: IngredientRecord[];
  warehouses: { id: number; name: string }[];
}) => {
  const payload = { ...data, updatedAt: Date.now() };
  memoryProductsCache = payload;
  try {
    localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota error
  }
};

export const preloadProductsManageData = async () => {
  try {
    const [posRes, ingRes, whRes] = await Promise.all([
      api.get("/api/products/manage-data"),
      api.get("/api/ingredients"),
      api.get("/api/inventory/warehouses"),
    ]);
    if (!posRes.ok) return;
    const posData = await posRes.json();
    const ingData = ingRes.ok ? await ingRes.json() : [];
    const whData = whRes.ok ? await whRes.json() : [];
    writeStoredProductsCache({
      categories: Array.isArray(posData.categories) ? posData.categories.map(normalizeCategory) : [],
      products: Array.isArray(posData.products) ? posData.products.map(normalizeProduct) : [],
      ingredients: Array.isArray(ingData) ? ingData : [],
      warehouses: Array.isArray(whData) ? whData : [],
    });
  } catch {
    // background preload silent ignore
  }
};

const PRESET_IMAGES = [
  { name: "مطعم / وجبة", url: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=500&q=80" },
  { name: "قهوة ومشروبات", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=500&q=80" },
  { name: "سوبر ماركت", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=500&q=80" },
  { name: "ملابس", url: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=500&q=80" },
  { name: "إلكترونيات", url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=500&q=80" },
  { name: "منتج عام", url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=500&q=80" },
];

const CATEGORY_ICONS = [
  { id: "utensils", label: "مطاعم", icon: Utensils },
  { id: "coffee", label: "مشروبات", icon: Coffee },
  { id: "basket", label: "سوبر ماركت", icon: ShoppingBasket },
  { id: "shirt", label: "ملابس", icon: Shirt },
  { id: "factory", label: "إنتاج", icon: Factory },
  { id: "package", label: "عام", icon: Package },
];

const CATEGORY_COLORS = [
  "#2563eb",
  "#0f766e",
  "#ea580c",
  "#7c3aed",
  "#db2777",
  "#16a34a",
  "#475569",
];

const BUSINESS_PROFILES: Record<BusinessProfile, { label: string; icon: React.ReactNode; hint: string }> = {
  restaurant: {
    label: "مطاعم وكافيهات",
    icon: <Utensils className="w-4 h-4" />,
    hint: "أحجام، مقادير، مطبخ، وقت تجهيز",
  },
  clothing: {
    label: "ملابس",
    icon: <Shirt className="w-4 h-4" />,
    hint: "مقاسات، ألوان، خامات، باركود",
  },
  supermarket: {
    label: "سوبر ماركت",
    icon: <ShoppingBasket className="w-4 h-4" />,
    hint: "باركود، مخزون، صلاحية، وحدات",
  },
  general: {
    label: "نشاط عام",
    icon: <Package className="w-4 h-4" />,
    hint: "أي منتج أو خدمة أو باكدج",
  },
};

const PRODUCT_KIND_LABELS: Record<ProductKind, string> = {
  sale: "منتج بيع مباشر",
  manufactured: "منتج إنتاج / تصنيع",
  raw_material: "خامة / صنف مخزني",
  service: "خدمة",
  bundle: "باكدج / تجميعة",
};

const DEFAULT_PRODUCT: Partial<ProductRecord> = {
  name: "",
  price: 0,
  sales_price: null,
  cost: 0,
  category_id: 0,
  image: "",
  ingredients: [],
  sizes: [],
  unit: "قطعة",
  stock: 0,
  min_stock: 0,
  max_stock: 0,
  brand: "",
  barcode: "",
  code: "",
  business_profile: "restaurant",
  item_type: "sale",
  is_active: true,
  show_in_pos: true,
  is_available_in_pos: true,
  show_in_sales: true,
  is_available_in_sales: true,
  is_favorite: false,
  allow_discount: true,
  track_inventory: true,
  tax_rate: 14,
};

const parseProperties = (properties: any): Record<string, any> => {
  if (!properties) return {};
  if (typeof properties === "object") return properties;
  try {
    const parsed = JSON.parse(properties);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const num = (value: any, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const boolValue = (value: any, fallback = true) => {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return fallback;
};

const normalizeProduct = (product: any): ProductRecord => {
  const props = parseProperties(product?.properties);
  const ingId = product?.ingredient_id ? Number(product.ingredient_id) : (props?.ingredient_id ? Number(props.ingredient_id) : undefined);
  const showInPos = boolValue(product?.show_in_pos ?? product?.is_available_in_pos ?? props.show_in_pos ?? props.is_available_in_pos, true);
  const showInSales = boolValue(product?.show_in_sales ?? product?.is_available_in_sales ?? props.show_in_sales ?? props.is_available_in_sales, true);
  const customSalesPrice = product?.sales_price !== undefined && product?.sales_price !== null && product?.sales_price !== "" 
    ? num(product.sales_price) 
    : (props.sales_price !== undefined && props.sales_price !== null && props.sales_price !== "" ? num(props.sales_price) : null);

  return {
    ...product,
    ingredient_id: ingId,
    master_item_id: ingId,
    master_item_name: product?.master_item_name || null,
    master_item_unit: product?.master_item_unit || null,
    properties: props,
    price: num(product?.price),
    sales_price: customSalesPrice,
    cost: num(product?.cost ?? props.cost),
    stock: num(product?.live_stock ?? product?.stock ?? props.stock),
    live_stock: num(product?.live_stock ?? product?.stock ?? props.stock),
    min_stock: num(product?.min_stock ?? props.min_stock),
    max_stock: num(product?.max_stock ?? props.max_stock),
    tax_rate: num(product?.tax_rate ?? props.tax_rate, 14),
    unit: product?.unit ?? props.unit ?? "قطعة",
    brand: product?.brand ?? props.brand ?? "",
    code: product?.code ?? props.code ?? "",
    barcode: product?.barcode ?? props.barcode ?? "",
    business_profile: (product?.business_profile ?? props.business_profile ?? "general") as BusinessProfile,
    item_type: (product?.item_type ?? props.item_type ?? "sale") as ProductKind,
    is_active: boolValue(product?.is_active ?? props.is_active, true),
    show_in_pos: showInPos,
    is_available_in_pos: showInPos,
    show_in_sales: showInSales,
    is_available_in_sales: showInSales,
    is_favorite: boolValue(product?.is_favorite ?? props.is_favorite, false),
    allow_discount: boolValue(product?.allow_discount ?? props.allow_discount, true),
    track_inventory: boolValue(product?.track_inventory ?? props.track_inventory, true),
    preparation_time: num(product?.preparation_time ?? props.preparation_time),
    kitchen_station: product?.kitchen_station ?? props.kitchen_station ?? "",
    size_label: product?.size_label ?? props.size_label ?? "",
    color: product?.color ?? props.color ?? "",
    material: product?.material ?? props.material ?? "",
    supplier: product?.supplier ?? props.supplier ?? "",
    shelf_life_days: num(product?.shelf_life_days ?? props.shelf_life_days),
    display_order: num(product?.display_order ?? props.display_order),
  };
};

const normalizeCategory = (category: any): CategoryRecord => ({
  ...category,
  parent_id: category?.parent_id ? Number(category.parent_id) : null,
  is_active: boolValue(category?.is_active, true),
  show_in_pos: boolValue(category?.show_in_pos, true),
  color: category?.color || "#2563eb",
  icon: category?.icon || "package",
  sort_order: num(category?.sort_order),
});

const getIconById = (iconId?: string) => {
  const found = CATEGORY_ICONS.find((item) => item.id === iconId);
  return found?.icon || Package;
};

const ProductStatusBadge = ({ product }: { product: ProductRecord }) => {
  const active = product.is_active !== false;
  const inPos = product.show_in_pos !== false && product.is_available_in_pos !== false;
  const inSales = product.show_in_sales === true || product.is_available_in_sales === true;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          {active ? "نشط" : "موقوف"}
        </span>
        {inPos && inSales ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
            POS + المبيعات
          </span>
        ) : inPos ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-700 border border-blue-200">
            POS فقط
          </span>
        ) : inSales ? (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-700 border border-purple-200">
            المبيعات فقط
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
            غير متاح للبيع
          </span>
        )}
      </div>
      {product.sales_price !== undefined && product.sales_price !== null && Number(product.sales_price) > 0 && (
        <span className="text-[9px] font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
          سعر المبيعات: {Number(product.sales_price).toFixed(2)} ج.م
        </span>
      )}
    </div>
  );
};

export const Products: React.FC<ProductsProps> = ({
  onBack,
  onRefresh,
  initialTab,
  initialCategories,
  initialProducts,
}) => {
  const { canEdit, canDelete } = useAuth();
  const cachedSnapshot = useMemo(() => readStoredProductsCache(), []);

  const [activeTab, setActiveTab] = useState<"products" | "categories" | "ingredients">(initialTab || "products");
  const [categories, setCategories] = useState<CategoryRecord[]>(() => {
    if (cachedSnapshot?.categories?.length) return cachedSnapshot.categories;
    if (initialCategories?.length) return initialCategories.map(normalizeCategory);
    return [];
  });
  const [products, setProducts] = useState<ProductRecord[]>(() => {
    if (cachedSnapshot?.products?.length) return cachedSnapshot.products;
    if (initialProducts?.length) return initialProducts.map(normalizeProduct);
    return [];
  });
  const [ingredients, setIngredients] = useState<IngredientRecord[]>(() => cachedSnapshot?.ingredients || []);
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>(() => cachedSnapshot?.warehouses || []);
  const [loading, setLoading] = useState<boolean>(() => {
    const hasInitial = (cachedSnapshot?.products && cachedSnapshot.products.length > 0) || (initialProducts && initialProducts.length > 0);
    return !hasInitial;
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [profileFilter, setProfileFilter] = useState<BusinessProfile | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "hidden_pos" | "low_stock">("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [importingExcel, setImportingExcel] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [showImportResult, setShowImportResult] = useState(false);

  const [showProductModal, setShowProductModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<ProductRecord> | null>(null);
  const [editingCategory, setEditingCategory] = useState<Partial<CategoryRecord> | null>(null);
  const [editingIngredient, setEditingIngredient] = useState<Partial<IngredientRecord> | null>(null);

  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingIngredient, setIsSavingIngredient] = useState(false);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (categories.length === 0 && initialCategories && initialCategories.length > 0) {
      setCategories(initialCategories.map(normalizeCategory));
    }
    if (products.length === 0 && initialProducts && initialProducts.length > 0) {
      setProducts(initialProducts.map(normalizeProduct));
      setLoading(false);
    }
  }, [initialCategories, initialProducts]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (retries = 2, forceRefresh = false) => {
    const hasExistingData = products.length > 0 || categories.length > 0;
    if (!hasExistingData) {
      setLoading(true);
    }
    try {
      const qs = forceRefresh ? "?refresh=1" : "";
      const [posRes, ingRes, whRes] = await Promise.all([
        api.get(`/api/products/manage-data${qs}`),
        api.get(`/api/ingredients${qs}`),
        api.get("/api/inventory/warehouses"),
      ]);

      if (!posRes.ok) throw new Error("Failed to fetch POS data");

      const posData = await posRes.json();
      const ingData = ingRes.ok ? await ingRes.json() : [];
      const whData = whRes.ok ? await whRes.json() : [];

      const nextCategories = Array.isArray(posData.categories) ? posData.categories.map(normalizeCategory) : [];
      const nextProducts = Array.isArray(posData.products) ? posData.products.map(normalizeProduct) : [];
      const nextIngredients = Array.isArray(ingData) ? ingData : [];
      const nextWarehouses = Array.isArray(whData) ? whData : [];

      setCategories(nextCategories);
      setProducts(nextProducts);
      setIngredients(nextIngredients);
      setWarehouses(nextWarehouses);

      writeStoredProductsCache({
        categories: nextCategories,
        products: nextProducts,
        ingredients: nextIngredients,
        warehouses: nextWarehouses,
      });
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchData(retries - 1, forceRefresh), 600);
        return;
      }
      console.error("Failed to fetch products data", error);
    } finally {
      setLoading(false);
    }
  };

  const categoryChildren = useMemo(() => {
    const map = new Map<number | null, CategoryRecord[]>();
    categories.forEach((category) => {
      const key = category.parent_id ?? null;
      const list = map.get(key) || [];
      list.push(category);
      map.set(key, list);
    });
    map.forEach((list) => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || a.name.localeCompare(b.name, "ar")));
    return map;
  }, [categories]);

  const mainCategories = categoryChildren.get(null) || [];
  const subCategoriesCount = categories.filter((category) => !!category.parent_id).length;
  const mainCategoriesCount = categories.length - subCategoriesCount;

  const getDescendantIds = (categoryId: number): number[] => {
    const children = categoryChildren.get(categoryId) || [];
    return children.reduce<number[]>((acc, child) => [...acc, child.id, ...getDescendantIds(child.id)], []);
  };

  const isDescendantCategory = (candidateParentId?: number | null, categoryId?: number) => {
    if (!candidateParentId || !categoryId) return false;
    return getDescendantIds(categoryId).includes(candidateParentId);
  };

  const categoryPath = (categoryId?: number) => {
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return "-";
    const parent = category.parent_id ? categories.find((item) => item.id === category.parent_id) : null;
    return parent ? `${parent.name} / ${category.name}` : category.name;
  };

  const selectedCategoryIds = useMemo(() => {
    if (selectedCategoryId === "all") return [];
    return [selectedCategoryId, ...getDescendantIds(selectedCategoryId)];
  }, [selectedCategoryId, categories]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((product) => {
      const searchMatch =
        !q ||
        [product.name, product.code, product.barcode, product.brand, product.unit, categoryPath(product.category_id)]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const categoryMatch = selectedCategoryId === "all" || selectedCategoryIds.includes(product.category_id);
      const profileMatch = profileFilter === "all" || product.business_profile === profileFilter;

      const statusMatch =
        statusFilter === "all" ||
        (statusFilter === "active" && product.is_active !== false) ||
        (statusFilter === "inactive" && product.is_active === false) ||
        (statusFilter === "hidden_pos" && product.show_in_pos === false) ||
        (statusFilter === "low_stock" && product.track_inventory !== false && num(product.stock) <= num(product.min_stock));

      return searchMatch && categoryMatch && profileMatch && statusMatch;
    });
  }, [products, searchQuery, selectedCategoryId, selectedCategoryIds, profileFilter, statusFilter, categories]);

  const filteredCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((category) => {
      const parent = category.parent_id ? categories.find((item) => item.id === category.parent_id)?.name : "";
      return `${category.name} ${parent} ${category.description || ""}`.toLowerCase().includes(q);
    });
  }, [categories, categorySearch]);

  const stats = useMemo(() => {
    const activeProducts = products.filter((p) => p.is_active !== false).length;
    const hiddenProducts = products.filter((p) => p.show_in_pos === false).length;
    const lowStock = products.filter((p) => p.track_inventory !== false && num(p.stock) <= num(p.min_stock)).length;
    const inventoryValue = products.reduce((sum, p) => sum + num(p.stock) * num(p.cost || p.price), 0);
    return { activeProducts, hiddenProducts, lowStock, inventoryValue };
  }, [products]);

  const addProduct = (patch: Partial<ProductRecord> = {}) => {
    setEditingProduct({
      ...DEFAULT_PRODUCT,
      category_id: selectedCategoryId !== "all" ? selectedCategoryId : categories[0]?.id || 0,
      ...patch,
      ingredients: patch.ingredients || [],
      sizes: patch.sizes || [],
    });
    setShowProductModal(true);
  };

  const addCategory = (parentId?: number | null) => {
    setEditingCategory({
      name: "",
      parent_id: parentId || null,
      is_active: true,
      show_in_pos: true,
      color: CATEGORY_COLORS[0],
      icon: "package",
      sort_order: categories.length + 1,
    });
    setShowCategoryModal(true);
  };

  const buildProductPayload = (product: Partial<ProductRecord>) => {
    const existingProps = parseProperties(product.properties);
    const resolvedIngId = product.ingredient_id ? Number(product.ingredient_id) : (existingProps.ingredient_id ? Number(existingProps.ingredient_id) : undefined);
    const showInPos = product.show_in_pos !== false && product.is_available_in_pos !== false;
    const showInSales = product.show_in_sales === true || product.is_available_in_sales === true;
    const salesPrice = product.sales_price !== undefined && product.sales_price !== null && product.sales_price !== ("" as any)
      ? num(product.sales_price)
      : null;

    const finalProps = {
      ...existingProps,
      ingredient_id: resolvedIngId,
      business_profile: product.business_profile || "general",
      item_type: product.item_type || "sale",
      unit: product.unit || "قطعة",
      brand: product.brand || "",
      code: product.code || "",
      barcode: product.barcode || "",
      cost: num(product.cost),
      stock: num(product.stock),
      min_stock: num(product.min_stock),
      max_stock: num(product.max_stock),
      tax_rate: num(product.tax_rate, 14),
      preparation_time: num(product.preparation_time),
      kitchen_station: product.kitchen_station || "",
      size_label: product.size_label || "",
      color: product.color || "",
      material: product.material || "",
      supplier: product.supplier || "",
      shelf_life_days: num(product.shelf_life_days),
      allow_discount: product.allow_discount !== false,
      track_inventory: product.track_inventory !== false,
      show_in_pos: showInPos,
      is_available_in_pos: showInPos,
      show_in_sales: showInSales,
      is_available_in_sales: showInSales,
      sales_price: salesPrice,
      is_active: product.is_active !== false,
      is_favorite: !!product.is_favorite,
      display_order: num(product.display_order),
    };

    return {
      ...product,
      ...finalProps,
      ingredient_id: resolvedIngId,
      master_item_id: resolvedIngId,
      price: num(product.price),
      sales_price: salesPrice,
      show_in_pos: showInPos,
      is_available_in_pos: showInPos,
      show_in_sales: showInSales,
      is_available_in_sales: showInSales,
      category_id: Number(product.category_id),
      properties: finalProps,
    };
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingProduct || !editingProduct?.name || !editingProduct?.category_id) return;

    const finalPrice = editingProduct.sizes?.length ? num(editingProduct.sizes[0].price) : num(editingProduct.price);
    const payload = buildProductPayload({ ...editingProduct, price: finalPrice });

    setIsSavingProduct(true);
    try {
      const url = editingProduct.id ? `/api/products/${editingProduct.id}` : "/api/products";
      const res = editingProduct.id ? await api.put(url, payload) : await api.post(url, payload);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }
      setShowProductModal(false);
      setShowRecipeModal(false);
      setEditingProduct(null);
      fetchData(2, true);
      onRefresh();
    } catch (error: any) {
      console.error("Failed to save product", error);
      alert(`فشل حفظ المنتج: ${error.message}`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingCategory || !editingCategory?.name) return;

    if (editingCategory.id && editingCategory.parent_id === editingCategory.id) {
      alert("لا يمكن جعل القسم تابعاً لنفسه.");
      return;
    }

    if (editingCategory.id && isDescendantCategory(editingCategory.parent_id, editingCategory.id)) {
      alert("لا يمكن نقل القسم داخل قسم فرعي تابع له حتى لا تتكون حلقة في شجرة الأقسام.");
      return;
    }

    setIsSavingCategory(true);
    try {
      const url = editingCategory.id ? `/api/categories/${editingCategory.id}` : "/api/categories";
      const categoryPayload = {
        name: editingCategory.name,
        printer_id: editingCategory.printer_id || null,
        parent_id: editingCategory.parent_id || null,
        color: editingCategory.color || "#2563eb",
        icon: editingCategory.icon || "package",
        description: editingCategory.description || "",
        sort_order: num(editingCategory.sort_order),
        is_active: editingCategory.is_active !== false,
        show_in_pos: editingCategory.show_in_pos !== false,
      };
      const res = editingCategory.id ? await api.put(url, categoryPayload) : await api.post(url, categoryPayload);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }
      setShowCategoryModal(false);
      setEditingCategory(null);
      fetchData(2, true);
      onRefresh();
    } catch (error: any) {
      console.error("Failed to save category", error);
      alert(`فشل حفظ القسم: ${error.message}`);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleSaveIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingIngredient || !editingIngredient?.name || !editingIngredient?.unit) return;

    setIsSavingIngredient(true);
    try {
      const url = editingIngredient.id ? `/api/ingredients/${editingIngredient.id}` : "/api/ingredients";
      const res = editingIngredient.id ? await api.put(url, editingIngredient) : await api.post(url, editingIngredient);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }
      setShowIngredientModal(false);
      setEditingIngredient(null);
      fetchData(2, true);
    } catch (error: any) {
      console.error("Failed to save ingredient", error);
      alert(`فشل حفظ الصنف المخزني: ${error.message}`);
    } finally {
      setIsSavingIngredient(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف/إيقاف هذا المنتج؟")) return;
    try {
      const res = await api.delete(`/api/products/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.message) alert(data.message);
      fetchData(2, true);
      onRefresh();
    } catch (error: any) {
      alert(`فشل حذف المنتج: ${error.message}`);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const childCount = getDescendantIds(id).length;
    const message = childCount
      ? `هذا القسم يحتوي على ${childCount} قسم فرعي. هل تريد المتابعة؟`
      : "هل أنت متأكد من حذف/إيقاف هذا القسم؟";
    if (!confirm(message)) return;

    try {
      const res = await api.delete(`/api/categories/${id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.message) alert(data.message);
      if (selectedCategoryId === id) setSelectedCategoryId("all");
      fetchData(2, true);
      onRefresh();
    } catch (error: any) {
      alert(`فشل حذف القسم: ${error.message}`);
    }
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const extension = file.name.toLowerCase().split(".").pop();
    if (!extension || !["xlsx", "xls"].includes(extension)) {
      setImportResult({
        success: false,
        title: "فشل استيراد Excel",
        error: "الملف غير مدعوم. يجب اختيار ملف Excel بصيغة .xlsx أو .xls."
      });
      setShowImportResult(true);
      return;
    }

    setImportingExcel(true);
    setShowImportResult(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await authFetch("/api/products/import-excel", {
        method: "POST",
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportResult({
          success: false,
          title: "فشل استيراد الأصناف",
          error: data.message || data.error || "حدث خطأ غير معروف أثناء قراءة ملف Excel.",
          details: data.details || [],
          headers: data.headers || []
        });
        setShowImportResult(true);
        return;
      }

      setImportResult(data);
      setShowImportResult(true);
      await fetchData(2, true);
      onRefresh();
    } catch (error: any) {
      setImportResult({
        success: false,
        title: "فشل استيراد الأصناف",
        error: error?.message || "تعذر الاتصال بالسيرفر أثناء استيراد ملف Excel."
      });
      setShowImportResult(true);
    } finally {
      setImportingExcel(false);
    }
  };

  const handleDeleteIngredient = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الصنف المخزني؟")) return;
    try {
      const res = await api.delete(`/api/ingredients/${id}`);
      if (!res.ok) throw new Error("Failed");
      fetchData(2, true);
    } catch {
      alert("فشل حذف الصنف المخزني.");
    }
  };

  const duplicateProduct = (product: ProductRecord) => {
    const copy = normalizeProduct({
      ...product,
      id: undefined,
      name: `${product.name} - نسخة`,
      code: product.code ? `${product.code}-COPY` : "",
      barcode: "",
      is_active: true,
    });
    addProduct(copy);
  };

  const renderCategoryNode = (category: CategoryRecord, level = 0) => {
    if (categorySearch && !filteredCategories.some((item) => item.id === category.id || item.parent_id === category.id)) return null;
    const children = categoryChildren.get(category.id) || [];
    const Icon = getIconById(category.icon);
    const productCount = products.filter((product) => product.category_id === category.id).length;
    const totalCount = products.filter((product) => [category.id, ...getDescendantIds(category.id)].includes(product.category_id)).length;
    const selected = selectedCategoryId === category.id;

    return (
      <div key={category.id} className="space-y-1">
        <div
          className={`group rounded-xl border transition-all ${selected ? "bg-blue-50 border-blue-200 shadow-sm" : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100"}`}
          style={{ marginRight: level * 14 }}
        >
          <button
            onClick={() => setSelectedCategoryId(category.id)}
            className="w-full flex items-center justify-between gap-2 p-2.5 text-right"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: category.color || "#2563eb" }}>
                <Icon className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className={`font-black text-sm truncate ${selected ? "text-blue-800" : "text-slate-800"}`}>{category.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{children.length ? `${children.length} فرعي` : "قسم نهائي"} · {totalCount} منتج</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!category.show_in_pos && <EyeOff className="w-3.5 h-3.5 text-amber-500" />}
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-black">{productCount}</span>
            </div>
          </button>
          <div className="hidden group-hover:flex gap-1 px-2 pb-2">
            <button onClick={() => addCategory(category.id)} className="flex-1 text-[10px] font-bold rounded-lg bg-blue-50 text-blue-700 py-1 hover:bg-blue-100">فرعي</button>
            {canEdit() && (
              <button onClick={() => { setEditingCategory(category); setShowCategoryModal(true); }} className="px-2 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete() && (
              <button onClick={() => handleDeleteCategory(category.id)} className="px-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {children.map((child) => renderCategoryNode(child, level + 1))}
      </div>
    );
  };

  const pageTitle = activeTab === "products" ? "إدارة المنتجات المتقدمة" : activeTab === "categories" ? "إدارة الأقسام والشجرة" : "الأصناف المخزنية والمكونات";

  return (
    <div className="h-full min-h-screen bg-[#f4f7fa] flex flex-col font-sans" dir="rtl">
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <FolderTree className="w-7 h-7 text-blue-700" />
              {pageTitle}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              نفس منطق شاشة المبيعات: أقسام رئيسية، أقسام فرعية، منتجات، باركود، مخزون، وصفات، وتهيئة حسب النشاط.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => fetchData(2, true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors font-bold shadow-sm">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            تحديث
          </button>
          <label className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors font-bold shadow-sm cursor-pointer ${importingExcel ? "opacity-60 pointer-events-none" : ""}`}>
            {importingExcel ? <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" /> : <Upload className="w-4 h-4 text-green-600" />}
            {importingExcel ? "جاري الاستيراد..." : "استيراد Excel"}
            <input type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={handleExcelImport} disabled={importingExcel} />
          </label>
          <button
            type="button"
            onClick={() => {
              try {
                const worksheet = XLSX.utils.aoa_to_sheet([["الصنف"], ["مثال صنف 1"], ["مثال صنف 2"]]);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "الأصناف");
                const fname = "نموذج_استيراد_الأصناف.xlsx";
                try {
                  XLSX.writeFile(workbook, fname);
                } catch {
                  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
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
                console.error("Template download error", e);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-700 rounded-xl transition-colors font-bold shadow-sm"
          >
            <Download className="w-4 h-4" />
            نموذج Excel
          </button>
          {canEdit() && (
            <button
              onClick={() => {
                if (activeTab === "products") addProduct();
                else if (activeTab === "categories") addCategory();
                else {
                  setEditingIngredient({ name: "", unit: "قطعة", cost: 0, current_stock: 0, min_stock: 0 });
                  setShowIngredientModal(true);
                }
              }}
              className="flex items-center gap-2 px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl transition-colors font-black shadow-md shadow-blue-700/20"
            >
              <Plus className="w-5 h-5" />
              <span>{activeTab === "products" ? "منتج جديد" : activeTab === "categories" ? "قسم جديد" : "صنف مخزني جديد"}</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">إجمالي المنتجات</p>
            <h3 className="text-2xl font-black text-slate-800">{products.length}</h3>
            <span className="text-[10px] text-slate-400 font-bold">{stats.activeProducts} منتج نشط</span>
          </div>
          <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">الأقسام الرئيسية</p>
            <h3 className="text-2xl font-black text-slate-800">{mainCategoriesCount}</h3>
            <span className="text-[10px] text-slate-400 font-bold">مطابقة لقائمة POS</span>
          </div>
          <div className="w-11 h-11 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
            <Folder className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">الأقسام الفرعية</p>
            <h3 className="text-2xl font-black text-slate-800">{subCategoriesCount}</h3>
            <span className="text-[10px] text-slate-400 font-bold">تظهر تحت القسم المختار</span>
          </div>
          <div className="w-11 h-11 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">منخفضة المخزون</p>
            <h3 className="text-2xl font-black text-slate-800">{stats.lowStock}</h3>
            <span className="text-[10px] text-slate-400 font-bold">تحتاج متابعة</span>
          </div>
          <div className="w-11 h-11 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">مخفية من البيع</p>
            <h3 className="text-2xl font-black text-slate-800">{stats.hiddenProducts}</h3>
            <span className="text-[10px] text-slate-400 font-bold">لا تظهر في POS</span>
          </div>
          <div className="w-11 h-11 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center">
            <EyeOff className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500 font-bold mb-1">قيمة المخزون</p>
            <h3 className="text-xl font-black text-slate-800">{stats.inventoryValue.toFixed(2)}</h3>
            <span className="text-[10px] text-slate-400 font-bold">تكلفة تقريبية</span>
          </div>
          <div className="w-11 h-11 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden px-6 pb-6 gap-6">
        <aside className="w-80 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-slate-900 flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-blue-700" />
                شجرة الأقسام
              </h3>
              <button onClick={() => addCategory()} className="text-blue-700 hover:bg-blue-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-black">
                <Plus className="w-3 h-3" /> رئيسي
              </button>
            </div>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={categorySearch ?? ""}
                onChange={(e) => setCategorySearch(e.target.value)}
                type="text"
                placeholder="ابحث عن قسم أو قسم فرعي..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>
          <div className="p-3 overflow-y-auto flex-1 space-y-1">
            <button
              onClick={() => setSelectedCategoryId("all")}
              className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-black transition-colors ${selectedCategoryId === "all" ? "bg-blue-700 text-white shadow-sm" : "hover:bg-slate-50 text-slate-700"}`}
            >
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                <span>كل الأقسام والمنتجات</span>
              </div>
              <span className={`px-2 py-0.5 rounded-md text-xs ${selectedCategoryId === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{products.length}</span>
            </button>
            {mainCategories.map((category) => renderCategoryNode(category))}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-100">
            <div className="rounded-2xl bg-white border border-slate-200 p-3">
              <p className="text-xs font-black text-slate-700 mb-1">تلميح مهم</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                أي قسم فرعي تضيفه هنا سيظهر في شاشة المبيعات تحت القسم الرئيسي، والمنتجات التابعة له ستدخل في نفس فلتر الـ POS.
              </p>
            </div>
          </div>
        </aside>

        <main className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="flex items-center gap-6 px-6 border-b border-slate-100">
            {[
              { id: "products", label: "المنتجات", icon: Package },
              { id: "categories", label: "الأقسام", icon: FolderTree },
              { id: "ingredients", label: "المقادير والمخزون", icon: Boxes },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 border-b-2 font-black text-sm transition-colors flex items-center gap-2 ${activeTab === tab.id ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={profileFilter ?? ""}
                onChange={(e) => setProfileFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">كل الأنشطة</option>
                {Object.entries(BUSINESS_PROFILES).map(([key, profile]) => (
                  <option key={key} value={key}>{profile.label}</option>
                ))}
              </select>
              <select
                value={statusFilter ?? ""}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none"
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشط فقط</option>
                <option value="inactive">موقوف</option>
                <option value="hidden_pos">مخفي من POS</option>
                <option value="low_stock">منخفض المخزون</option>
              </select>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-sm hover:bg-blue-100 transition-colors">
                <Filter className="w-4 h-4" />
                فلاتر متقدمة
              </button>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث بالاسم، الباركود، الكود، البراند..."
                  value={searchQuery ?? ""}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-80 bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-9 pl-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="bg-slate-100 rounded-xl p-1 flex">
                <button onClick={() => setViewMode("table")} className={`p-2 rounded-lg ${viewMode === "table" ? "bg-white shadow-sm text-blue-700" : "text-slate-500"}`}>
                  <List className="w-4 h-4" />
                </button>
                <button onClick={() => setViewMode("grid")} className={`p-2 rounded-lg ${viewMode === "grid" ? "bg-white shadow-sm text-blue-700" : "text-slate-500"}`}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center text-slate-500 font-bold">
                جاري تحميل بيانات الأصناف...
              </div>
            ) : activeTab === "products" ? (
              viewMode === "table" ? (
                <table className="w-full text-right min-w-[800px]">
                  <thead className="bg-slate-50 text-slate-500 text-xs sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-4 font-black">المنتج</th>
                      <th className="px-6 py-4 font-black">القسم</th>
                      <th className="px-6 py-4 font-black">الكود / الباركود</th>
                      <th className="px-6 py-4 font-black">النشاط</th>
                      <th className="px-6 py-4 font-black">السعر (POS / المبيعات)</th>
                      <th className="px-6 py-4 font-black">المخزون</th>
                      <th className="px-6 py-4 font-black">الحالة</th>
                      <th className="px-6 py-4 font-black">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.map((product) => {
                      const profile = BUSINESS_PROFILES[product.business_profile || "general"];
                      return (
                        <tr key={product.id} className="hover:bg-slate-50/60 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <Package className="w-5 h-5 text-slate-400" />}
                              </div>
                              <div>
                                <p className="font-black text-slate-900">{product.name}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold">
                                    {warehouses.find((w) => w.id === product.warehouse_id)?.name || "المخزن الافتراضي"}
                                  </span>
                                  {product.ingredient_id && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-black flex items-center gap-1">
                                      <Boxes className="w-3 h-3" />
                                      صنف مخزني: {ingredients.find(i => i.id === product.ingredient_id)?.name || product.master_item_name || `#${product.ingredient_id}`}
                                    </span>
                                  )}
                                  {product.ingredients && product.ingredients.length > 1 && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                                      {product.ingredients.length} مقادير
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">{PRODUCT_KIND_LABELS[product.item_type || "sale"]} · {product.brand || "بدون براند"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-bold text-sm">{categoryPath(product.category_id)}</td>
                          <td className="px-6 py-4">
                            <div className="font-mono text-xs text-slate-600">{product.code || "-"}</div>
                            <div className="font-mono text-xs text-slate-400">{product.barcode || "بدون باركود"}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-black">
                              {profile.icon}
                              {profile.label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-400 font-bold">POS:</span>
                                <span className="font-black text-slate-900">{num(product.price).toFixed(2)} ج.م</span>
                              </div>
                              {product.sales_price !== undefined && product.sales_price !== null && Number(product.sales_price) > 0 ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-purple-600 font-bold">المبيعات:</span>
                                  <span className="font-black text-purple-700">{num(product.sales_price).toFixed(2)} ج.م</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400">
                                  المبيعات: نفس POS
                                </div>
                              )}
                              <p className="text-[10px] text-slate-400">تكلفة: {num(product.cost).toFixed(2)} ج.م</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className={`font-black ${num(product.stock) <= num(product.min_stock) ? "text-red-600" : "text-slate-800"}`}>{num(product.stock)} {product.unit}</p>
                            <p className="text-[10px] text-slate-400">حد أدنى {num(product.min_stock)}</p>
                          </td>
                          <td className="px-6 py-4"><ProductStatusBadge product={product} /></td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingProduct(product); setShowRecipeModal(true); }}
                                className="px-2.5 py-1.5 text-xs font-black bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                title="تحديد المقادير وربط المخزن"
                              >
                                <Boxes className="w-3.5 h-3.5" />
                                <span>المقادير والمخزن</span>
                              </button>
                              {canEdit() && (
                                <>
                                  <button onClick={() => { setEditingProduct(product); setShowProductModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" title="تعديل الكامل">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={() => duplicateProduct(product)} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer" title="نسخ">
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {canDelete() && (
                                <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" title="حذف">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-5">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                      <div className="h-36 bg-slate-100 relative">
                        {product.image ? <img src={product.image} alt={product.name} className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center"><ImageIcon className="w-10 h-10 text-slate-300" /></div>}
                        <div className="absolute top-3 right-3"><ProductStatusBadge product={product} /></div>
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-black text-lg text-slate-900">{product.name}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold">
                                {warehouses.find((w) => w.id === product.warehouse_id)?.name || "المخزن الرئيسي"}
                              </span>
                              {product.ingredients && product.ingredients.length > 0 && (
                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold">
                                  {product.ingredients.length} مكونات/مقادير
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{categoryPath(product.category_id)}</p>
                          </div>
                          <span className="font-black text-blue-700">{num(product.price).toFixed(2)}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-[10px] text-slate-400 font-bold">مخزون</p>
                            <p className="text-sm font-black">{num(product.stock)}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-[10px] text-slate-400 font-bold">وحدة</p>
                            <p className="text-sm font-black">{product.unit}</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2">
                            <p className="text-[10px] text-slate-400 font-bold">باركود</p>
                            <p className="text-sm font-black truncate">{product.barcode || "-"}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex gap-2">
                          <button
                            onClick={() => { setEditingProduct(product); setShowRecipeModal(true); }}
                            className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-black text-xs hover:bg-emerald-100 flex items-center justify-center gap-1.5 cursor-pointer"
                            title="تحديد المقادير وربط المخزن"
                          >
                            <Boxes className="w-4 h-4" />
                            <span>المقادير والمخزن</span>
                          </button>
                          <button onClick={() => { setEditingProduct(product); setShowProductModal(true); }} className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-700 font-black text-sm hover:bg-blue-100 cursor-pointer">تعديل</button>
                          <button onClick={() => duplicateProduct(product)} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer"><Copy className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : activeTab === "categories" ? (
              <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-5">
                {categories.map((category) => {
                  const Icon = getIconById(category.icon);
                  const children = categoryChildren.get(category.id) || [];
                  const parent = category.parent_id ? categories.find((item) => item.id === category.parent_id) : null;
                  return (
                    <div key={category.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl text-white flex items-center justify-center" style={{ background: category.color || "#2563eb" }}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-black text-lg text-slate-900">{category.name}</h3>
                            <p className="text-xs text-slate-500">{parent ? `فرعي من: ${parent.name}` : "قسم رئيسي"} · {children.length} أقسام فرعية</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {category.show_in_pos !== false ? <Eye className="w-4 h-4 text-blue-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                          {category.is_active !== false ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed mt-4 min-h-[40px]">{category.description || "لا يوجد وصف للقسم."}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-black">{products.filter((p) => p.category_id === category.id).length} منتج مباشر</span>
                        <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">{products.filter((p) => [category.id, ...getDescendantIds(category.id)].includes(p.category_id)).length} بإجمالي الفروع</span>
                      </div>
                      <div className="mt-5 flex gap-2">
                        <button onClick={() => addCategory(category.id)} className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-700 font-black text-sm hover:bg-blue-100 flex items-center justify-center gap-2">
                          <PlusCircle className="w-4 h-4" /> قسم فرعي
                        </button>
                        <button onClick={() => addProduct({ category_id: category.id })} className="flex-1 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-black text-sm hover:bg-emerald-100 flex items-center justify-center gap-2">
                          <Package className="w-4 h-4" /> منتج
                        </button>
                        <button onClick={() => { setEditingCategory(category); setShowCategoryModal(true); }} className="px-3 py-2 rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="bg-white border border-slate-200 p-5 rounded-3xl shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="font-black text-slate-900">{ingredient.name}</h3>
                        <p className="text-xs text-slate-500">كود: {ingredient.item_code || ingredient.id}</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-black">{ingredient.unit}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-[10px] text-slate-400 font-bold">تكلفة</p>
                        <p className="text-sm font-black">{num(ingredient.cost).toFixed(2)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-[10px] text-slate-400 font-bold">حالي</p>
                        <p className="text-sm font-black">{num(ingredient.current_stock)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-2">
                        <p className="text-[10px] text-slate-400 font-bold">حد أدنى</p>
                        <p className="text-sm font-black">{num(ingredient.min_stock)}</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
                      {canEdit() && (
                        <button onClick={() => { setEditingIngredient(ingredient); setShowIngredientModal(true); }} className="p-2 hover:bg-slate-50 text-slate-500 hover:text-blue-600 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete() && (
                        <button onClick={() => handleDeleteIngredient(ingredient.id)} className="p-2 hover:bg-red-50 text-slate-500 hover:text-red-600 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500 font-bold bg-slate-50/50">
            <div>
              {activeTab === "products"
                ? `عرض ${filteredProducts.length} من ${products.length} منتج`
                : activeTab === "categories"
                  ? `${categories.length} قسم رئيسي وفرعي`
                  : `${ingredients.length} صنف مخزني`}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">&lt;</button>
              <button className="px-3 py-1 bg-blue-700 text-white rounded-lg shadow-sm shadow-blue-700/20">1</button>
              <button className="px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">&gt;</button>
            </div>
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showProductModal && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowProductModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl">
              <form onSubmit={handleSaveProduct}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{editingProduct.id ? "تعديل منتج" : "إضافة منتج جديد"}</h2>
                    <p className="text-xs text-slate-500 mt-1">كل الحقول المهمة للظهور في شاشة المبيعات والمخزون والإنتاج.</p>
                  </div>
                  <button type="button" onClick={() => setShowProductModal(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 max-h-[72vh] overflow-y-auto space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="lg:col-span-2 space-y-2">
                      <label className="text-sm text-slate-600 font-black">اسم المنتج *</label>
                      <input required value={editingProduct.name || ""} onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">القسم / القسم الفرعي *</label>
                      <select required value={editingProduct.category_id || ""} onChange={(e) => setEditingProduct({ ...editingProduct, category_id: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right">
                        <option value="">اختر القسم</option>
                        {categories.map((category, idx) => (
                          <option key={`cat-${category.id}-${idx}`} value={category.id}>{categoryPath(category.id)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">نوع النشاط</label>
                      <select value={editingProduct.business_profile || "general"} onChange={(e) => setEditingProduct({ ...editingProduct, business_profile: e.target.value as BusinessProfile })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right">
                        {Object.entries(BUSINESS_PROFILES).map(([key, profile]) => (
                          <option key={`biz-${key}`} value={key}>{profile.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">نوع المنتج</label>
                      <select value={editingProduct.item_type || "sale"} onChange={(e) => setEditingProduct({ ...editingProduct, item_type: e.target.value as ProductKind })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right">
                        {Object.entries(PRODUCT_KIND_LABELS).map(([key, label]) => <option key={`kind-${key}`} value={key}>{label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black flex items-center gap-1"><Tag className="w-4 h-4" /> SKU / كود</label>
                      <input value={editingProduct.code || ""} onChange={(e) => setEditingProduct({ ...editingProduct, code: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black flex items-center gap-1"><Barcode className="w-4 h-4" /> باركود</label>
                      <input value={editingProduct.barcode || ""} onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">الوحدة</label>
                      <input value={editingProduct.unit || ""} onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })} placeholder="قطعة / كيلو / لتر" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">البراند</label>
                      <input value={editingProduct.brand || ""} onChange={(e) => setEditingProduct({ ...editingProduct, brand: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
                    {[
                      { key: "price", label: "سعر البيع", step: "0.01" },
                      { key: "cost", label: "التكلفة", step: "0.01" },
                      { key: "tax_rate", label: "الضريبة %", step: "0.01" },
                      { key: "stock", label: "الرصيد", step: "0.01" },
                      { key: "min_stock", label: "حد أدنى", step: "0.01" },
                      { key: "max_stock", label: "حد أقصى", step: "0.01" },
                    ].map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="text-sm text-slate-600 font-black">{field.label}</label>
                        <input type="number" step={field.step} value={num((editingProduct as any)[field.key]) ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, [field.key]: Number(e.target.value) } as any)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                      </div>
                    ))}
                  </div>

                  {/* Master Item & Warehouse Linking Section */}
                  <div className="p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-indigo-950 font-black flex items-center gap-2">
                        <Boxes className="w-5 h-5 text-indigo-700" />
                        الصنف المخزني الرئيسي المرتبط (Master Inventory Item ID)
                      </label>
                      <span className="text-xs bg-indigo-100 text-indigo-800 font-black px-2.5 py-1 rounded-lg">
                        الربط الموحد للمخازن ونقاط البيع
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-700 font-bold">اختر صنف المخزن المرتبط (أو اترك لإنشاء/ربط تلقائي)</label>
                        <select
                          value={editingProduct.ingredient_id || ""}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : undefined;
                            const matchedIng = ingredients.find((i) => i.id === val);
                            setEditingProduct({
                              ...editingProduct,
                              ingredient_id: val,
                              unit: matchedIng ? matchedIng.unit : editingProduct.unit,
                              cost: matchedIng && matchedIng.cost ? Number(matchedIng.cost) : editingProduct.cost,
                            });
                          }}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900 text-right"
                        >
                          <option value="">(ربط تلقائي بالصنف المخزني المطابق أو إنشاؤه)</option>
                          {ingredients.map((ing, idx) => (
                            <option key={`master-ing-${ing.id}-${idx}`} value={ing.id}>
                              {ing.name} (رصيد: {num(ing.current_stock)} {ing.unit} | تكلفة: {num(ing.cost)} ج.م)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs text-slate-700 font-bold">مخزن الخصم المباشر عند البيع</label>
                        <select
                          value={editingProduct.warehouse_id || ""}
                          onChange={(e) => setEditingProduct({ ...editingProduct, warehouse_id: e.target.value ? Number(e.target.value) : undefined })}
                          className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-900 text-right"
                        >
                          <option value="">المخزن الافتراضي للفرع / المخزن الرئيسي</option>
                          {warehouses.map((warehouse, idx) => (
                            <option key={`wh-modal-${warehouse.id}-${idx}`} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {editingProduct.ingredient_id && (
                      <div className="bg-white/80 rounded-xl p-3 border border-indigo-100 flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-bold">
                          المخزون المتوفر للصنف المخزني المربوط:{" "}
                          <strong className="text-indigo-700 font-black">
                            {num(ingredients.find(i => i.id === editingProduct.ingredient_id)?.current_stock)}{" "}
                            {ingredients.find(i => i.id === editingProduct.ingredient_id)?.unit}
                          </strong>
                        </span>
                        <span className="text-emerald-700 font-black">
                          ✓ مربوط بنجاح بالصنف المخزني #{editingProduct.ingredient_id}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">محطة المطبخ / خط الإنتاج</label>
                      <input value={editingProduct.kitchen_station || ""} onChange={(e) => setEditingProduct({ ...editingProduct, kitchen_station: e.target.value })} placeholder="مشويات / بيتزا / تقفيل..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">وقت التجهيز بالدقائق</label>
                      <input type="number" value={num(editingProduct.preparation_time) ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, preparation_time: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">المقاس / الحجم الافتراضي</label>
                      <input value={editingProduct.size_label || ""} onChange={(e) => setEditingProduct({ ...editingProduct, size_label: e.target.value })} placeholder="S / M / L أو صغير / كبير" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">اللون</label>
                      <input value={editingProduct.color || ""} onChange={(e) => setEditingProduct({ ...editingProduct, color: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">الخامة / المادة</label>
                      <input value={editingProduct.material || ""} onChange={(e) => setEditingProduct({ ...editingProduct, material: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">صلاحية بالأيام</label>
                      <input type="number" value={num(editingProduct.shelf_life_days) ?? ""} onChange={(e) => setEditingProduct({ ...editingProduct, shelf_life_days: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                  </div>

                  {/* Unified Channels & Product Sharing Architecture Section */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border-2 border-indigo-200/90 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Store className="w-5 h-5 text-indigo-700" />
                        <h4 className="text-sm text-indigo-950 font-black">
                          قنوات البيع والمشاركة الموحدة (POS & Sales Product Sharing)
                        </h4>
                      </div>
                      <span className="text-[11px] bg-indigo-600 text-white font-black px-3 py-1 rounded-full shadow-xs">
                        Product واحد مشترك بدون تكرار
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      يتم إنشاء المنتج مرة واحدة وربطه بالصنف المخزني، ومن هنا يتم تحديد الموديولات التي يتاح فيها المنتج وسعر البيع الخاص بكل موديول.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* POS Availability Toggle */}
                      <label className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        editingProduct.show_in_pos !== false && editingProduct.is_available_in_pos !== false
                          ? "bg-white border-blue-500 shadow-sm"
                          : "bg-slate-50 border-slate-200 opacity-80"
                      }`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">متاح في نقطة البيع (POS)</span>
                            {editingProduct.show_in_pos !== false && editingProduct.is_available_in_pos !== false ? (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded">مفعّل</span>
                            ) : (
                              <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded">معطّل</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            يظهر على شاشات الكاشير ونقاط البيع السريعة بسعر POS ({num(editingProduct.price).toFixed(2)} ج.م).
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={editingProduct.show_in_pos !== false && editingProduct.is_available_in_pos !== false}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              show_in_pos: e.target.checked,
                              is_available_in_pos: e.target.checked,
                            })
                          }
                          className="mt-1 h-5 w-5 accent-blue-600 rounded cursor-pointer"
                        />
                      </label>

                      {/* Sales Module Availability Toggle */}
                      <label className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        editingProduct.show_in_sales === true || editingProduct.is_available_in_sales === true
                          ? "bg-white border-purple-500 shadow-sm"
                          : "bg-slate-50 border-slate-200 opacity-80"
                      }`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900 text-sm">متاح في موديول المبيعات (Sales)</span>
                            {editingProduct.show_in_sales === true || editingProduct.is_available_in_sales === true ? (
                              <span className="text-[10px] bg-purple-100 text-purple-800 font-black px-2 py-0.5 rounded">مفعّل</span>
                            ) : (
                              <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded">معطّل</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            يظهر تلقائياً في أوامر البيع، عروض الأسعار، وفواتير المبيعات بدون إعادة إنشاء.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={editingProduct.show_in_sales === true || editingProduct.is_available_in_sales === true}
                          onChange={(e) =>
                            setEditingProduct({
                              ...editingProduct,
                              show_in_sales: e.target.checked,
                              is_available_in_sales: e.target.checked,
                            })
                          }
                          className="mt-1 h-5 w-5 accent-purple-600 rounded cursor-pointer"
                        />
                      </label>
                    </div>

                    {/* Distinct Sales Price Field */}
                    <div className="bg-white p-4 rounded-2xl border border-indigo-100 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <Tag className="w-4 h-4 text-purple-600" />
                          سعر البيع الخاص بموديول المبيعات (Sales Price) - اختياري
                        </label>
                        <span className="text-[10px] text-slate-400 font-medium">
                          إذا تُرك فارغاً أو (0) سيتم تطبيق سعر POS الافتراضي ({num(editingProduct.price).toFixed(2)} ج.م)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.01"
                            value={editingProduct.sales_price !== undefined && editingProduct.sales_price !== null ? editingProduct.sales_price : ""}
                            onChange={(e) =>
                              setEditingProduct({
                                ...editingProduct,
                                sales_price: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            placeholder={`سعر البيع بالمبيعات (الافتراضي: ${num(editingProduct.price).toFixed(2)})`}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-sm focus:outline-none focus:border-purple-500 text-slate-900 text-right"
                          />
                          <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">ج.م</span>
                        </div>
                        {editingProduct.sales_price !== undefined && editingProduct.sales_price !== null && Number(editingProduct.sales_price) > 0 && (
                          <button
                            type="button"
                            onClick={() => setEditingProduct({ ...editingProduct, sales_price: null })}
                            className="text-[11px] text-rose-600 hover:underline font-bold px-2 py-1"
                          >
                            إعادة لسعر POS
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Visual Status Result Table */}
                    <div className="bg-white/90 rounded-xl p-3 border border-indigo-100 text-[11px] flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-600 font-bold">
                        نتيجة تفعيل المنتج الحالية:
                      </span>
                      {(() => {
                        const inPos = editingProduct.show_in_pos !== false && editingProduct.is_available_in_pos !== false;
                        const inSales = editingProduct.show_in_sales === true || editingProduct.is_available_in_sales === true;
                        if (inPos && inSales) {
                          return (
                            <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                              ✓ يظهر في نقطة البيع (POS) وفي موديول المبيعات (Sales)
                            </span>
                          );
                        } else if (inPos) {
                          return (
                            <span className="font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                              • يظهر في نقطة البيع (POS) فقط
                            </span>
                          );
                        } else if (inSales) {
                          return (
                            <span className="font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                              • يظهر في موديول المبيعات (Sales) فقط
                            </span>
                          );
                        } else {
                          return (
                            <span className="font-black text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                              ✕ غير متاح للبيع (معطل في POS والمبيعات)
                            </span>
                          );
                        }
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {[
                      { key: "is_active", label: "المنتج نشط", desc: "إيقافه يمنع ظهوره واستخدامه بالكامل" },
                      { key: "is_favorite", label: "منتج مفضل", desc: "يظهر في تبويب المفضلة" },
                      { key: "track_inventory", label: "تتبع المخزون", desc: "ينبه عند انخفاض الرصيد" },
                      { key: "allow_discount", label: "يسمح بالخصم", desc: "قابل للخصومات اليدوية" },
                    ].map((toggle) => (
                      <label key={toggle.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-blue-200">
                        <div>
                          <p className="font-black text-slate-800 text-sm">{toggle.label}</p>
                          <p className="text-xs text-slate-500 mt-1">{toggle.desc}</p>
                        </div>
                        <input type="checkbox" checked={(editingProduct as any)[toggle.key] !== false} onChange={(e) => setEditingProduct({ ...editingProduct, [toggle.key]: e.target.checked } as any)} className="mt-1 h-5 w-5 accent-blue-700" />
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <label className="text-sm text-slate-600 font-black flex items-center gap-2"><ImageIcon className="w-4 h-4" /> صورة المنتج</label>
                    <div className="flex flex-col xl:flex-row gap-4">
                      <div className="w-28 h-28 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                        {editingProduct.image ? <img src={editingProduct.image} alt="preview" className="w-full h-full object-cover" /> : "معاينة"}
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex gap-2">
                          <input value={editingProduct.image || ""} onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })} placeholder="رابط الصورة URL..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 text-slate-900" />
                          <label className="cursor-pointer bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-center gap-1.5 font-black text-xs transition-colors">
                            <Upload className="w-4 h-4" />
                            رفع
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                try {
                                  const formData = new FormData();
                                  formData.append("file", file);
                                  const res = await fetch("/api/upload", { method: "POST", headers: authHeaders(), body: formData });
                                  if (res.ok) {
                                    const data = await res.json();
                                    setEditingProduct({ ...editingProduct, image: data.url });
                                  } else {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setEditingProduct({ ...editingProduct, image: reader.result as string });
                                    reader.readAsDataURL(file);
                                  }
                                } catch {
                                  const reader = new FileReader();
                                  reader.onloadend = () => setEditingProduct({ ...editingProduct, image: reader.result as string });
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                          {PRESET_IMAGES.map((img) => (
                            <button key={img.url} type="button" onClick={() => setEditingProduct({ ...editingProduct, image: img.url })} className="p-2 rounded-xl border border-slate-200 hover:border-blue-300 bg-white text-xs font-bold text-slate-600 flex items-center gap-2">
                              <img src={img.url} alt={img.name} className="w-8 h-8 rounded-lg object-cover" />
                              <span className="truncate">{img.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black flex items-center gap-2 text-slate-900">
                          <Package className="w-4 h-4 text-blue-700" />
                          أحجام / مقاسات وأسعار مختلفة
                        </h3>
                        <button
                          type="button"
                          onClick={() => setEditingProduct({
                            ...editingProduct,
                            sizes: [...(editingProduct.sizes || []), { product_id: editingProduct.id || 0, name: "", price: num(editingProduct.price) }],
                          })}
                          className="text-sm text-blue-700 flex items-center gap-1 hover:underline font-black"
                        >
                          <PlusCircle className="w-4 h-4" />
                          إضافة حجم
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(editingProduct.sizes || []).map((size: ProductSize, idx: number) => (
                          <div key={idx} className="grid grid-cols-[1fr_140px_42px] gap-3 items-end bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold">اسم الحجم / المقاس</label>
                              <input value={size.name ?? ""} onChange={(e) => {
                                const next = [...(editingProduct.sizes || [])];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setEditingProduct({ ...editingProduct, sizes: next });
                              }} placeholder="كبير / M / 1 كجم" className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold">السعر</label>
                              <input type="number" step="0.01" value={num(size.price) ?? ""} onChange={(e) => {
                                const next = [...(editingProduct.sizes || [])];
                                next[idx] = { ...next[idx], price: Number(e.target.value) };
                                setEditingProduct({ ...editingProduct, sizes: next });
                              }} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" />
                            </div>
                            <button type="button" onClick={() => setEditingProduct({ ...editingProduct, sizes: editingProduct.sizes?.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-black flex items-center gap-2 text-slate-900">
                          <Factory className="w-4 h-4 text-blue-700" />
                          المقادير / الوصفة / مكونات الإنتاج
                        </h3>
                        <button
                          type="button"
                          onClick={() => setEditingProduct({
                            ...editingProduct,
                            ingredients: [...(editingProduct.ingredients || []), { ingredient_id: 0, product_id: editingProduct.id || 0, quantity: 0 }],
                          })}
                          className="text-sm text-blue-700 flex items-center gap-1 hover:underline font-black"
                        >
                          <PlusCircle className="w-4 h-4" />
                          إضافة مكون
                        </button>
                      </div>
                      <div className="space-y-3">
                        {(editingProduct.ingredients || []).map((ing: ProductIngredient, idx: number) => (
                          <div key={idx} className="grid grid-cols-[1fr_120px_42px] gap-3 items-end bg-slate-50 p-3 rounded-2xl border border-slate-100">
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold">المكون</label>
                              <select value={ing.ingredient_id ?? ""} onChange={(e) => {
                                const next = [...(editingProduct.ingredients || [])];
                                next[idx] = { ...next[idx], ingredient_id: Number(e.target.value) };
                                setEditingProduct({ ...editingProduct, ingredients: next });
                              }} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900">
                                <option value={0}>اختر مكون</option>
                                {ingredients.map((ingredient, iIdx) => (
                                  <option key={`ing-prod-${ingredient.id}-${iIdx}`} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] text-slate-500 font-bold">الكمية</label>
                              <input type="number" step="0.01" value={num(ing.quantity) ?? ""} onChange={(e) => {
                                const next = [...(editingProduct.ingredients || [])];
                                next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                                setEditingProduct({ ...editingProduct, ingredients: next });
                              }} className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900" />
                            </div>
                            <button type="button" onClick={() => setEditingProduct({ ...editingProduct, ingredients: editingProduct.ingredients?.filter((_, i) => i !== idx) })} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSavingProduct}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-700/20 cursor-pointer"
                  >
                    {isSavingProduct ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span>جاري حفظ المنتج...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-5 h-5" />
                        <span>حفظ المنتج وربطه بالمبيعات</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingProduct}
                    onClick={() => setShowProductModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600 py-3 rounded-xl font-black transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCategoryModal && editingCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCategoryModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <form onSubmit={handleSaveCategory}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{editingCategory.id ? "تعديل قسم" : "إضافة قسم / قسم فرعي"}</h2>
                    <p className="text-xs text-slate-500 mt-1">الأقسام هنا هي نفس الأقسام التي تظهر في شاشة المبيعات.</p>
                  </div>
                  <button type="button" onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">اسم القسم *</label>
                      <input required value={editingCategory.name || ""} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">القسم الرئيسي</label>
                      <select value={editingCategory.parent_id || ""} onChange={(e) => setEditingCategory({ ...editingCategory, parent_id: e.target.value ? Number(e.target.value) : null })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right">
                        <option value="">قسم رئيسي</option>
                        {categories.filter((c) => c.id !== editingCategory.id && !getDescendantIds(editingCategory.id || -1).includes(c.id)).map((c, idx) => (
                          <option key={`pcat-${c.id}-${idx}`} value={c.id}>{categoryPath(c.id)}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 font-black">وصف مختصر</label>
                    <textarea value={editingCategory.description || ""} onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right resize-none" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">الأيقونة</label>
                      <select value={editingCategory.icon || "package"} onChange={(e) => setEditingCategory({ ...editingCategory, icon: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right">
                        {CATEGORY_ICONS.map((icon, idx) => <option key={`icon-${icon.id}-${idx}`} value={icon.id}>{icon.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">اللون</label>
                      <div className="flex gap-2 items-center">
                        <input type="color" value={editingCategory.color || CATEGORY_COLORS[0]} onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })} className="w-14 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1" />
                        <select value={editingCategory.color || CATEGORY_COLORS[0]} onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })} className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900">
                          {CATEGORY_COLORS.map((color, idx) => <option key={`col-${color}-${idx}`} value={color}>{color}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">ترتيب الظهور</label>
                      <input type="number" value={num(editingCategory.sort_order) ?? ""} onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-blue-200">
                      <div>
                        <p className="font-black text-slate-800 text-sm">القسم نشط</p>
                        <p className="text-xs text-slate-500 mt-1">إيقافه يمنع استخدامه في القوائم</p>
                      </div>
                      <input type="checkbox" checked={editingCategory.is_active !== false} onChange={(e) => setEditingCategory({ ...editingCategory, is_active: e.target.checked })} className="mt-1 h-5 w-5 accent-blue-700" />
                    </label>
                    <label className="rounded-2xl border border-slate-100 bg-slate-50 p-4 flex items-start justify-between gap-4 cursor-pointer hover:border-blue-200">
                      <div>
                        <p className="font-black text-slate-800 text-sm">يظهر في شاشة المبيعات</p>
                        <p className="text-xs text-slate-500 mt-1">يتحكم في ظهوره داخل POS</p>
                      </div>
                      <input type="checkbox" checked={editingCategory.show_in_pos !== false} onChange={(e) => setEditingCategory({ ...editingCategory, show_in_pos: e.target.checked })} className="mt-1 h-5 w-5 accent-blue-700" />
                    </label>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSavingCategory}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black transition-colors shadow-lg shadow-blue-700/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingCategory ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ القسم...</span>
                      </>
                    ) : (
                      "حفظ القسم"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingCategory}
                    onClick={() => setShowCategoryModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600 py-3 rounded-xl font-black transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showIngredientModal && editingIngredient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowIngredientModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
              <form onSubmit={handleSaveIngredient}>
                <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <h2 className="text-xl font-black text-slate-900">{editingIngredient.id ? "تعديل صنف مخزني" : "إضافة صنف مخزني"}</h2>
                  <button type="button" onClick={() => setShowIngredientModal(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600 font-black">اسم الصنف المخزني *</label>
                    <input required value={editingIngredient.name || ""} onChange={(e) => setEditingIngredient({ ...editingIngredient, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">الوحدة *</label>
                      <input required value={editingIngredient.unit || ""} onChange={(e) => setEditingIngredient({ ...editingIngredient, unit: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">التكلفة</label>
                      <input type="number" step="0.01" value={num(editingIngredient.cost) ?? ""} onChange={(e) => setEditingIngredient({ ...editingIngredient, cost: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">الرصيد الحالي</label>
                      <input type="number" step="0.01" value={num(editingIngredient.current_stock) ?? ""} onChange={(e) => setEditingIngredient({ ...editingIngredient, current_stock: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600 font-black">حد أدنى</label>
                      <input type="number" step="0.01" value={num(editingIngredient.min_stock) ?? ""} onChange={(e) => setEditingIngredient({ ...editingIngredient, min_stock: Number(e.target.value) })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-slate-900 text-right" />
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-slate-50 flex gap-3">
                  <button
                    type="submit"
                    disabled={isSavingIngredient}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-black transition-colors shadow-lg shadow-blue-700/20 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSavingIngredient ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      "حفظ"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isSavingIngredient}
                    onClick={() => setShowIngredientModal(false)}
                    className="px-8 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600 py-3 rounded-xl font-black transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecipeModal && editingProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRecipeModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} className="relative bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl my-auto max-h-[90vh] flex flex-col">
              <form onSubmit={handleSaveProduct} className="flex flex-col h-full overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Boxes className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">تحديد مقادير الصنف وربطه بمخزن الخصم</h2>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">{editingProduct.name} (عند البيع يتم سحب المقادير تلقائياً من هذا المخزن)</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowRecipeModal(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-500">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {/* Warehouse Selection */}
                  <div className="p-5 rounded-2xl bg-blue-50/50 border border-blue-200/60 space-y-3">
                    <label className="text-sm text-blue-900 font-black flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-blue-700" />
                      مخزن الخصم المباشر عند البيع *
                    </label>
                    <select
                      value={editingProduct.warehouse_id || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, warehouse_id: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full bg-white border border-blue-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-right"
                    >
                      <option value="">بدون ربط (سحب من المطبخ/المخزن الرئيسي تلقائياً)</option>
                      {warehouses.map((w, idx) => (
                        <option key={`rec-wh-${w.id}-${idx}`} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-blue-700 font-semibold">
                      💡 عند تأكيد أي فاتورة بيع تحتوي هذا المنتج، سيقوم النظام بسحب مقاديره فوراً من المخزن المحدد أعلاه.
                    </p>
                  </div>

                  {/* Ingredients Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black flex items-center gap-2 text-slate-900 text-base">
                        <Factory className="w-5 h-5 text-emerald-600" />
                        مقادير ومكونات الوصفة (لكل 1 وحدة من {editingProduct.name})
                      </h3>
                      <button
                        type="button"
                        onClick={() => setEditingProduct({
                          ...editingProduct,
                          ingredients: [...(editingProduct.ingredients || []), { ingredient_id: 0, product_id: editingProduct.id || 0, quantity: 1 }],
                        })}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        إضافة مكون/مقدار
                      </button>
                    </div>

                    {(!editingProduct.ingredients || editingProduct.ingredients.length === 0) ? (
                      <div className="p-8 border-2 border-dashed border-slate-200 rounded-2xl text-center text-slate-400 font-bold">
                        لم يتم إضافة أي مقادير لهذا المنتج بعد. اضغط على "إضافة مكون/مقدار" لربط المقادير المخزنية.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(editingProduct?.ingredients || []).map((ing: ProductIngredient, idx: number) => {
                          const selectedIng = ingredients.find((i) => i.id === ing.ingredient_id);
                          return (
                            <div key={idx} className="grid grid-cols-[1fr_130px_100px_42px] gap-3 items-end bg-slate-50 p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-300 transition-colors">
                              <div className="space-y-1">
                                <label className="text-xs text-slate-600 font-black">المكون المخزني</label>
                                <select
                                  value={ing.ingredient_id ?? ""}
                                  onChange={(e) => {
                                    const next = [...(editingProduct.ingredients || [])];
                                    next[idx] = { ...next[idx], ingredient_id: Number(e.target.value) };
                                    setEditingProduct({ ...editingProduct, ingredients: next });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900"
                                >
                                  <option value={0}>اختر صنف مخزني...</option>
                                  {ingredients.map((ingredient, iIdx) => (
                                    <option key={`rec-ing-${ingredient.id}-${iIdx}`} value={ingredient.id}>{ingredient.name} ({ingredient.unit})</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-600 font-black">الكمية المسحوبة</label>
                                <input
                                  type="number"
                                  step="0.001"
                                  value={num(ing.quantity) ?? ""}
                                  onChange={(e) => {
                                    const next = [...(editingProduct.ingredients || [])];
                                    next[idx] = { ...next[idx], quantity: Number(e.target.value) };
                                    setEditingProduct({ ...editingProduct, ingredients: next });
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-900 text-center"
                                />
                              </div>
                              <div className="space-y-1 text-center">
                                <label className="text-[10px] text-slate-400 font-bold">الوحدة</label>
                                <div className="py-2 text-xs font-black text-slate-700 bg-slate-100 rounded-xl border border-slate-200">
                                  {selectedIng?.unit || "-"}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditingProduct({
                                  ...editingProduct,
                                  ingredients: editingProduct.ingredients?.filter((_, i) => i !== idx),
                                })}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                title="حذف المقدار"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3">
                  <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer">
                    حفظ المقادير وربط المخزن
                  </button>
                  <button type="button" onClick={() => setShowRecipeModal(false)} className="px-8 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-3 rounded-xl font-black transition-colors cursor-pointer">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {showImportResult && (
        <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowImportResult(false)}>
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <div className={`p-5 border-b flex items-center justify-between ${importResult?.success ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
              <div className="flex items-center gap-3">
                {importResult?.success ? <CheckCircle2 className="w-7 h-7 text-emerald-600" /> : <AlertTriangle className="w-7 h-7 text-red-600" />}
                <div>
                  <h3 className="font-black text-lg text-slate-900">{importResult?.title || (importResult?.success ? "تم الاستيراد بنجاح" : "فشل الاستيراد")}</h3>
                  <p className="text-xs text-slate-500 mt-1">نتيجة عملية استيراد ملف Excel</p>
                </div>
              </div>
              <button onClick={() => setShowImportResult(false)} className="p-2 rounded-xl hover:bg-white/70"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {importResult?.success ? (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-center"><b className="block text-2xl text-emerald-700">{importResult.created_count ?? 0}</b><span className="text-xs font-bold text-slate-500">أصناف أضيفت</span></div>
                    <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-center"><b className="block text-2xl text-amber-700">{importResult.skipped_count ?? 0}</b><span className="text-xs font-bold text-slate-500">تم تخطيها</span></div>
                    <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-center"><b className="block text-2xl text-blue-700">{importResult.total_rows ?? 0}</b><span className="text-xs font-bold text-slate-500">صفوف مقروءة</span></div>
                  </div>
                  <p className="text-sm font-bold text-slate-700">{importResult.message || "تمت إضافة الأصناف إلى النظام وإنشاء كود صنف تلقائي لكل صنف جديد."}</p>
                  {!!importResult.skipped?.length && <div className="bg-slate-50 rounded-2xl p-3 max-h-40 overflow-auto text-xs text-slate-600"><b className="block mb-2">الأصناف التي تم تخطيها:</b>{importResult.skipped.slice(0, 50).map((x: any, i: number) => <div key={i} className="py-1 border-b last:border-0 border-slate-200">{x.name} — {x.reason}</div>)}</div>}
                </>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl bg-red-50 border border-red-100 p-4 text-sm font-bold text-red-800">{importResult?.error || "حدث خطأ أثناء الاستيراد."}</div>
                  {importResult?.headers?.length > 0 && <div className="text-xs text-slate-500">الأعمدة الموجودة في الملف: <span className="font-bold text-slate-700">{importResult.headers.join("، ")}</span></div>}
                  {importResult?.details?.length > 0 && <div className="rounded-2xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">{importResult.details.map((d: any, i: number) => <div key={i}>• {typeof d === "string" ? d : d.message || JSON.stringify(d)}</div>)}</div>}
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800 font-bold">يجب أن يحتوي ملف Excel على عمود باسم <span className="font-black">الصنف</span>، ويكون كل صف بعده اسم صنف واحد.</div>
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex justify-end"><button onClick={() => setShowImportResult(false)} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-black">إغلاق</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
