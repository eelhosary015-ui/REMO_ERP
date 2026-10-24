import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Plus, Search, CheckCircle, CheckCircle2, Clock, Ban, AlertCircle, X, 
  Eye, Calendar, Layers, Check, PlayCircle, Tag, Users, FileText, 
  Settings, Award, Trash2, LayoutGrid, Warehouse, Activity, Zap, TrendingUp,
  MapPin, User, ChevronLeft, ArrowRight, Package, PackageCheck, Loader2,
  FileSpreadsheet, Maximize2, Minimize2, Copy, CheckSquare, Boxes, Table
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ProductionOrder, ProductDef, BillOfMaterial, WorkCenter } from './types';
import { api } from '../../utils/api';
import { convertQuantity } from '../../utils/unitConversion';

const DEFAULT_PRODUCTS: ProductDef[] = [];
const DEFAULT_BOMS: BillOfMaterial[] = [];
const DEFAULT_CENTERS: WorkCenter[] = [];
const MOCK_ORDERS: ProductionOrder[] = [];

export function ProductionOrdersManagement() {
  const [orders, setOrders] = useState<ProductionOrder[]>(() => {
    const saved = localStorage.getItem('remo_production_orders');
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => {
            if (!item || typeof item !== 'object' || !item.id || !item.orderNumber) return false;
            // Purge legacy demo orders
            const num = String(item.orderNumber || '');
            const pid = String(item.productId || '');
            const pname = String(item.productName || '');
            if (num === 'PRD-2026-001' || num === 'PRD-2026-002' || num === 'PRD-2026-003') return false;
            if (pid === 'FIN-500' || pid === 'SFP-102' || pid === 'RAW-001' || pid === 'RAW-002') return false;
            if (pname.includes('سيارة سيدان') || pname.includes('إطار سيارة') || pname.includes('سيليكا')) return false;
            return true;
          });
        }
      } catch (e) { 
        console.error('Failed to parse from local storage', e); 
      }
    }
    return [];
  });

  // DB Registrations for cross references
  const [products] = useState<ProductDef[]>(() => {
    const saved = localStorage.getItem('remo_production_products');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.code && !['RAW-001', 'RAW-002', 'FIN-500', 'SFP-102', 'PROD-001', 'PROD-A72'].includes(item.code));
        }
      } catch (e) {}
    }
    return [];
  });

  const [boms, setBoms] = useState<BillOfMaterial[]>(() => {
    const saved = localStorage.getItem('remo_production_boms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.id && !['b1', 'bom1', 'bom2', 'bom-1'].includes(item.id));
        }
      } catch (e) {}
    }
    return [];
  });

  const [workCenters] = useState<WorkCenter[]>(() => {
    const saved = localStorage.getItem('remo_production_workcenters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter(item => item && typeof item === 'object' && item.id);
        }
      } catch (e) {}
    }
    return [];
  });

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [viewMode, setViewMode] = useState<'list' | 'gantt'>('list');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalMaximized, setIsModalMaximized] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);

  // Live ERP Database Linkage States
  const [dbWarehouses, setDbWarehouses] = useState<any[]>([]);
  const [dbIngredients, setDbIngredients] = useState<any[]>([]);
  const [dbProducts, setDbProducts] = useState<any[]>([]);
  const [selectedRawWarehouse, setSelectedRawWarehouse] = useState<number | null>(null);
  const [selectedFinishedWarehouse, setSelectedFinishedWarehouse] = useState<number | null>(null);
  const [warehouseStock, setWarehouseStock] = useState<Record<number, number>>({});
  const [warehouseStockByCode, setWarehouseStockByCode] = useState<Record<string, number>>({});
  const [warehouseStockByName, setWarehouseStockByName] = useState<Record<string, number>>({});
  const [loadingStock, setLoadingStock] = useState(false);
  const [postingToInventory, setPostingToInventory] = useState(false);

  // Live BOM Stock Availability States
  const [availabilityData, setAvailabilityData] = useState<any>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  // 1. Fetch live warehouses, products, ingredients, orders, and BOMs from backend on mount
  useEffect(() => {
    // Load backend persisted orders
    api.get('/api/v2/production/orders')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setOrders(data.data);
          localStorage.setItem('remo_production_orders', JSON.stringify(data.data));
        }
      })
      .catch(err => console.log('Notice: using local orders backup', err));

    // Load backend persisted BOMs
    api.get('/api/v2/production/boms')
      .then(res => res.json())
      .then(data => {
        if (data && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setBoms(data.data);
          localStorage.setItem('remo_production_boms', JSON.stringify(data.data));
        }
      })
      .catch(err => console.log('Notice: using local boms backup', err));

    api.get('/api/inventory/warehouses')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setDbWarehouses(data);
          // Auto-select first main warehouse or fallback to the first element
          const mainWh = data.find((w: any) => w.is_main === 1 || w.type === 'main') || data[0];
          if (mainWh) {
            setSelectedRawWarehouse(prev => prev || mainWh.id);
            setSelectedFinishedWarehouse(prev => prev || mainWh.id);
          }
        }
      })
      .catch(err => console.error('Failed to load warehouses:', err));

    // 1. Fetch live warehouses, products, ingredients, orders, and BOMs from backend on mount
    const loadMasterData = () => {
      Promise.all([
        api.get('/api/pos/data').then(res => res.json()).catch(() => null),
        api.get('/api/v2/production/shared-products').then(res => res.json()).catch(() => null),
        api.get('/api/ingredients').then(res => res.json()).catch(() => [])
      ]).then(([posData, sharedData, ingredientData]) => {
        const sharedList = Array.isArray(sharedData?.data) ? sharedData.data : (Array.isArray(sharedData) ? sharedData : []);
        if (sharedList.length > 0) {
          setDbProducts(sharedList);
        } else if (posData && Array.isArray(posData.products)) {
          setDbProducts(posData.products);
        }
        if (Array.isArray(ingredientData)) {
          setDbIngredients(ingredientData);
        } else if (posData && Array.isArray(posData.ingredients)) {
          setDbIngredients(posData.ingredients);
        }
      }).catch(err => console.error('Failed to load production master data:', err));
    };

    loadMasterData();

    const handleSync = () => {
      loadMasterData();
    };

    window.addEventListener('sales_products_updated', handleSync);
    window.addEventListener('sales_pricing_updated', handleSync);
    window.addEventListener('production_products_updated', handleSync);

    return () => {
      window.removeEventListener('sales_products_updated', handleSync);
      window.removeEventListener('sales_pricing_updated', handleSync);
      window.removeEventListener('production_products_updated', handleSync);
    };
  }, []);

  // Ensure selectedRawWarehouse and selectedFinishedWarehouse stay synced if dbWarehouses loads later
  useEffect(() => {
    if (Array.isArray(dbWarehouses) && dbWarehouses.length > 0) {
      const mainWh = dbWarehouses.find((w: any) => w.is_main === 1 || w.type === 'main') || dbWarehouses[0];
      if (mainWh) {
        setSelectedRawWarehouse(prev => prev || mainWh.id);
        setSelectedFinishedWarehouse(prev => prev || mainWh.id);
      }
    }
  }, [dbWarehouses]);

  // 2. Fetch live stock levels in the selected raw materials warehouse whenever warehouse or selected order changes
  useEffect(() => {
    if (!selectedRawWarehouse) {
      setWarehouseStock({});
      setWarehouseStockByCode({});
      setWarehouseStockByName({});
      return;
    }
    setLoadingStock(true);
    api.get(`/api/inventory/items?warehouse_id=${selectedRawWarehouse}`)
      .then(res => res.json())
      .then(data => {
        const items = Array.isArray(data) ? data : (data?.items || data?.data || []);
        if (Array.isArray(items)) {
          const stockMap: Record<number, number> = {};
          const stockMapByCode: Record<string, number> = {};
          const stockMapByName: Record<string, number> = {};

          items.forEach((item: any) => {
            const explicitId = item.ingredient_id ?? item.ingredientId;
            const ingredientId = explicitId != null && !isNaN(Number(explicitId)) ? Number(explicitId) : 0;
            const available = Number(item.available);
            const quantity = Number(item.quantity);
            const reserved = Number(item.reserved);
            const effectiveStock = Number.isFinite(available) && available >= 0
              ? available 
              : (Number.isFinite(quantity) ? Math.max(quantity - (Number.isFinite(reserved) ? reserved : 0), 0) : 0);

            if (ingredientId > 0) {
              stockMap[ingredientId] = (stockMap[ingredientId] || 0) + effectiveStock;
            }
            if (item.ingredient_code || item.code || item.item_code) {
              const codeKey = String(item.ingredient_code || item.code || item.item_code).trim().toLowerCase();
              stockMapByCode[codeKey] = (stockMapByCode[codeKey] || 0) + effectiveStock;
              const cleanCodeOnly = codeKey.replace(/^item-/, '');
              if (cleanCodeOnly && cleanCodeOnly !== codeKey) {
                stockMapByCode[cleanCodeOnly] = (stockMapByCode[cleanCodeOnly] || 0) + effectiveStock;
              }
            }
            if (item.ingredient_name || item.name) {
              const nameKey = String(item.ingredient_name || item.name).trim().toLowerCase().replace(/\s+/g, ' ');
              stockMapByName[nameKey] = (stockMapByName[nameKey] || 0) + effectiveStock;
            }
          });

          setWarehouseStock(stockMap);
          setWarehouseStockByCode(stockMapByCode);
          setWarehouseStockByName(stockMapByName);
        }
      })
      .catch(err => console.error('Failed to fetch warehouse items stock:', err))
      .finally(() => setLoadingStock(false));
  }, [selectedRawWarehouse, selectedOrder]);

  // Form states
  const [newOrder, setNewOrder] = useState<Partial<ProductionOrder>>({
    orderNumber: '',
    productId: '',
    quantity: 10,
    bomId: '',
    startDate: '',
    endDate: '',
    priority: 'normal',
    status: 'planned',
    progress: 0,
    salesReference: '',
    workCenterId: '',
    supervisor: '',
    notes: '',
    rawWarehouseId: undefined,
    finishedWarehouseId: undefined
  });

  // Product Filter search term inside Modal Creator
  const [productSearch, setProductSearch] = useState('');

  // Live stock availability check effect for create modal
  useEffect(() => {
    if (!isModalOpen || !newOrder.productId || !selectedRawWarehouse) {
      setAvailabilityData(null);
      return;
    }

    setCheckingAvailability(true);
    const qty = Number(newOrder.quantity) || 1;
    const bomId = newOrder.bomId || '';
    const prodId = newOrder.productId;

    api.get(`/api/v2/production/check-availability?productId=${encodeURIComponent(prodId)}&quantity=${qty}&bomId=${encodeURIComponent(bomId)}&rawWarehouseId=${selectedRawWarehouse}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.success && data.data) {
          setAvailabilityData(data.data);
        } else {
          setAvailabilityData(null);
        }
      })
      .catch(err => {
        console.error('Failed to check availability:', err);
        setAvailabilityData(null);
      })
      .finally(() => setCheckingAvailability(false));
  }, [isModalOpen, newOrder.productId, newOrder.quantity, newOrder.bomId, selectedRawWarehouse]);

  // Auto incremental order number builder
  const suggestNextOrderNumber = (currentOrders: ProductionOrder[]) => {
    const year = new Date().getFullYear();
    const prefix = `PRD-${year}-`;
    let lastNum = 0;
    
    const safeOrders = Array.isArray(currentOrders) ? currentOrders : [];
    safeOrders.forEach(o => {
      if (o && o.orderNumber && typeof o.orderNumber === 'string' && o.orderNumber.startsWith(prefix)) {
        const parts = o.orderNumber.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > lastNum) {
          lastNum = num;
        }
      }
    });

    const nextSeq = lastNum + 1;
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  };

  const handleOpenCreateModal = () => {
    const nextOrderNum = suggestNextOrderNumber(orders);
    
    // Auto find first available product from combined list
    const initialProduct = combinedProducts.find(p => p && (p.type === 'finished' || p.type === 'semi_finished')) || combinedProducts[0];
    const targetProductCode = initialProduct ? initialProduct.code : '';
    const safeBoms = Array.isArray(boms) ? boms : [];
    const matchingBOM = safeBoms.find(b => b && (b.productId === targetProductCode || b.productId === initialProduct?.name));
    
    // Preset default dates
    const today = new Date().toISOString().split('T')[0];
    const targetEnd = new Date();
    targetEnd.setDate(targetEnd.getDate() + 5);
    const endStr = targetEnd.toISOString().split('T')[0];

    const safeWorkCenters = Array.isArray(workCenters) ? workCenters.filter(Boolean) : [];

    const mainWh = dbWarehouses.find((w: any) => w.is_main === 1 || w.type === 'main') || dbWarehouses[0];
    const initialRawWh = selectedRawWarehouse || mainWh?.id || undefined;
    const initialFinWh = selectedFinishedWarehouse || mainWh?.id || undefined;
    if (initialRawWh && !selectedRawWarehouse) setSelectedRawWarehouse(initialRawWh);
    if (initialFinWh && !selectedFinishedWarehouse) setSelectedFinishedWarehouse(initialFinWh);

    setNewOrder({
      orderNumber: nextOrderNum,
      productId: targetProductCode,
      quantity: 10,
      bomId: matchingBOM ? matchingBOM.id : '',
      startDate: today,
      endDate: endStr,
      priority: 'normal',
      status: 'planned',
      progress: 0,
      salesReference: '',
      workCenterId: safeWorkCenters[0] ? (safeWorkCenters[0].code || safeWorkCenters[0].id) : '',
      supervisor: 'م. فادي القاضي',
      notes: '',
      rawWarehouseId: initialRawWh,
      finishedWarehouseId: initialFinWh,
      laborCost: 0,
      overheadCost: 0,
      otherCost: 0
    });

    setProductSearch('');
    setIsModalOpen(true);
  };

  const handleAddOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.orderNumber || !newOrder.productId) {
      alert('الرجاء التأكد من رقم الأمر والمنتج المستهدف!');
      return;
    }
    const mainWh = dbWarehouses.find((w: any) => w.is_main === 1 || w.type === 'main') || dbWarehouses[0];
    const rawWh = selectedRawWarehouse || newOrder.rawWarehouseId || mainWh?.id;
    const finWh = selectedFinishedWarehouse || newOrder.finishedWarehouseId || rawWh || mainWh?.id;

    if (!rawWh) {
      alert('❌ يجب تحديد مخزن صرف المواد الخام قبل حفظ أمر الإنتاج.');
      return;
    }
    if (!finWh) {
      alert('❌ يجب تحديد مخزن استلام المنتج التام قبل حفظ أمر الإنتاج.');
      return;
    }
    if (!selectedRawWarehouse) setSelectedRawWarehouse(rawWh);
    if (!selectedFinishedWarehouse) setSelectedFinishedWarehouse(finWh);

    const safeOrders = Array.isArray(orders) ? orders : [];
    // Verify uniqueness
    const numExists = safeOrders.some(o => o && o.orderNumber === newOrder.orderNumber);
    if (numExists) {
      alert('رقم الأمر هذا مسجل مسبقاً! تم تكييف رمز جديد تلقائي.');
      return;
    }

    const safeBoms = Array.isArray(boms) ? boms : [];
    const matchingBOM = safeBoms.find(b => b && b.id === newOrder.bomId) || safeBoms.find(b => b && (b.productId === newOrder.productId || b.name === newOrder.productId));

    const prodObj = getProductDetails(newOrder.productId);
    const laborVal = Number(newOrder.laborCost) || 0;
    const overheadVal = Number(newOrder.overheadCost) || 0;
    const otherVal = Number(newOrder.otherCost) || 0;
    const matCostVal = modalSheetItems.reduce((acc: number, it: any) => acc + (Number(it.totalItemCost) || 0), 0) || Number(availabilityData?.totalMaterialCost || availabilityData?.totalEstimatedCost || 0);
    const combinedTotalCost = matCostVal + laborVal + overheadVal + otherVal;
    const combinedUnitCost = (Number(newOrder.quantity) || 1) > 0 ? combinedTotalCost / (Number(newOrder.quantity) || 1) : 0;

    const added: ProductionOrder = {
      ...(newOrder as ProductionOrder),
      productName: prodObj?.name || newOrder.productId,
      id: `ord-${Date.now()}`,
      bomId: newOrder.bomId || (matchingBOM ? matchingBOM.id : ''),
      progress: newOrder.status === 'completed' ? 100 : (newOrder.progress || 0),
      rawWarehouseId: selectedRawWarehouse || undefined,
      finishedWarehouseId: selectedFinishedWarehouse || undefined,
      laborCost: laborVal,
      overheadCost: overheadVal,
      otherCost: otherVal,
      bomSnapshot: matchingBOM ? {
        // Immutable snapshot: the Work Order Card must always show the exact BOM
        // and materials that were selected when this production order was created.
        bomId: matchingBOM.id,
        bomName: matchingBOM.name,
        version: matchingBOM.version,
        scrapPercentage: Number(matchingBOM.scrapPercentage) || 0,
        productId: newOrder.productId,
        productName: prodObj?.name || newOrder.productId,
        productCode: prodObj?.code || newOrder.productId,
        productUnit: prodObj?.unit || 'وحدة',
        rawWarehouseId: Number(selectedRawWarehouse) || null,
        rawWarehouseName: dbWarehouses.find((w: any) => Number(w.id) === Number(selectedRawWarehouse))?.name || 'مخزن الصرف',
        finishedWarehouseId: Number(selectedFinishedWarehouse) || null,
        finishedWarehouseName: dbWarehouses.find((w: any) => Number(w.id) === Number(selectedFinishedWarehouse))?.name || 'مخزن المنتج التام',
        items: modalSheetItems.length > 0 ? modalSheetItems.map((it: any) => {
          const perUnit = Number(it.requiredPerUnit) || 0;
          const exactTotal = parseFloat((perUnit * (Number(newOrder.quantity) || 1)).toFixed(4));
          return {
            materialId: String(it.materialId ?? ''),
            materialName: it.materialName || it.name || String(it.materialId ?? ''),
            code: it.code || it.materialId,
            unit: it.unit || 'وحدة',
            quantity: perUnit,
            quantityPerUnit: perUnit,
            totalRequiredQty: exactTotal > 0 ? exactTotal : (Number(it.totalQuantityWithScrap) || 0),
            totalQuantityWithScrap: exactTotal > 0 ? exactTotal : (Number(it.totalQuantityWithScrap) || 0),
            currentStock: Number(it.currentStock) || 0,
            rawWarehouseId: Number(selectedRawWarehouse) || null,
            rawWarehouseName: dbWarehouses.find((w: any) => Number(w.id) === Number(selectedRawWarehouse))?.name || 'مخزن الصرف',
            unitCost: Number(it.unitCost) || 0,
            totalItemCost: Number(it.totalItemCost) || 0
          };
        }) : matchingBOM.items,
        routings: matchingBOM.routings || [],
        laborCost: laborVal,
        overheadCost: overheadVal,
        otherCost: otherVal,
        totalCost: combinedTotalCost,
        costPerUnit: combinedUnitCost
      } : undefined,
      totalCost: combinedTotalCost,
      costPerUnit: combinedUnitCost
    };

    // If order is created with status 'completed', perform immediate warehouse execution and validation
    if (newOrder.status === 'completed') {
      const rawWhId = Number(newOrder.rawWarehouseId || selectedRawWarehouse) || null;
      const finWhId = Number(newOrder.finishedWarehouseId || selectedFinishedWarehouse) || null;

      if (!rawWhId || !finWhId) {
        alert('❌ تم رفض العملية: يلزم تحديد كل من مستودع صرف المواد الخام ومستودع استلام المنتج التام لإتمام الترحيل.');
        return;
      }

      setPostingToInventory(true);
      try {
        // 1. Create the relational production-order record first.
        const saveRes = await api.post('/api/v2/production/orders', added);
        const saveData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok || !saveData?.success) {
          throw new Error(saveData?.error || 'تعذر حفظ أمر الإنتاج في قاعدة البيانات');
        }
        if (saveData?.data?.id !== undefined) added.id = String(saveData.data.id);

        // 2. Execute stock deduction & receipt atomically.
        const execRes = await api.post(`/api/v2/production/orders/${added.id}/execute`, {
          orderNumber: added.orderNumber,
          productId: added.productId,
          productName: added.productName,
          quantity: added.quantity,
          rawWarehouseId: rawWhId,
          finishedWarehouseId: finWhId,
          allowNegativeStock: false,
          user: 'مسؤول الإنتاج والتصنيع',
          notes: added.notes,
          laborCost: laborVal,
          overheadCost: overheadVal,
          otherCost: otherVal
        });

        const execData = await execRes.json();

        if (!execRes.ok || !execData.success) {
          const errMsg = execData.error || 'فشل في تنفيذ وترحيل أمر الإنتاج';
          alert(`❌ تعذر تنفيذ وترحيل أمر الإنتاج [${added.orderNumber}].\n\n${errMsg}`);
          return;
        }

        // Successfully executed
        handleExecutionSuccess(added, execData.data);
        setIsModalOpen(false);
        return;
      } catch (err: any) {
        console.error('Direct execution error:', err);
        alert(`❌ حدث خطأ أثناء ترحيل أمر الإنتاج: ${err.message}`);
        return;
      } finally {
        setPostingToInventory(false);
      }
    }

    // Standard draft / planned / released order save
    try {
      const saveRes = await api.post('/api/v2/production/orders', added);
      const saveData = await saveRes.json().catch(() => ({}));
      if (!saveRes.ok || !saveData?.success) {
        throw new Error(saveData?.error || 'تعذر حفظ أمر الإنتاج في قاعدة البيانات');
      }
      // Use the database-generated id so later execution always targets the
      // persisted relational record instead of a localStorage-only id.
      if (saveData?.data?.id !== undefined) {
        added.id = String(saveData.data.id);
      }
    } catch (err: any) {
      console.error('Production order database save failed:', err);
      alert(`❌ لم يتم حفظ أمر الإنتاج في قاعدة البيانات.\n\n${err?.message || err}`);
      return;
    }

    const updated = [added, ...safeOrders];
    setOrders(updated);
    localStorage.setItem('remo_production_orders', JSON.stringify(updated));
    setIsModalOpen(false);
  };

  const handleExecutionSuccess = (order: ProductionOrder, execResult: any) => {
    const finalTotalCost = Number(execResult?.totalProductionCost ?? execResult?.totalMaterialCost ?? order.totalCost ?? 0);
    const finalUnitCost = Number(execResult?.costPerUnit ?? order.costPerUnit ?? 0);
    const updatedOrders = orders.map(o => {
      if (o && (o.id === order.id || o.orderNumber === order.orderNumber)) {
        return {
          ...o,
          status: 'completed' as const,
          progress: 100,
          is_executed: true,
          executed_at: new Date().toISOString(),
          totalCost: finalTotalCost,
          costPerUnit: finalUnitCost
        };
      }
      return o;
    });

    setOrders(updatedOrders);
    localStorage.setItem('remo_production_orders', JSON.stringify(updatedOrders));

    if (selectedOrder && (selectedOrder.id === order.id || selectedOrder.orderNumber === order.orderNumber)) {
      setSelectedOrder({
        ...selectedOrder,
        status: 'completed',
        progress: 100,
        is_executed: true,
        executed_at: new Date().toISOString(),
        totalCost: finalTotalCost,
        costPerUnit: finalUnitCost
      });
    }

    // Refresh live inventory balances in the warehouse
    if (selectedRawWarehouse) {
      api.get(`/api/inventory/items?warehouse_id=${selectedRawWarehouse}`)
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d)) {
            const map: Record<number, number> = {};
            d.forEach((it: any) => { if (it.ingredient_id) map[it.ingredient_id] = parseFloat(it.quantity) || 0; });
            setWarehouseStock(map);
          }
        })
        .catch(e => console.error('Failed to reload inventory stock:', e));
    }

    alert(
      `✅ تم تنفيذ وترحيل أمر الإنتاج [${execResult?.orderNumber || order.orderNumber}] بنجاح تام!\n\n` +
      `• تم استلام المنتج التام في مخزن المنتجات المصنعة\n` +
      `• تم خصم وسحب المواد الخام المستهلكة من مخزن الخامات\n` +
      `• إجمالي تكلفة المواد الخام: ${Number(execResult?.totalMaterialCost || 0).toLocaleString()} ج.م\n` +
      `• إجمالي تكلفة الإنتاج الكلية: ${finalTotalCost.toLocaleString()} ج.م\n` +
      `• تكلفة الوحدة المصنعة المعتمدة بالمخزن: ${finalUnitCost.toFixed(2)} ج.م`
    );
  };

  const handleExecuteOrder = async (orderToExecute: ProductionOrder) => {
    if (!orderToExecute) return;

    // Double execution check (Idempotency)
    if (orderToExecute.is_executed || orderToExecute.status === 'completed') {
      alert('هذا الأمر تم تنفيذه وترحيله للمخازن مسبقاً (محمي من تكرار الصرف).');
      return;
    }

    const mainWh = dbWarehouses.find((w: any) => w.is_main === 1 || w.type === 'main') || dbWarehouses[0];
    const rawWhId = orderToExecute.rawWarehouseId || selectedRawWarehouse || mainWh?.id;
    const finWhId = orderToExecute.finishedWarehouseId || selectedFinishedWarehouse || rawWhId || mainWh?.id;

    if (!rawWhId || !finWhId) {
      alert('يرجى تحديد كل من مستودع صرف الخامات ومستودع استلام المنتج التام أولاً.');
      return;
    }

    const rawWhName = dbWarehouses.find(w => w.id === rawWhId)?.name || `مخزن #${rawWhId}`;
    const finWhName = dbWarehouses.find(w => w.id === finWhId)?.name || `مخزن #${finWhId}`;
    const prodObj = getProductDetails(orderToExecute.productId);
    const prodName = prodObj?.name || orderToExecute.productId;

    const confirmMsg = 
      `⚡ تأكيد تنفيذ وترحيل أمر الإنتاج [${orderToExecute.orderNumber}]\n\n` +
      `• المنتج المستهدف: ${prodName} (${orderToExecute.quantity} ${prodObj?.unit || 'وحدة'})\n` +
      `• مستودع سحب الخامات: ${rawWhName}\n` +
      `• مستودع استلام المنتج التام: ${finWhName}\n\n` +
      `سيتم خصم الخامات من المخزن وإضافة المنتج المصنع وتوثيق القيود المخزنية.\n` +
      `هل تريد الاستمرار؟`;

    if (!window.confirm(confirmMsg)) return;

    setPostingToInventory(true);
    try {
      const snap = orderToExecute.bomSnapshot || {};
      const res = await api.post(`/api/v2/production/orders/${orderToExecute.id}/execute`, {
        orderNumber: orderToExecute.orderNumber,
        productId: orderToExecute.productId,
        productName: orderToExecute.productName || prodName,
        quantity: orderToExecute.quantity,
        rawWarehouseId: rawWhId,
        finishedWarehouseId: finWhId,
        allowNegativeStock: false,
        user: 'مسؤول الإنتاج والتصنيع',
        notes: orderToExecute.notes,
        laborCost: Number(orderToExecute.laborCost ?? snap.laborCost ?? 0),
        overheadCost: Number(orderToExecute.overheadCost ?? snap.overheadCost ?? 0),
        otherCost: Number(orderToExecute.otherCost ?? snap.otherCost ?? 0)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = data.error || 'فشل في تنفيذ وترحيل أمر الإنتاج';
        // Do not mislabel every server error as a raw-material shortage.
        // The backend now returns the actual validation/database reason.
        alert(`❌ تعذر تنفيذ وترحيل أمر الإنتاج [${orderToExecute.orderNumber}].\n\n${errMsg}`);
        return;
      }

      handleExecutionSuccess(orderToExecute, data.data);
    } catch (err: any) {
      console.error('Execution error:', err);
      alert(`حدث خطأ أثناء الاتصال بالخادم: ${err.message}`);
    } finally {
      setPostingToInventory(false);
    }
  };

  const handleDeleteOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const safeOrders = Array.isArray(orders) ? orders : [];
    const ord = safeOrders.find(o => o && o.id === id);
    if (ord && (ord.status === 'completed' || ord.is_executed)) {
      alert(`⚠️ لا يمكن إلغاء أو حذف أمر الإنتاج [${ord.orderNumber}] لأنه تم تنفيذه وترحيله بالفعل في قيود المخازن.`);
      return;
    }
    if (window.confirm('هل أنت متأكد من إلغاء وحذف أمر الإنتاج بالكامل؟')) {
      const updated = safeOrders.filter(o => o && o.id !== id);
      setOrders(updated);
      localStorage.setItem('remo_production_orders', JSON.stringify(updated));
      setIsDetailOpen(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStats: ProductionOrder['status'], newProg: number) => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    const orderToUpdate = safeOrders.find(o => o && o.id === id);
    if (!orderToUpdate) return;

    // Strict lock on completed/executed orders
    if (orderToUpdate.status === 'completed' || orderToUpdate.is_executed) {
      alert(`⚠️ أمر الإنتاج [${orderToUpdate.orderNumber}] تم ترحيله وإتمامه بالمخازن مسبقاً، ولا يمكن إعادة بدء تشغيله أو تعديل مسار عمله منعاً لتكرار الصرف وازدواجية القيود.`);
      return;
    }

    if (newStats === 'completed') {
      const executeNow = window.confirm(
        `⚡ هل ترغب في تنفيذ وترحيل أمر الإنتاج [${orderToUpdate.orderNumber}] إلى المخازن وتحديث الأرصدة تلقائياً؟\n\n` +
        `اضغط 'موافق' لتنفيذ الترحيل الفعلي بالمخازن وتوثيق حركات الاستهلاك والاستلام، أو 'إلغاء' للاكتفاء بتعديل الحالة الإدارية فقط.`
      );
      if (executeNow) {
        await handleExecuteOrder(orderToUpdate);
        return;
      }
    }

    const updated = safeOrders.map(o => {
      if (o && o.id === id) {
        const stats = {
          ...o,
          status: newStats,
          progress: newStats === 'completed' ? 100 : newProg
        };
        if (selectedOrder && selectedOrder.id === id) {
          setSelectedOrder(stats);
        }
        return stats;
      }
      return o;
    });

    setOrders(updated);
    localStorage.setItem('remo_production_orders', JSON.stringify(updated));
  };

  const handleViewDetails = (order: ProductionOrder) => {
    // The Work Order Card must be a faithful view of THIS order, not the
    // current form defaults or the first BOM/warehouse in the master data.
    setSelectedOrder(order);
    const snap = order.bomSnapshot || {};
    const rawId = Number(order.rawWarehouseId ?? snap.rawWarehouseId) || null;
    const finishedId = Number(order.finishedWarehouseId ?? snap.finishedWarehouseId) || null;
    setSelectedRawWarehouse(rawId);
    setSelectedFinishedWarehouse(finishedId);
    setIsDetailOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': 
        return <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><AlertCircle className="w-3.5 h-3.5"/> مسودة</span>;
      case 'planned': 
        return <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Calendar className="w-3.5 h-3.5"/> مخطط إنتاجه</span>;
      case 'released': 
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><PlayCircle className="w-3.5 h-3.5"/> مطلق للتشغيل</span>;
      case 'in_progress': 
        return <span className="bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit animate-pulse"><Clock className="w-3.5 h-3.5"/> قيد العمل</span>;
      case 'completed': 
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle className="w-3.5 h-3.5"/> مكتمل وجاهز</span>;
      case 'cancelled': 
        return <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><Ban className="w-3.5 h-3.5"/> ملغي</span>;
      default: 
        return <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-bold">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded text-xs font-extrabold border border-red-200">عالية جداً</span>;
      case 'normal':
        return <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-extrabold">عادية</span>;
      case 'low':
        return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs">منخفضة</span>;
      default:
        return null;
    }
  };

  // Searching logic based on Order Code, Product Code, OR Product Name (امكانية البحث من اسم المنتج)!
  // Helper to find a product details from either local state products or database products (إدارة المنتجات)
  const getProductDetails = (prodId: string) => {
    // 1. Find in local production products from localStorage
    const pLocal = Array.isArray(products) ? products.find(p => p && (p.code === prodId || p.id === prodId || p.name === prodId)) : null;
    if (pLocal) return pLocal;

    // 2. Find in real database products (إدارة المنتجات)
    const pDb = Array.isArray(dbProducts) ? dbProducts.find(p => p && (p.code === prodId || `PROD-${p.id}` === prodId || p.name === prodId || String(p.id) === prodId)) : null;
    if (pDb) {
      return {
        id: String(pDb.id),
        code: pDb.code || `PROD-${pDb.id}`,
        name: pDb.name,
        category: pDb.category_name || pDb.category || 'منتجات مبيعات مستودع',
        unit: pDb.unit || 'وحدة',
        type: 'finished',
        plmStatus: 'approved'
      };
    }

    return {
      id: prodId,
      code: prodId,
      name: prodId,
      category: 'عام',
      unit: 'وحدة',
      type: 'finished',
      plmStatus: 'approved'
    };
  };

  const toEnglishDigits = (value: any) => String(value ?? '').replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  const filteredOrders = (Array.isArray(orders) ? orders : []).filter(o => {
    if (!o) return false;
    const term = (search || '').toLowerCase();
    const isOrderNumberMatch = o.orderNumber && typeof o.orderNumber === 'string' && o.orderNumber.toLowerCase().includes(term);
    const isProductIdMatch = o.productId && typeof o.productId === 'string' && o.productId.toLowerCase().includes(term);
    
    const product = getProductDetails(o.productId);
    const productName = product && product.name ? product.name.toLowerCase() : '';
    const isProductNameMatch = productName.includes(term);
    
    return isOrderNumberMatch || isProductIdMatch || isProductNameMatch;
  });

  useEffect(() => { setPage(1); }, [search, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageStart = filteredOrders.length ? (safePage - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(safePage * pageSize, filteredOrders.length);

  // Combined list of products from POS/ERP DB and local production definitions
  const combinedProducts = React.useMemo(() => {
    const list: (ProductDef & { source?: string; sourceLabel?: string })[] = [];
    const seen = new Set<string>();

    // Real DB products first (including shared from POS and Sales)
    (dbProducts || []).forEach(p => {
      const code = p.code || p.barcode || (p.id ? `PROD-${p.id}` : '');
      const key = code || p.name;
      if (key && !seen.has(key)) {
        seen.add(key);
        const source = p.source || (p.category_name?.includes('مبيعات') || p.category?.includes('مبيعات') ? 'sales' : 'pos');
        const sourceLabel = p.sourceLabel || (source === 'sales' ? 'منتجات المبيعات' : 'نقاط البيع (POS)');
        list.push({
          id: String(p.id || ''),
          code: code || p.name,
          name: p.name,
          category: p.category_name || p.category || (source === 'sales' ? 'منتجات المبيعات' : 'منتجات تامة'),
          type: (p.type as any) || 'finished',
          unit: p.unit || 'قطعة',
          costMethod: 'Actual',
          source,
          sourceLabel
        });
      }
    });

    // Local production products
    (products || []).forEach(p => {
      if (p && p.code && !seen.has(p.code)) {
        seen.add(p.code);
        list.push({
          ...p,
          source: 'production',
          sourceLabel: 'دليل التصنيع'
        });
      }
    });

    return list;
  }, [dbProducts, products]);

  // Modal selector product filtering list
  const modalFilteredProducts = combinedProducts.filter(p => {
    if (!p) return false;
    const term = (productSearch || '').toLowerCase();
    return (p.name || '').toLowerCase().includes(term) || (p.code || '').toLowerCase().includes(term);
  });

  // Active recipe for current modal selection
  const activeModalBOM = React.useMemo(() => {
    if (!newOrder.productId) return null;
    const safeBoms = Array.isArray(boms) ? boms : [];
    return safeBoms.find(b => b && b.id === newOrder.bomId) || 
           safeBoms.find(b => b && (b.productId === newOrder.productId || b.productId === combinedProducts.find(p => p.code === newOrder.productId)?.name));
  }, [newOrder.productId, newOrder.bomId, boms, combinedProducts]);

  const currentSelectedProduct = React.useMemo(() => {
    return combinedProducts.find(p => p.code === newOrder.productId);
  }, [combinedProducts, newOrder.productId]);

  const currentProdUnit = currentSelectedProduct?.unit || 'وحدة';

  // Helper to accurately lookup real stock in the selected warehouse for any raw material
  const getLiveStockForItem = React.useCallback((rawItem: any, fallbackStock?: number): number => {
    if (!rawItem) return Number(fallbackStock) || 0;

    // 1. Explicit ingredient ID from rawItem (NEVER use rawItem.id as an ingredientId)
    const explicitIngId = Number(rawItem.ingredient_id ?? rawItem.ingredientId);
    if (!isNaN(explicitIngId) && explicitIngId > 0 && warehouseStock[explicitIngId] !== undefined) {
      return Number(warehouseStock[explicitIngId]) || 0;
    }

    // 2. Resolve matching ingredient via dbIngredients master
    const matIdRef = String(rawItem.materialId ?? rawItem.material_id ?? '').trim();
    const codeRef = String(rawItem.code ?? rawItem.ingredientCode ?? rawItem.item_code ?? matIdRef).trim().toLowerCase();
    const cleanCodeRef = codeRef.replace(/^item-/, '');
    const nameRef = String(rawItem.materialName ?? rawItem.ingredientName ?? rawItem.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

    const matchedIng = dbIngredients.find((ing: any) => {
      if (explicitIngId > 0 && Number(ing.id) === explicitIngId) return true;
      const ingIdStr = String(ing.id ?? '').trim().toLowerCase();
      const ingCode = String(ing.code ?? ing.item_code ?? '').trim().toLowerCase();
      const ingCleanCode = ingCode.replace(/^item-/, '');
      const ingName = String(ing.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

      if (matIdRef && (ingIdStr === matIdRef.toLowerCase() || ingCode === matIdRef.toLowerCase() || (cleanCodeRef && ingCleanCode === cleanCodeRef))) return true;
      if (codeRef && (ingCode === codeRef || (cleanCodeRef && ingCleanCode === cleanCodeRef))) return true;
      if (nameRef && ingName === nameRef) return true;
      return false;
    });

    if (matchedIng) {
      const idNum = Number(matchedIng.id);
      if (!isNaN(idNum) && idNum > 0 && warehouseStock[idNum] !== undefined) {
        return Number(warehouseStock[idNum]) || 0;
      }
      const c = String(matchedIng.code ?? matchedIng.item_code ?? '').trim().toLowerCase();
      if (c && warehouseStockByCode[c] !== undefined) {
        return Number(warehouseStockByCode[c]) || 0;
      }
      const cleanC = c.replace(/^item-/, '');
      if (cleanC && warehouseStockByCode[cleanC] !== undefined) {
        return Number(warehouseStockByCode[cleanC]) || 0;
      }
      const n = String(matchedIng.name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (n && warehouseStockByName[n] !== undefined) {
        return Number(warehouseStockByName[n]) || 0;
      }
    }

    // 3. Direct lookup in warehouseStockByCode using codeRef / cleanCodeRef
    if (codeRef && warehouseStockByCode[codeRef] !== undefined) {
      return Number(warehouseStockByCode[codeRef]) || 0;
    }
    if (cleanCodeRef && warehouseStockByCode[cleanCodeRef] !== undefined) {
      return Number(warehouseStockByCode[cleanCodeRef]) || 0;
    }

    // 4. Direct lookup in warehouseStockByName using nameRef
    if (nameRef && warehouseStockByName[nameRef] !== undefined) {
      return Number(warehouseStockByName[nameRef]) || 0;
    }

    // 5. Fallback stock if provided from availability check API
    if (fallbackStock !== undefined && fallbackStock !== null && !isNaN(Number(fallbackStock))) {
      return Number(fallbackStock);
    }

    return 0;
  }, [warehouseStock, warehouseStockByCode, warehouseStockByName, dbIngredients]);

  // Unified items list for the Excel Spreadsheet Table in the modal
  const modalSheetItems = React.useMemo(() => {
    const safeOrderQty = Number(newOrder.quantity) && !isNaN(Number(newOrder.quantity)) && Number(newOrder.quantity) > 0 ? Number(newOrder.quantity) : 1;
    if (availabilityData?.items && Array.isArray(availabilityData.items) && availabilityData.items.length > 0) {
      return availabilityData.items.map((it: any) => {
        // Accept both the API's canonical names and legacy frontend names.
        const reqPer = it.quantityPerUnit != null && !isNaN(Number(it.quantityPerUnit))
          ? Number(it.quantityPerUnit)
          : (it.requiredPerUnit != null && !isNaN(Number(it.requiredPerUnit))
            ? Number(it.requiredPerUnit)
            : 0);
        // Deduct exact recipe quantity without scrap additions
        const exactBatchQty = reqPer > 0
          ? parseFloat((reqPer * safeOrderQty).toFixed(4))
          : (Number(it.totalRequiredQty ?? it.totalQuantityWithScrap ?? 0) || 0);
        const totQty = exactBatchQty;
        
        // Units
        const recipeUnit = it.recipeUnit || it.unit || 'وحدة';
        const baseUnit = it.baseUnit || it.unit || recipeUnit;

        // Base converted quantity
        let totalBaseQty = it.totalRequiredBaseQty != null && !isNaN(Number(it.totalRequiredBaseQty))
          ? Number(it.totalRequiredBaseQty)
          : undefined;

        if (totalBaseQty === undefined) {
          const conv = convertQuantity(totQty, recipeUnit, baseUnit);
          totalBaseQty = conv.success ? conv.toQuantity : totQty;
        }

        // Prioritize live issue warehouse stock map (which is in baseUnit)
        const stock = getLiveStockForItem(it, Number(it.currentStock ?? it.availableStock ?? 0));
        const uCost = Number(it.unitCost ?? 0) || 0;
        const totCost = Number(it.totalCost ?? it.totalItemCost ?? 0) || (totalBaseQty * uCost);
        const isAvail = stock >= totalBaseQty;
        const short = isAvail ? 0 : Math.max(0, parseFloat((totalBaseQty - stock).toFixed(4)) || 0);
        const remainingStock = Math.round((stock - totalBaseQty) * 10000) / 10000;

        // Converted stock in recipe unit if different
        let currentStockInRecipeUnit: number | null = null;
        let remainingStockInRecipeUnit: number | null = null;
        let shortageInRecipeUnit: number | null = null;
        if (recipeUnit !== baseUnit) {
          const convBackStock = convertQuantity(stock, baseUnit, recipeUnit);
          if (convBackStock.success) currentStockInRecipeUnit = convBackStock.toQuantity;
          const convBackRem = convertQuantity(remainingStock, baseUnit, recipeUnit);
          if (convBackRem.success) remainingStockInRecipeUnit = convBackRem.toQuantity;
          const convBackShort = convertQuantity(short, baseUnit, recipeUnit);
          if (convBackShort.success) shortageInRecipeUnit = convBackShort.toQuantity;
        }

        return {
          materialId: it.materialId ?? it.ingredientId ?? it.material_id ?? it.ingredient_id,
          ingredientId: it.ingredientId ?? it.ingredient_id,
          materialName: it.materialName || it.ingredientName || it.name || `خامة #${it.ingredientId ?? it.materialId ?? '-'}`,
          code: it.code || it.ingredientCode || it.item_code || it.ingredientCode || it.ingredientId || it.materialId,
          unit: recipeUnit,
          recipeUnit,
          baseUnit,
          requiredPerUnit: isNaN(reqPer) ? 1 : reqPer,
          totalQuantityWithScrap: totQty,
          totalRequiredBaseQty: totalBaseQty,
          currentStock: stock,
          currentStockInRecipeUnit,
          remainingStock,
          remainingStockInRecipeUnit,
          unitCost: isNaN(uCost) ? 0 : uCost,
          totalItemCost: isNaN(totCost) ? 0 : totCost,
          isAvailable: isAvail,
          shortage: isNaN(short) ? 0 : short,
          shortageInRecipeUnit,
          conversionFactor: it.conversionFactor,
          conversionEquation: it.conversionEquation,
          rawWarehouseId: it.rawWarehouseId ?? selectedRawWarehouse ?? null,
          rawWarehouseName: it.rawWarehouseName || dbWarehouses.find((w: any) => Number(w.id) === Number(it.rawWarehouseId ?? selectedRawWarehouse))?.name || 'مخزن الصرف'
        };
      });
    }
    if (activeModalBOM?.items && Array.isArray(activeModalBOM.items)) {
      return activeModalBOM.items.map((it: any) => {
        const explicitId = it.ingredient_id ?? it.ingredientId;
        const ref = explicitId ?? it.materialId ?? it.material_id ?? it.code;
        const refStr = String(ref ?? '').trim().toLowerCase();
        const cleanRefStr = refStr.replace(/^item-/, '');
        const ing = dbIngredients.find((i: any) => {
          if (explicitId != null && Number(i.id) === Number(explicitId)) return true;
          const id = String(i.id ?? '').trim().toLowerCase();
          const code = String(i.code ?? i.item_code ?? '').trim().toLowerCase();
          const cleanCode = code.replace(/^item-/, '');
          const name = String(i.name ?? '').trim().toLowerCase();
          return (refStr && (id === refStr || code === refStr || (cleanRefStr && cleanCode === cleanRefStr) || name === refStr));
        });
        const reqPerUnit = Number(it.quantity) || 1;
        // Exact recipe quantity without scrap additions
        const totalReq = parseFloat((reqPerUnit * safeOrderQty).toFixed(4)) || 0;
        const recipeUnit = it.unit || ing?.unit || 'وحدة';
        const baseUnit = ing?.unit || recipeUnit;

        const conv = convertQuantity(totalReq, recipeUnit, baseUnit);
        const totalBaseQty = conv.success ? conv.toQuantity : totalReq;

        // IMPORTANT: stock shown here is the balance in the selected issue warehouse (in baseUnit)
        const currentStock = getLiveStockForItem(ing || it, 0);
        const baseUnitCost = Number(ing?.avg_cost || ing?.cost || ing?.last_purchase_price || 0) || 0;
        const recipeUnitCost = conv.factor ? baseUnitCost / conv.factor : baseUnitCost;
        const totalCost = parseFloat((totalBaseQty * baseUnitCost).toFixed(2)) || 0;
        const isAvail = currentStock >= totalBaseQty;
        const short = isAvail ? 0 : Math.max(0, parseFloat((totalBaseQty - currentStock).toFixed(4)) || 0);
        const remainingStock = Math.round((currentStock - totalBaseQty) * 10000) / 10000;

        // Converted stock in recipe unit if different
        let currentStockInRecipeUnit: number | null = null;
        let remainingStockInRecipeUnit: number | null = null;
        let shortageInRecipeUnit: number | null = null;
        if (recipeUnit !== baseUnit) {
          const convBackStock = convertQuantity(currentStock, baseUnit, recipeUnit);
          if (convBackStock.success) currentStockInRecipeUnit = convBackStock.toQuantity;
          const convBackRem = convertQuantity(remainingStock, baseUnit, recipeUnit);
          if (convBackRem.success) remainingStockInRecipeUnit = convBackRem.toQuantity;
          const convBackShort = convertQuantity(short, baseUnit, recipeUnit);
          if (convBackShort.success) shortageInRecipeUnit = convBackShort.toQuantity;
        }

        return {
          materialId: it.materialId ?? ing?.id,
          ingredientId: ing?.id,
          materialName: ing?.name || it.materialName || it.materialId,
          code: ing?.code || ing?.item_code || it.code || it.materialId,
          unit: recipeUnit,
          recipeUnit,
          baseUnit,
          requiredPerUnit: reqPerUnit,
          totalQuantityWithScrap: totalReq,
          totalRequiredBaseQty: totalBaseQty,
          currentStock: currentStock,
          currentStockInRecipeUnit,
          remainingStock,
          remainingStockInRecipeUnit,
          unitCost: recipeUnitCost,
          totalItemCost: totalCost,
          isAvailable: isAvail,
          shortage: short,
          shortageInRecipeUnit,
          conversionFactor: conv.factor,
          conversionEquation: conv.explanation,
          rawWarehouseId: selectedRawWarehouse || null,
          rawWarehouseName: dbWarehouses.find((w: any) => Number(w.id) === Number(selectedRawWarehouse))?.name || 'مخزن الصرف'
        };
      });
    }
    return [];
  }, [availabilityData, activeModalBOM, newOrder.quantity, dbIngredients, dbWarehouses, selectedRawWarehouse, getLiveStockForItem]);

  const modalTotalCost = React.useMemo(() => {
    if (availabilityData?.totalEstimatedCost != null && !isNaN(Number(availabilityData.totalEstimatedCost))) {
      return Number(availabilityData.totalEstimatedCost);
    }
    const sum = modalSheetItems.reduce((acc: number, it: any) => acc + (Number(it.totalItemCost) || 0), 0);
    return isNaN(sum) ? 0 : sum;
  }, [availabilityData, modalSheetItems]);

  const modalCostPerUnit = React.useMemo(() => {
    const qty = Number(newOrder.quantity) || 1;
    const total = Number(modalTotalCost) || 0;
    const result = qty > 0 ? (total / qty) : 0;
    return isNaN(result) ? 0 : result;
  }, [modalTotalCost, newOrder.quantity]);

  const allItemsAvailable = React.useMemo(() => {
    if (availabilityData && typeof availabilityData.canProduce === 'boolean') {
      return availabilityData.canProduce;
    }
    if (modalSheetItems.length === 0) return true;
    return modalSheetItems.every((it: any) => it.isAvailable);
  }, [availabilityData, modalSheetItems]);

  return (
    <div className="p-4 md:p-8 w-full max-w-[1800px] mx-auto space-y-6 animate-fadeIn" id="production_orders_main">
      {/* Header Hub - Clean Production Management UI */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-xs flex flex-col lg:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">أوامر الإنتاج وتتبع النشاط</h1>
            <p className="text-slate-500 font-medium mt-1 flex items-center gap-2 text-xs">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              تخطيط، جدولة، ومراقبة أوامر التشغيل الميدانية وربط المخازن في الوقت الفعلي
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="البحث برقم الأمر، كود المنتج أو اسم الصنف..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-10 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all font-semibold text-slate-700 text-xs"
            />
          </div>
          
          <button 
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all text-xs cursor-pointer whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            إنشاء أمر إنتاج جديد (شيت إكسيل)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 px-1">
        <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button 
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'list' 
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className={`w-3.5 h-3.5 ${viewMode === 'list' ? 'text-indigo-600' : ''}`} />
            جدول أوامر التشغيل
          </button>
          <button 
            type="button"
            onClick={() => setViewMode('gantt')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              viewMode === 'gantt' 
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${viewMode === 'gantt' ? 'text-indigo-600' : ''}`} />
            المخطط الزمني (Gantt)
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
           <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{orders.filter(o => o.status === 'completed').length} مكتمل</span>
           </div>
           <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{orders.filter(o => o.status === 'in_progress').length} نشط</span>
           </div>
           <div className="w-8 h-[1px] bg-slate-200" />
           <span className="text-slate-400 font-mono text-[11px]">نظام متابعة الإنتاج والمخازن الحية</span>
        </div>
      </div>

      {viewMode === 'gantt' ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-right">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5 justify-end">
                مخطط وجدولة إنتاج الورشة - Gantt Chart Scheduler
                <Calendar className="w-4 h-4 text-indigo-600" />
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">مخطط زمني تفاعلي لتوزيع الأوامر، الحصص، والمواعيد وتفادي فترات تراكم العمل</p>
            </div>
            {/* Legend indicators */}
            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-600" dir="rtl">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-sky-400 rounded-full"></span> مخطط (Planned)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> تحت العمل (Running)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> مكتمل وجاهز (Done)</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px] border border-slate-200 rounded-xl overflow-hidden">
              {/* Timeline Header Row */}
              <div className="grid grid-cols-12 bg-slate-50 border-b border-slate-200 text-center font-bold text-xs text-slate-600 py-2.5 pr-2">
                <div className="col-span-3 text-right pr-3">كود الأمر والمنتج النهائي المستهدف</div>
                <div className="col-span-9 grid grid-cols-12 gap-0.5 font-mono text-[11px]">
                  {['06-11', '06-12', '06-13', '06-14', '06-15', '06-16', '06-17', '06-18', '06-19', '06-20', '06-21', '06-22'].map(d => (
                    <div key={d} className="border-r border-slate-200/50 last:border-0 py-0.5">{d.split('-').reverse().join('/')}</div>
                  ))}
                </div>
              </div>

              {/* Rows matching orders */}
              <div className="divide-y divide-slate-100">
                {(filteredOrders || []).map((order, oIdx) => {
                  if (!order) return null;
                  const associatedProduct = getProductDetails(order.productId);
                  const daysList = ['06-11', '06-12', '06-13', '06-14', '06-15', '06-16', '06-17', '06-18', '06-19', '06-20', '06-21', '06-22'];
                  
                  const isCompleted = order.status === 'completed' || Boolean(order.is_executed);

                  return (
                    <div key={`po-timeline-${order.id ?? oIdx}-${oIdx}`} className={`grid grid-cols-12 hover:bg-slate-50/50 items-center py-2.5 text-xs text-right cursor-pointer transition-colors ${isCompleted ? 'bg-emerald-50/20' : ''}`} onClick={() => handleViewDetails(order)}>
                      <div className="col-span-3 pr-3 space-y-0.5">
                        <div className="flex items-center gap-1.5 justify-start flex-wrap">
                          <span className={`font-mono font-bold text-xs ${isCompleted ? 'line-through decoration-emerald-600 decoration-2 text-slate-400' : 'text-indigo-600'}`}>{order.orderNumber}</span>
                          {getPriorityBadge(order.priority)}
                          {isCompleted && (
                            <span className="text-[9px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.2 rounded inline-flex items-center gap-0.5">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> تم بنجاح وتحويل المنتج إلى المخزن
                            </span>
                          )}
                        </div>
                        <p className={`font-bold truncate text-[11px] ${isCompleted ? 'line-through decoration-emerald-600 decoration-2 text-slate-400' : 'text-slate-700'}`}>{associatedProduct ? associatedProduct.name : order.productId}</p>
                        <p className="text-[10px] text-slate-400 font-mono">الكمية: {order.quantity} {associatedProduct ? associatedProduct.unit : 'وحدات'}</p>
                      </div>

                      <div className="col-span-9 grid grid-cols-12 gap-0.5 h-9 items-stretch border-r border-slate-100" dir="ltr">
                        {daysList.map((day, dIdx) => {
                          const dayNormalized = `2026-${day}`;
                          const start = order.startDate;
                          const end = order.endDate || order.startDate;
                          
                          const isActive = dayNormalized >= start && dayNormalized <= end;
                          
                          let cellBg = 'bg-slate-50/20';
                          if (isActive) {
                            if (isCompleted) {
                              cellBg = 'bg-emerald-500/85 hover:bg-emerald-600 text-white font-bold';
                            } else if (order.status === 'in_progress') {
                              cellBg = 'bg-amber-400/90 hover:bg-amber-500 text-amber-950 font-bold';
                            } else if (order.status === 'planned') {
                              cellBg = 'bg-sky-400/80 hover:bg-sky-500 text-sky-950 font-bold';
                            } else {
                              cellBg = 'bg-indigo-400/80 hover:bg-indigo-500 text-indigo-950';
                            }
                          }

                          return (
                            <div 
                              key={`po-day-${order.id ?? oIdx}-${day}-${dIdx}`} 
                              className={`flex flex-col items-center justify-center transition-colors border-r border-slate-100/50 relative group ${cellBg} text-[9px]`}
                              title={`${order.orderNumber}: ${day.split('-').reverse().join('/')}${isCompleted ? ' (تم بنجاح وتحويل المنتج إلى المخزن)' : ''}`}
                            >
                              {isActive && (
                                <span className="absolute inset-0 flex items-center justify-center font-mono opacity-0 group-hover:opacity-100 bg-black/75 text-white text-[8px] z-10 px-1 rounded">
                                  {isCompleted ? '100%' : `${Number(order.progress) || 0}%`}
                                </span>
                              )}
                              {isActive && <div className="h-1.5 w-1.5 bg-white/70 rounded-full" />}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredOrders.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">لا يوجد أوامر إنتاج مجدولة.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-center text-xs border-collapse">
              <thead className="bg-[#2F5F9F] text-white font-bold border-b border-[#244D80] text-xs sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-center align-middle">تعريف أمر الإنتاج</th>
                  <th className="p-3 text-center align-middle">المنتج والوصفة (BOM)</th>
                  <th className="p-3 text-center align-middle">الكمية</th>
                  <th className="p-3 text-center align-middle">الأولوية والجدولة</th>
                  <th className="p-3 text-center align-middle">خط التشغيل / المشرف</th>
                  <th className="p-3 text-center align-middle">حالة المسار الميداني</th>
                  <th className="p-3 text-center align-middle">تقدم التنفيذ</th>
                  <th className="p-3 text-center align-middle">الأدوات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {(paginatedOrders || []).map((order) => {
                  if (!order) return null;
                  const associatedProduct = getProductDetails(order.productId);
                  const associatedWC = Array.isArray(workCenters) ? workCenters.find(w => w && (w.code === order.workCenterId || w.id === order.workCenterId)) : null;
                  const linkedBom = Array.isArray(boms) ? boms.find(b => b && b.id === order.bomId) : null;
                  const isCompleted = order.status === 'completed' || Boolean(order.is_executed);
                  const orderProgress = isCompleted ? 100 : (isNaN(Number(order.progress)) ? 0 : Number(order.progress));

                  return (
                    <tr 
                      key={order.id} 
                      className={`transition-all duration-200 cursor-pointer ${
                        isCompleted 
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/70 border-r-4 border-r-emerald-500' 
                          : 'hover:bg-slate-50/70'
                      }`}
                      onClick={() => handleViewDetails(order)}
                    >
                      <td className="p-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-xs shrink-0 ${
                            isCompleted ? 'bg-emerald-100 text-emerald-700 ring-2 ring-emerald-400/50' :
                            order.status === 'in_progress' ? 'bg-amber-50 text-amber-600' :
                            'bg-indigo-50 text-indigo-600'
                          }`}>
                            {isCompleted ? <PackageCheck className="w-5 h-5" /> : <Activity className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`font-mono text-sm block ${
                                isCompleted 
                                  ? 'font-bold text-slate-400 line-through decoration-emerald-600 decoration-2' 
                                  : 'font-bold text-indigo-700'
                              }`}>
                                {order.orderNumber}
                              </span>
                            </div>
                            {isCompleted ? (
                              <div className="flex items-center gap-1 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10.5px] font-black text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-2 py-0.5 rounded-md shadow-xs">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                                  تم بنجاح وتحويل المنتج إلى المخزن
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">كود أمر الإنتاج</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center align-middle">
                        <div className="space-y-1 flex flex-col items-center">
                          <h4 className={`font-bold text-xs ${
                            isCompleted ? 'line-through decoration-emerald-600 decoration-2 text-slate-400' : 'text-slate-800'
                          }`}>
                            {associatedProduct ? associatedProduct.name : 'منتج غير معروف'}
                          </h4>
                          <div className="flex items-center gap-1.5 flex-wrap">
                             <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                               isCompleted 
                                 ? 'bg-slate-100 text-slate-400 line-through border-slate-200' 
                                 : 'bg-slate-100 text-slate-600 border-slate-200'
                             }`}>
                                {associatedProduct?.code || order.productId}
                             </span>
                             <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                               isCompleted
                                 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                 : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                             }`}>
                                {linkedBom ? linkedBom.name : 'BOM الافتراضي'}
                             </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center align-middle">
                        <span className={`text-sm font-bold font-mono block ${
                          isCompleted ? 'line-through decoration-emerald-600 decoration-2 text-slate-400' : 'text-slate-900'
                        }`}>
                          {toEnglishDigits(order.quantity)}
                        </span>
                        <span className="text-[10px] text-slate-400">{associatedProduct?.unit || 'وحدة'}</span>
                      </td>
                      <td className="p-3 text-center align-middle">
                        <div className="space-y-1 flex flex-col items-center">
                           <div>{getPriorityBadge(order.priority)}</div>
                           <div className={`text-[11px] font-mono flex items-center gap-1 ${
                             isCompleted ? 'line-through text-slate-400' : 'text-slate-500'
                           }`}>
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>{toEnglishDigits(order.startDate)}</span>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-300 mx-0.5 inline" />
                              <span>{toEnglishDigits(order.endDate || '...')}</span>
                           </div>
                        </div>
                      </td>
                      <td className="p-3 text-center align-middle">
                        <div className="space-y-1 flex flex-col items-center">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full inline-block ${isCompleted ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <span className={`font-bold text-xs ${
                              isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                            }`}>
                              {associatedWC ? associatedWC.name : 'خط عام'}
                            </span>
                          </div>
                          <div className={`text-[11px] flex items-center gap-1 ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-500'
                          }`}>
                             <User className="w-3 h-3 text-slate-400" />
                             <span>{order.supervisor || 'غير محدد'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center align-middle">
                        {isCompleted ? (
                          <div className="space-y-1 flex flex-col items-center">
                            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 w-fit shadow-xs mx-auto">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              تم بنجاح وتحويل المنتج إلى المخزن
                            </span>
                            {order.executed_at && (
                              <span className="text-[10px] text-emerald-700 font-mono block pr-1">
                                تم الترحيل: {toEnglishDigits(new Date(order.executed_at).toLocaleDateString('en-GB'))}
                              </span>
                            )}
                          </div>
                        ) : (
                          getStatusBadge(order.status)
                        )}
                      </td>
                      <td className="p-3 text-center align-middle">
                        <div className="w-28 space-y-1.5" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-between items-center text-[10px] font-bold">
                             <span className={isCompleted ? "text-emerald-700" : "text-slate-400"}>
                               {isCompleted ? "مكتمل ومرحل" : "الإنجاز"}
                             </span>
                             <span className={`font-mono ${isCompleted ? "text-emerald-700 font-black" : "text-slate-800"}`}>
                               {toEnglishDigits(orderProgress)}%
                             </span>
                          </div>
                          <div className="bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div 
                              style={{ width: `${Math.min(100, Math.max(0, orderProgress))}%` }}
                              className={`h-full rounded-full transition-all duration-300 ${
                                isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                              }`} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center align-middle">
                        <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                          {!isCompleted ? (
                            <button
                              onClick={() => handleExecuteOrder(order)}
                              disabled={postingToInventory}
                              title="تنفيذ وترحيل أمر الإنتاج إلى المخازن فوراً"
                              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              ترحيل للمخازن
                            </button>
                          ) : (
                            <span className="px-2.5 py-1.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-black inline-flex items-center gap-1.5 shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3] text-emerald-600" />
                              تم الترحيل للمخازن بنجاح
                            </span>
                          )}
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleViewDetails(order); }}
                            title="عرض تفاصيل كرت العمل والوصفة"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-500 font-bold bg-slate-50/30">
                       <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                       <h3 className="text-base font-bold text-slate-600">لا توجد أوامر إنتاج مطابقة</h3>
                       <p className="text-slate-400 font-normal mt-0.5 text-xs">جرب تعديل كلمات البحث لمشاهدة السجلات</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      
      {/* Pagination */}
      {viewMode === 'list' && (
        <div className="bg-white border border-slate-200 border-t-0 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" dir="rtl">
          <div className="flex items-center gap-3 text-slate-600 font-bold">
            <span>عرض {toEnglishDigits(pageStart)} - {toEnglishDigits(pageEnd)} من {toEnglishDigits(filteredOrders.length)} أمر إنتاج</span>
            <label className="flex items-center gap-2 font-medium">
              عدد الصفوف:
              <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="border border-slate-300 bg-white rounded-md px-2 py-1.5 outline-none focus:border-[#2F5F9F]">
                <option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-1" dir="ltr">
            <button disabled={safePage <= 1} onClick={() => setPage(1)} className="px-2.5 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50">الأولى</button>
            <button disabled={safePage <= 1} onClick={() => setPage(Math.max(1, safePage - 1))} className="px-2.5 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50">السابق</button>
            {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
              let n = Math.max(1, Math.min(totalPages - 4, safePage - 2)) + i;
              return <button key={n} onClick={() => setPage(n)} className={`min-w-8 px-2 py-1.5 border rounded-md ${n === safePage ? 'bg-[#2F5F9F] text-white border-[#2F5F9F]' : 'border-slate-300 hover:bg-slate-50'}`}>{toEnglishDigits(n)}</button>;
            })}
            <button disabled={safePage >= totalPages} onClick={() => setPage(Math.min(totalPages, safePage + 1))} className="px-2.5 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50">التالي</button>
            <button disabled={safePage >= totalPages} onClick={() => setPage(totalPages)} className="px-2.5 py-1.5 border border-slate-300 rounded-md disabled:opacity-40 hover:bg-slate-50">الأخيرة</button>
          </div>
        </div>
      )}

      {/* CREATE ORDER MODAL — EXCEL SPREADSHEET CARD */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className={`bg-white rounded-xl w-full shadow-2xl border border-slate-300 flex flex-col transition-all duration-200 overflow-hidden ${
                isModalMaximized 
                  ? 'fixed inset-1 md:inset-2 w-[calc(100vw-16px)] h-[calc(100vh-16px)] rounded-lg' 
                  : 'w-[98vw] max-w-[1440px] h-[92vh] max-h-[96vh]'
              }`}
            >
              {/* Excel Header Toolbar */}
              <div className="px-5 py-3 bg-slate-800 text-white flex items-center justify-between border-b border-slate-700 shrink-0 select-none">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm md:text-base font-bold text-white">
                        شيت أمر الإنتاج والتشغيل | Production Work Order Sheet
                      </h2>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] md:text-[11px] font-mono px-2 py-0.5 rounded font-bold">
                        رقم: {newOrder.orderNumber}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 mt-0.5 hidden sm:block">
                      نموذج إلكتروني موحد لإصدار أوامر الإنتاج وحساب احتياجات الخامات وتكلفة التشغيل والمطابقة المخزنية
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsModalMaximized(!isModalMaximized)}
                    title={isModalMaximized ? "استعادة الحجم الطبيعي" : "تكبير للشاشة الكاملة"}
                    className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {isModalMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)} 
                    title="إغلاق (Esc)"
                    className="p-1.5 text-slate-300 hover:text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form Body */}
              <form onSubmit={handleAddOrderSubmit} className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-slate-50/60 text-slate-800 flex flex-col justify-between">
                <div className="space-y-4">
                  {/* Block 1: Excel Header Metadata Cells */}
                  <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                    <div className="bg-slate-100 px-3.5 py-1.5 border-b border-slate-300 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-600" />
                        بيانات تعريف وترميز أمر الإنتاج (Order Metadata)
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">Auto-Ref: {newOrder.orderNumber}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-x-reverse divide-y sm:divide-y-0 divide-slate-200 text-xs">
                      {/* Cell 1: Order Number */}
                      <div className="p-2.5 bg-slate-50/60">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">رقم الأمر</label>
                        <input 
                          readOnly 
                          value={newOrder.orderNumber} 
                          className="w-full font-mono font-bold text-indigo-700 bg-white border border-slate-200 px-2 py-1 rounded text-xs text-center outline-none"
                        />
                      </div>

                      {/* Cell 2: Priority */}
                      <div className="p-2.5 bg-white">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">أولوية التشغيل</label>
                        <select 
                          value={newOrder.priority}
                          onChange={e => setNewOrder({...newOrder, priority: e.target.value as any})}
                          className="w-full bg-white border border-slate-200 px-2 py-1 rounded text-xs font-semibold text-slate-800 outline-none"
                        >
                          <option value="normal">عادية (Normal)</option>
                          <option value="high">أولوية قصوى (High)</option>
                          <option value="low">منخفضة (Low)</option>
                        </select>
                      </div>

                      {/* Cell 3: Start Date */}
                      <div className="p-2.5 bg-white">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">تاريخ البدء</label>
                        <input 
                          type="date"
                          required
                          value={newOrder.startDate}
                          onChange={e => setNewOrder({...newOrder, startDate: e.target.value})}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 rounded text-xs font-mono font-semibold text-slate-800 outline-none"
                        />
                      </div>

                      {/* Cell 4: Deadline Date */}
                      <div className="p-2.5 bg-white">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">تاريخ التسليم</label>
                        <input 
                          type="date"
                          required
                          value={newOrder.endDate}
                          onChange={e => setNewOrder({...newOrder, endDate: e.target.value})}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 rounded text-xs font-mono font-semibold text-slate-800 outline-none"
                        />
                      </div>

                      {/* Cell 5: SO Reference */}
                      <div className="p-2.5 bg-white">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">المرجع (SO/REF)</label>
                        <input 
                          type="text"
                          placeholder="SO-1092..."
                          value={newOrder.salesReference}
                          onChange={e => setNewOrder({...newOrder, salesReference: e.target.value})}
                          className="w-full bg-white border border-slate-200 px-2 py-1 rounded text-xs font-mono text-slate-800 outline-none"
                        />
                      </div>

                      {/* Cell 6: Work Center */}
                      <div className="p-2.5 bg-white">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">مركز التشغيل / الخط</label>
                        <select 
                          value={newOrder.workCenterId}
                          onChange={e => setNewOrder({...newOrder, workCenterId: e.target.value})}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 rounded text-xs font-semibold text-slate-800 outline-none"
                        >
                          <option value="">-- اختر الخط --</option>
                          {workCenters.map(wc => (
                            <option key={wc.id} value={wc.code || wc.id}>{wc.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cell 7: Supervisor */}
                      <div className="p-2.5 bg-white">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">المشرف المسؤول</label>
                        <input 
                          type="text"
                          placeholder="اسم المشرف..."
                          value={newOrder.supervisor}
                          onChange={e => setNewOrder({...newOrder, supervisor: e.target.value})}
                          className="w-full bg-white border border-slate-200 px-2 py-1 rounded text-xs text-slate-800 font-semibold outline-none"
                        />
                      </div>

                      {/* Cell 8: Status */}
                      <div className="p-2.5 bg-white">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">حالة الأمر</label>
                        <select 
                          value={newOrder.status}
                          onChange={e => {
                            const st = e.target.value as any;
                            setNewOrder({...newOrder, status: st, progress: st === 'completed' ? 100 : 0});
                          }}
                          className="w-full bg-white border border-slate-200 px-1.5 py-1 rounded text-xs font-bold text-indigo-700 outline-none"
                        >
                          <option value="planned">مخطط (Planned)</option>
                          <option value="released">مطلق للتنفيذ</option>
                          <option value="in_progress">قيد العمل</option>
                          <option value="completed">مكتمل (ترحيل فوري للمخازن)</option>
                          <option value="draft">مسودة (Draft)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Block 2: Excel Ribbon for Product, Qty, BOM, and Warehouses */}
                  <div className="bg-white border border-slate-300 rounded-xl p-3.5 shadow-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-emerald-600" />
                        تحديد الصنف المستهدف للتصنيع والكمية ومسار المستودعات (Production Routing)
                      </span>
                      <span className="text-[11px] bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded font-mono font-bold">
                        ربط مباشر بمخازن ERP والوصفات الفنية
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                      {/* Product Selector with Search */}
                      <div className="md:col-span-4">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-700">المنتج المراد تصنيعه</label>
                          <input 
                            type="text" 
                            placeholder="تصفية سريعة..." 
                            value={productSearch}
                            onChange={e => setProductSearch(e.target.value)}
                            className="text-[10px] px-2 py-0.5 border border-slate-200 rounded w-28 bg-slate-50 focus:bg-white outline-none"
                          />
                        </div>
                        <select
                          required
                          value={newOrder.productId}
                          onChange={e => {
                            const selectedProdCode = e.target.value;
                            const matchingBOM = boms.find(b => b.productId === selectedProdCode || b.productId === combinedProducts.find(p => p.code === selectedProdCode)?.name);
                            setNewOrder(prev => ({
                              ...prev,
                              productId: selectedProdCode,
                              bomId: matchingBOM ? matchingBOM.id : ''
                            }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-indigo-950 focus:border-indigo-500 outline-none"
                        >
                          <option value="">-- اختر المنتج من الدليل الموحد (مبيعات / POS / تصنيع) --</option>
                          
                          {/* Sales Module Products */}
                          {modalFilteredProducts.some(p => p.source === 'sales') && (
                            <optgroup label="🛍️ منتجات مديول المبيعات (Sales Products)">
                              {modalFilteredProducts.filter(p => p.source === 'sales').map(p => (
                                <option key={`sales-${p.id || p.code}`} value={p.code}>
                                  [مبيعات] {p.name} ({p.unit || 'قطعة'}) - كود: {p.code}
                                </option>
                              ))}
                            </optgroup>
                          )}

                          {/* POS Products */}
                          {modalFilteredProducts.some(p => p.source === 'pos' || (!p.source && !p.category?.includes('مبيعات'))) && (
                            <optgroup label="🛒 منتجات نقاط البيع والكاشير (POS)">
                              {modalFilteredProducts.filter(p => p.source === 'pos' || (!p.source && !p.category?.includes('مبيعات'))).map(p => (
                                <option key={`pos-${p.id || p.code}`} value={p.code}>
                                  [POS] {p.name} ({p.unit || 'قطعة'}) - كود: {p.code}
                                </option>
                              ))}
                            </optgroup>
                          )}

                          {/* Internal Production Products */}
                          {modalFilteredProducts.some(p => p.source === 'production') && (
                            <optgroup label="🏭 منتجات دليل التصنيع الداخلي">
                              {modalFilteredProducts.filter(p => p.source === 'production').map(p => (
                                <option key={`prod-${p.id || p.code}`} value={p.code}>
                                  [تصنيع] {p.name} ({p.unit || 'قطعة'}) - كود: {p.code}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          كمية الدفعة المطلوبة ({currentProdUnit})
                        </label>
                        <div className="relative">
                          <input 
                            required
                            type="number"
                            min="1"
                            step="any"
                            value={newOrder.quantity}
                            onChange={e => setNewOrder({...newOrder, quantity: parseFloat(e.target.value) || 1})}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-center text-indigo-700 focus:border-indigo-500 outline-none"
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                            {currentProdUnit}
                          </span>
                        </div>
                      </div>

                      {/* BOM Selection */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">وصفة التصنيع المعتمدة (BOM)</label>
                        <select 
                          value={newOrder.bomId}
                          onChange={e => setNewOrder({...newOrder, bomId: e.target.value})}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:border-indigo-500 outline-none"
                        >
                          <option value="">-- ربط تلقائي بالوصفة --</option>
                          {boms.filter(b => b.productId === newOrder.productId || b.productId === combinedProducts.find(p => p.code === newOrder.productId)?.name).map(b => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.version})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Source Warehouse */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">مستودع صرف المواد الخام</label>
                        <select 
                          value={selectedRawWarehouse || ''}
                          onChange={e => {
                            const id = parseInt(e.target.value, 10) || null;
                            setSelectedRawWarehouse(id);
                            setNewOrder(prev => ({ ...prev, rawWarehouseId: id || undefined }));
                          }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:border-indigo-500 outline-none"
                        >
                          {dbWarehouses.map((wh: any) => (
                            <option key={`wh-raw-${wh.id}`} value={wh.id}>
                              📦 {wh.name} {wh.is_main === 1 ? '(الرئيسي)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Destination Warehouse */}
                      <div className="md:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">مستودع استلام المنتج التام</label>
                        <select 
                          value={selectedFinishedWarehouse || ''}
                          onChange={e => {
                          const id = parseInt(e.target.value, 10) || null;
                          setSelectedFinishedWarehouse(id);
                          setNewOrder(prev => ({ ...prev, finishedWarehouseId: id || undefined }));
                        }}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:border-indigo-500 outline-none"
                        >
                          {dbWarehouses.map((wh: any) => (
                            <option key={`wh-fin-${wh.id}`} value={wh.id}>
                              🏢 {wh.name} {wh.is_main === 1 ? '(الرئيسي)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Block 3: The Live Excel Worksheet Table for Raw Materials & Stock Availability */}
                  <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
                    {/* Excel Table Title Bar */}
                    <div className="bg-slate-100 px-3.5 py-2 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Table className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-800">
                          جدول مطابقة المواد الخام وميزانية التكلفة (BOM Live Materials Spreadsheet)
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          الدفعة المستهدفة: {newOrder.quantity} {currentProdUnit}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                          مخزن الصرف: {dbWarehouses.find((w: any) => Number(w.id) === Number(selectedRawWarehouse))?.name || 'غير محدد'}
                        </span>
                      </div>

                      {checkingAvailability && (
                        <span className="text-xs font-bold text-indigo-600 flex items-center gap-1.5 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري تدقيق الأرصدة والتكلفة...
                        </span>
                      )}
                    </div>

                    {/* Excel Grid Table */}
                    <div className="overflow-x-auto max-h-[36vh] overflow-y-auto">
                      <table className="w-full text-right text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b-2 border-slate-300 sticky top-0 z-10 select-none">
                          <tr className="divide-x divide-x-reverse divide-slate-300">
                            <th className="p-2 text-center w-8 font-mono">#</th>
                            <th className="p-2">كود الصنف بالمخزن</th>
                            <th className="p-2">اسم المادة الخام / المكون</th>
                            <th className="p-2">مخزن الصرف</th>
                            <th className="p-2 text-center">الوحدة</th>
                            <th className="p-2 text-center">استهلاك الوحدة</th>
                            <th className="p-2 text-center">إجمالي المطلوب للدفعة</th>
                            <th className="p-2 text-center">الرصيد المتاح بالمخزن</th>
                            <th className="p-2 text-center">سعر الوحدة</th>
                            <th className="p-2 text-center">إجمالي التكلفة</th>
                            <th className="p-2 text-center">حالة الرصيد</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 font-medium">
                          {modalSheetItems.map((item: any, idx: number) => {
                            const isAvail = Boolean(item.isAvailable);
                            return (
                              <tr 
                                key={`sheet-it-${idx}`} 
                                className={`divide-x divide-x-reverse divide-slate-200 transition-colors ${
                                  idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                                } hover:bg-emerald-50/40`}
                              >
                                <td className="p-2 text-center font-mono text-slate-400 bg-slate-50/50">{idx + 1}</td>
                                <td className="p-2 font-mono text-slate-700 font-bold">{item.code || item.materialId || '-'}</td>
                                <td className="p-2 font-bold text-slate-800">{item.materialName || item.ingredientName || item.materialId || '-'}</td>
                                <td className="p-2 font-semibold text-slate-700 whitespace-nowrap">
                                  📦 {item.rawWarehouseName || 'مخزن الصرف'}
                                </td>
                                <td className="p-2 text-center text-slate-700 font-semibold">
                                  <div>{item.unit || 'وحدة'}</div>
                                  {item.unit !== item.baseUnit && (
                                    <div className="text-[9px] text-amber-700 font-normal bg-amber-50 rounded px-1 mt-0.5 border border-amber-200 inline-block">
                                      مخزن: {item.baseUnit}
                                    </div>
                                  )}
                                </td>
                                <td className="p-2 text-center font-mono text-slate-700">
                                  {Number(item.requiredPerUnit || 0)} {item.unit}
                                </td>
                                <td className="p-2 text-center font-mono font-bold text-indigo-700">
                                  <div>{Number(item.totalQuantityWithScrap || 0).toLocaleString()} {item.unit}</div>
                                  {item.unit !== item.baseUnit && (
                                    <div className="text-[10px] font-mono text-indigo-600 font-medium">
                                      = {Number(item.totalRequiredBaseQty || 0).toLocaleString()} {item.baseUnit}
                                    </div>
                                  )}
                                </td>
                                <td className={`p-2 text-center font-mono font-bold ${isAvail ? 'text-emerald-700 bg-emerald-50/30' : 'text-rose-600 bg-rose-50/30'}`}>
                                  <div className="text-sm">{Number(item.currentStock || 0).toLocaleString()} {item.baseUnit}</div>
                                  {item.unit !== item.baseUnit && item.currentStockInRecipeUnit != null && (
                                    <div className="text-[10px] text-emerald-600 font-normal">
                                      (= {Number(item.currentStockInRecipeUnit || 0).toLocaleString()} {item.unit})
                                    </div>
                                  )}
                                  <div className="text-[9px] text-slate-400 font-normal">
                                    رصيد المخزن الفعلي
                                  </div>
                                </td>
                                <td className="p-2 text-center font-mono text-slate-600">
                                  {Number(item.unitCost || 0).toFixed(2)} ج.م
                                </td>
                                <td className="p-2 text-center font-mono font-bold text-slate-800">{Number(item.totalItemCost || 0).toFixed(2)} ج.م</td>
                                <td className="p-2 text-center">
                                  {isAvail ? (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">
                                        <Check className="w-3 h-3" /> متوفر بالكامل
                                      </span>
                                      <span className="text-[9px] font-mono text-emerald-600 mt-0.5">
                                        متبقي: {Number(item.remainingStock || 0).toLocaleString()} {item.baseUnit}
                                        {item.unit !== item.baseUnit && item.remainingStockInRecipeUnit != null && (
                                          <span className="block text-[8px] text-emerald-500">
                                            (= {Number(item.remainingStockInRecipeUnit || 0).toLocaleString()} {item.unit})
                                          </span>
                                        )}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="inline-flex flex-col items-center">
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                                        <AlertCircle className="w-3 h-3" /> عجز: {Number(item.shortage || 0).toLocaleString()} {item.baseUnit}
                                      </span>
                                      {item.unit !== item.baseUnit && item.shortageInRecipeUnit != null && (
                                        <span className="text-[9px] font-mono text-rose-600 mt-0.5">
                                          (= {Number(item.shortageInRecipeUnit || 0).toLocaleString()} {item.unit})
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}

                          {modalSheetItems.length === 0 && (
                            <tr>
                              <td colSpan={11} className="p-8 text-center text-slate-400 font-semibold bg-white">
                                {newOrder.productId ? 'لا توجد بنود مواد خام مسجلة في وصفة هذا المنتج، أو جاري تحميل الوصفة.' : 'يرجى اختيار المنتج المستهدف أعلاه لعرض شيت الخامات المطابق.'}
                              </td>
                            </tr>
                          )}
                        </tbody>

                        {/* Excel Summary Row */}
                        {modalSheetItems.length > 0 && (
                          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 sticky bottom-0 select-none">
                            <tr className="divide-x divide-x-reverse divide-slate-300">
                              <td colSpan={4} className="p-2.5 text-right font-bold text-slate-700">
                                Σ إجمالي ملخص أمر التشغيل ({modalSheetItems.length} خامة)
                              </td>
                              <td className="p-2.5 text-center text-slate-500">-</td>
                              <td className="p-2.5 text-center text-slate-500">-</td>
                              <td className="p-2.5 text-center font-mono text-indigo-900 font-bold text-xs">
                                {modalSheetItems.reduce((acc: number, it: any) => acc + (Number(it.totalQuantityWithScrap) || 0), 0).toFixed(2)}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-emerald-800 text-xs">
                                {modalSheetItems.reduce((acc: number, it: any) => acc + (Number(it.currentStock) || 0), 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                              </td>
                              <td className="p-2.5 text-center text-slate-500 text-[10px]">-</td>
                              <td className="p-2.5 text-center font-mono text-emerald-800 text-sm font-black">
                                {modalTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م
                              </td>
                              <td className="p-2.5 text-center">
                                {allItemsAvailable ? (
                                  <span className="text-[11px] font-bold text-emerald-700">جاهز للصرف فوراً</span>
                                ) : (
                                  <span className="text-[11px] font-bold text-rose-600">يلزم توفير الخامات</span>
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  </div>

                  {/* Block 4: Operational Cost Components & Notes */}
                  <div className="bg-white border border-slate-300 rounded-xl p-3.5 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                        مكونات التكلفة الإضافية للتشغيل وتقييم المنتج التام (Production Cost Components)
                      </span>
                      <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded">
                        تكلفة الوحدة الكلية: {(((modalTotalCost + (Number(newOrder.laborCost) || 0) + (Number(newOrder.overheadCost) || 0) + (Number(newOrder.otherCost) || 0)) / Math.max(1, Number(newOrder.quantity) || 1))).toFixed(2)} ج.م
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">تكلفة المواد الخام المباشرة (ج.م)</label>
                        <div className="font-mono font-bold text-slate-800 text-sm py-1">{modalTotalCost.toFixed(2)} ج.م</div>
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">تكلفة العمالة المباشرة (ج.م)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={newOrder.laborCost ?? 0}
                          onChange={e => setNewOrder({ ...newOrder, laborCost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                        />
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">التكاليف الصناعية غير المباشرة (ج.م)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={newOrder.overheadCost ?? 0}
                          onChange={e => setNewOrder({ ...newOrder, overheadCost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                        />
                      </div>
                      <div className="p-2 bg-white rounded-lg border border-slate-200">
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">تكاليف تشغيلية أخرى (ج.م)</label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={newOrder.otherCost ?? 0}
                          onChange={e => setNewOrder({ ...newOrder, otherCost: parseFloat(e.target.value) || 0 })}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">
                        ملاحظات التشغيل وشروط الجودة وتوجيهات خط الإنتاج (Guidelines & Notes)
                      </label>
                      <textarea 
                        rows={2}
                        placeholder="اكتب أي تعليمات خاصة لمشغل خط الإنتاج أو شروط الجودة المطلوبة..."
                        value={newOrder.notes}
                        onChange={e => setNewOrder({...newOrder, notes: e.target.value})}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:bg-white focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer Actions (Excel Status & Confirmation Bar) */}
                <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white -mx-4 -mb-4 p-4 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    {allItemsAvailable ? (
                      <span className="text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        <CheckCircle className="w-4 h-4" /> كافة الخامات متوفرة بالمخزن وجاهزة للخصم والإنتاج
                      </span>
                    ) : (
                      <span className="text-rose-700 flex items-center gap-1 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-200">
                        <AlertCircle className="w-4 h-4" /> تنبيه: يوجد عجز في بعض الخامات بالمخزن (سيتم رفض الترحيل الفعلي حتى توفيرها)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)} 
                      className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                    >
                      إلغاء الأمر
                    </button>
                    <button 
                      type="submit" 
                      disabled={postingToInventory}
                      className="flex-1 sm:flex-initial px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {postingToInventory ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> جاري الترحيل المخزني...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="w-4 h-4" /> اعتماد وحفظ أمر الإنتاج
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DYNAMIC COMPONENT BREAKDOWN & ROUTING DETAILS DRAWER/MODAL */}
      {isDetailOpen && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden my-8">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  selectedOrder.status === 'completed' || selectedOrder.is_executed
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {selectedOrder.status === 'completed' || selectedOrder.is_executed ? (
                    <PackageCheck className="w-6 h-6" />
                  ) : (
                    <ClipboardList className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-bold text-slate-800">
                      تفاصيل كرت العمل لأمر الإنتاج:{' '}
                      <span className={selectedOrder.status === 'completed' || selectedOrder.is_executed ? 'line-through decoration-emerald-600 decoration-2 text-slate-400 font-mono' : 'text-indigo-700 font-mono'}>
                        {selectedOrder.orderNumber}
                      </span>
                    </h2>
                    {(selectedOrder.status === 'completed' || selectedOrder.is_executed) && (
                      <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 shadow-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        تم بنجاح وتحويل المنتج إلى المخزن
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">عرض خلاصة الخامات، نسب الهالك الافتراضية، ومسار الحركة الفعلية</p>
                </div>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 border rounded-xl bg-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto text-right">

              {/* SUCCESSFUL EXECUTION & WAREHOUSE TRANSFER BANNER */}
              {(selectedOrder.status === 'completed' || selectedOrder.is_executed) && (
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300/80 rounded-2xl flex items-center gap-3.5 shadow-xs">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-emerald-950">
                        تم إتمام أمر الإنتاج بنجاح تام وتحويل المنتج إلى المخزن
                      </h3>
                      <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-md">
                        مرحل ومقفل
                      </span>
                    </div>
                    <p className="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                      تم شطب هذا الأمر واكتماله، وجرى خصم الخامات المستهلكة من مستودع المواد الخام وتوريد المنتج النهائي بالكامل إلى مخزن المنتجات المصنعة وتوثيق القيود المخزنية في قاعدة البيانات.
                    </p>
                  </div>
                </div>
              )}
              
              {/* Core Information Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/50">
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">المنتج المستهدف</span>
                  <span className="font-extrabold text-slate-800">
                    {selectedOrder.bomSnapshot?.productName
                      ? `${selectedOrder.bomSnapshot.productName}${selectedOrder.bomSnapshot.productCode ? ` (${selectedOrder.bomSnapshot.productCode})` : ''}`
                      : (selectedOrder.productName || (() => {
                          const prod = getProductDetails(selectedOrder.productId);
                          return prod ? `${prod.name} (${prod.code})` : selectedOrder.productId;
                        })())}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">الكمية المستهدفة</span>
                  <span className="font-extrabold text-slate-800 text-base font-mono">
                    {selectedOrder.quantity}{' '}
                    {selectedOrder.bomSnapshot?.productUnit || (() => {
                      const prod = getProductDetails(selectedOrder.productId);
                      return prod ? prod.unit : 'وحدات';
                    })()}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">فترة الجدولة</span>
                  <span className="text-xs text-slate-700 font-mono">
                    من: <strong className="text-slate-800">{selectedOrder.startDate}</strong>
                    <br />
                    إلي: <strong className="text-slate-800">{selectedOrder.endDate || '-'}</strong>
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-slate-400 font-bold mb-1">المشرف المسؤول</span>
                  <span className="font-extrabold text-slate-800">{selectedOrder.supervisor || 'غير معين'}</span>
                </div>
              </div>

              {/* WAREHOUSE BINDING INTEGRATION CARD */}
              <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4">
                <div className="flex sm:flex-row flex-col justify-between items-start sm:items-center border-b border-slate-200 pb-2 gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Warehouse className="w-5 h-5 text-indigo-600 animate-pulse" />
                      ربط وتخصيص مستودعات الجرد (Warehouse Inventory Linkage)
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">حدد مستودعات سحب الخامات وإيداع المنتجات الجاهزة لربطها بمديول المخازن تلقائياً</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded-full border border-emerald-100/50">ربط مؤتمت نشط</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                  {/* Raw Material Warehouse */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-indigo-500" />
                      مستودع سحب المواد الخام والمكونات:
                    </label>
                    <select
                      value={(Number(selectedOrder.rawWarehouseId ?? selectedOrder.bomSnapshot?.rawWarehouseId) || selectedRawWarehouse || '')}
                      disabled={selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed)}
                      onChange={e => {
                            const id = parseInt(e.target.value, 10) || null;
                            setSelectedRawWarehouse(id);
                            setSelectedOrder(prev => prev ? ({ ...prev, rawWarehouseId: id || undefined }) : null);
                            setNewOrder(prev => ({ ...prev, rawWarehouseId: id || undefined }));
                          }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {dbWarehouses.map((wh: any, idx: number) => (<option key={`wh-pom-${wh.id || idx}-${idx}`} value={wh.id}>
                          📦 {wh.name} {wh.is_main === 1 ? '(رئيسي)' : ''}
                        </option>
                      ))}
                      {dbWarehouses.length === 0 && <option value="">جاري تحميل المستودعات...</option>}
                    </select>
                  </div>

                  {/* Finished Goods Warehouse */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      مستودع إيداع المنتجات تامة الصنع:
                    </label>
                    <select
                      value={(Number(selectedOrder.finishedWarehouseId ?? selectedOrder.bomSnapshot?.finishedWarehouseId) || selectedFinishedWarehouse || '')}
                      disabled={selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed)}
                      onChange={e => {
                          const id = parseInt(e.target.value, 10) || null;
                          setSelectedFinishedWarehouse(id);
                          setSelectedOrder(prev => prev ? ({ ...prev, finishedWarehouseId: id || undefined }) : null);
                          setNewOrder(prev => ({ ...prev, finishedWarehouseId: id || undefined }));
                        }}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800 text-xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {dbWarehouses.map((wh: any, idx: number) => (<option key={`wh-pom-${wh.id || idx}-${idx}`} value={wh.id}>
                          🏢 {wh.name} {wh.is_main === 1 ? '(رئيسي)' : ''}
                        </option>
                      ))}
                      {dbWarehouses.length === 0 && <option value="">جاري تحميل المستودعات...</option>}
                    </select>
                  </div>
                </div>
              </div>

              {/* ATOMIC INVENTORY & COSTING EXECUTION BANNER */}
              <div className={`border p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm ${
                selectedOrder.status === 'completed' || selectedOrder.is_executed
                  ? 'bg-emerald-50/50 border-emerald-300'
                  : 'bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-emerald-500/10 border-emerald-300/60'
              }`}>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md ${
                      selectedOrder.status === 'completed' || selectedOrder.is_executed
                        ? 'bg-emerald-700 text-white'
                        : 'bg-emerald-600 text-white shadow-emerald-600/20'
                    }`}>
                      {selectedOrder.status === 'completed' || selectedOrder.is_executed ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Zap className="w-4 h-4 fill-current" />
                      )}
                    </span>
                    <h4 className="text-sm font-black text-emerald-950">
                      التنفيذ والترحيل الفعلي للمخازن (Atomic Production & Inventory Posting)
                    </h4>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed max-w-xl">
                    خصم الخامات آلياً من مستودع المواد الخام، واستلام المنتج التام بالمستودع، وحساب التكلفة الفعلية، وتسجيل قيود المخزون وحركات الصرف والاستلام ذرّياً داخل قاعدة البيانات.
                  </p>
                  {(selectedOrder.is_executed || selectedOrder.status === 'completed') && (
                    <p className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" /> 
                      تم التنفيذ والترحيل للمخازن بنجاح {selectedOrder.executed_at ? `بتاريخ: ${new Date(selectedOrder.executed_at).toLocaleString('ar-EG')}` : ''} (الأمر مقفل تماماً ومحمي من تكرار الصرف)
                    </p>
                  )}
                </div>

                <button 
                  onClick={() => handleExecuteOrder(selectedOrder)}
                  disabled={selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed) || postingToInventory}
                  className={`px-6 py-3.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                    selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed)
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-none cursor-not-allowed opacity-90'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-40'
                  }`}
                >
                  {selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed) ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      تم الترحيل للمخازن مسبقاً (مقفل) ✓
                    </>
                  ) : postingToInventory ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      جاري الترحيل بالداتابيز...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      ⚡ تنفيذ وترحيل للمخازن الآن
                    </>
                  )}
                </button>
              </div>

              {/* Status Update Quick Bar */}
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${
                selectedOrder.status === 'completed' || selectedOrder.is_executed
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-indigo-50/40 border-indigo-100'
              }`}>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Settings className={`w-4 h-4 ${selectedOrder.status === 'completed' || selectedOrder.is_executed ? 'text-slate-400' : 'text-indigo-800 animate-spin'}`} />
                    تحديث مسار الإنتاج وقفل الكرت
                  </h4>
                  <p className="text-[10px] mt-0.5">
                    {selectedOrder.status === 'completed' || selectedOrder.is_executed ? (
                      <span className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        هذا الأمر تم ترحيله للمخازن ومقفل نهائياً - لا يمكن إعادة بدء تشغيله أو ترحيله مجدداً.
                      </span>
                    ) : (
                      <span className="text-slate-500">يمكنك نقل حالة الأمر بناءً على التقدم الفعلي لعمالية الورش</span>
                    )}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'in_progress', 30)}
                    disabled={selectedOrder.status === 'in_progress' || selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed)}
                    title={selectedOrder.status === 'completed' || selectedOrder.is_executed ? 'الأمر مرحل ومقفل' : 'بدء العمل التشغيلي'}
                    className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    بدء العمل التشغيلي (30%)
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'completed', 100)}
                    disabled={selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed)}
                    title={selectedOrder.status === 'completed' || selectedOrder.is_executed ? 'الأمر مرحل ومقفل' : 'إكمال واستلام'}
                    className="px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    إكمال واستلام (100%)
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'cancelled', 0)}
                    disabled={selectedOrder.status === 'cancelled' || selectedOrder.status === 'completed' || Boolean(selectedOrder.is_executed)}
                    title={selectedOrder.status === 'completed' || selectedOrder.is_executed ? 'الأمر مرحل ومقفل' : 'إلغاء الأمر'}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    إلغاء الأمر
                  </button>
                </div>
              </div>

              {/* DYNAMIC REAL-TIME RAW MATERIALS BREAKDOWN (Peak Integration Core) */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 text-indigo-700">
                    <Layers className="w-5 h-5" />
                    تحديد متطلبات المواد الخام الإنشائية الفعلية (Dynamic Components Breakdown)
                  </h3>
                  <span className="text-xs text-slate-400">
                    محسوبة بناءً على الكمية: <strong className="text-indigo-600 text-sm font-mono">{selectedOrder.quantity}</strong>
                  </span>
                </div>

                {(() => {
                  const linkedBom = selectedOrder.bomSnapshot && Object.keys(selectedOrder.bomSnapshot).length > 0
                    ? {
                        id: selectedOrder.bomSnapshot.bomId || selectedOrder.bomId,
                        name: selectedOrder.bomSnapshot.bomName || 'وصفة أمر الإنتاج',
                        version: selectedOrder.bomSnapshot.version || '-',
                        scrapPercentage: Number(selectedOrder.bomSnapshot.scrapPercentage) || 0,
                        items: Array.isArray(selectedOrder.bomSnapshot.items) ? selectedOrder.bomSnapshot.items : [],
                        routings: Array.isArray(selectedOrder.bomSnapshot.routings) ? selectedOrder.bomSnapshot.routings : []
                      }
                    : null;
                  if (!linkedBom) return (
                    <p className="text-xs text-center py-4 text-slate-400 font-bold bg-slate-50 rounded-xl">
                      لا توجد وصفة (BOM) معرفة لتفكيك خامات هذا الموديل. قم بتعريف الخبز والصناعة بمديول الوصفات لتشبيك الاحتياجات الفورية.
                    </p>
                  );

                  return (
                    <div className="space-y-4">
                      <div className="bg-emerald-500/10 text-emerald-950 text-xs p-3 rounded-xl border border-emerald-200/50 flex justify-between">
                        <span>الوصفة المتبعة: <strong>{linkedBom.name} ({linkedBom.version})</strong></span>
                        <span className="text-emerald-700 font-bold">الخصم المخزني: مطابق لكميات الوصفة بالضبط بدون إضافات</span>
                      </div>

                      <div className="border rounded-xl font-sans overflow-hidden">
                        <table className="w-full text-sm text-right">
                          <thead className="bg-slate-50 text-slate-600 text-xs font-bold border-b">
                            <tr>
                              <th className="px-4 py-2.5 font-bold">كود الخام</th>
                              <th className="px-4 py-2.5 font-bold">اسم المادة الخام</th>
                              <th className="px-4 py-2.5 text-center font-bold">الكمية لكل وحدة</th>
                              <th className="px-4 py-2.5 text-center bg-indigo-50/40 font-bold">إجمالي المطلوب للصرف من المخزن</th>
                              <th className="px-4 py-2.5 text-center font-bold">وحدة القياس</th>
                              <th className="px-4 py-2.5 text-center font-bold bg-indigo-50/20 text-indigo-900">حالة الرصيد (الربط المخزني)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y text-xs font-medium">
                            {linkedBom.items && linkedBom.items.map((item: any, id: number) => {
                              const prodObj = getProductDetails(item.materialId);
                              const materialName = item.materialName || item.name || prodObj?.name || String(item.materialId || '');
                              const materialCode = item.code || prodObj?.code || item.materialId;
                              const recipeUnit = item.unit || prodObj?.unit || 'وحدة';
                              const itmQty = Number(item.quantityPerUnit ?? item.quantity) || 0;
                              const ordQty = Number(selectedOrder.quantity) || 0;
                              const totalNet = parseFloat((itmQty * ordQty).toFixed(3)) || 0;

                              // Live Matching Ingredient Check
                              const explicitId = item.ingredient_id ?? item.ingredientId;
                              const ref = explicitId ?? item.materialId ?? item.material_id ?? item.code;
                              const refStr = String(ref ?? '').trim().toLowerCase();
                              const cleanRefStr = refStr.replace(/^item-/, '');
                              const matchedIng = dbIngredients.find((ing: any) => {
                                if (explicitId != null && Number(ing.id) === Number(explicitId)) return true;
                                const ingId = String(ing.id ?? '').trim().toLowerCase();
                                const ingCode = String(ing.code ?? ing.item_code ?? '').trim().toLowerCase();
                                const cleanCode = ingCode.replace(/^item-/, '');
                                const ingName = String(ing.name ?? '').trim().toLowerCase();
                                return (refStr && (ingId === refStr || ingCode === refStr || (cleanRefStr && cleanCode === cleanRefStr) || ingName === refStr));
                              });

                              const baseUnit = matchedIng?.unit || recipeUnit;
                              const conv = convertQuantity(totalNet, recipeUnit, baseUnit);
                              const totalBaseQty = conv.success ? conv.toQuantity : totalNet;

                              // Live warehouse stock check for detail modal
                              const currentStockQty = getLiveStockForItem(matchedIng || item, item.currentStock != null ? Number(item.currentStock) : undefined);
                              const isAvail = currentStockQty >= totalBaseQty;

                              let stockBadge = null;
                              if (currentStockQty === null || currentStockQty === undefined) {
                                stockBadge = <span className="text-slate-400 italic text-[11px]">غير مسجل بالمستودع</span>;
                              } else if (isAvail) {
                                const remaining = Math.round((currentStockQty - totalBaseQty) * 1000) / 1000;
                                stockBadge = (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      متوفر: {currentStockQty.toLocaleString()} {baseUnit}
                                    </span>
                                    <span className="text-[9px] text-emerald-600 mt-0.5">
                                      متبقي: {remaining.toLocaleString()} {baseUnit}
                                    </span>
                                  </div>
                                );
                              } else {
                                const shortageAmt = Math.max(0, Math.round((totalBaseQty - currentStockQty) * 1000) / 1000);
                                stockBadge = (
                                  <div className="inline-flex flex-col items-center">
                                    <span className="inline-flex bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-1 rounded-full text-[11px] font-bold items-center gap-1 animate-pulse">
                                      <AlertCircle className="w-3 h-3 text-rose-600" />
                                      عجز: {shortageAmt.toLocaleString()} {baseUnit}
                                    </span>
                                    <span className="text-[9px] text-slate-500 mt-0.5">
                                      المتاح: {currentStockQty.toLocaleString()} {baseUnit}
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <tr key={id} className="hover:bg-slate-50/50">
                                  <td className="px-4 py-3 font-mono text-slate-600 font-bold">{materialCode}</td>
                                  <td className="px-4 py-3 font-bold text-slate-800">{materialName}</td>
                                  <td className="px-4 py-3 text-center text-slate-600 font-mono">{itmQty} {recipeUnit}</td>
                                  <td className="px-4 py-3 text-center font-bold text-indigo-700 font-mono bg-indigo-50/10 text-sm">
                                    <div>{totalNet.toLocaleString()} {recipeUnit}</div>
                                    {recipeUnit !== baseUnit && (
                                      <div className="text-[10px] text-indigo-500 font-normal">
                                        = {totalBaseQty.toLocaleString()} {baseUnit}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center text-slate-600">
                                    <div>{recipeUnit}</div>
                                    {recipeUnit !== baseUnit && (
                                      <div className="text-[9px] text-amber-600 bg-amber-50 px-1 rounded inline-block mt-0.5 border border-amber-200">
                                        مخزن: {baseUnit}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center font-bold bg-slate-50/30">{stockBadge}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Linked routing checklist stages */}
              <div className="border border-slate-200 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 border-b pb-3 text-rose-700">
                  <Award className="w-5 h-5" />
                  مراحل ومسار التوجيه للإنتاج الأرضي والماكينات (Routing Operations checklist)
                </h3>

                {(() => {
                  const linkedBom = selectedOrder.bomSnapshot && Object.keys(selectedOrder.bomSnapshot).length > 0
                    ? {
                        id: selectedOrder.bomSnapshot.bomId || selectedOrder.bomId,
                        name: selectedOrder.bomSnapshot.bomName || 'وصفة أمر الإنتاج',
                        version: selectedOrder.bomSnapshot.version || '-',
                        scrapPercentage: Number(selectedOrder.bomSnapshot.scrapPercentage) || 0,
                        items: Array.isArray(selectedOrder.bomSnapshot.items) ? selectedOrder.bomSnapshot.items : [],
                        routings: Array.isArray(selectedOrder.bomSnapshot.routings) ? selectedOrder.bomSnapshot.routings : []
                      }
                    : null;
                  if (!linkedBom || !linkedBom.routings || linkedBom.routings.length === 0) return (
                    <p className="text-xs text-center py-3 text-slate-400 italic">لا توجد مراحل توجيه مسجلة لهذا المسار.</p>
                  );

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {linkedBom.routings.map((routing: any, index: number) => {
                        const targetWC = workCenters.find(w => (w.code === routing.workCenterId || w.id === routing.workCenterId));
                        const setup = Number(routing.setupTime) || 0;
                        const run = Number(routing.runTime) || 0;
                        const ordQty = Number(selectedOrder.quantity) || 1;
                        const totalUnitTimes = (setup + run) * ordQty;
                        const costHr = Number(targetWC?.costPerHour) || 0;
                        const laborCost = (totalUnitTimes * (costHr / 60)) || 0;
                        return (
                          <div key={index} className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                            <div className="flex justify-between items-center mb-2">
                              <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded font-mono">
                                خطوة تتابعية رقم {routing.opNumber}
                              </span>
                              <span className="text-xs text-slate-400 font-bold">وقت التشغيل الكلي: {totalUnitTimes} د</span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-800 mb-1">{routing.description}</h4>
                            <p className="text-[10px] text-slate-500 mt-2">
                              مركز العمل: <strong>{targetWC ? targetWC.name : routing.workCenterId}</strong> | تكلفة الجهد للوردية: {laborCost.toFixed(2)} ج.م
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Notes Context */}
              {selectedOrder.notes && (
                <div className="p-4 bg-amber-50 text-amber-900 text-xs rounded-xl border border-amber-200/55 flex gap-2">
                  <FileText className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  <div>
                    <strong className="block mb-1">تعليمات وتوصيات خاصة:</strong>
                    <span>{selectedOrder.notes}</span>
                  </div>
                </div>
              )}

            </div>

            {/* Footer and deletion */}
            <div className="p-6 border-t bg-slate-50 flex justify-between items-center">
              <button 
                onClick={(e) => handleDeleteOrder(selectedOrder.id, e)}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                حذف وإلغاء كرت العمل
              </button>
              
              <button 
                onClick={() => setIsDetailOpen(false)} 
                className="px-6 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs"
              >
                إغلاق وتاكيد
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
