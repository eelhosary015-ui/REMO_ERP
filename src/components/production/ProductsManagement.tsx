import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Package, Plus, Search, Filter, X, RefreshCw, Layers, CheckCircle, 
  Edit, Trash2, Image as ImageIcon, Tag, Warehouse, Cpu, Clock, 
  AlertTriangle, Grid, List, Upload, BarChart3, HelpCircle, ClipboardList,
  Download, Eye, MoreVertical, Info, Store, Sparkles, Check, Unlink, AlertCircle
} from 'lucide-react';
import { ProductDef } from './types';
import { databaseStorage } from '../../utils/databaseStorage';
import { api } from '../../utils/api';

// Arabic Normalization helper
function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel / harakat
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[-_./\\,;:()\[\]{}'"`!؟?+*#@$%^&=~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance
function getLevenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Compute similarity score between 0.0 and 1.0
function calculateTextSimilarity(str1: string, str2: string): number {
  const norm1 = normalizeArabicText(str1);
  const norm2 = normalizeArabicText(str2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  // Exact substring check
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const minLen = Math.min(norm1.length, norm2.length);
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen > 0) {
      const ratio = minLen / maxLen;
      if (ratio > 0.6) return Math.max(0.82, ratio);
    }
  }

  // Token matching (Jaccard on words)
  const tokens1 = new Set(norm1.split(' ').filter(Boolean));
  const tokens2 = new Set(norm2.split(' ').filter(Boolean));
  let intersection = 0;
  tokens1.forEach(t => { if (tokens2.has(t)) intersection++; });
  const union = new Set([...tokens1, ...tokens2]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  if (jaccard >= 0.75) return Math.max(0.85, jaccard);

  // Levenshtein similarity
  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1;
  const dist = getLevenshteinDistance(norm1, norm2);
  const levSim = 1 - (dist / maxLen);

  return Math.max(levSim, jaccard * 0.9);
}

const MOCK_PRODUCTS: ProductDef[] = [];

// Presets images for easy selection
const IMAGE_PRESETS = [
  { name: 'صلب ومعادن', url: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?w=400&auto=format&fit=crop&q=80' },
  { name: 'هياكل وإطارات وميكانيكا', url: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=400&auto=format&fit=crop&q=80' },
  { name: 'سيارة ومنتج تجميعي نهائي', url: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400&auto=format&fit=crop&q=80' },
  { name: 'إلكترونيات ولوحات تحكم', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=80' },
  { name: 'بلاستيك وبولي إيثيلين', url: 'https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?w=400&auto=format&fit=crop&q=80' },
  { name: 'كرتون وتغليف وحزم', url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&auto=format&fit=crop&q=80' },
];

interface ProductsManagementProps {
  onTabChange?: (tab: string) => void;
}

export function ProductsManagement({ onTabChange }: ProductsManagementProps = {}) {
  const [products, setProducts] = useState<ProductDef[]>([]);
  const [workCenters, setWorkCenters] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const savedProducts = await databaseStorage.getItem<ProductDef[]>('remo_production_products', []);
      const cleanProd = Array.isArray(savedProducts) ? savedProducts.filter(p => p && p.code && !['RAW-001', 'RAW-002', 'FIN-001', 'RAW-003', 'COMP-001', 'PACK-001', 'CHEM-001'].includes(p.code)) : [];
      
      // Also fetch shared products from POS and Sales
      try {
        const res = await api.get('/api/v2/production/shared-products');
        const data = await res.json();
        const sharedList = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
        if (!cancelled && sharedList.length > 0) {
          const merged = [...cleanProd];
          sharedList.forEach((sp: any) => {
            const code = sp.code || `SP-${sp.id}`;
            if (!merged.some(p => p.code === code || p.name === sp.name)) {
              merged.push({
                id: String(sp.id || ''),
                code: code,
                name: sp.name,
                category: sp.category || (sp.source === 'sales' ? 'منتجات المبيعات' : 'منتجات نقاط البيع'),
                type: (sp.type as any) || 'finished',
                unit: sp.unit || 'قطعة',
                costMethod: 'FIFO',
                plmStatus: 'approved',
                version: 'v1.0',
                image: sp.image || '',
                manufacturingData: { leadTimeDays: 2, batchSizeRatio: 1, scrapRate: 0, defaultWorkCenterId: '1' }
              });
            }
          });
          setProducts(merged);
        } else if (!cancelled) {
          setProducts(cleanProd);
        }
      } catch (_) {
        if (!cancelled) setProducts(cleanProd);
      }

      const savedWC = await databaseStorage.getItem<any[]>('remo_production_workcenters', []);
      const cleanWC = Array.isArray(savedWC) ? savedWC.filter(wc => wc && wc.code && !['MC-101', 'MC-102', 'MC-103', 'LN-001'].includes(wc.code)) : [];
      if (!cancelled) setWorkCenters(cleanWC);
      if (!cancelled) setIsLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadProductionRecipes = async () => {
      try {
        const response = await api.get('/api/v2/production/boms');
        const body = await response.json();
        const liveBoms = Array.isArray(body) ? body : body?.data;
        if (!cancelled && Array.isArray(liveBoms)) {
          const cleanBoms = liveBoms.filter((bom: any) => bom && bom.id);
          setBoms(cleanBoms);
          localStorage.setItem('remo_production_boms', JSON.stringify(cleanBoms));
        }
      } catch {
        // The local BOM cache remains available when the server is offline.
      }
    };
    loadProductionRecipes();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!isLoading) {
      databaseStorage.setItem('remo_production_products', products);
    }
  }, [products, isLoading]);

  const [boms, setBoms] = useState<any[]>(() => {
    const saved = localStorage.getItem('remo_production_boms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    return [];
  });

  const [productionOrders] = useState<any[]>(() => {
    const saved = localStorage.getItem('remo_production_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) {}
    }
    return [];
  });

  const AVAILABLE_WAREHOUSES = [
    'مستودع أ - الخامات والمواد الأولية',
    'مستودع ب - المكونات والأجزاء',
    'مستودع ج - المنتجات النهائية للتسليم',
    'مستودع د - المواد الكيميائية والخطرة',
    'مستودع هـ - مواد التعبئة والتغليف'
  ];

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Tab within form modal: 'basic' | 'inventory' | 'mfg'
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'inventory' | 'mfg'>('basic');
  
  // File Upload Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formState, setFormState] = useState<Partial<ProductDef>>({
    code: '',
    name: '',
    category: 'معادن',
    type: 'raw',
    unit: 'قطعة',
    costMethod: 'FIFO',
    plmStatus: 'approved',
    version: 'v1.0',
    brand: '',
    image: '',
    inventoryData: { minQty: 10, maxQty: 500, currentStock: 25, location: 'المخزن الرئيسي - الرف 1' },
    manufacturingData: { leadTimeDays: 3, batchSizeRatio: 10, scrapRate: 1.0, defaultWorkCenterId: '1' }
  });

  const generateCode = (type: string) => {
    const prefix = type === 'raw' ? 'RAW' : type === 'semi_finished' ? 'SFP' : type === 'finished' ? 'FIN' : 'BYP';
    return `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'raw': return 'bg-slate-100 text-slate-700 hover:bg-slate-200';
      case 'semi_finished': return 'bg-amber-100 text-amber-700 hover:bg-amber-200';
      case 'finished': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200';
      case 'by_product': return 'bg-purple-100 text-purple-700 hover:bg-purple-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case 'raw': return 'مادة خام (Raw)';
      case 'semi_finished': return 'نصف مصنع (Semi-Finished)';
      case 'finished': return 'منتج نهائي (Finished)';
      case 'by_product': return 'منتج ثانوي (By-Product)';
      default: return type;
    }
  };

  const getPlmBadge = (status?: string) => {
    const val = status || 'approved';
    switch (val) {
      case 'under_design':
        return <span className="px-2 py-1 text-xs font-bold bg-slate-100 text-slate-500 rounded-md border border-slate-200 inline-block">تحت التصميم</span>;
      case 'development':
        return <span className="px-2 py-1 text-xs font-bold bg-indigo-50 text-indigo-600 rounded-md border border-indigo-150 inline-block">تطوير فني</span>;
      case 'approved':
        return <span className="px-2 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-150 inline-block">معتمد لإنتاج</span>;
      case 'deprecated':
        return <span className="px-2 py-1 text-xs font-bold bg-rose-50 text-rose-700 rounded-md border border-rose-150 inline-block">موقوف</span>;
      default:
        return <span className="px-2 py-1 text-xs font-bold bg-gray-100 text-gray-600 rounded-md inline-block">{val}</span>;
    }
  };

  const getProductRecipe = (product: Partial<ProductDef>) => {
    const productKeys = [product.id, product.code, product.name]
      .filter(Boolean)
      .map(value => normalizeArabicText(String(value)));
    return boms.find((bom: any) => {
      const bomKeys = [bom.productId, bom.product_id, bom.productCode, bom.productName, bom.product_name]
        .filter(Boolean)
        .map(value => normalizeArabicText(String(value)));
      return bomKeys.some(key => productKeys.includes(key));
    });
  };

  const changePlmStatus = (id: string, newStatus: ProductDef['plmStatus']) => {
    const updated = products.map(p => p.id === id ? { ...p, plmStatus: newStatus } : p);
    setProducts(updated);
    localStorage.setItem('remo_production_products', JSON.stringify(updated));
  };

  // Product source states for modal (POS, Warehouse, Custom)
  const [productSource, setProductSource] = useState<'pos' | 'warehouse' | 'custom'>('custom');
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [dbIngredients, setDbIngredients] = useState<any[]>([]);
  const [posSearchTerm, setPosSearchTerm] = useState('');
  const [warehouseSearchTerm, setWarehouseSearchTerm] = useState('');
  const [selectedLinkedItem, setSelectedLinkedItem] = useState<{ id: string | number; name: string; type: 'pos' | 'warehouse'; code?: string } | null>(null);
  const [selectedRecipeProduct, setSelectedRecipeProduct] = useState<{ product: ProductDef; bom: any } | null>(null);

  // Load POS products and Warehouse ingredients for linking
  useEffect(() => {
    api.get('/api/pos/data')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (Array.isArray(data.products) && data.products.length > 0) {
            setDbProducts(data.products);
          }
          if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
            setDbIngredients(data.ingredients);
          }
        }
      })
      .catch(() => {});

    api.get('/api/products')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDbProducts(prev => prev.length > 0 ? prev : data);
        }
      })
      .catch(() => {});

    api.get('/api/ingredients')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDbIngredients(prev => prev.length > 0 ? prev : data);
        }
      })
      .catch(() => {});
  }, []);

  // Filtered lists for modal dropdowns
  const filteredPosProducts = useMemo(() => {
    if (!posSearchTerm.trim()) return dbProducts;
    const term = posSearchTerm.toLowerCase().trim();
    return dbProducts.filter((p: any) => 
      p.name?.toLowerCase().includes(term) ||
      p.code?.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term) ||
      p.category_name?.toLowerCase().includes(term)
    );
  }, [dbProducts, posSearchTerm]);

  const filteredWarehouseItems = useMemo(() => {
    if (!warehouseSearchTerm.trim()) return dbIngredients;
    const term = warehouseSearchTerm.toLowerCase().trim();
    return dbIngredients.filter((i: any) => 
      i.name?.toLowerCase().includes(term) ||
      i.item_code?.toLowerCase().includes(term) ||
      i.unit?.toLowerCase().includes(term)
    );
  }, [dbIngredients, warehouseSearchTerm]);

  // Real-time name uniqueness and similarity check engine
  const validationResult = useMemo(() => {
    if (!formState.name || !formState.name.trim()) {
      return { status: 'empty' as const, message: '' };
    }

    const currentName = formState.name.trim();
    const normalizedCurrent = normalizeArabicText(currentName);

    // 1. Check against existing Production PLM Products
    const otherProductionProducts = products.filter(p => !editingId || String(p.id) !== String(editingId));
    for (const p of otherProductionProducts) {
      const norm = normalizeArabicText(p.name);
      if (norm === normalizedCurrent) {
        return {
          status: 'duplicate' as const,
          source: 'production',
          sourceLabel: 'إدارة الإنتاج (PLM)',
          matchedName: p.name,
          matchedCode: p.code,
          score: 1.0,
          message: `اسم المنتج متطابق تماماً مع المنتج "${p.name}" (الرمز: ${p.code}) المسجل في إدارة الإنتاج.`
        };
      }
      const score = calculateTextSimilarity(currentName, p.name);
      if (score >= 0.78) {
        return {
          status: 'similar' as const,
          source: 'production',
          sourceLabel: 'إدارة الإنتاج (PLM)',
          matchedName: p.name,
          matchedCode: p.code,
          score,
          message: `الاسم مشابه جداً للمنتج "${p.name}" (الرمز: ${p.code}) في إدارة الإنتاج (نسبة التقارب: ${(score * 100).toFixed(0)}%).`
        };
      }
    }

    // 2. If Custom Entry mode: check against POS and Warehouse items to prevent collision
    if (productSource === 'custom') {
      // Check POS Products
      for (const p of dbProducts) {
        const norm = normalizeArabicText(p.name);
        if (norm === normalizedCurrent) {
          return {
            status: 'duplicate' as const,
            source: 'pos',
            sourceLabel: 'نقاط البيع (POS)',
            matchedName: p.name,
            matchedCode: p.code || p.barcode,
            score: 1.0,
            message: `اسم المنتج متطابق مع منتج مسجل بنقاط البيع: "${p.name}". إذا كنت تريد ربطه، اختر تبويب "منتج من نقطة البيع".`
          };
        }
        const score = calculateTextSimilarity(currentName, p.name);
        if (score >= 0.78) {
          return {
            status: 'similar' as const,
            source: 'pos',
            sourceLabel: 'نقاط البيع (POS)',
            matchedName: p.name,
            matchedCode: p.code || p.barcode,
            score,
            message: `الاسم مشابه لمنتج في نقاط البيع: "${p.name}" (نسبة التقارب: ${(score * 100).toFixed(0)}%). يرجى إدخال اسم مميز وغير مطابق.`
          };
        }
      }

      // Check Warehouse items
      for (const ing of dbIngredients) {
        const norm = normalizeArabicText(ing.name);
        if (norm === normalizedCurrent) {
          return {
            status: 'duplicate' as const,
            source: 'warehouse',
            sourceLabel: 'مستودع الخامات',
            matchedName: ing.name,
            matchedCode: ing.item_code,
            score: 1.0,
            message: `اسم المنتج متطابق مع صنف مخزني مسجل: "${ing.name}". إذا كنت تريد استخدامه، اختر تبويب "صنف مخزني".`
          };
        }
        const score = calculateTextSimilarity(currentName, ing.name);
        if (score >= 0.78) {
          return {
            status: 'similar' as const,
            source: 'warehouse',
            sourceLabel: 'مستودع الخامات',
            matchedName: ing.name,
            matchedCode: ing.item_code,
            score,
            message: `الاسم مشابه لصنف مخزني: "${ing.name}" (نسبة التقارب: ${(score * 100).toFixed(0)}%). يرجى إدخال اسم مميز وغير مطابق.`
          };
        }
      }
    }

    // 3. If in POS or Warehouse selection mode, check if the selected item is already registered in Production
    if (productSource === 'pos' && selectedLinkedItem?.type === 'pos') {
      const alreadyRegistered = products.find(p => (!editingId || String(p.id) !== String(editingId)) && normalizeArabicText(p.name) === normalizedCurrent);
      if (alreadyRegistered) {
        return {
          status: 'duplicate' as const,
          source: 'production',
          sourceLabel: 'إدارة الإنتاج (PLM)',
          matchedName: alreadyRegistered.name,
          matchedCode: alreadyRegistered.code,
          score: 1.0,
          message: `هذا المنتج من نقطة البيع مسجل بالفعل في إدارة الإنتاج برمز: ${alreadyRegistered.code}.`
        };
      }
    }

    if (productSource === 'warehouse' && selectedLinkedItem?.type === 'warehouse') {
      const alreadyRegistered = products.find(p => (!editingId || String(p.id) !== String(editingId)) && normalizeArabicText(p.name) === normalizedCurrent);
      if (alreadyRegistered) {
        return {
          status: 'duplicate' as const,
          source: 'production',
          sourceLabel: 'إدارة الإنتاج (PLM)',
          matchedName: alreadyRegistered.name,
          matchedCode: alreadyRegistered.code,
          score: 1.0,
          message: `هذا الصنف المخزني مسجل بالفعل في إدارة الإنتاج برمز: ${alreadyRegistered.code}.`
        };
      }
    }

    return {
      status: 'unique' as const,
      message: '✓ اسم المنتج متاح ومميز، لا يوجد أي تشابه أو تكرار مع منتجات أو أصناف السيستم.'
    };
  }, [formState.name, products, dbProducts, dbIngredients, editingId, productSource, selectedLinkedItem]);

  const handleSelectPosProduct = (posItem: any) => {
    setSelectedLinkedItem({ id: posItem.id, name: posItem.name, type: 'pos', code: posItem.code || posItem.barcode });
    setFormState(prev => ({
      ...prev,
      name: posItem.name,
      code: posItem.code || posItem.barcode ? `FIN-${posItem.code || posItem.barcode}` : generateCode('finished'),
      type: 'finished',
      category: posItem.category_name || prev.category || 'منتجات نهائية',
      unit: posItem.unit || 'قطعة',
      brand: posItem.brand || prev.brand || '',
      image: posItem.image || prev.image || '',
      sourceType: 'pos',
      sourceId: posItem.id,
      inventoryData: {
        ...prev.inventoryData,
        currentStock: parseFloat(posItem.stock || posItem.current_stock) || prev.inventoryData?.currentStock || 0,
        minQty: 10,
        maxQty: 1000,
        location: prev.inventoryData?.location || 'المخزن الرئيسي - قسم التوريد'
      }
    }));
  };

  const handleSelectWarehouseItem = (ing: any) => {
    setSelectedLinkedItem({ id: ing.id, name: ing.name, type: 'warehouse', code: ing.item_code });
    setFormState(prev => ({
      ...prev,
      name: ing.name,
      code: ing.item_code ? `RAW-${ing.item_code}` : generateCode('raw'),
      type: 'raw',
      category: prev.category || 'معادن',
      unit: ing.unit || 'كجم',
      brand: prev.brand || '',
      sourceType: 'warehouse',
      sourceId: ing.id,
      inventoryData: {
        ...prev.inventoryData,
        currentStock: parseFloat(ing.quantity || ing.current_stock) || 0,
        minQty: 10,
        maxQty: 1000,
        location: prev.inventoryData?.location || 'مستودع الخامات والمواد الأولية'
      }
    }));
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setActiveFormTab('basic');
    setProductSource('custom');
    setSelectedLinkedItem(null);
    setPosSearchTerm('');
    setWarehouseSearchTerm('');
    setFormState({
      code: generateCode('raw'),
      name: '',
      category: 'معادن',
      type: 'raw',
      unit: 'قطعة',
      costMethod: 'FIFO',
      plmStatus: 'approved',
      version: 'v1.0',
      brand: '',
      image: '',
      sourceType: 'custom',
      inventoryData: { minQty: 10, maxQty: 500, currentStock: 25, location: 'المخزن الرئيسي - الرف 1' },
      manufacturingData: { leadTimeDays: 3, batchSizeRatio: 5, scrapRate: 1.0, defaultWorkCenterId: workCenters[0]?.id || '1' }
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product: ProductDef, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(product.id);
    setActiveFormTab('basic');
    setProductSource(product.sourceType || 'custom');
    setSelectedLinkedItem(product.sourceType && product.sourceId ? { id: product.sourceId, name: product.name, type: product.sourceType as any } : null);
    setPosSearchTerm('');
    setWarehouseSearchTerm('');
    
    // Ensure nested objects are fully populated to prevent reference/undefined errors
    setFormState({
      ...product,
      brand: product.brand || '',
      image: product.image || '',
      inventoryData: product.inventoryData ? { ...product.inventoryData } : { minQty: 10, maxQty: 500, currentStock: 0, location: '' },
      manufacturingData: product.manufacturingData ? { ...product.manufacturingData } : { leadTimeDays: 2, batchSizeRatio: 1, scrapRate: 0, defaultWorkCenterId: '' }
    });
    setIsModalOpen(true);
  };

  const handleDeleteProduct = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`هل أنت متأكد تماماً من حذف المنتج "${name}"؟ قد يؤثر الحظر على فواتير المواد وأوامر التصنيع الجديدة.`)) {
      const updated = products.filter(p => p.id !== id);
      setProducts(updated);
      localStorage.setItem('remo_production_products', JSON.stringify(updated));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormState(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.name || !formState.name.trim()) {
      alert('الرجاء إدخال اسم المنتج بشكل دقيق');
      return;
    }

    if (validationResult.status === 'duplicate') {
      alert(`⛔ لا يمكن حفظ المنتج بسبب تطابق الاسم:\n${validationResult.message}`);
      return;
    }

    if (validationResult.status === 'similar' && productSource === 'custom') {
      alert(`⛔ لا يمكن إضافة هذا المنتج بسبب تشابه الاسم:\n${validationResult.message}\n\nيُشترط أن يكون اسم المنتج مختلفاً ومميزاً عن باقي منتجات وأصناف السيستم.`);
      return;
    }

    if (editingId) {
      // Edit mode
      const updated = products.map(p => {
        if (p.id === editingId) {
          return {
            ...p,
            ...formState,
            sourceType: productSource,
            sourceId: selectedLinkedItem?.id || p.sourceId,
            id: editingId // ensure id is preserved
          } as ProductDef;
        }
        return p;
      });
      setProducts(updated);
      localStorage.setItem('remo_production_products', JSON.stringify(updated));
    } else {
      // Create mode
      const added: ProductDef = {
        ...formState,
        id: Date.now().toString(),
        sourceType: productSource,
        sourceId: selectedLinkedItem?.id,
        plmStatus: formState.plmStatus || 'approved',
        version: formState.version || 'v1.0',
        brand: formState.brand || '',
        image: formState.image || '',
        inventoryData: formState.inventoryData || { minQty: 0, maxQty: 100, currentStock: 0, location: '-' },
        manufacturingData: formState.manufacturingData || { leadTimeDays: 1, batchSizeRatio: 1, scrapRate: 0, defaultWorkCenterId: '' }
      } as ProductDef;

      const updated = [...products, added];
      setProducts(updated);
      localStorage.setItem('remo_production_products', JSON.stringify(updated));
    }

    setIsModalOpen(false);
    setEditingId(null);
  };

  // Searching & Advanced filtering logic
  const filteredProducts = products.filter(p => {
    const term = search.toLowerCase();
    const isCodeMatch = p.code?.toLowerCase().includes(term);
    const isNameMatch = p.name?.toLowerCase().includes(term);
    const isBrandMatch = p.brand?.toLowerCase().includes(term);
    const isCategoryMatch = p.category?.toLowerCase().includes(term);
    const isSearchMatch = !search ? true : (isCodeMatch || isNameMatch || isBrandMatch || isCategoryMatch);

    const isUnitMatch = filterUnit === 'all' ? true : p.unit === filterUnit;
    const isTypeMatch = filterType === 'all' ? true : p.type === filterType;
    const isCategoryFilterMatch = filterCategory === 'all' ? true : p.category.includes(filterCategory);
    
    let isStatusMatch = true;
    if (filterStatus !== 'all') {
      if (filterStatus === 'approved') {
        isStatusMatch = p.plmStatus === 'approved';
      } else if (filterStatus === 'under_review') {
        isStatusMatch = p.plmStatus === 'development' || p.plmStatus === 'under_design';
      } else if (filterStatus === 'deprecated') {
        isStatusMatch = p.plmStatus === 'deprecated';
      }
    }

    return isSearchMatch && isUnitMatch && isTypeMatch && isCategoryFilterMatch && isStatusMatch;
  });

  // KPI Calculations
  const totalProductsCount = products.length;
  const approvedProductsCount = products.filter(p => p.plmStatus === 'approved').length;
  const underReviewProductsCount = products.filter(p => p.plmStatus === 'development' || p.plmStatus === 'under_design').length;
  const notApprovedProductsCount = products.filter(p => p.plmStatus === 'deprecated').length;

  const exportToCSV = () => {
    const headers = ['رمز المنتج', 'اسم المنتج', 'الفئة', 'نوع المنتج', 'الوحدة', 'المخزون الحالي', 'الإصدار', 'الحالة'];
    const rows = filteredProducts.map(p => [
      p.code,
      p.name,
      p.category,
      p.type === 'raw' ? 'مادة خام' : p.type === 'semi_finished' ? 'نصف مصنع' : p.type === 'finished' ? 'منتج نهائي' : 'منتج ثانوي',
      p.unit,
      p.inventoryData?.currentStock || 0,
      p.version || 'V1.0',
      p.plmStatus === 'approved' ? 'معتمد' : (p.plmStatus === 'development' || p.plmStatus === 'under_design' ? 'قيد المراجعة' : 'موقوف')
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `products_plm_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">إدارة المنتجات (PLM)</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">عرض وإدارة جميع المنتجات والمواصفات الخاصة بها</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold shadow-xs transition-all text-sm"
          >
            <Download className="w-4 h-4 text-slate-505" />
            تصدير
          </button>
          
          <button 
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl font-bold shadow-md transition-all text-sm"
          >
            <Plus className="w-5 h-5" />
            منتج جديد
          </button>
        </div>
      </div>

      {/* 4 Beautiful KPI Metric Cards matching the screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Products */}
        <div className="bg-[#EEF2FF]/60 border border-[#E0E7FF] rounded-2xl p-5 flex justify-between items-center shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-black text-[#4F46E5] uppercase tracking-wider">إجمالي المنتجات</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#1E1B4B]">{totalProductsCount}</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">منتج</p>
          </div>
          <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-[#4F46E5]">
            <Package className="w-7 h-7" />
          </div>
        </div>

        {/* Card 2: Approved Products */}
        <div className="bg-[#EFF6FF]/60 border border-[#DBEAFE] rounded-2xl p-5 flex justify-between items-center shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-black text-[#2563EB] uppercase tracking-wider">منتجات معتمدة</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#1E3A8A]">{approvedProductsCount}</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">منتج</p>
          </div>
          <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center text-[#2563EB]">
            <CheckCircle className="w-7 h-7" />
          </div>
        </div>

        {/* Card 3: Under Review */}
        <div className="bg-[#FFF7ED]/60 border border-[#FFEDD5] rounded-2xl p-5 flex justify-between items-center shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-black text-[#EA580C] uppercase tracking-wider">قيد المراجعة</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#7C2D12]">{underReviewProductsCount}</span>
            </div>
            <p className="text-xs text-slate-400 font-medium">منتج</p>
          </div>
          <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-[#EA580C]">
            <Clock className="w-7 h-7" />
          </div>
        </div>

        {/* Card 4: Not Approved */}
        <div className="bg-[#FEF2F2]/60 border border-[#FEE2E2] rounded-2xl p-5 flex justify-between items-center shadow-xs">
          <div className="space-y-1">
            <span className="text-xs font-black text-[#DC2626] uppercase tracking-wider">غير معتمدة</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-[#7F1D1D]">{notApprovedProductsCount}</span>
            </div>
            <p className="text-xs text-[#DC2626] font-medium">منتج</p>
          </div>
          <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center text-[#DC2626]">
            <AlertTriangle className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Advanced Filter row styled exactly like the screenshot */}
      <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Filter controls container */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Advanced Filters indicator */}
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 text-slate-705 rounded-xl text-xs font-extrabold relative">
            <Filter className="w-4 h-4 text-[#4f46e5]" />
            <span>فلاتر متقدمة</span>
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#4f46e5]"></span>
          </div>

          {/* Core Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="ابحث برمز المنتج أو الاسم الفني أو الفئة..."
              className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs transition-all"
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>

          {/* Unit dropdown */}
          <select 
            value={filterUnit}
            onChange={e => { setFilterUnit(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 text-slate-705 text-xs rounded-xl font-bold px-3 py-2 outline-none cursor-pointer hover:bg-slate-100"
          >
            <option value="all">الوحدة</option>
            <option value="كجم">كجم</option>
            <option value="لتر">لتر</option>
            <option value="قطعة">قطعة</option>
            <option value="طن">طن</option>
          </select>

          {/* Type dropdown */}
          <select 
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 text-slate-705 text-xs rounded-xl font-bold px-3 py-2 outline-none cursor-pointer hover:bg-slate-100"
          >
            <option value="all">نوع المنتج</option>
            <option value="raw">مادة خام</option>
            <option value="semi_finished">نصف مصنع / مكون</option>
            <option value="finished">منتج نهائي للبيع</option>
            <option value="by_product">منتج ثانوي متفرع</option>
          </select>

          {/* Category dropdown */}
          <select 
            value={filterCategory}
            onChange={e => { setFilterCategory(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 text-slate-705 text-xs rounded-xl font-bold px-3 py-2 outline-none cursor-pointer hover:bg-slate-100"
          >
            <option value="all">الفئة</option>
            <option value="المعادن">المعادن</option>
            <option value="المنتجات النهائية">المنتجات النهائية</option>
            <option value="الدرجات / المكونات">المكونات / الدرجات</option>
            <option value="مواد تعبئة">مواد تعبئة</option>
            <option value="الكيميائيات">الكيميائيات</option>
          </select>

          {/* Status dropdown */}
          <select 
            value={filterStatus}
            onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 text-slate-705 text-xs rounded-xl font-bold px-3 py-2 outline-none cursor-pointer hover:bg-slate-100"
          >
            <option value="all">الحالة</option>
            <option value="approved">معتمد</option>
            <option value="under_review">قيد المراجعة</option>
            <option value="deprecated">مسودة / موقوف</option>
          </select>

          {/* Clear Filters Button */}
          {(search || filterUnit !== 'all' || filterType !== 'all' || filterCategory !== 'all' || filterStatus !== 'all') && (
            <button 
              onClick={() => {
                setSearch('');
                setFilterUnit('all');
                setFilterType('all');
                setFilterCategory('all');
                setFilterStatus('all');
                setCurrentPage(1);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-bold transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>مسح الفلاتر</span>
            </button>
          )}
        </div>

        {/* View mode switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${viewMode === 'table' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <List className="w-4 h-4" />
            <span>جدول البيانات</span>
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition-all ${viewMode === 'grid' ? 'bg-white shadow-xs text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Grid className="w-4 h-4" />
            <span>عرض البطاقات</span>
          </button>
        </div>
      </div>

      {/* Grid Mode Representation */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
          {filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((p) => {
            const hasAlert = (p.inventoryData?.currentStock || 0) < (p.inventoryData?.minQty || 0);
            const stockPct = p.inventoryData?.maxQty 
              ? Math.min(100, Math.round(((p.inventoryData.currentStock || 0) / p.inventoryData.maxQty) * 100))
              : 0;

            return (
              <div 
                key={p.id} 
                className={`group bg-white rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col hover:shadow-md ${hasAlert ? 'border-amber-300/60 bg-amber-50/10' : 'border-slate-200'}`}
              >
                {/* Product Header Images */}
                <div className="relative h-44 w-full bg-slate-100 overflow-hidden border-b border-slate-100">
                  {p.image ? (
                    <img 
                      src={p.image} 
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-linear-to-br from-slate-50 to-slate-100">
                      <ImageIcon className="w-12 h-12 text-slate-350 stroke-1" />
                      <span className="text-xs text-slate-405 mt-2">لا توجد صورة مسجلة</span>
                    </div>
                  )}

                  {/* Brand Tag overlay */}
                  {p.brand && (
                    <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-1 rounded-lg border border-white/20 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-indigo-300" />
                      <span>{p.brand}</span>
                    </div>
                  )}

                  {/* Type Badge */}
                  <div className="absolute bottom-3 left-3">
                    <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md shadow-xs ${getTypeStyle(p.type)}`}>
                      {getTypeName(p.type).split(' ')[0]}
                    </span>
                  </div>

                  {/* PLM Status quick select */}
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-lg shadow-xs border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 align-middle ml-1">PLM:</span>
                    <select
                      value={p.plmStatus || 'approved'}
                      onChange={(e) => changePlmStatus(p.id, e.target.value as any)}
                      className="text-[11px] font-black bg-transparent text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="under_design">تحت التصميم</option>
                      <option value="development">تطوير فني</option>
                      <option value="approved">معتمد</option>
                      <option value="deprecated">موقوف</option>
                    </select>
                  </div>
                </div>

                {/* Card Content body */}
                <div className="p-5 flex-1 flex flex-col space-y-4">
                  <div>
                    <span className="font-mono text-xs text-indigo-600 font-bold bg-indigo-50/50 px-2 py-0.5 rounded-md">{p.code}</span>
                    <h4 className="text-base font-bold text-slate-800 mt-1.5 line-clamp-1" title={p.name}>{p.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1">
                      الفئة العامة: <strong className="text-slate-600 font-semibold">{p.category}</strong> • الإصدار: <span className="font-mono text-slate-600">{p.version || 'v1.0'}</span>
                    </p>
                    
                    {/* Interactive BOM Linkage badge */}
                    {(() => {
                      const targetBom = getProductRecipe(p);
                      if (targetBom) {
                        return (
                          <div className="flex justify-between items-center mt-2.5 p-2 bg-emerald-50 text-emerald-800 border border-emerald-200/65 rounded-xl text-[10px] font-black">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-emerald-600" />
                              وصفة: {targetBom.name || 'وصفة إنتاج'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedRecipeProduct({ product: p, bom: targetBom })}
                              className="px-2 py-1 bg-[#1e293b] hover:bg-slate-900 text-white rounded-lg text-[9px] font-bold cursor-pointer transition-colors shadow-xs"
                              title="عرض تفاصيل وصفة المواد وتعديل مكوناتها الفنية"
                            >
                              عرض المكونات ↗
                            </button>
                          </div>
                        );
                      } else {
                        return (
                          <div className="flex justify-between items-center mt-2.5 p-1.5 bg-slate-50 text-slate-500 border border-slate-200/65 rounded-xl text-[10px] font-bold">
                            <span className="flex items-center gap-1">
                              <Layers className="w-3.5 h-3.5 text-slate-400" />
                              لا توجد وصفة مواد رقمية
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onTabChange?.('bom');
                              }}
                              className="px-2 py-1 bg-white hover:bg-indigo-50 border border-slate-200 text-indigo-700 rounded-lg text-[9px] font-black cursor-pointer transition-all active:scale-95 shadow-2xs"
                              title="تأسيس قائمة خامات وخطوات سريعة له"
                            >
                              + إنشاء وصفة (BOM)
                            </button>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {/* Inventory Section Block */}
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                    <p className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                       <Warehouse className="w-3.5 h-3.5 text-slate-500" />
                       مستوى المخزون بالمستوع
                      </span>
                      <span className="text-indigo-600 font-mono">{p.inventoryData?.currentStock || 0} / {p.inventoryData?.maxQty || 100} {p.unit}</span>
                    </p>
                    
                    {/* Visual Meter Bar */}
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${hasAlert ? 'bg-amber-500' : 'bg-indigo-600'}`}
                        style={{ width: `${stockPct}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>الحد الأدنى: {p.inventoryData?.minQty || 0}</span>
                      <span className="font-mono text-slate-600 bg-slate-200 px-1 py-0.5 rounded-xs truncate max-w-[120px]" title={p.inventoryData?.location || '-'}>
                        الموقع: {p.inventoryData?.location || '-'}
                      </span>
                    </div>

                    {hasAlert && (
                      <div className="bg-amber-100/50 border border-amber-200 text-amber-800 rounded-lg p-1.5 text-center flex items-center justify-center gap-1 text-[10px] font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        الكمية دون مخزون الأمان المقدر! أعد تعبئة الرصيد.
                      </div>
                    )}
                  </div>

                  {/* Manufacturing Section Block */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5" title="فترة الإنتاج المعيارية">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <div>
                        <p className="text-[9px] text-slate-400">زمن التصنيع</p>
                        <p className="font-bold text-slate-700">{p.manufacturingData?.leadTimeDays || 1} أيام</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" title="نسبة الهدر المسموح بها في أمر التشغيل">
                      <Cpu className="w-3.5 h-3.5 text-slate-400" />
                      <div>
                        <p className="text-[9px] text-slate-400">نسبة الهدر %</p>
                        <p className="font-bold text-slate-700">{p.manufacturingData?.scrapRate || 0}% هالك</p>
                      </div>
                    </div>
                  </div>

                  {/* Associated Production Orders block */}
                  {(() => {
                    const linkedOrders = productionOrders.filter(o => o && (o.productId === p.code || o.productId === p.name || o.productId === p.id));
                    if (linkedOrders.length === 0) return null;
                    return (
                      <div className="border-t border-slate-100 pt-3 space-y-1.5">
                        <p className="text-[10px] font-bold text-indigo-700 flex items-center gap-1.5">
                          <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                          أوامر الإنتاج المرتبطة ({linkedOrders.length})
                        </p>
                        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5">
                          {linkedOrders.map(o => {
                            let statusBadge = "bg-amber-50 text-amber-700 border-amber-200/60";
                            let statusLabel = "معلق";
                            if (o.status === 'in_progress' || o.status === 'running') {
                              statusBadge = "bg-blue-50 text-blue-700 border-blue-200/60";
                              statusLabel = "قيد التشغيل";
                            } else if (o.status === 'completed' || o.status === 'done' || o.status === 'finished') {
                              statusBadge = "bg-emerald-50 text-emerald-700 border-emerald-200/60";
                              statusLabel = "مكتمل";
                            } else if (o.status === 'cancelled') {
                              statusBadge = "bg-rose-50 text-rose-700 border-rose-200/60";
                              statusLabel = "ملغى";
                            }
                            return (
                              <div key={o.id} className={`text-[9.5px] px-1.5 py-0.5 rounded border ${statusBadge} font-mono flex items-center gap-1`} title={`${o.orderNumber}: كمية ${o.quantity} ${p.unit}`}>
                                <span className="font-bold">{o.orderNumber}</span>
                                <span className="text-slate-500">({o.quantity})</span>
                                <span className="opacity-80 font-bold">• {statusLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Operations Action Area */}
                <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex gap-2 justify-end opacity-90 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => handleOpenEditModal(p, e)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    تعديل البيانات
                  </button>
                  <button 
                    onClick={(e) => handleDeleteProduct(p.id, p.name, e)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    حذف للمنتج
                  </button>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="col-span-full bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <Package className="w-16 h-16 mx-auto text-slate-300 stroke-1" />
              <h4 className="text-base font-bold text-slate-700">لم نجد أي منتجات تطابق بحثك حالياً</h4>
              <p className="text-xs text-slate-400">جرب البحث بكلمات أبسط أو أضف منتجاً جديداً مباشرة من زر الإضافة.</p>
            </div>
          )}
        </div>
      )}

      {/* Table Mode Representation */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#f8fafc] border-b border-slate-200">
                <tr>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">رمز المنتج</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">اسم ومواصفات المنتج</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">وصفة الإنتاج</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">أوامر الإنتاج المرتبطة</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">النوع والفئة</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">العلامة التجارية</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">المخزون المستودعي</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide">محددات التصنيع</th>
                  <th className="p-4 font-black text-slate-500 uppercase tracking-wide text-center">الحالة البرمجية & التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((p) => {
                  const hasAlert = (p.inventoryData?.currentStock || 0) < (p.inventoryData?.minQty || 0);
                  
                  return (
                    <tr key={p.id} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="p-4">
                        {(() => {
                          const targetBom = getProductRecipe(p);
                          return targetBom ? (
                            <div className="min-w-[170px] rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5">
                              <div className="flex items-center gap-1.5 text-emerald-800 font-black">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                <span className="truncate" title={targetBom.name}>{targetBom.name || 'وصفة إنتاج'}</span>
                              </div>
                              <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-700">
                                <span>إصدار {targetBom.version || 'v1.0'}</span>
                                <button type="button" onClick={() => onTabChange?.('bom')} className="font-black underline underline-offset-2">فتح</button>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-400">
                              <AlertCircle className="w-3.5 h-3.5" /> بدون وصفة
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {p.image ? (
                              <img src={p.image} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <span className="font-mono text-indigo-650 font-bold bg-indigo-50/80 px-2 py-0.5 rounded text-xs">{p.code}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800">{p.name}</p>
                          <p className="text-[10px] text-slate-400">الإصدار: {p.version || 'v1.0'} • طريقة التكلفة: {p.costMethod || 'FIFO'}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        {(() => {
                          const linkedOrders = productionOrders.filter(o => o && (o.productId === p.code || o.productId === p.name || o.productId === p.id));
                          if (linkedOrders.length === 0) {
                            return <span className="text-slate-400 text-xs italic">لا توجد أوامر إنتاج</span>;
                          }
                          return (
                            <div className="flex flex-col gap-1 max-w-[180px]">
                              {linkedOrders.slice(0, 3).map(o => {
                                let statusBadge = "bg-amber-50 text-amber-705 border-amber-200/50";
                                let statusLabel = "معلق";
                                if (o.status === 'in_progress' || o.status === 'running') {
                                  statusBadge = "bg-blue-50 text-blue-755 border-blue-200/50";
                                  statusLabel = "تحت التشغيل";
                                } else if (o.status === 'completed' || o.status === 'done' || o.status === 'finished') {
                                  statusBadge = "bg-emerald-50 text-emerald-755 border-emerald-200/50";
                                  statusLabel = "مكتمل";
                                } else if (o.status === 'cancelled') {
                                  statusBadge = "bg-rose-50 text-rose-755 border-rose-200/50";
                                  statusLabel = "ملغى";
                                }
                                return (
                                  <div key={o.id} className={`text-[10.5px] px-1.5 py-0.5 rounded border ${statusBadge} flex items-center justify-between font-mono`} title={`كمية: ${o.quantity} ${p.unit}`}>
                                    <span className="font-bold">{o.orderNumber} ({o.quantity})</span>
                                    <span className="font-bold">{statusLabel}</span>
                                  </div>
                                );
                              })}
                              {linkedOrders.length > 3 && (
                                <span className="text-[9.5px] text-indigo-650 font-bold">+ {linkedOrders.length - 3} أوامر أخرى...</span>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${getTypeStyle(p.type)} block w-fit mb-1`}>
                          {getTypeName(p.type).split(' ')[0]}
                        </span>
                        <span className="text-xs text-slate-500">{p.category}</span>
                      </td>
                      <td className="p-4 text-slate-700 font-semibold">
                        {p.brand ? (
                          <span className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-indigo-505" />
                            {p.brand}
                          </span>
                        ) : (
                          <span className="text-slate-350 text-xs italic">- غير محددة -</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <p className={`font-bold ${hasAlert ? 'text-amber-600' : 'text-slate-800'}`}>
                            {p.inventoryData?.currentStock || 0} {p.unit}
                          </p>
                          <p className="text-[10px] text-slate-400">الموقع: {p.inventoryData?.location || '-'}</p>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-600 space-y-1">
                        <p>زمن التصنيع: <strong className="text-slate-800">{p.manufacturingData?.leadTimeDays || 1} يوم</strong></p>
                        <p>الهدر: <strong className="text-slate-800">{p.manufacturingData?.scrapRate || 0}%</strong></p>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                          <select
                            value={p.plmStatus || 'approved'}
                            onChange={(e) => changePlmStatus(p.id, e.target.value as any)}
                            className="px-2 py-1 text-xs font-bold rounded border bg-slate-50 text-slate-700 outline-none hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <option value="under_design">تحت التصميم</option>
                            <option value="development">تطوير فني</option>
                            <option value="approved">معتمد</option>
                            <option value="deprecated">موقوف</option>
                          </select>
                          
                          <div className="flex gap-1.5 ml-2 items-center">
                            {(() => {
                              const targetBom = getProductRecipe(p);
                              if (targetBom) {
                                return (
                                  <button
                                    onClick={() => setSelectedRecipeProduct({ product: p, bom: targetBom })}
                                    className="px-2 py-1 text-[10px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                    title="عرض وتعديل وصفة المواد الفعالة"
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                    الوصفة (BOM)
                                  </button>
                                );
                              } else {
                                return (
                                  <button
                                    onClick={() => {
                                      onTabChange?.('bom');
                                    }}
                                    className="px-2 py-1 text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                                    title="الانتقال إلى وصفات التصنيع لإعداد وصفة جديدة"
                                  >
                                    <Plus className="w-3 h-3 text-slate-400" />
                                    ربط وصفة
                                  </button>
                                );
                              }
                            })()}
                            
                            <button 
                              onClick={(e) => handleOpenEditModal(p, e)}
                              className="p-1 text-indigo-650 hover:bg-indigo-50 rounded-md border border-indigo-100"
                              title="تعديل هذا المنتج"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => handleDeleteProduct(p.id, p.name, e)}
                              className="p-1 text-rose-650 hover:bg-rose-50 rounded-md border border-rose-100"
                              title="حذف هذا المنتج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredProducts.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                لا توجد نتائج مسجلة مطابقة للبحث الحالي.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {filteredProducts.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm mt-4">
          <div className="text-sm text-slate-500">
            عرض <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> إلى <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, filteredProducts.length)}</span> من أصل <span className="font-bold text-slate-800">{filteredProducts.length}</span> منتج
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              السابق
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(filteredProducts.length / pageSize) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${currentPage === i + 1 ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(filteredProducts.length / pageSize), prev + 1))}
              disabled={currentPage === Math.ceil(filteredProducts.length / pageSize)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              التالي
            </button>
          </div>
        </div>
      )}

      {selectedRecipeProduct && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm" onClick={() => setSelectedRecipeProduct(null)}>
          <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-white shadow-2xl" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 bg-slate-900 p-5 text-white">
              <div>
                <div className="mb-1 flex items-center gap-2 text-emerald-300 text-xs font-bold"><Layers className="h-4 w-4" /> وصفة الإنتاج المرتبطة</div>
                <h2 className="text-xl font-black">{selectedRecipeProduct.product.name}</h2>
                <p className="mt-1 text-xs text-slate-300">{selectedRecipeProduct.bom.name || 'وصفة إنتاج'} · الإصدار {selectedRecipeProduct.bom.version || 'v1.0'}</p>
              </div>
              <button type="button" onClick={() => setSelectedRecipeProduct(null)} className="rounded-xl p-2 text-slate-300 hover:bg-white/10 hover:text-white" title="إغلاق">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[calc(90vh-100px)] overflow-y-auto p-5">
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3"><p className="text-[10px] font-bold text-indigo-500">كود المنتج</p><p className="mt-1 font-mono font-black text-indigo-900">{selectedRecipeProduct.product.code}</p></div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-600">عدد المكونات</p><p className="mt-1 font-black text-emerald-900">{Array.isArray(selectedRecipeProduct.bom.items) ? selectedRecipeProduct.bom.items.length : 0}</p></div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-600">الهالك المخطط</p><p className="mt-1 font-black text-amber-900">{Number(selectedRecipeProduct.bom.scrapPercentage || selectedRecipeProduct.bom.scrap_percentage || 0)}%</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-500">الوحدة</p><p className="mt-1 font-black text-slate-900">{selectedRecipeProduct.product.unit || 'وحدة'}</p></div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">المادة / المكون</th><th className="p-3">الكود</th><th className="p-3 text-center">الكمية</th><th className="p-3 text-center">الوحدة</th><th className="p-3 text-center">تكلفة الوحدة</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.isArray(selectedRecipeProduct.bom.items) && selectedRecipeProduct.bom.items.length > 0 ? selectedRecipeProduct.bom.items.map((item: any, index: number) => (
                      <tr key={`${item.materialId || item.ingredientId || index}`} className="hover:bg-indigo-50/40"><td className="p-3 font-bold text-slate-800">{item.name || item.materialName || 'مكون غير مسمى'}</td><td className="p-3 font-mono text-slate-500">{item.code || item.materialId || '-'}</td><td className="p-3 text-center font-black text-indigo-700">{Number(item.quantity || 0).toLocaleString()}</td><td className="p-3 text-center text-slate-600">{item.unit || 'وحدة'}</td><td className="p-3 text-center font-mono text-slate-700">{Number(item.unitCost || item.unit_cost || 0).toFixed(2)} ج.م</td></tr>
                    )) : <tr><td colSpan={5} className="p-8 text-center text-slate-400">لا توجد مكونات مسجلة لهذه الوصفة.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unified Add/Edit Interactive Modal with Tabbed Sections for premium experience */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-800">
                  {editingId ? `تحديث بيانات المنتج: [${formState.code}]` : 'إضافة منتج صناعي وتخطيطي جديد'}
                </h2>
                <p className="text-[11px] text-slate-400 mt-1 font-medium">املأ الأقسام الفرعية بعناية لتجهيز متطلبات الـ MRP والتصنيع</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1.5 bg-white border border-slate-200 rounded-xl transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Internal Form Section Tab Switcher */}
            <div className="bg-slate-100 px-5 pt-3 border-b border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveFormTab('basic')}
                className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition-all border-b-2 -mb-[2px] flex items-center gap-1 ${activeFormTab === 'basic' ? 'bg-white border-indigo-650 text-indigo-750 font-black' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Package className="w-4 h-4 text-indigo-500" />
                البيانات الأساسية والصورة
              </button>
              
              <button
                type="button"
                onClick={() => setActiveFormTab('inventory')}
                className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition-all border-b-2 -mb-[2px] flex items-center gap-1 ${activeFormTab === 'inventory' ? 'bg-white border-indigo-650 text-indigo-750 font-black' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Warehouse className="w-4 h-4 text-emerald-500" />
                بيانات المخزون المستودعي
              </button>

              <button
                type="button"
                onClick={() => setActiveFormTab('mfg')}
                className={`px-4 py-2 text-xs font-extrabold rounded-t-xl transition-all border-b-2 -mb-[2px] flex items-center gap-1 ${activeFormTab === 'mfg' ? 'bg-white border-indigo-650 text-indigo-750 font-black' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                <Cpu className="w-4 h-4 text-purple-500" />
                معايير التصنيع والـ MRP
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: Basic Information Code, Name, Brand, Image presets */}
              {activeFormTab === 'basic' && (
                <div className="space-y-4 animate-fadeIn">

                  {/* PRODUCT SOURCE SELECTION ENGINE */}
                  <div className="bg-slate-50/90 border border-slate-200/90 p-4 rounded-2xl space-y-3.5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-xs font-black text-slate-800">
                          مصدر تحديد المنتج أو المدخل الصناعي
                        </span>
                      </div>
                      {selectedLinkedItem && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-800 text-[11px] font-bold">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>مرتبط بـ: {selectedLinkedItem.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLinkedItem(null);
                              setFormState(prev => ({ ...prev, name: '' }));
                            }}
                            className="hover:text-rose-600 text-slate-400 mr-1"
                            title="إلغاء الربط"
                          >
                            <Unlink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Source Selection Buttons */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Option 1: POS */}
                      <button
                        type="button"
                        onClick={() => {
                          setProductSource('pos');
                          setPosSearchTerm('');
                        }}
                        className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                          productSource === 'pos'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white hover:bg-slate-100/80 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          productSource === 'pos' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          <Store className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">منتج من نقطة البيع (POS)</div>
                          <div className={`text-[10px] mt-0.5 ${productSource === 'pos' ? 'text-indigo-100' : 'text-slate-400'}`}>
                            استيراد صنف من قائمة المبيعات
                          </div>
                        </div>
                      </button>

                      {/* Option 2: Warehouse */}
                      <button
                        type="button"
                        onClick={() => {
                          setProductSource('warehouse');
                          setWarehouseSearchTerm('');
                        }}
                        className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                          productSource === 'warehouse'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white hover:bg-slate-100/80 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          productSource === 'warehouse' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          <Warehouse className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">صنف مخزني (المستودع)</div>
                          <div className={`text-[10px] mt-0.5 ${productSource === 'warehouse' ? 'text-indigo-100' : 'text-slate-400'}`}>
                            ربط مادة خام أو مكون من المخزن
                          </div>
                        </div>
                      </button>

                      {/* Option 3: Custom */}
                      <button
                        type="button"
                        onClick={() => {
                          setProductSource('custom');
                          setSelectedLinkedItem(null);
                        }}
                        className={`p-3 rounded-xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                          productSource === 'custom'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white hover:bg-slate-100/80 text-slate-700 border-slate-200'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          productSource === 'custom' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'
                        }`}>
                          <Plus className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-black truncate">منتج مخصص / جديد</div>
                          <div className={`text-[10px] mt-0.5 ${productSource === 'custom' ? 'text-indigo-100' : 'text-slate-400'}`}>
                            إدخال اسم جديد مع فحص التشابه
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* If POS Source selected: Show searchable list */}
                    {productSource === 'pos' && (
                      <div className="pt-2 border-t border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-indigo-600" />
                            اختر صنف من نقطة البيع لربطه وإدراجه في التصنيع (متوفر {dbProducts.length} منتج):
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="ابحث باسم المنتج أو الباركود أو التصنيف في نقطة البيع..."
                            value={posSearchTerm}
                            onChange={e => setPosSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 pr-9 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* List dropdown */}
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-sm">
                          {filteredPosProducts.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              {dbProducts.length === 0 ? 'جارٍ تحميل منتجات نقطة البيع...' : 'لا توجد نتائج مطابقة لبحثك في نقطة البيع'}
                            </div>
                          ) : (
                            filteredPosProducts.slice(0, 25).map((p: any) => {
                              const isAlreadyInProd = products.some(prod => prod.id !== editingId && normalizeArabicText(prod.name) === normalizeArabicText(p.name));
                              const isSelected = selectedLinkedItem?.id === p.id && selectedLinkedItem?.type === 'pos';
                              return (
                                <button
                                  key={`pos-item-${p.id}`}
                                  type="button"
                                  onClick={() => handleSelectPosProduct(p)}
                                  className={`w-full p-2.5 text-right flex items-center justify-between hover:bg-indigo-50/60 transition-colors text-xs cursor-pointer ${
                                    isSelected ? 'bg-indigo-50/90 font-black text-indigo-900' : 'text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 overflow-hidden">
                                      {p.image ? (
                                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <Store className="w-3.5 h-3.5 text-indigo-500" />
                                      )}
                                    </div>
                                    <div className="truncate">
                                      <span className="font-bold block truncate">{p.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {p.code || p.barcode || `POS-${p.id}`} {p.category_name ? `• ${p.category_name}` : ''}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-left shrink-0 flex items-center gap-2">
                                    <span className="font-mono text-xs font-black text-indigo-600">
                                      {Number(p.price || 0).toLocaleString()} ج.م
                                    </span>
                                    {isAlreadyInProd ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                        مسجل بالإنتاج
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                        اختيار للربط
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}

                    {/* If Warehouse Source selected: Show searchable list */}
                    {productSource === 'warehouse' && (
                      <div className="pt-2 border-t border-slate-200/70 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <Search className="w-3.5 h-3.5 text-emerald-600" />
                            اختر مادة خام أو صنف مخزني من مستودع الخامات (متوفر {dbIngredients.length} صنف):
                          </label>
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="ابحث بالاسم أو كود الصنف أو وحدة القياس في المستودع..."
                            value={warehouseSearchTerm}
                            onChange={e => setWarehouseSearchTerm(e.target.value)}
                            className="w-full px-4 py-2 pr-9 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        {/* List dropdown */}
                        <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl bg-white divide-y divide-slate-100 shadow-sm">
                          {filteredWarehouseItems.length === 0 ? (
                            <div className="p-3 text-center text-xs text-slate-400">
                              {dbIngredients.length === 0 ? 'جارٍ تحميل أصناف المستودع...' : 'لا توجد أصناف مخزنية مطابقة لبحثك'}
                            </div>
                          ) : (
                            filteredWarehouseItems.slice(0, 25).map((ing: any) => {
                              const isAlreadyInProd = products.some(prod => prod.id !== editingId && normalizeArabicText(prod.name) === normalizeArabicText(ing.name));
                              const isSelected = selectedLinkedItem?.id === ing.id && selectedLinkedItem?.type === 'warehouse';
                              return (
                                <button
                                  key={`ing-item-${ing.id}`}
                                  type="button"
                                  onClick={() => handleSelectWarehouseItem(ing)}
                                  className={`w-full p-2.5 text-right flex items-center justify-between hover:bg-emerald-50/60 transition-colors text-xs cursor-pointer ${
                                    isSelected ? 'bg-emerald-50 font-black text-emerald-900' : 'text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                      <Warehouse className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="truncate">
                                      <span className="font-bold block truncate">{ing.name}</span>
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        كود: {ing.item_code || `ING-${ing.id}`} • الوحدة: {ing.unit || 'كجم'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="text-left shrink-0 flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold text-slate-600">
                                      رصيد: {Number(ing.quantity || ing.current_stock || 0)} {ing.unit || ''}
                                    </span>
                                    {isAlreadyInProd ? (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                                        مسجل بالإنتاج
                                      </span>
                                    ) : (
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                                        اختيار للربط
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رمز المنتج الفني</label>
                      <input 
                        required
                        readOnly
                        type="text" 
                        value={formState.code}
                        className="w-full px-4 py-2 border border-slate-200 bg-slate-50 rounded-xl text-slate-500 font-mono text-left cursor-not-allowed text-sm" dir="ltr"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">يولّد النظام الرمز بشكل تلقائي تبعا لنوع المدخل</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          اسم المنتج / المدخل الصناعي
                          <span className="text-rose-500 mr-1">*</span>
                        </label>
                        {productSource === 'custom' && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            (فحص تلقائي لمنع تكرار أو تشابه الأسماء)
                          </span>
                        )}
                      </div>

                      <div className="relative">
                        <input 
                          required
                          type="text" 
                          placeholder={
                            productSource === 'pos' 
                              ? 'اختر من منتجات نقطة البيع أعلاه أو اكتب الاسم...' 
                              : productSource === 'warehouse'
                              ? 'اختر من أصناف المستودع أعلاه أو اكتب الاسم...'
                              : 'مثال: لوحة تشغيل ألمنيوم فئة 5'
                          }
                          value={formState.name || ''}
                          onChange={e => {
                            setFormState({...formState, name: e.target.value});
                            if (selectedLinkedItem && e.target.value !== selectedLinkedItem.name) {
                              setSelectedLinkedItem(null);
                            }
                          }}
                          className={`w-full px-4 py-2 border rounded-xl outline-none text-sm transition-all ${
                            validationResult.status === 'duplicate'
                              ? 'border-rose-400 focus:ring-2 focus:ring-rose-400/20 bg-rose-50/30 text-rose-900 font-bold'
                              : validationResult.status === 'similar' && productSource === 'custom'
                              ? 'border-amber-400 focus:ring-2 focus:ring-amber-400/20 bg-amber-50/30 text-amber-900'
                              : validationResult.status === 'unique' && formState.name
                              ? 'border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 bg-emerald-50/20 text-slate-800'
                              : 'border-slate-200 focus:ring-2 focus:ring-indigo-500'
                          }`}
                        />

                        {formState.name && formState.name.trim() && (
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                            {validationResult.status === 'duplicate' && (
                              <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xs font-black">
                                ✕
                              </span>
                            )}
                            {validationResult.status === 'similar' && productSource === 'custom' && (
                              <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-black">
                                ⚠
                              </span>
                            )}
                            {validationResult.status === 'unique' && (
                              <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">
                                ✓
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Real-time feedback badge / warning banner */}
                      {formState.name && formState.name.trim() && (
                        <div className="mt-2 text-xs">
                          {validationResult.status === 'duplicate' && (
                            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 space-y-1 animate-fadeIn">
                              <div className="flex items-center gap-1.5 font-black text-rose-900 text-xs">
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>تنبيه: الاسم متطابق مع منتج مسجل بالنظام!</span>
                              </div>
                              <p className="text-[11px] text-rose-700 leading-relaxed font-medium">
                                {validationResult.message}
                              </p>
                              <p className="text-[10px] text-rose-600 font-black">
                                ⛔ لا يمكن حفظ المنتج بهذا الاسم لتفادي الازدواجية وتضارب القيود.
                              </p>
                            </div>
                          )}

                          {validationResult.status === 'similar' && productSource === 'custom' && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 space-y-1 animate-fadeIn">
                              <div className="flex items-center gap-1.5 font-black text-amber-900 text-xs">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>تحذير تشابه: يوجد منتج باسم مقارب جداً في النظام!</span>
                              </div>
                              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                                {validationResult.message}
                              </p>
                              <p className="text-[10px] text-amber-700 font-bold">
                                💡 يُرجى تعديل الاسم وإضافة مواصفة أو تمييز واضح لمنع اللبس مع المنتجات القائمة.
                              </p>
                            </div>
                          )}

                          {validationResult.status === 'unique' && (
                            <div className="p-2 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-800 flex items-center gap-1.5 font-bold text-[11px] animate-fadeIn">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>{validationResult.message}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">العلامة التجارية (اختياري)</label>
                      <input 
                        type="text" 
                        placeholder="مثال: يونيليفر، حديد أرسيلورميتال إلخ..."
                        value={formState.brand || ''}
                        onChange={e => setFormState({...formState, brand: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الفئة التصنيفية</label>
                      <select 
                        value={formState.category}
                        onChange={e => setFormState({...formState, category: e.target.value})}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm cursor-pointer"
                      >
                        <option value="معادن">معادن</option>
                        <option value="هياكل">هياكل وميكانيكا</option>
                        <option value="سيارات">سيارات ومحركات</option>
                        <option value="إلكترونيات">رقاقات وإلكترونيات</option>
                        <option value="بلاستيك">بلاستيك وبتروكيماويات</option>
                        <option value="أخشاب">أخشاب وأثاث</option>
                        <option value="أقمشة">أقمشة ومسوجات</option>
                        <option value="كرتون">أكياس وكرتون تغليف</option>
                        <option value="أخرى">أخرى وطارئة</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">نوع المنتج للتصنيع</label>
                      <select 
                        value={formState.type}
                        onChange={e => {
                          const newType = e.target.value as ProductDef['type'];
                          setFormState({
                            ...formState, 
                            type: newType,
                            code: editingId ? formState.code : generateCode(newType)
                          });
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs cursor-pointer bg-white"
                      >
                        <option value="raw">مادة خام أساسية</option>
                        <option value="semi_finished">نصف مصنع (مكون داخلي)</option>
                        <option value="finished">منتج نهائي للبيع</option>
                        <option value="by_product">منتج ثانوي متفرع</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة القياسية</label>
                      <select 
                        value={formState.unit}
                        onChange={e => setFormState({...formState, unit: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs cursor-pointer bg-white"
                      >
                        <option value="قطعة">قطعة</option>
                        <option value="طن">طن متري</option>
                        <option value="كجم">كجم جرام</option>
                        <option value="لتر">لتر سائل</option>
                        <option value="متر">متر طولي</option>
                        <option value="م3">متر مكعب</option>
                        <option value="مجموعة">مجموعة متكاملة (Kit)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">محاسبة وتكاليف المستودع</label>
                      <select 
                        value={formState.costMethod}
                        onChange={e => setFormState({...formState, costMethod: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs cursor-pointer bg-white"
                      >
                        <option value="FIFO">FIFO (الوارد أولاً يصرف أولاً)</option>
                        <option value="Standard">Standard (تكلفة معيارية للـ MRP)</option>
                        <option value="Actual">Actual (تكلفة التوريد الفعلية)</option>
                        <option value="Average">Average (المتوسط المرجح السعري)</option>
                      </select>
                    </div>
                  </div>

                  {/* Product Image Section Selector */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                    <label className="block text-xs font-black text-slate-700">صورة العينات والمنتج الفني</label>
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                      <div className="w-24 h-24 rounded-xl bg-white border border-slate-300 overflow-hidden flex-shrink-0 flex items-center justify-center relative shadow-inner">
                        {formState.image ? (
                          <img src={formState.image} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1 space-y-2">
                        <p className="text-[11px] text-slate-500 font-medium">يمكنك رفع صورة من حاسوبك، إدخال رابط خارجي بشكل يدوي، أو النقر على النماذج الجاهزة للتسهيل الفوري.</p>
                        
                        <div className="flex gap-2 flex-wrap">
                          <input 
                            type="file" 
                            accept="image/*" 
                            ref={fileInputRef} 
                            onChange={handleFileChange} 
                            className="hidden" 
                          />
                          <button 
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-750 hover:bg-indigo-100 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all cursor-pointer border border-indigo-200/50"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            تحميل صورة من جهازك
                          </button>
                          
                          {formState.image && (
                            <button 
                              type="button"
                              onClick={() => setFormState(prev => ({ ...prev, image: '' }))}
                              className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-extrabold transition-all"
                            >
                              إزالة الصورة
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick presets list */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-400 font-bold">نماذج سريعة جاهزة للاختيار:</p>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {IMAGE_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setFormState(prev => ({ ...prev, image: preset.url }))}
                            className={`p-1 border rounded-lg hover:border-indigo-500 transition-all text-center flex flex-col items-center gap-1 ${formState.image === preset.url ? 'border-2 border-indigo-600 bg-indigo-50/20' : 'border-slate-200 bg-white'}`}
                          >
                            <img src={preset.url} alt={preset.name} className="w-8 h-8 object-cover rounded-md" referrerPolicy="no-referrer" />
                            <span className="text-[8px] text-slate-500 font-semibold truncate w-full">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom URL Input block */}
                    <div>
                      <input 
                        type="url"
                        placeholder="أو أدخل رابط ويب مخصص للصورة هنا..."
                        value={formState.image || ''}
                        onChange={e => setFormState({...formState, image: e.target.value})}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* PLM Status + Revision number fields */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">حالة دورة الحياة للمنتج</label>
                      <select 
                        value={formState.plmStatus || 'approved'}
                        onChange={e => setFormState({...formState, plmStatus: e.target.value as any})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-none bg-white cursor-pointer font-bold"
                      >
                        <option value="under_design">تحت التصميم (Under Design) - مقفل للإنتاج</option>
                        <option value="development">تحت التطوير الفني (Dev Gate) - مقفل للإنتاج</option>
                        <option value="approved">معتمد وجاهز للإنتاج (Approved Gate) - نشط</option>
                        <option value="deprecated">موقوف تدريجياً (Deprecated Gate) - مقفل للإنتاج</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الإصدار والمراجعة الفنية</label>
                      <input 
                        type="text" 
                        placeholder="v1.0"
                        value={formState.version || 'v1.0'}
                        onChange={e => setFormState({...formState, version: e.target.value})}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-1 focus:ring-indigo-500 outline-none bg-white font-mono text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Inventory Warehouse Data Parameters */}
              {activeFormTab === 'inventory' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-150 text-emerald-900 flex gap-3 text-xs mb-2">
                    <Warehouse className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                    <div>
                      <strong className="block font-black">بيانات وحسابات المستودع التخطيطية</strong>
                      <span className="text-emerald-700 font-medium mt-0.5 block">
                        تمكّن هذه القيم نظام الـ MRP الذكي من فحص الكميات القابلة للتخصيص تلقائياً وإطلاق تنبيهات "مخزون الأمان" عند استشعار الهبوط لمنع تعطل التصنيع.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الفعلي الحالي بالمخزن</label>
                      <input 
                        required
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0"
                        value={formState.inventoryData?.currentStock ?? 0}
                        onChange={e => setFormState({
                          ...formState,
                          inventoryData: {
                            ...formState.inventoryData,
                            currentStock: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                      />
                    </div>

                    <div className="flex flex-col">
                      <label className="block text-xs font-bold text-slate-700 mb-1">موقع التخزين المادي بالتفصيل</label>
                      <select 
                        value={formState.inventoryData?.location || ''}
                        onChange={e => {
                          const newLocation = e.target.value;
                          const existingProductInLocation = products.find(p => p.code?.trim() && formState.code?.trim() && p.code.toLowerCase() === formState.code?.toLowerCase() && p.inventoryData?.location === newLocation && p.id !== editingId);
                          
                          setFormState({
                            ...formState,
                            inventoryData: {
                              ...formState.inventoryData,
                              location: newLocation,
                              ...(existingProductInLocation ? { currentStock: existingProductInLocation.inventoryData?.currentStock || 0 } : {})
                            }
                          });
                        }}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold bg-white text-slate-700 cursor-pointer hover:bg-slate-50 transition-all"
                      >
                        <option value="">اختر المخزن الشامل...</option>
                        {AVAILABLE_WAREHOUSES.map(w => (
                          <option key={w} value={w}>{w}</option>
                        ))}
                      </select>

                      {/* Info alert if product exists in this warehouse */}
                      {(() => {
                        const existingProductInLocation = formState.code?.trim() && formState.inventoryData?.location ? products.find(p => p.code?.trim() && p.code.toLowerCase() === formState.code?.toLowerCase() && p.inventoryData?.location === formState.inventoryData?.location && p.id !== editingId) : null;
                        if (existingProductInLocation) {
                          return (
                            <div className="mt-3 text-xs text-indigo-700 bg-indigo-50 p-2.5 rounded-xl border border-indigo-100 flex items-start gap-2 animate-fadeIn shadow-sm">
                              <Info className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600" />
                              <span className="font-semibold leading-relaxed">
                                هذا المنتج <strong>مسجل بالفعل</strong> في هذا المخزن برصيد فعلي <strong>{existingProductInLocation.inventoryData?.currentStock || 0} {formState.unit || 'وحدة'}</strong>.<br/>
                                تم استدعاء الرصيد الحالي للمطابقة.
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأدنى لطلب الأمان (Safety Stock / Min)</label>
                      <input 
                        required
                        type="number"
                        min="0"
                        step="any"
                        placeholder="10"
                        value={formState.inventoryData?.minQty ?? 10}
                        onChange={e => setFormState({
                          ...formState,
                          inventoryData: {
                            ...formState.inventoryData,
                            minQty: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-rose-700"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">يطلق النظام إشارة طارئة فورا إذا نقص الرصيد الفعلي عن هذا الرقم</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى للمستودع السعة الاستيعابية (Max Qty)</label>
                      <input 
                        required
                        type="number"
                        min="0"
                        step="any"
                        placeholder="1000"
                        value={formState.inventoryData?.maxQty ?? 1000}
                        onChange={e => setFormState({
                          ...formState,
                          inventoryData: {
                            ...formState.inventoryData,
                            maxQty: parseFloat(e.target.value) || 0
                          }
                        })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold text-emerald-800"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">يمنعون بموجبه جدولة تجميعية جديدة تتجاوز السعة الاستيعابية للمخازن</p>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Manufacturing & MRP Settings Parameters */}
              {activeFormTab === 'mfg' && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="p-4 bg-purple-50 rounded-xl border border-purple-150 text-purple-900 flex gap-3 text-xs mb-2">
                    <Cpu className="w-5 h-5 text-purple-600 flex-shrink-0" />
                    <div>
                      <strong className="block font-black">محددات مهارة التصنيع والتشغيل الفني</strong>
                      <span className="text-purple-700 font-medium mt-0.5 block">
                        بيانات لازمة لهندسة الإنتاج وحسابات زمن التحضير والأحمال القياسية لمخططي التصنيع والجدولة الذكية للورش.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">فترة التوريد/الإنتاج الفنية (Lead Time Days)</label>
                      <div className="relative">
                        <input 
                          required
                          type="number"
                          min="1"
                          placeholder="3"
                          value={formState.manufacturingData?.leadTimeDays ?? 3}
                          onChange={e => setFormState({
                            ...formState,
                            manufacturingData: {
                              ...formState.manufacturingData,
                              leadTimeDays: parseInt(e.target.value, 10) || 1
                            }
                          })}
                          className="w-full pl-12 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">أيام ميزانية</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">حجم الدفعة المعياري (Batch Size Ratio)</label>
                      <input 
                        required
                        type="number"
                        min="1"
                        placeholder="1"
                        value={formState.manufacturingData?.batchSizeRatio ?? 1}
                        onChange={e => setFormState({
                          ...formState,
                          manufacturingData: {
                            ...formState.manufacturingData,
                            batchSizeRatio: parseFloat(e.target.value) || 1
                          }
                        })}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">نسبة الهدر المعياري المتوقع (Expected Scrap %)</label>
                      <div className="relative">
                        <input 
                          required
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          placeholder="2.0"
                          value={formState.manufacturingData?.scrapRate ?? 0}
                          onChange={e => setFormState({
                            ...formState,
                            manufacturingData: {
                              ...formState.manufacturingData,
                              scrapRate: parseFloat(e.target.value) || 0
                            }
                          })}
                          className="w-full pl-8 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-semibold"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">نسبة المواد التالفة افتراضياً عند الإعداد وتحسب تلقائياً في التكلفة</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">مركز العمل الافتراضي للتصنيع</label>
                      <select 
                        value={formState.manufacturingData?.defaultWorkCenterId || ''}
                        onChange={e => setFormState({
                          ...formState,
                          manufacturingData: {
                            ...formState.manufacturingData,
                            defaultWorkCenterId: e.target.value
                          }
                        })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs bg-white cursor-pointer"
                      >
                        <option value="">- اختر مركز عمل مفضل -</option>
                        {workCenters.map((wc, index) => (
                          <option key={wc.id || index} value={wc.id || wc.code}>
                            {wc.name} ({wc.code})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">يوجّه النظام تتبع أوامر التشغيل لهذا القسم افتراضياً</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Bottom Navigation Actions */}
              <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => {
                      if (activeFormTab === 'inventory') setActiveFormTab('basic');
                      if (activeFormTab === 'mfg') setActiveFormTab('inventory');
                    }}
                    disabled={activeFormTab === 'basic'}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all"
                  >
                    السابق
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (activeFormTab === 'basic') setActiveFormTab('inventory');
                      else if (activeFormTab === 'inventory') setActiveFormTab('mfg');
                    }}
                    disabled={activeFormTab === 'mfg'}
                    className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-bold transition-all"
                  >
                    التالي
                  </button>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                  >
                    إلغاء التراجع
                  </button>
                  
                  <button 
                    type="submit" 
                    disabled={validationResult.status === 'duplicate' || (validationResult.status === 'similar' && productSource === 'custom')}
                    title={
                      validationResult.status === 'duplicate' 
                        ? validationResult.message 
                        : validationResult.status === 'similar' && productSource === 'custom'
                        ? 'يرجى تغيير الاسم لتفادي التشابه مع منتجات أخرى في النظام'
                        : ''
                    }
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${
                      validationResult.status === 'duplicate' || (validationResult.status === 'similar' && productSource === 'custom')
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm-indigo transform active:scale-95 cursor-pointer'
                    }`}
                  >
                    {editingId ? 'حفظ التحديثات للمنتج' : 'حفظ إضافة المنتج'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
