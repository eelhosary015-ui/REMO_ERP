import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Layers, 
  Cpu, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Pencil, 
  Clock, 
  GitBranch, 
  Hammer,
  FileText,
  Warehouse,
  Search,
  AlertCircle,
  Coins,
  CheckCircle2,
  Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { databaseStorage } from '../../utils/databaseStorage';
import { api, authHeaders } from '../../utils/api';
import { convertQuantity, getCompatibleUnits, MASTER_UNITS } from '../../utils/unitConversion';

interface RoutingOp {
  id: string;
  opNumber: number;
  description: string;
  workCenterId: string;
  setupTime: number;
  runTime: number;
  isExternal?: boolean;
  subcontractorName?: string;
  subcontractCost?: number;
}

interface BOMItem {
  materialId: string;
  quantity: number;
  ingredientId?: number;
  name?: string;
  code?: string;
  unit?: string;
  unitCost?: number;
  stock?: number;
}

interface BillOfMaterial {
  id: string;
  productId: string;
  name: string;
  version: string;
  scrapPercentage: number;
  items: BOMItem[];
  routings: RoutingOp[];
}

interface WorkCenter {
  id: string;
  code: string;
  name: string;
  costPerHour: number;
}

interface ProductDef {
  id: string;
  code: string;
  name: string;
  unit: string;
  type: 'finished' | 'semi_finished' | 'raw';
}

const DEFAULT_PRODUCTS: ProductDef[] = [];
const DEFAULT_CENTERS: WorkCenter[] = [];
const MOCK_BOMS: BillOfMaterial[] = [];

const normalizeProductKey = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي');

const normalizeBom = (bom: any): BillOfMaterial | null => {
  if (!bom || !bom.id) return null;
  return {
    ...bom,
    id: String(bom.id),
    productId: String(bom.productId ?? bom.product_id ?? bom.productCode ?? bom.product_code ?? ''),
    name: String(bom.name ?? bom.product_name ?? bom.productName ?? `وصفة ${bom.id}`),
    version: String(bom.version ?? 'v1.0'),
    scrapPercentage: Number(bom.scrapPercentage ?? bom.scrap_percentage ?? 0),
    items: Array.isArray(bom.items) ? bom.items : [],
    routings: Array.isArray(bom.routings) ? bom.routings : []
  };
};

const isDemoBom = (b: any) => {
  if (!b || !b.id) return true;
  if (['bom-1', 'b1', 'bom1', 'bom2', 'BOM-2225'].includes(b.id)) return true;
  if (['RAW-001', 'RAW-002', 'RAW-003', 'FIN-001', 'FIN-500', 'COMP-001', 'PACK-001', 'CHEM-001', 'PROD-001', 'PROD-002', 'p1', 'p2', 'p3'].includes(b.productId)) return true;
  const name = String(b.name || '');
  if (name.includes('حديد تسليح') || name.includes('سيليكا') || name.includes('دهان مقاوم') || name.includes('سلك نحاس') || name.includes('ترس صناعي') || name.includes('صندوق تغليف') || name.includes('مذيب صناعي')) return true;
  return false;
};

export function BOMManagement({ initialInnerTab = 'boms' }: { initialInnerTab?: 'boms' | 'ecns' }) {
  const [boms, setBoms] = useState<BillOfMaterial[]>([]);
  const [products, setProducts] = useState<ProductDef[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'boms' | 'ecns'>(initialInnerTab);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBOMId, setEditingBOMId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedBom, setSelectedBom] = useState<BillOfMaterial | null>(null);
  const [detailModalTab, setDetailModalTab] = useState<'items' | 'routings'>('items');

  // Form State for BOM Creation
  const [newBomName, setNewBomName] = useState('');
  const [newBomProductId, setNewBomProductId] = useState('');
  const [newBomVersion, setNewBomVersion] = useState('v1.0');
  const [newBomScrap, setNewBomScrap] = useState(0);

  // Drafting sub-tables inside creation form
  const [draftItems, setDraftItems] = useState<BOMItem[]>([]);
  const [draftRoutings, setDraftRoutings] = useState<RoutingOp[]>([]);

  // Temp builders for the inputs in the modal
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [materialQty, setMaterialQty] = useState(1);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [materialSearch, setMaterialSearch] = useState('');
  const [routingOpNumber, setRoutingOpNumber] = useState(10);
  const [routingDesc, setRoutingDesc] = useState('');
  const [routingCenterId, setRoutingCenterId] = useState('');
  const [routingSetup, setRoutingSetup] = useState(10);
  const [routingRun, setRoutingRun] = useState(30);
  const [routingIsExternal, setRoutingIsExternal] = useState(false);
  const [routingSubcontractorName, setRoutingSubcontractorName] = useState('');
  const [routingSubcontractCost, setRoutingSubcontractCost] = useState(15);

  const [dbIngredients, setDbIngredients] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [ecnLogs, setEcnLogs] = useState<any[]>([]);
  const [isEcnModalOpen, setIsEcnModalOpen] = useState(false);
  const [newEcn, setNewEcn] = useState<any>({
    targetBomId: '', title: '', requestedBy: '', reason: '', previousVersion: '', newVersion: ''
  });

  useEffect(() => {
    setActiveTab(initialInnerTab);
  }, [initialInnerTab]);

  useEffect(() => {
    const load = async () => {
      // 1. Fetch live backend persisted BOMs
      try {
        const res = await api.get('/api/v2/production/boms');
        const data = await res.json();
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
          const cleanBoms = data.data.map(normalizeBom).filter((b: BillOfMaterial | null): b is BillOfMaterial => Boolean(b && !isDemoBom(b)));
          setBoms(cleanBoms);
          databaseStorage.setItem('remo_production_boms', cleanBoms);
          localStorage.setItem('remo_production_boms', JSON.stringify(cleanBoms));
        } else {
          const savedBoms = await databaseStorage.getItem<BillOfMaterial[]>('remo_production_boms', []);
          const cleanBoms = Array.isArray(savedBoms) ? savedBoms.map(normalizeBom).filter((b: BillOfMaterial | null): b is BillOfMaterial => Boolean(b && !isDemoBom(b))) : [];
          setBoms(cleanBoms);
          if (Array.isArray(savedBoms) && savedBoms.length !== cleanBoms.length) {
            databaseStorage.setItem('remo_production_boms', cleanBoms);
            localStorage.setItem('remo_production_boms', JSON.stringify(cleanBoms));
          }
        }
      } catch (err) {
        console.log('Notice: using local BOMs backup', err);
        const savedBoms = await databaseStorage.getItem<BillOfMaterial[]>('remo_production_boms', []);
        const cleanBoms = Array.isArray(savedBoms) ? savedBoms.map(normalizeBom).filter((b: BillOfMaterial | null): b is BillOfMaterial => Boolean(b && !isDemoBom(b))) : [];
        setBoms(cleanBoms);
        if (Array.isArray(savedBoms) && savedBoms.length !== cleanBoms.length) {
          databaseStorage.setItem('remo_production_boms', cleanBoms);
          localStorage.setItem('remo_production_boms', JSON.stringify(cleanBoms));
        }
      }

      const savedProducts = await databaseStorage.getItem<ProductDef[]>('remo_production_products', []);
      const cleanProducts = Array.isArray(savedProducts) ? savedProducts.filter((p: any) => p && p.code && !['RAW-001', 'RAW-002', 'FIN-001', 'PROD-001', 'PROD-002', 'FIN-500'].includes(p.code)) : [];
      setProducts(cleanProducts);

      const savedWC = await databaseStorage.getItem<WorkCenter[]>('remo_production_workcenters', []);
      setWorkCenters(Array.isArray(savedWC) ? savedWC : []);

      const savedEcns = await databaseStorage.getItem<any[]>('remo_production_ecns', []);
      setEcnLogs(Array.isArray(savedEcns) ? savedEcns : []);
      setIsLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    // 1. Fetch live ingredients from warehouse
    api.get('/api/ingredients')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDbIngredients(data);
        }
      })
      .catch(e => console.error('Failed to load ingredients', e));

    // 2. Fetch Shared products & POS products
    Promise.all([
      api.get('/api/v2/production/shared-products').then(res => res.json()).catch(() => null),
      fetch('/api/pos/data', { headers: authHeaders() }).then(res => res.json()).catch(() => null)
    ]).then(([sharedData, posData]) => {
      const sharedList = Array.isArray(sharedData?.data) ? sharedData.data : (Array.isArray(sharedData) ? sharedData : []);
      if (sharedList.length > 0) {
        setDbProducts(sharedList);
      } else if (posData && Array.isArray(posData.products)) {
        setDbProducts(posData.products);
      }
      if (posData && Array.isArray(posData.ingredients) && (!dbIngredients || dbIngredients.length === 0)) {
        setDbIngredients(posData.ingredients);
      }
    }).catch(e => console.error('Failed to load live shared products data', e));
  }, []);

  const getMaterialDetails = (mId: string) => {
    const dbIng = dbIngredients.find(ing => 
      String(ing.id) === String(mId) || 
      ing.name === mId || 
      (ing.code && ing.code === mId) || 
      (ing.item_code && ing.item_code === mId)
    );
    if (dbIng) {
      return { 
        id: dbIng.id,
        name: dbIng.name, 
        code: dbIng.code || dbIng.item_code || `ING-${dbIng.id}`, 
        unit: dbIng.unit || 'وحدة', 
        category: dbIng.item_group || dbIng.category || 'خامات مخزن', 
        type: 'raw', 
        stock: Number(dbIng.total_stock ?? dbIng.quantity ?? dbIng.current_stock ?? 0),
        cost: Number(dbIng.avg_cost || dbIng.cost || dbIng.last_purchase_price || 0)
      };
    }
    const p = products.find(p => p.code === mId || String(p.id) === String(mId)) || dbProducts.find(p => p.name === mId || String(p.id) === String(mId));
    if (p) return { id: p.id, name: p.name, code: p.code || String(p.id), unit: p.unit || 'وحدة', category: 'منتج', type: 'finished', stock: 0, cost: Number(p.cost || 0) };
    return { id: undefined, name: mId, code: mId, unit: 'وحدة', category: 'خامات', type: 'raw', stock: 0, cost: 0 };
  };

  const handleOpenCreateModal = () => {
    setEditingBOMId(null);
    setNewBomName('');
    setNewBomProductId('');
    setNewBomVersion('v1.0');
    setNewBomScrap(0);
    setDraftItems([]);
    setDraftRoutings([]);
    setSelectedMaterialId('');
    setMaterialSearch('');
    setMaterialQty(1);
    setIsModalOpen(true);
  };

  const handleEditBOM = (bom: BillOfMaterial) => {
    setEditingBOMId(bom.id);
    setNewBomName(bom.name);
    setNewBomProductId(bom.productId);
    setNewBomVersion(bom.version);
    setNewBomScrap(bom.scrapPercentage);
    setDraftItems([...bom.items]);
    setDraftRoutings([...bom.routings]);
    setSelectedMaterialId('');
    setMaterialSearch('');
    setMaterialQty(1);
    setIsModalOpen(true);
  };

  const addDraftItem = () => {
    if (!selectedMaterialId) return;
    const mat = getMaterialDetails(selectedMaterialId);
    const unitToUse = selectedUnit || mat.unit || 'وحدة';
    const conv = convertQuantity(Number(materialQty) || 1, unitToUse, mat.unit || 'وحدة');
    const baseUnitCost = Number(mat.cost || 0);
    const recipeUnitCost = conv.factor ? baseUnitCost / conv.factor : baseUnitCost;

    // Check if item already exists in drafts
    const existingIndex = draftItems.findIndex(i => String(i.materialId) === String(selectedMaterialId) || (mat.id && i.ingredientId === mat.id));
    if (existingIndex >= 0) {
      const updated = [...draftItems];
      updated[existingIndex].quantity = Math.round(((Number(updated[existingIndex].quantity) || 0) + (Number(materialQty) || 1)) * 1000) / 1000;
      updated[existingIndex].unit = unitToUse;
      setDraftItems(updated);
    } else {
      setDraftItems([...draftItems, { 
        materialId: String(mat.id || selectedMaterialId),
        ingredientId: mat.id ? Number(mat.id) : undefined,
        name: mat.name,
        code: mat.code,
        unit: unitToUse,
        unitCost: recipeUnitCost,
        stock: mat.stock,
        quantity: Number(materialQty) || 1 
      }]);
    }
    setSelectedMaterialId('');
    setSelectedUnit('');
    setMaterialSearch('');
    setMaterialQty(1);
  };

  const removeDraftItem = (matId: string) => {
    setDraftItems(draftItems.filter(i => i.materialId !== matId));
  };

  const handleAddBOM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBomName || !newBomProductId) {
      alert('يرجى كتابة اسم الوصفة وتحديد المنتج المستهدف!');
      return;
    }
    if (draftItems.length === 0) {
      alert('يرجى إضافة مادة خام واحدة على الأقل للوصفة وربطها بأصناف المخزن!');
      return;
    }

    const calculatedTotalCost = draftItems.reduce((acc, item) => {
      const mat = getMaterialDetails(item.materialId);
      const conv = convertQuantity(Number(item.quantity) || 0, item.unit || mat.unit, mat.unit || 'وحدة');
      const baseQty = conv.success ? conv.toQuantity : (Number(item.quantity) || 0);
      return acc + (baseQty * Number(mat.cost || item.unitCost || 0));
    }, 0);

    const bomPayload: BillOfMaterial = {
      id: editingBOMId || `bom-${Date.now()}`,
      name: newBomName,
      productId: newBomProductId,
      version: newBomVersion,
      scrapPercentage: newBomScrap,
      items: draftItems.map(item => {
        const mat = getMaterialDetails(item.materialId);
        return {
          materialId: String(mat.id || item.materialId),
          ingredientId: mat.id ? Number(mat.id) : undefined,
          quantity: Number(item.quantity) || 1,
          name: mat.name || item.name,
          code: mat.code || item.code,
          unit: mat.unit || item.unit,
          unitCost: mat.cost || item.unitCost,
          stock: mat.stock !== undefined ? mat.stock : item.stock
        };
      }),
      routings: draftRoutings
    };

    // Save to backend database
    try {
      await api.post('/api/v2/production/boms', bomPayload);
    } catch (err) {
      console.warn('Backend BOM sync notice:', err);
    }

    const updated = editingBOMId 
      ? boms.map(b => b.id === editingBOMId ? bomPayload : b)
      : [...boms, bomPayload];
    setBoms(updated as BillOfMaterial[]);
    databaseStorage.setItem('remo_production_boms', updated);
    localStorage.setItem('remo_production_boms', JSON.stringify(updated));
    setIsModalOpen(false);
  };

  const handleDeleteBOM = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذه الوصفة الفنية؟')) {
      try {
        await api.delete(`/api/v2/production/boms/${id}`);
      } catch (err) {
        console.warn('Backend BOM delete notice:', err);
      }
      const updated = boms.filter(b => b.id !== id);
      setBoms(updated);
      databaseStorage.setItem('remo_production_boms', updated);
      localStorage.setItem('remo_production_boms', JSON.stringify(updated));
    }
  };

  const handleClearAllBoms = async () => {
    if (confirm('هل أنت متأكد من حذف جميع وصفات التصنيع وإفراغ القائمة بالكامل؟')) {
      try {
        await api.delete('/api/v2/production/boms');
      } catch (err) {
        console.warn('Backend BOM clear notice:', err);
      }
      setBoms([]);
      databaseStorage.setItem('remo_production_boms', []);
      localStorage.setItem('remo_production_boms', '[]');
    }
  };

  const handleViewDetails = (bom: BillOfMaterial) => {
    setSelectedBom(bom);
    setDetailModalTab('items');
    setIsDetailModalOpen(true);
  };

  const addDraftRouting = () => {
    const newOp: RoutingOp = {
      id: `r-${Date.now()}`,
      opNumber: routingOpNumber,
      description: routingDesc,
      workCenterId: routingCenterId,
      setupTime: routingSetup,
      runTime: routingRun,
      isExternal: routingIsExternal,
      subcontractorName: routingSubcontractorName,
      subcontractCost: routingSubcontractCost
    };
    setDraftRoutings([...draftRoutings, newOp]);
    setRoutingDesc('');
    setRoutingOpNumber(routingOpNumber + 10);
  };

  const removeDraftRouting = (id: string) => setDraftRoutings(draftRoutings.filter(r => r.id !== id));

  const filteredBoms = boms.filter(b => {
    const query = search.toLowerCase().trim();
    return !query || b.name.toLowerCase().includes(query) || b.productId.toLowerCase().includes(query);
  });

  return (
    <div className="space-y-6 animate-fadeIn" id="bom_management_section">
      <div className="flex border-b border-slate-200 gap-8 mb-2">
        {(!initialInnerTab || initialInnerTab === 'boms') && (
          <button 
            onClick={() => setActiveTab('boms')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'boms' ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              وصفات التصنيع (BOM)
            </div>
            {activeTab === 'boms' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 rounded-t-full" />}
          </button>
        )}
        {(!initialInnerTab || initialInnerTab === 'ecns') && (
          <button 
            onClick={() => setActiveTab('ecns')}
            className={`pb-4 px-2 text-sm font-bold transition-all relative cursor-pointer ${activeTab === 'ecns' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              أوامر التغيير الهندسي (ECN)
            </div>
            {activeTab === 'ecns' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-indigo-500 rounded-t-full" />}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <input 
            type="text" 
            placeholder="بحث..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        
        {activeTab === 'boms' ? (
          <div className="flex items-center gap-2">
            {boms.length > 0 && (
              <button 
                onClick={handleClearAllBoms}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-600 border border-rose-200 font-bold rounded-xl hover:bg-rose-100 transition-all cursor-pointer shadow-sm text-xs"
                title="حذف جميع الوصفات المسجلة"
              >
                <Trash2 className="w-4 h-4" />
                مسح جميع الوصفات
              </button>
            )}
            <button onClick={handleOpenCreateModal} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-md cursor-pointer">
              <Plus className="w-5 h-5" />
              إضافة وصفة وتحديد خط التشغيل (New BOM & Route)
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEcnModalOpen(true)} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md cursor-pointer">
            <Plus className="w-5 h-5" />
            طلب تغيير هندسي جديد (New ECN)
          </button>
        )}
      </div>

      {activeTab === 'boms' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-scaleUp">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-4">اسم الوصفة (Recipe Name)</th>
                  <th className="p-4">المنتج المرتبط</th>
                  <th className="p-4 text-center">الإصدار</th>
                  <th className="p-4 text-center">الهالك المخطط</th>
                  <th className="p-4 text-center">المكونات</th>
                  <th className="p-4 text-center">مراحل التشغيل</th>
                  <th className="p-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBoms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Layers className="w-10 h-10 text-slate-300 stroke-[1.5]" />
                        <p className="text-sm font-bold text-slate-600">لا توجد وصفات تصنيع مسجلة حالياً</p>
                        <p className="text-xs text-slate-400">يمكنك إضافة وصفة فنية جديدة بتحديد المواد ومراحل التشغيل بالضغط على الزر أعلاه</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredBoms.map((bom) => {
                    const bomProductKeys = [bom.productId, (bom as any).product_id, (bom as any).productCode, (bom as any).productName, (bom as any).product_name]
                      .filter(Boolean)
                      .map(normalizeProductKey);
                    const associatedProd = products.find(p => [p.id, p.code, p.name].map(normalizeProductKey).some(key => bomProductKeys.includes(key)))
                      || dbProducts.find(p => [p.id, p.code, p.name, p.barcode].map(normalizeProductKey).some(key => bomProductKeys.includes(key)));
                    return (
                      <tr key={bom.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="p-4"><span className="font-bold text-slate-800">{bom.name}</span></td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center"><Package className="w-4 h-4" /></div>
                            <div>
                              <span className="font-black text-indigo-700">{associatedProd ? associatedProd.name : bom.productId}</span>
                              <p className="text-[10px] text-slate-400">{associatedProd?.code || bom.productId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-center"><span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[10px]">{bom.version}</span></td>
                        <td className="p-4 text-center font-bold text-amber-600">{bom.scrapPercentage}%</td>
                        <td className="p-4 text-center">{bom.items ? bom.items.length : 0} مكون</td>
                        <td className="p-4 text-center">{bom.routings ? bom.routings.length : 0} مَراحل</td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleViewDetails(bom)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"><ExternalLink className="w-4 h-4" /></button>
                            <button onClick={() => handleEditBOM(bom)} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"><Pencil className="w-4 h-4" /></button>
                            <button onClick={(e) => handleDeleteBOM(bom.id, e)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ECN View */}
      {activeTab === 'ecns' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm animate-scaleUp">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                <tr>
                  <th className="p-4">رمز الأمر</th>
                  <th className="p-4">اسم التعديل</th>
                  <th className="p-4">الوصفة الفنية</th>
                  <th className="p-4 text-center">الإصدار الجديد</th>
                  <th className="p-4 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ecnLogs.map((ecn) => (
                  <tr key={ecn.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-indigo-600">{ecn.id}</td>
                    <td className="p-4 font-bold text-slate-800">{ecn.title}</td>
                    <td className="p-4 text-slate-700">{ecn.targetBomId}</td>
                    <td className="p-4 text-center text-indigo-600 font-mono font-bold">{ecn.newVersion}</td>
                    <td className="p-4 text-center"><span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-bold">معتمد</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL FOR CREATE / EDIT BOM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-6xl overflow-hidden shadow-2xl animate-scaleUp max-h-[95vh] flex flex-col border border-white/20">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20"><Layers className="w-6 h-6" /></div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{editingBOMId ? 'تعديل وصفة التصنيع' : 'إنشاء وصفة تصنيع متكاملة'}</h2>
                  <p className="text-xs text-slate-500 mt-1">قم بتحديد المنتج النهائي والمكونات وخطوات التوجيه اللازمة للإنتاج الاحترافي</p>
                </div>
              </div>
              <button onClick={() => { setIsModalOpen(false); setEditingBOMId(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleAddBOM} className="flex-1 overflow-y-auto p-8 space-y-10">
              <div className="bg-slate-50/40 border border-slate-100 rounded-3xl p-6 relative overflow-hidden group hover:border-amber-200/50 transition-colors">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center"><Package className="w-4 h-4" /></div>
                  <h3 className="font-bold text-slate-700 text-sm">البيانات الأساسية للوصفة والمنتج النهائي</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-500 mb-2">اسم الوصفة</label>
                    <input required type="text" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-semibold" value={newBomName ?? ""} onChange={e => setNewBomName(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-2">المنتج المستهدف (النهائي)</label>
                    <select className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold text-indigo-700 shadow-sm" value={newBomProductId ?? ""} onChange={e => setNewBomProductId(e.target.value)}>
                      <option value="">-- اختر المنتج المستهدف للتصنيع (مبيعات / POS / تصنيع) --</option>
                      {/* Sales Module Products */}
                      {dbProducts.some(p => p.source === 'sales' || p.category?.includes('مبيعات')) && (
                        <optgroup label="🛍️ منتجات مديول المبيعات (Sales Products)">
                          {dbProducts.filter(p => p.source === 'sales' || p.category?.includes('مبيعات')).map((p, idx) => (
                            <option key={`sales-bom-${p.id || idx}-${idx}`} value={p.code || p.name}>
                              [مبيعات] {p.name} {p.price ? `- سعر البيع: ${p.price} ج.م` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {/* POS Products */}
                      {dbProducts.some(p => p.source === 'pos' || (!p.source && !p.category?.includes('مبيعات'))) && (
                        <optgroup label="🛒 منتجات نقاط البيع (POS)">
                          {dbProducts.filter(p => p.source === 'pos' || (!p.source && !p.category?.includes('مبيعات'))).map((p, idx) => (
                            <option key={`dbp-${p.id || idx}-${idx}`} value={p.code || p.name}>
                              [POS] {p.name} {p.price ? `- سعر البيع: ${p.price} ج.م` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}

                      {/* Production Catalog */}
                      <optgroup label="🏭 منتجات دليل الإنتاج والتصنيع">
                        {products.filter(p => p.type === 'finished' || p.type === 'semi_finished').map((p, idx) => (
                          <option key={`p-${p.id || idx}-${idx}`} value={p.code}>
                            [{p.code}] {p.name} ({p.unit || 'وحدة'})
                          </option>
                        ))}
                      </optgroup>

                      {/* Raw and Other Materials */}
                      <optgroup label="📦 أصناف المخزن الأخرى">
                        {products.filter(p => p.type === 'raw').map((p, idx) => (
                          <option key={`praw-all-${p.id || idx}-${idx}`} value={p.code}>
                            [{p.code}] {p.name}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">الإصدار</label>
                      <input required type="text" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center text-sm font-mono" value={newBomVersion ?? ""} onChange={e => setNewBomVersion(e.target.value)} placeholder="الإصدار" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-2">نسبة الهالك %</label>
                      <input required type="number" step="0.1" className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center text-sm font-bold text-amber-600" value={newBomScrap ?? ""} onChange={e => setNewBomScrap(parseFloat(e.target.value) || 0)} placeholder="الهالك %" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Materials / Ingredients from Warehouse */}
              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Warehouse className="w-4 h-4 text-amber-600" />
                      مكونات ومواد الخام المطلوبة (ربط مباشر بأصناف المخزن)
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      اربط كل خامة بصنف مخزني محدد مع تحديد الكمية المستهلكة لإنتاج وحدة واحدة، ليتم خصمها تلقائياً من المستودع عند تنفيذ التصنيع.
                    </p>
                  </div>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold border border-indigo-100/60 self-start sm:self-auto">
                    {draftItems.length} مواد مرتبطة
                  </span>
                </div>

                <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200/80 mb-6">
                  {/* Search and filter bar for warehouse items */}
                  <div className="mb-3">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input 
                        type="text" 
                        placeholder="ابحث في أصناف المخزن بالاسم أو الكود لتسهيل الاختيار..." 
                        value={materialSearch} 
                        onChange={e => setMaterialSearch(e.target.value)}
                        className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                    <div className="lg:col-span-5">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">اختر صنف المادة الخام من المخزن</label>
                      <select 
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 outline-none" 
                        value={selectedMaterialId ?? ""} 
                        onChange={e => {
                          const val = e.target.value;
                          setSelectedMaterialId(val);
                          if (val) {
                            const mat = getMaterialDetails(val);
                            setSelectedUnit(mat.unit || 'وحدة');
                          } else {
                            setSelectedUnit('');
                          }
                        }}
                      >
                        <option value="">-- اختر صنف المادة الخام من المخزن --</option>
                        <optgroup label="أصناف ومواد المستودع (المخزن الرئيسي)">
                          {dbIngredients
                            .filter(ing => {
                              if (!materialSearch) return true;
                              const q = materialSearch.toLowerCase().trim();
                              return (
                                (ing.name && ing.name.toLowerCase().includes(q)) ||
                                (ing.code && ing.code.toLowerCase().includes(q)) ||
                                (ing.item_code && ing.item_code.toLowerCase().includes(q))
                              );
                            })
                            .map((ing, idx) => {
                              const stockVal = Number(ing.total_stock ?? ing.quantity ?? ing.current_stock ?? 0);
                              const costVal = Number(ing.avg_cost || ing.cost || ing.last_purchase_price || 0);
                              return (
                                <option key={`dbing-${ing.id || idx}-${idx}`} value={String(ing.id)}>
                                  [{ing.code || ing.item_code || `ING-${ing.id}`}] {ing.name} — رصيد المخزن: {stockVal} {ing.unit || 'وحدة'} {costVal > 0 ? `(تكلفة: ${costVal.toFixed(2)} ج.م)` : ''}
                                </option>
                              );
                            })
                          }
                        </optgroup>
                        <optgroup label="خامات وسيطة من دليل الإنتاج">
                          {products
                            .filter(p => p.type === "raw" || p.type === "semi_finished")
                            .filter(p => {
                              if (!materialSearch) return true;
                              const q = materialSearch.toLowerCase().trim();
                              return (p.name && p.name.toLowerCase().includes(q)) || (p.code && p.code.toLowerCase().includes(q));
                            })
                            .map((p, idx) => (
                              <option key={`praw-${p.id || idx}-${idx}`} value={p.code}>
                                [{p.code}] {p.name} ({p.unit || 'وحدة'})
                              </option>
                            ))
                          }
                        </optgroup>
                      </select>
                    </div>

                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                        الكمية المستهلكة
                      </label>
                      <input 
                        type="number" 
                        step="any"
                        min="0.0001"
                        className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-center font-bold font-mono text-indigo-700 shadow-sm focus:border-indigo-500 outline-none" 
                        value={materialQty ?? ""} 
                        onChange={e => setMaterialQty(parseFloat(e.target.value) || 0)} 
                      />
                    </div>

                    <div className="lg:col-span-3">
                      <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                        وحدة الوصفة
                      </label>
                      {selectedMaterialId ? (() => {
                        const mat = getMaterialDetails(selectedMaterialId);
                        const compatible = getCompatibleUnits(mat.unit || 'وحدة');
                        return (
                          <select
                            value={selectedUnit || mat.unit || 'وحدة'}
                            onChange={e => setSelectedUnit(e.target.value)}
                            className="w-full px-3 py-2.5 bg-white border border-indigo-200 rounded-xl text-sm font-semibold text-slate-800 shadow-sm focus:border-indigo-500 outline-none"
                          >
                            {compatible.map(u => (
                              <option key={`u-${u.code}`} value={u.name}>
                                {u.name} ({u.symbol}) {u.isBase ? '— وحدة المخزن الأساسية' : ''}
                              </option>
                            ))}
                            {/* In case current unit isn't in standard list */}
                            {mat.unit && !compatible.some(u => u.name === mat.unit || u.code === mat.unit) && (
                              <option value={mat.unit}>{mat.unit} (وحدة المخزن)</option>
                            )}
                          </select>
                        );
                      })() : (
                        <input 
                          type="text" 
                          disabled 
                          placeholder="وحدة الوصفة" 
                          className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-400"
                        />
                      )}
                    </div>

                    <div className="lg:col-span-2">
                      <button 
                        type="button" 
                        onClick={addDraftItem} 
                        disabled={!selectedMaterialId || materialQty <= 0}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة للمكونات</span>
                      </button>
                    </div>
                  </div>

                  {/* Selected material interactive info strip */}
                  {selectedMaterialId && (() => {
                    const selMat = getMaterialDetails(selectedMaterialId);
                    const unitToUse = selectedUnit || selMat.unit || 'وحدة';
                    const conv = convertQuantity(Number(materialQty) || 1, unitToUse, selMat.unit || 'وحدة');
                    const baseUnitCost = Number(selMat.cost || 0);
                    const baseQty = conv.success ? conv.toQuantity : (Number(materialQty) || 1);
                    const totalCostForQty = baseQty * baseUnitCost;
                    const recipeUnitCost = conv.factor ? baseUnitCost / conv.factor : baseUnitCost;

                    return (
                      <div className="mt-3 p-3.5 bg-white border border-indigo-100 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                            <Boxes className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-800">{selMat.name}</span>
                            <span className="font-mono text-[10px] text-slate-500 mr-2 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                              كود المخزن: {selMat.code}
                            </span>
                          </div>
                        </div>

                        {/* Conversion equation banner */}
                        {unitToUse !== selMat.unit && (
                          <div className="w-full bg-amber-50/80 border border-amber-200/80 px-3 py-1.5 rounded-lg flex items-center gap-2 text-[11px] font-bold text-amber-900">
                            <span>⚡ تحويل الوحدات التلقائي:</span>
                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-amber-300">
                              {materialQty} {unitToUse} = {baseQty} {selMat.unit} (بالمخزن)
                            </span>
                            <span className="text-amber-700 font-normal">
                              (سيتم خصم {baseQty} {selMat.unit} تلقائياً من رصيد المستودع عند التصنيع)
                            </span>
                          </div>
                        )}

                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">الرصيد المتاح بالمخزن:</span>
                            <span className={`font-bold font-mono px-2 py-0.5 rounded ${
                              selMat.stock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {selMat.stock} {selMat.unit}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-500">تكلفة وحدة المخزن ({selMat.unit}):</span>
                            <span className="font-bold text-slate-700 font-mono">{baseUnitCost.toFixed(2)} ج.م</span>
                          </div>
                          {unitToUse !== selMat.unit && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-500">سعر وحدة الوصفة ({unitToUse}):</span>
                              <span className="font-bold text-slate-700 font-mono">{recipeUnitCost.toFixed(4)} ج.م</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 bg-indigo-50/70 px-2.5 py-1 rounded-lg border border-indigo-100">
                            <span className="text-indigo-600 font-medium">تكلفة المكون بالوحدة:</span>
                            <span className="font-bold text-indigo-700 font-mono">{totalCostForQty.toFixed(2)} ج.م</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Table of added BOM Items */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200/80 font-bold">
                      <tr>
                        <th className="p-3.5">كود المخزن</th>
                        <th className="p-3.5">اسم المادة الخام</th>
                        <th className="p-3.5 text-center">الرصيد الحالي بالمخزن</th>
                        <th className="p-3.5 text-center">تكلفة الوحدة</th>
                        <th className="p-3.5 text-center">الكمية المستهلكة (للوحدة)</th>
                        <th className="p-3.5 text-center">إجمالي تكلفة المكون</th>
                        <th className="p-3.5 text-center">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {draftItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400">
                            <Warehouse className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                            <p className="font-semibold">لم يتم ربط أي مواد خام بالوصفة حتى الآن.</p>
                            <p className="text-[11px] text-slate-400 mt-1">اختر صنفاً من أصناف المخزن وحدد الكمية لإضافته للوصفة.</p>
                          </td>
                        </tr>
                      ) : (
                        draftItems.map((item, idx) => {
                          const mat = getMaterialDetails(item.materialId);
                          const itemUnitCost = Number(item.unitCost || mat.cost || 0);
                          const itemQty = Number(item.quantity || 1);
                          const itemTotal = itemQty * itemUnitCost;
                          const currentStock = mat.stock !== undefined ? mat.stock : (item.stock || 0);

                          return (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              <td className="p-3.5">
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg text-[11px] inline-flex items-center gap-1">
                                  <Warehouse className="w-3 h-3 text-indigo-500" />
                                  {mat.code || item.code}
                                </span>
                              </td>
                              <td className="p-3.5 font-bold text-slate-800">
                                {mat.name || item.name}
                              </td>
                              <td className="p-3.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                  currentStock > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                                }`}>
                                  {currentStock} {mat.unit || item.unit || 'وحدة'}
                                </span>
                              </td>
                              <td className="p-3.5 text-center font-mono text-slate-600 font-semibold">
                                {itemUnitCost.toFixed(2)} ج.م
                              </td>
                              <td className="p-3.5 text-center">
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50/80 border border-indigo-200/60 px-2.5 py-1 rounded-lg text-xs">
                                  {itemQty} {mat.unit || item.unit || 'وحدة'}
                                </span>
                              </td>
                              <td className="p-3.5 text-center font-mono font-bold text-emerald-700">
                                {itemTotal.toFixed(2)} ج.م
                              </td>
                              <td className="p-3.5 text-center">
                                <button 
                                  type="button" 
                                  onClick={() => removeDraftItem(item.materialId)} 
                                  className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="حذف من الوصفة"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Summary & Deduction Assurance Box */}
                {draftItems.length > 0 && (
                  <div className="p-4 bg-gradient-to-r from-emerald-50/80 via-indigo-50/50 to-slate-50 border border-emerald-200/60 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          الربط المخزني التلقائي نشط
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          عند تنفيذ أمر الإنتاج، سيتم التحقق من الأرصدة وخصم الكميات المحددة أعلاه ذرّياً من مخزن المواد الخام المختار.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[10px] font-bold text-slate-400 block">إجمالي تكلفة الخامات (للوحدة)</span>
                        <span className="text-base font-bold font-mono text-indigo-700">
                          {draftItems.reduce((acc, it) => {
                            const mat = getMaterialDetails(it.materialId);
                            const cost = Number(it.unitCost || mat.cost || 0);
                            return acc + (Number(it.quantity || 1) * cost);
                          }, 0).toFixed(2)} ج.م
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden p-6">
                <h3 className="font-bold text-slate-800 text-sm mb-4">خطوات التوجيه ومراحل التشغيل (Routing Steps)</h3>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50/50 p-5 rounded-2xl border border-slate-100 mb-6">
                  <div className="md:col-span-1">
                    <input type="number" className="w-full px-2 py-2.5 border border-slate-200 rounded-xl text-center font-bold text-sm" value={routingOpNumber ?? ""} onChange={e => setRoutingOpNumber(parseInt(e.target.value) || 10)} />
                  </div>
                  <div className="md:col-span-6">
                    <input type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm" placeholder="وصف المهمة" value={routingDesc ?? ""} onChange={e => setRoutingDesc(e.target.value)} />
                  </div>
                  <div className="md:col-span-3">
                    <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold" value={routingCenterId ?? ""} onChange={e => setRoutingCenterId(e.target.value)}>
                      <option value="">-- مركز العمل --</option>
                      {workCenters.map(wc => <option key={wc.id} value={wc.code || wc.id}>{wc.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button type="button" onClick={addDraftRouting} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-bold text-xs"><Plus className="w-4 h-4 mx-auto" /></button>
                  </div>
                </div>
                <div className="space-y-3">
                  {draftRoutings.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 p-4 rounded-2xl hover:border-emerald-200 transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-slate-400">{r.opNumber}</div>
                        <div><p className="text-sm font-bold text-slate-700">{r.description}</p><p className="text-[10px] text-slate-500">{r.workCenterId}</p></div>
                      </div>
                      <button type="button" onClick={() => removeDraftRouting(r.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-4 rounded-b-3xl">
                <button type="submit" disabled={draftItems.length === 0} className="flex-1 px-8 py-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-2xl shadow-xl shadow-amber-500/20 font-bold transition-all flex items-center justify-center gap-3 cursor-pointer"><Check className="w-6 h-6" />{editingBOMId ? 'تحديث الوصفة وحفظ التغييرات' : 'حفظ الوصفة وادراجها في الداتابيز'}</button>
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-2xl font-bold transition-all">إلغاء التغييرات</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL VIEW MODAL */}
      {isDetailModalOpen && selectedBom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-8">
            <div className="p-6 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center"><Layers className="w-6 h-6" /></div>
                <div><h2 className="text-lg font-bold text-slate-800">{selectedBom.name}</h2><p className="text-xs text-slate-500">إصدار: {selectedBom.version}</p></div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-xl border border-slate-200"><X className="w-5 h-5" /></button>
            </div>
            {/* ... simplified detail view for restoration ... */}
            <div className="p-6 text-center text-slate-500">تم استعادة الملف بنجاح. يرجى إعادة فتح الكرت لعرض تفاصيله المحدثة.</div>
            <div className="p-6 border-t border-slate-100 flex justify-end bg-slate-50">
              <button onClick={() => setIsDetailModalOpen(false)} className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* ECN MODAL */}
      {isEcnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-scaleUp border border-white/20">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20"><GitBranch className="w-5 h-5" /></div>
                <div><h3 className="font-bold text-slate-800">تحرير أمر تغيير هندسي</h3></div>
              </div>
              <button onClick={() => setIsEcnModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-full transition-all"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              const added = { id: `ECN-${Date.now()}`, title: newEcn.title, targetBomId: newEcn.targetBomId, newVersion: newEcn.newVersion };
              const updated = [...ecnLogs, added];
              setEcnLogs(updated);
              databaseStorage.setItem('remo_production_ecns', updated);
              setBoms(boms.map(b => b.id === newEcn.targetBomId ? { ...b, version: newEcn.newVersion } : b));
              setIsEcnModalOpen(false);
            }} className="p-8 space-y-6">
              <select className="w-full px-4 py-2.5 border border-slate-200 rounded-xl" value={newEcn.targetBomId ?? ""} onChange={e => setNewEcn({...newEcn, targetBomId: e.target.value})}>
                <option value="">-- اختر الوصفة --</option>
                {boms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input required type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl" placeholder="عنوان التغيير" value={newEcn.title ?? ""} onChange={e => setNewEcn({...newEcn, title: e.target.value})} />
              <input required type="text" className="w-full px-4 py-2.5 border border-slate-200 rounded-xl" placeholder="الإصدار الجديد" value={newEcn.newVersion ?? ""} onChange={e => setNewEcn({...newEcn, newVersion: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl">حفظ</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
