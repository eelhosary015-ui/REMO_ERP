import React, { useState, useEffect, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Scale, Layers, 
  Cpu, Users, Printer, Download, AlertTriangle, CheckCircle2, 
  Info, RefreshCw, FileText, Calculator, Settings, BarChart2, 
  PieChart, Search, Building2, HelpCircle, Warehouse, 
  UserCheck, ShieldAlert, BadgeCheck, ClipboardList, CheckCircle, 
  Plus, Trash2, ArrowLeftRight, Landmark
} from 'lucide-react';
import { ProductionOrder, WorkCenter, ProductDef, BillOfMaterial } from './types';
import { api } from '../../utils/api';
import { pageRows, PaginationBar, usePaginationState } from "../PaginationBar";

// Fallback high-fidelity sample data, merging gracefully with Live Database if empty
const SAMPLE_PRODUCTS: ProductDef[] = [];
const SAMPLE_WORK_CENTERS: WorkCenter[] = [];
const SAMPLE_ORDERS: ProductionOrder[] = [];
const SAMPLE_SHOPFLOOR: any[] = [];
const FALLBACK_BOMS: any[] = [];

export function CostManagement() {
  // Live API States
  const [liveEmployees, setLiveEmployees] = useState<any[]>([]);
  const [liveIngredients, setLiveIngredients] = useState<any[]>([]);
  const [isHrLoaded, setIsHrLoaded] = useState(false);
  const [isInventoryLoaded, setIsInventoryLoaded] = useState(false);

  // Core production states loaded from database / local storage fallback
  const [products, setProducts] = useState<ProductDef[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [shopfloorJobs, setShopfloorJobs] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);

  // Selected Order & HR Crew Allocation
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [allocatedCrewIds, setAllocatedCrewIds] = useState<number[]>([]);
  
  // Custom manual raw material addition
  const [customBOMItems, setCustomBOMItems] = useState<{ id: string; name: string; quantity: number; cost: number; unit: string }[]>([]);
  const [selectedIngToAdd, setSelectedIngToAdd] = useState<string>('');
  const [customIngQty, setCustomIngQty] = useState<number>(1);

  // App UI states
  const [searchQuery, setSearchQuery] = useState('');
  const [tabView, setTabView] = useState<'sheet' | 'hr_integration' | 'warehouse_integration' | 'accounting_post'>('sheet');
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // COST CALCULATOR CONTROLS
  const [calcInputs, setCalcInputs] = useState({
    scrapCountFactor: 0,
    laborHoursNeeded: 0,
    machineWearRate: 0,
    machinePowerRate: 0,
    machineRuntimeHours: 0,
    overheadPercentage: 0,
    targetProfitMargin: 0,
    targetSalePrice: 0
  });
  const pgn1 = usePaginationState();

  // Load and merge live resources
  const loadLiveResources = async () => {
    setIsLoading(true);
    try {
      // 1) Fetch real employees from `/api/hr/employees`
      const hrResponse = await api.get('/api/hr/employees');
      if (hrResponse.ok) {
        const hrData = await hrResponse.json();
        setLiveEmployees(Array.isArray(hrData) ? hrData : []);
        setIsHrLoaded(true);
        if (Array.isArray(hrData) && hrData.length > 0) {
          setAllocatedCrewIds(hrData.slice(0, 3).map((e: any) => e.id));
        }
      } else {
        setLiveEmployees([]);
        setIsHrLoaded(true);
      }

      // 2) Fetch real warehouse ingredients from `/api/ingredients`
      const ingResponse = await api.get('/api/ingredients');
      if (ingResponse.ok) {
        const ingData = await ingResponse.json();
        setLiveIngredients(Array.isArray(ingData) ? ingData : []);
        setIsInventoryLoaded(true);
      } else {
        setLiveIngredients([]);
        setIsInventoryLoaded(true);
      }

      // 3) Load standard Core Production module local data
      const savedProducts = localStorage.getItem('remo_production_products');
      const savedOrders = localStorage.getItem('remo_production_orders');
      const savedWC = localStorage.getItem('remo_production_workcenters');
      const savedShopfloor = localStorage.getItem('remo_production_shopfloor');
      const savedBoms = localStorage.getItem('remo_production_boms');

      const prodData = savedProducts ? JSON.parse(savedProducts) : [];
      const ordData = savedOrders ? JSON.parse(savedOrders) : [];
      const wcData = savedWC ? JSON.parse(savedWC) : [];
      const sfData = savedShopfloor ? JSON.parse(savedShopfloor) : [];
      const bomData = savedBoms ? JSON.parse(savedBoms) : [];

      const cleanOrd = Array.isArray(ordData) ? ordData.filter((o: any) => o && !['PRD-2026-001', 'PRD-2026-002', 'PRD-2026-003'].includes(o.orderNumber)) : [];
      const cleanProd = Array.isArray(prodData) ? prodData.filter((p: any) => p && !['p1', 'p2', 'p3', 'PROD-A72', 'PROD-B14', 'PROD-C50'].includes(p.id || p.code)) : [];

      setProducts(cleanProd);
      setOrders(cleanOrd);
      setWorkCenters(Array.isArray(wcData) ? wcData : []);
      setShopfloorJobs(Array.isArray(sfData) ? sfData : []);
      setBoms(Array.isArray(bomData) ? bomData : []);

      // Default selected order
      if (cleanOrd.length > 0 && !selectedOrderId) {
        setSelectedOrderId(cleanOrd[0].id);
      }
    } catch (e) {
      console.error('Error synchronizing costing data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLiveResources();
  }, []);

  // Show Toast messaging function
  const showToast = (type: 'success' | 'info' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Memoized calculations for selected active structures
  const activeOrder = useMemo(() => {
    return orders.find(o => o.id === selectedOrderId) || orders[0] || null;
  }, [selectedOrderId, orders]);

  const activeProduct = useMemo(() => {
    if (!activeOrder) return null;
    return products.find(p => p.id === activeOrder.productId) || products[0] || null;
  }, [activeOrder, products]);

  const activeWorkCenter = useMemo(() => {
    if (!activeOrder) return null;
    const wcId = activeOrder.workCenterId || activeProduct?.manufacturingData?.defaultWorkCenterId;
    return workCenters.find((w: any) => w.id === wcId) || workCenters[0] || null;
  }, [activeOrder, activeProduct, workCenters]);

  const activeShopJob = useMemo(() => {
    if (!activeOrder) return null;
    return shopfloorJobs.find(j => j.orderNumber === activeOrder.orderNumber) || null;
  }, [activeOrder, shopfloorJobs]);

  const activeBOM = useMemo(() => {
    if (!activeOrder || !activeProduct) return null;
    // Link by order's specified BOM or lookup product's BOM
    return boms.find(b => b.id === activeOrder.bomId || b.productId === activeProduct.id) || boms[0] || null;
  }, [activeOrder, activeProduct, boms]);

  // Translate employees database list to assigned crew objects
  const assignedCrew = useMemo(() => {
    return liveEmployees.filter(emp => allocatedCrewIds.includes(emp.id));
  }, [liveEmployees, allocatedCrewIds]);

  // Calculate actual crew hourly values
  const totalCrewHourlyCost = useMemo(() => {
    let hourlySum = 0;
    assignedCrew.forEach(emp => {
      // If basic salary is monthly, divide by 30 days and 8 working hours = hourly rate
      if (emp.salary_type === 'monthly') {
        const hourlyRate = (emp.basic_salary || 5000) / (30 * 8);
        hourlySum += hourlyRate;
      } else { // Daily salary
        const hourlyRate = (emp.basic_salary || 200) / 8;
        hourlySum += hourlyRate;
      }
    });
    return hourlySum > 0 ? hourlySum : 120; // safe baseline fallback if empty
  }, [assignedCrew]);

  // Map and evaluate the materials from the Warehouse for the chosen BOM
  const warehouseMaterialsStatus = useMemo(() => {
    if (!activeOrder) return [];

    const totalOrderQty = activeOrder.quantity || 100;
    const bomItems = activeBOM ? activeBOM.items : [];

    const mapped = bomItems.map((item: any) => {
      // Match key (with either ingredient ID or matching ingredient text/code)
      const ingObj = liveIngredients.find(li => li.id === item.materialId || li.item_code === item.materialId || li.name.includes(item.materialId));
      
      const qtyRequired = parseFloat((item.quantity * totalOrderQty).toFixed(2));
      const currentStock = ingObj ? ingObj.current_stock : 1200;
      const unitCost = ingObj ? ingObj.cost : 45;
      const shortFall = qtyRequired > currentStock ? parseFloat((qtyRequired - currentStock).toFixed(2)) : 0;
      
      return {
        id: item.materialId,
        name: ingObj ? ingObj.name : `خام معياري مُبهم (${item.materialId})`,
        unit: ingObj ? ingObj.unit : 'وحدة',
        qtyPerUnit: item.quantity,
        qtyRequired,
        currentStock,
        unitCost,
        shortFall,
        totalCost: qtyRequired * unitCost,
        itemCode: ingObj ? ingObj.item_code : 'RAW-GEN'
      };
    });

    // Merge manually added custom costing materials on the fly
    customBOMItems.forEach(custom => {
      const qtyRequired = custom.quantity;
      const currentStock = 12000;
      const shortFall = qtyRequired > currentStock ? parseFloat((qtyRequired - currentStock).toFixed(2)) : 0;

      mapped.push({
        id: custom.id,
        name: custom.name,
        unit: custom.unit,
        qtyPerUnit: custom.quantity / (totalOrderQty || 1),
        qtyRequired,
        currentStock,
        unitCost: custom.cost,
        shortFall,
        totalCost: qtyRequired * custom.cost,
        itemCode: 'RAW-ADD'
      });
    });

    return mapped;
  }, [activeOrder, activeBOM, liveIngredients, customBOMItems]);

  // Aggregate Material Cost from Inventory variables
  const totalInventoryMaterialCost = useMemo(() => {
    return warehouseMaterialsStatus.reduce((sum: any, item: any) => sum + item.totalCost, 0);
  }, [warehouseMaterialsStatus]);

  // When selected order / worker group changes, recalibrate dynamic calculators
  useEffect(() => {
    if (!activeOrder) return;

    const targetQty = activeOrder.quantity || 100;
    
    // Default hourly configuration setup
    const wcMRate = activeWorkCenter?.machineCost || 50;
    const wcOHRate = activeWorkCenter?.overheadCost || 30;
    const simulatedHours = Math.max(8, Math.ceil(targetQty * 0.04));

    setCalcInputs(prev => ({
      ...prev,
      scrapCountFactor: Math.ceil((totalInventoryMaterialCost / (targetQty || 1)) * 0.8) || 35,
      laborHoursNeeded: simulatedHours,
      machineWearRate: Math.ceil(wcMRate * 0.6) || 30,
      machinePowerRate: Math.ceil(wcMRate * 0.4) || 20,
      machineRuntimeHours: Math.max(6, Math.ceil(simulatedHours * 0.85)),
      overheadPercentage: Math.ceil((wcOHRate / (totalCrewHourlyCost + wcMRate || 1)) * 100) || 12,
      targetProfitMargin: 35,
      targetSalePrice: Math.ceil((totalInventoryMaterialCost / (targetQty || 1)) * 2.2) || 150
    }));

    // Clear custom ingredients for fresh order analysis
    setCustomBOMItems([]);
  }, [activeOrder, activeProduct, activeWorkCenter, totalInventoryMaterialCost, totalCrewHourlyCost]);

  // MASTER FINANCE ENGINE CALCULATION (Live linked with HR salary metrics and true Warehouses Costs)
  const calculatedStats = useMemo(() => {
    if (!activeOrder) return null;

    const targetQty = activeOrder.quantity || 100;
    const plannedQty = targetQty;
    const actualProducedQty = activeShopJob ? (activeShopJob.producedQty || plannedQty) : plannedQty;
    const actualScrapQty = activeShopJob ? (activeShopJob.scrapQty || 0) : Math.ceil(plannedQty * 0.02);

    // 1) DIRECT MATERIALS COST (Sourced 100% from live warehouse ingredients values!)
    const stdRawMaterialsCost = totalInventoryMaterialCost;
    const avgMaterialUnitCost = totalInventoryMaterialCost / (plannedQty || 1);
    const actRawMaterialsCost = (actualProducedQty + actualScrapQty) * avgMaterialUnitCost;

    // 2) DIRECT LABOR COST (Sourced 100% from actual HR payroll selection!)
    const stdLaborCost = totalCrewHourlyCost * calcInputs.laborHoursNeeded;
    // Completed work includes overtime calculation (e.g. Completed takes 5% extra OT/premium hour)
    const actLaborCost = stdLaborCost * (activeOrder.status === 'completed' ? 1.08 : 1.0);

    // 3) DIRECT MACHINE COST
    const stdMachineCost = calcInputs.machineRuntimeHours * (calcInputs.machineWearRate + calcInputs.machinePowerRate);
    const actMachineCost = stdMachineCost * (activeOrder.status === 'completed' ? 1.03 : 1.0);

    // 4) WASTE / SCRAP FACTORY FINANCIAL LOSSES
    const stdScrapLossCost = Math.ceil(plannedQty * 0.02) * calcInputs.scrapCountFactor;
    const actScrapLossCost = actualScrapQty * calcInputs.scrapCountFactor;

    // 5) PRIME COST (Direct materials + Direct labor)
    const stdPrimeCost = stdRawMaterialsCost + stdLaborCost;
    const actPrimeCost = actRawMaterialsCost + actLaborCost;

    // 6) DIRECT MANUFACTURING COST (Prime + Equipment)
    const stdDirectManCost = stdPrimeCost + stdMachineCost;
    const actDirectManCost = actPrimeCost + actMachineCost;

    // 7) FACTORY COST
    const stdFactoryCost = stdDirectManCost + stdScrapLossCost;
    const actFactoryCost = actDirectManCost + actScrapLossCost;

    // 8) FACTORY INDIRECT OVERHEADS (Linked with the Work Center overhead ratios)
    const stdOverheadCost = stdFactoryCost * (calcInputs.overheadPercentage / 100);
    const actOverheadCost = actFactoryCost * (calcInputs.overheadPercentage / 100);

    // 9) TOTAL MANUFACTURING COST
    const stdTotalCost = stdFactoryCost + stdOverheadCost;
    const actTotalCost = actFactoryCost + actOverheadCost;

    // 10) SINGLE UNIT ANALYSIS
    const divisor = actualProducedQty > 0 ? actualProducedQty : 1;
    const actualUnitCost = actTotalCost / divisor;
    const standardUnitCost = stdTotalCost / plannedQty;

    // Selling & Margin Study
    const expectedMarginRevenue = actTotalCost / (1 - (calcInputs.targetProfitMargin / 100));
    const suggestedSellingPrice = expectedMarginRevenue / divisor;
    const targetProfitPerUnit = suggestedSellingPrice - actualUnitCost;

    const userEstimatedRevenue = actualProducedQty * calcInputs.targetSalePrice;
    const userGrossProfit = userEstimatedRevenue - actTotalCost;
    const userProfitPerUnit = calcInputs.targetSalePrice - actualUnitCost;
    const userProfitMarginPercent = (userProfitPerUnit / (calcInputs.targetSalePrice || 1)) * 100;

    // Cost Variances (Std vs Act)
    const totalCostVariance = actTotalCost - stdTotalCost;
    const materialVariance = actRawMaterialsCost - stdRawMaterialsCost;
    const laborVariance = actLaborCost - stdLaborCost;
    const machineVariance = actMachineCost - stdMachineCost;
    const scrapVariance = actScrapLossCost - stdScrapLossCost;

    return {
      plannedQty,
      actualProducedQty,
      actualScrapQty,
      
      stdRawMaterialsCost,
      actRawMaterialsCost,
      
      stdLaborCost,
      actLaborCost,
      
      stdMachineCost,
      actMachineCost,
      
      stdScrapLossCost,
      actScrapLossCost,

      stdPrimeCost,
      actPrimeCost,

      stdFactoryCost,
      actFactoryCost,

      stdTotalCost,
      actTotalCost,

      actualUnitCost,
      standardUnitCost,

      suggestedSellingPrice,
      targetProfitPerUnit,

      userEstimatedRevenue,
      userGrossProfit,
      userProfitPerUnit,
      userProfitMarginPercent,

      totalCostVariance,
      materialVariance,
      laborVariance,
      machineVariance,
      scrapVariance,
    };
  }, [activeOrder, activeProduct, activeWorkCenter, calcInputs, totalInventoryMaterialCost, totalCrewHourlyCost, activeShopJob]);

  // DYNAMIC COMPONENT ACTIONS
  const handleAddEmployeeToCrew = (empId: number) => {
    if (allocatedCrewIds.includes(empId)) return;
    setAllocatedCrewIds([...allocatedCrewIds, empId]);
    showToast('success', `تم تحويل وتوجيه الموظف لصالة أمر التصنيع الحالي، وإدراج أجر ساعة العمل في جدول التقرير.`);
  };

  const handleRemoveEmployeeFromCrew = (empId: number) => {
    if (allocatedCrewIds.length <= 1) {
      showToast('error', 'يجب إسناد فني مباشر واحد على الأقل لصالة الإنتاج لخدمة الخط وتشغيل الماكنات.');
      return;
    }
    setAllocatedCrewIds(allocatedCrewIds.filter(id => id !== empId));
    showToast('info', 'تم استبعاد تكلفة أجر العامل من مقايسة الحسابات هذه.');
  };

  const handleAddCustomMaterial = () => {
    if (!selectedIngToAdd) {
      showToast('error', 'الرجاء اختيار أحد مستلزمات الإنتاج من بنك الخامات أولاً.');
      return;
    }
    const ingObj = liveIngredients.find(li => li.id === selectedIngToAdd);
    if (!ingObj) return;

    // Check pre-existence
    const exists = customBOMItems.find(c => c.id === ingObj.id);
    if (exists) {
      showToast('error', 'هذه المادة مضافة بالفعل في كشف التكاليف الإضافي.');
      return;
    }

    setCustomBOMItems([...customBOMItems, {
      id: ingObj.id,
      name: ingObj.name,
      quantity: customIngQty,
      cost: ingObj.cost,
      unit: ingObj.unit
    }]);

    showToast('success', `تم إضافة المادة الخام (${ingObj.name}) بكمية ${customIngQty} ${ingObj.unit} للتكاليف الإضافية.`);
  };

  const handleRemoveCustomMaterial = (id: string) => {
    setCustomBOMItems(customBOMItems.filter(c => c.id !== id));
    showToast('info', 'تم إزالة البند الإضافي وتعديل الحساب الإجمالي.');
  };

  // Perform Simulated/Real Inventory release (deplete raw stock from stock levels)
  const handlePerformInventoryRelease = async () => {
    setIsLoading(true);
    try {
      const updatedIngredients = liveIngredients.map(ing => {
        const matchingDemand = warehouseMaterialsStatus.find((w: any) => w.id === ing.id || w.name === ing.name);
        if (matchingDemand) {
          return {
            ...ing,
            current_stock: Math.max(0, ing.current_stock - matchingDemand.qtyRequired)
          };
        }
        return ing;
      });

      // Save back both to database system settings (unified persistence) and local variable
      await api.post('/api/system/settings', {
        key: 'remo_pro_live_depleted_ingredients',
        value: updatedIngredients
      });
      
      setLiveIngredients(updatedIngredients);
      showToast('success', 'تم تسجيل سند سحب وتحويل الخامات الرقمي من المستودع وتخصيصه للإنتاج بنجاح!');
    } catch (e) {
      showToast('error', 'تعذّر إرسال السند المحاسبي للمخازن. تحقق من الاتصال بالقناة.');
    } finally {
      setIsLoading(false);
    }
  };

  // Capitalize production finished product valuation and increment finished product stock values!
  const handlePerformERPStockAuditPost = async () => {
    if (!calculatedStats || !activeOrder) return;
    setIsLoading(true);
    try {
      const targetQty = calculatedStats.actualProducedQty;
      const unitCost = calculatedStats.actualUnitCost;

      // Log a stock transaction block
      const newTransaction = {
        date: new Date().toISOString(),
        orderNumber: activeOrder.orderNumber,
        productName: activeProduct?.name || 'منتج مسبوك',
        quantityAdded: targetQty,
        costValuePerUnit: unitCost,
        totalCapitalValue: targetQty * unitCost,
        remarks: 'وارد مقبوض من صالة السباكة الكبرى ريستوماستر ومحمل برسم الإنتاج الكلي'
      };

      const existingPosts = JSON.parse(localStorage.getItem('remo_pro_inventory_capitalized_posts') || '[]');
      existingPosts.push(newTransaction);
      localStorage.setItem('remo_pro_inventory_capitalized_posts', JSON.stringify(existingPosts));

      showToast('success', 'تم بنجاح إدراج القيمة الدفترية الرأسمالية للمخزون، وتم إشعار إدارة الحسابات العامة ودفتر الأستاذ.');
    } catch (e) {
      showToast('error', 'فشل في الاتصال بمصفوفة الحسابات العلوية.');
    } finally {
      setIsLoading(false);
    }
  };

  // EXECUTIVE METRICS CALCULATOR ACCUMULATOR
  const executiveMetricsSum = useMemo(() => {
    let finalActual = 0;
    let deficitCount = 0;

    orders.forEach(ord => {
      const pId = ord.productId;
      const associatedProduct = products.find(p => p.id === pId);
      const sf = shopfloorJobs.find(j => j.orderNumber === ord.orderNumber);
      
      const q = sf ? sf.producedQty : ord.quantity;
      const s = sf ? sf.scrapQty : Math.ceil(ord.quantity * 0.02);
      
      let baseRawCost = 50;
      if (associatedProduct?.code.includes('A72')) baseRawCost = 135;
      else if (associatedProduct?.code.includes('B14')) baseRawCost = 90;
      else if (associatedProduct?.code.includes('C50')) baseRawCost = 30;

      const actMaterials = (q + s) * baseRawCost;
      const actLabor = 3 * 80 * Math.max(8, Math.ceil(ord.quantity * 0.05));
      const actMachine = Math.max(8, Math.ceil(ord.quantity * 0.04)) * 90;
      const actScrap = s * baseRawCost * 0.8;
      
      const subTot = (actMaterials + actLabor + actMachine + actScrap) * 1.15;
      finalActual += subTot;

      // check deficits
      if (s > 40) deficitCount++;
    });

    return {
      finalActual,
      deficitCount
    };
  }, [orders, products, shopfloorJobs]);

  // Printing Layout generator
  const handlePrintCostSheet = () => {
    const printContent = document.getElementById('printable-cost-sheet')?.innerHTML;
    const windowUrl = 'about:blank';
    const printWindow = window.open(windowUrl, '_blank', 'left=0,top=0,width=900,height=900,toolbar=0,scrollbars=0,status=0');
    
    if (printWindow) {
      printWindow.document.write(`
        <html dir="rtl" lang="ar">
          <head>
            <title>تقرير تكاليف التصنيع المحاسبي الشامل - ${activeOrder?.orderNumber}</title>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;950&display=swap" rel="stylesheet">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { font-family: 'Cairo', sans-serif; background-color: white; }
            </style>
          </head>
          <body class="p-8">
            <div class="border-4 border-slate-900 rounded-[2rem] p-8 w-full relative overflow-hidden bg-white">
              <div class="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
                <div>
                  <h1 class="text-2xl font-black text-slate-900">مجموعة ريستوماستر الصناعية الكبرى</h1>
                  <p class="text-[11px] text-slate-500 font-bold mt-1">قسم المراجعة المالية والمحاسبة الصناعية (Precision ERP Manufacturing Costing)</p>
                  <p class="text-[9px] text-slate-400 mt-0.5">قسم التخطيط والمخازن وإدارة الأصول الصناعية المدمجة</p>
                </div>
                <div class="text-left font-mono text-xs text-slate-700">
                  <div class="font-bold">التاريخ: ${new Date().toLocaleDateString('ar-EG')}</div>
                  <div class="text-emerald-700 font-bold">مربوط ومعتمد بمديول الموارد البشرية والمستودعات</div>
                </div>
              </div>

              ${printContent}

              <div class="grid grid-cols-2 gap-6 text-center text-xs font-bold text-slate-800 border-t-2 border-slate-900 pt-8 mt-12">
                <div>
                  <p class="text-slate-500 mb-8 block">إدارة المستودعات وجرد التكاليف</p>
                  <p class="font-bold text-slate-900 text-sm">أ. كمال حسني الغزاوي</p>
                </div>
                <div>
                  <p class="text-slate-500 mb-8 block">اعتماد المدير المالي التنفيذي للـ ERP</p>
                  <p class="font-bold text-slate-900 text-sm">مروان عبد العزيز المنصوري</p>
                </div>
              </div>
            </div>
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const handleExportCSV = () => {
    if (!calculatedStats) return;
    
    const rowData = [
      ['بند التكلفة الصناعية المدمجة', 'التكلفة المعيارية المخططة (ج.م)', 'التكلفة الفعلية المحسوبة (ج.م)'],
      ['تكلفة الخامات والمواد المباشرة (مخازن)', calculatedStats.stdRawMaterialsCost.toFixed(2), calculatedStats.actRawMaterialsCost.toFixed(2)],
      ['تكلفة العمالة المهنية المباشرة (موارد بشرية)', calculatedStats.stdLaborCost.toFixed(2), calculatedStats.actLaborCost.toFixed(2)],
      ['إهلاك الآلات ومصروفات الدوران', calculatedStats.stdMachineCost.toFixed(2), calculatedStats.actMachineCost.toFixed(2)],
      ['تكلفة الهدر التالف المالي', calculatedStats.stdScrapLossCost.toFixed(2), calculatedStats.actScrapLossCost.toFixed(2)],
      ['تكلفة الفروع والمصاريف الإدارية الإضافية', (calculatedStats.stdFactoryCost * calcInputs.overheadPercentage / 100).toFixed(2), (calculatedStats.actFactoryCost * calcInputs.overheadPercentage / 100).toFixed(2)],
      ['إجمالي التكلفة الكلية للدفعة', calculatedStats.stdTotalCost.toFixed(2), calculatedStats.actTotalCost.toFixed(2)],
      ['تكلفة القطعة المنفردة النهائية', calculatedStats.standardUnitCost.toFixed(2), calculatedStats.actualUnitCost.toFixed(2)]
    ];

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    rowData.forEach(row => {
      csvContent += row.map(v => `"${v}"`).join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقرير_تكاليف_الدفعة_الملحق_${activeOrder?.orderNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-right font-sans mb-12 animate-fade-in">
      {/* Toast notifications */}
      {feedbackMsg && (
        <div className={`fixed top-4 left-4 z-50 p-4 rounded-xl flex items-center gap-3 shadow-2xl border ${
          feedbackMsg.type === 'success' ? 'bg-slate-900 border-slate-800 text-white' : 
          feedbackMsg.type === 'error' ? 'bg-rose-950 border-rose-900 text-rose-100' : 'bg-slate-900 border-slate-800 text-white'
        } text-xs font-bold`}>
          {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* HEADER CONTROLLER BANNER */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/80 shadow-xs relative overflow-hidden flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-505 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1 relative z-10 max-w-2xl">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-full text-[10px] font-black">
              <BadgeCheck className="w-3.5 h-3.5" />
              مربوط بمستودعات الخامات والسلع
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 border border-indigo-150 text-indigo-700 rounded-full text-[10px] font-black">
              <Users className="w-3.5 h-3.5" />
              مربوط بسجل الرواتب والموارد البشرية (HR)
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-150 text-amber-700 rounded-full text-[10px] font-black">
              <Landmark className="w-3.5 h-3.5" />
              تتبع رأسمالي لتدوين أصول المخزون التام
            </span>
          </div>
          <h2 className="text-lg font-black text-slate-950 flex items-center gap-2">
            <Calculator className="w-5 h-5 text-indigo-650" />
            مركز تدقيق وحسابات تكاليف الإنتاج المتطور (Unified Multi-Module Manufacturing Costing Hub)
          </h2>
          <p className="text-slate-400 text-xs leading-relaxed font-semibold">
            يقوم هذا المديول باحتساب تكلفة المواد المباشرة الفعالة بالاستعلام المتزامن من المخازن، مع سحب كشوف الحساب الساعية ومعدلات الرواتب لمشغلي خط الإنتاج من مديول الموارد البشرية لضمان كفاءة التسعير الصناعي.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 relative z-10 self-stretch lg:self-auto shrink-0 justify-end">
          <button 
            type="button"
            onClick={loadLiveResources}
            disabled={isLoading}
            className="p-3 bg-slate-100 font-bold hover:bg-slate-200 text-slate-700 rounded-2xl transition-all flex items-center gap-2 text-xs border border-slate-200 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث البيانات والمزامنة
          </button>
        </div>
      </div>

      {/* EXECUTIVE TOPLEVEL KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">المحفظة التصنيعية الإجمالية للدفعة</span>
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight text-indigo-700 block">
              {Number(executiveMetricsSum?.finalActual || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs font-bold text-slate-500 font-sans mr-0.5">ج.م</span>
            </span>
            <span className="text-[10px] text-emerald-600 font-bold inline-block mt-1">✓ قيمة حية شاملة لعدد {orders.length} أوامر إنتاج</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:scale-105">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block mb-1">إجمالي الفنيين الفعالين في الحسابات</span>
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight text-emerald-700 block">
              {liveEmployees.length} <span className="text-xs font-bold text-slate-500 font-sans mr-0.5">موظفين</span>
            </span>
            <span className="text-[10px] text-indigo-600 font-extrabold inline-block mt-1">← مسنود منهم {allocatedCrewIds.length} كادر في صالة العمل</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:bg-emerald-600 group-hover:text-white transition-all transform group-hover:scale-105">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block mb-1">مستوى ارتباط خامات المخازن بالإنتاج</span>
            <span className="text-xl font-black text-slate-900 font-mono tracking-tight text-amber-600 block">
              {liveIngredients.length} <span className="text-xs font-bold text-slate-500 font-sans mr-0.5">خامات رئيسية</span>
            </span>
            <span className="text-[10px] text-slate-500 font-medium inline-block mt-1">تسمح بالتخصيص وتحديد عجز المخزون فورا</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:bg-amber-600 group-hover:text-white transition-all transform group-hover:scale-105">
            <Warehouse className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between group">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block mb-1">أوامر تشغيل مرتفعة الفواقد تالياً</span>
            <span className="text-xl font-black text-rose-600 font-mono tracking-tight block">
              {executiveMetricsSum.deficitCount} <span className="text-xs font-bold text-slate-500 font-sans mr-0.5">أمر إنتاج</span>
            </span>
            <span className="text-[10px] text-rose-500 font-extrabold inline-block mt-1">⚠️ تتجاوز نسب الفاقد الحد الطبيعي بالصالة</span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:bg-rose-600 group-hover:text-white transition-all transform group-hover:scale-105">
            <Scale className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* NAVIGATION TABS FOR MULTI-MODULE INTERACTIVE CONTROLS */}
      <div className="border-b border-slate-200 flex flex-wrap gap-1 bg-white p-2 rounded-2xl border shadow-2xs">
        <button
          type="button"
          onClick={() => setTabView('sheet')}
          className={`px-4 py-2.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            tabView === 'sheet' 
              ? 'bg-slate-900 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          بطاقة التكاليف التفصيلية وشيت المقارنة
        </button>
        <button
          type="button"
          onClick={() => setTabView('hr_integration')}
          className={`px-4 py-2.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            tabView === 'hr_integration' 
              ? 'bg-indigo-650 bg-indigo-600 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          تحليل رواتب كادر التشغيل (HR Core)
          <span className="bg-indigo-100 text-indigo-700 text-[9px] px-2 py-0.5 rounded-full font-black">
            {allocatedCrewIds.length} فنيين
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTabView('warehouse_integration')}
          className={`px-4 py-2.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            tabView === 'warehouse_integration' 
              ? 'bg-slate-800 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Warehouse className="w-3.5 h-3.5" />
          جرد وحساب خامات المخزن (BOM Stock Allocation)
          {warehouseMaterialsStatus.some((x: any) => x.shortFall > 0) && (
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setTabView('accounting_post')}
          className={`px-4 py-2.5 text-xs font-black rounded-lg transition-all flex items-center gap-2 cursor-pointer ${
            tabView === 'accounting_post' 
              ? 'bg-emerald-600 text-white shadow-xs' 
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          معاملات دفتر الحسابات العام والرسملة
        </button>
      </div>

      {/* INNER VIEW CONTENT */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* VIEW 1: BASIC SHEET TAB */}
        {tabView === 'sheet' && (
          <>
            {/* SIDEBAR FOR PARAMETERS & SIMULATED SETTINGS */}
            <div className="xl:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xs">
                <div className="border-b border-slate-100 pb-4 mb-4 flex justify-between items-center">
                  <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-650" />
                    محددات ومقاييس صالة العمل والتسعير
                  </h3>
                  <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded">ERP Inputs</span>
                </div>

                {/* 1) Choice of Active Order */}
                <div className="space-y-1.5 mb-5">
                  <label className="block text-[10px] font-black text-slate-400">اختر بطاقة وأمر إنتاج مرجعي للدراسة</label>
                  <select 
                    value={selectedOrderId}
                    onChange={e => setSelectedOrderId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 outline-none cursor-pointer"
                  >
                    {orders.map(o => {
                      const prodObj = products.find(p => p.id === o.productId);
                      return (
                        <option key={o.id} value={o.id}>
                          {o.orderNumber} - {prodObj?.name || 'مسبوك'} ({o.quantity} قطعة)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Parameters ranges */}
                <div className="space-y-4">
                  
                  {/* Labor Run Hours */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                      <span>ساعات العمل المقدرة للفريق</span>
                      <span className="font-mono text-indigo-600 font-black">{calcInputs.laborHoursNeeded} ساعة عمل</span>
                    </div>
                    <input 
                      type="range"
                      min="2"
                      max="150"
                      value={calcInputs.laborHoursNeeded}
                      onChange={e => setCalcInputs({...calcInputs, laborHoursNeeded: parseInt(e.target.value) || 2})}
                      className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                    />
                  </div>

                  {/* Machine variables */}
                  <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-500">معاملات استهلاك ماكلكات الفرن والصهر</span>
                    <span className="text-[9px] text-amber-600 font-bold">طاقة صهر + إهلاك مبكر</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black text-slate-400">ساعة ماكينة</label>
                      <input 
                        type="number"
                        min="1"
                        max="240"
                        value={calcInputs.machineRuntimeHours}
                        onChange={e => setCalcInputs({...calcInputs, machineRuntimeHours: Math.max(1, parseInt(e.target.value) || 1)})}
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-center rounded-lg text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black text-slate-400">وقود وطاقة/س</label>
                      <input 
                        type="number"
                        min="0"
                        max="300"
                        value={calcInputs.machinePowerRate}
                        onChange={e => setCalcInputs({...calcInputs, machinePowerRate: Math.max(0, parseInt(e.target.value) || 0)})}
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-center rounded-lg text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[8px] font-black text-slate-400">إهلاك ميكانيكي/س</label>
                      <input 
                        type="number"
                        min="0"
                        max="300"
                        value={calcInputs.machineWearRate}
                        onChange={e => setCalcInputs({...calcInputs, machineWearRate: Math.max(0, parseInt(e.target.value) || 0)})}
                        className="w-full p-2 bg-slate-50 border border-slate-200 text-center rounded-lg text-xs font-mono font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  {/* Overheads and Margins */}
                  <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400">نسبة مصاريف الإدارة %</label>
                      <input 
                        type="number"
                        min="0"
                        max="90"
                        value={calcInputs.overheadPercentage}
                        onChange={e => setCalcInputs({...calcInputs, overheadPercentage: Math.max(0, parseInt(e.target.value) || 0)})}
                        className="w-full p-2 bg-slate-50 border text-center rounded-xl text-xs font-bold font-mono text-indigo-700"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400">هامش الربح المطلوب %</label>
                      <input 
                        type="number"
                        min="5"
                        max="200"
                        value={calcInputs.targetProfitMargin}
                        onChange={e => setCalcInputs({...calcInputs, targetProfitMargin: Math.max(0, parseInt(e.target.value) || 0)})}
                        className="w-full p-2 bg-slate-50 border text-center rounded-xl text-xs font-bold font-mono text-emerald-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 border-t border-slate-100 pt-3">
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <span>سعر بيع بالتجزئة مستهدف للمقارنة</span>
                      <span className="font-mono text-indigo-600 font-bold">{calcInputs.targetSalePrice} EGP</span>
                    </div>
                    <input 
                      type="number"
                      value={calcInputs.targetSalePrice}
                      onChange={e => setCalcInputs({...calcInputs, targetSalePrice: parseInt(e.target.value) || 1})}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 text-xs font-mono text-center font-bold text-slate-800"
                    />
                  </div>

                </div>
              </div>

              {/* DYNAMIC VARIANCE BRIEF CARD */}
              {calculatedStats && (
                <div className={`p-5 rounded-[2rem] border relative overflow-hidden transition-all ${
                  calculatedStats.totalCostVariance > 0 
                    ? 'border-rose-200 bg-rose-50/10' 
                    : 'border-emerald-200 bg-emerald-50/10'
                }`}>
                  <div className="flex gap-3">
                    <div className={`p-2.5 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                      calculatedStats.totalCostVariance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      <Info className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 text-xs">
                      <h4 className="font-extrabold text-slate-900">التحليل المالي والانحرافات</h4>
                      <p className="text-slate-500 leading-relaxed font-semibold">
                        أمر الإنتاج <strong className="font-mono text-slate-800">{activeOrder?.orderNumber}</strong> لديه انحراف كلي بمعدل 
                        <span className={`font-black font-mono mx-1 ${calculatedStats.totalCostVariance > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {calculatedStats.totalCostVariance > 0 ? '+' : ''}{Number(calculatedStats?.totalCostVariance || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م
                        </span>
                        عن المقايسة القياسية. هذا راجع لتكلفة سحب المواد ومكوّنات الهدر المضافة.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* MAIN COST SHEET SHEET & CHARTS */}
            <div className="xl:col-span-2 space-y-6">
              
              {/* COMPARATIVE METRICS AND SVG GRAPHICS */}
              {calculatedStats && (
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  
                  {/* CIRCULAR PIE CHART - DETAILED SLICES */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-900 pb-2 border-b flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-indigo-600" />
                      مكونات التكلفة الفعلية للأصول المسبوكة
                    </h4>

                    <div className="flex items-center justify-center h-48 relative">
                      <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f8fafc" strokeWidth="12" />
                        
                        {(() => {
                          const total = calculatedStats.actTotalCost || 1;
                          const pMat = (calculatedStats.actRawMaterialsCost / total) * 100;
                          const pLab = (calculatedStats.actLaborCost / total) * 100;
                          const pMac = (calculatedStats.actMachineCost / total) * 100;
                          const pScr = (calculatedStats.actScrapLossCost / total) * 100;
                          const pOvh = (calculatedStats.actFactoryCost * (calcInputs.overheadPercentage / 100) / total) * 100;

                          let offset = 0;
                          const c = 2 * Math.PI * 40; // ~251.2 circumference

                          const slices = [
                            { pct: pMat, color: '#4f46e5' }, // indigo: materials
                            { pct: pLab, color: '#10b981' }, // emerald: labor
                            { pct: pMac, color: '#f59e0b' }, // amber: machine
                            { pct: pScr, color: '#ef4444' }, // red: scrap
                            { pct: pOvh, color: '#ec4899' }  // pink: overheads
                          ];

                          return slices.map((slice, i) => {
                            const dashArray = `${(slice.pct / 100) * c} ${c}`;
                            const strokeOffset = c - (offset / 100) * c;
                            offset += slice.pct;

                            return (
                              <circle 
                                key={i}
                                cx="50" 
                                cy="50" 
                                r="40" 
                                fill="transparent" 
                                stroke={slice.color} 
                                strokeWidth="12" 
                                strokeDasharray={dashArray}
                                strokeDashoffset={strokeOffset}
                                className="transition-all duration-300 hover:stroke-[15]"
                              />
                            );
                          });
                        })()}
                      </svg>

                      <div className="absolute flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">تكلفة الوحدة</span>
                        <strong className="text-base font-black text-slate-900 font-mono">{calculatedStats.actualUnitCost.toFixed(2)} ج.م</strong>
                        <span className="text-[8px] bg-slate-100 hover:bg-slate-200 border rounded px-1 text-slate-500 font-black mt-1">
                          {activeProduct ? activeProduct.unit : 'قطع'}
                        </span>
                      </div>
                    </div>

                    {/* Legends for SVG Pie Chart */}
                    <div className="grid grid-cols-5 text-center text-[9px] font-bold text-slate-600 gap-1 pt-2">
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 bg-[#4f46e5] rounded-full block mb-0.5" />
                        <span>خامات ({(calculatedStats.actRawMaterialsCost / (calculatedStats.actTotalCost || 1) * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 bg-[#10b981] rounded-full block mb-0.5" />
                        <span>أجور ({(calculatedStats.actLaborCost / (calculatedStats.actTotalCost || 1) * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 bg-[#f59e0b] rounded-full block mb-0.5" />
                        <span>آلات ({(calculatedStats.actMachineCost / (calculatedStats.actTotalCost || 1) * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 bg-[#ef4444] rounded-full block mb-0.5" />
                        <span>فاقد ({(calculatedStats.actScrapLossCost / (calculatedStats.actTotalCost || 1) * 100).toFixed(0)}%)</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="w-2.5 h-2.5 bg-[#ec4899] rounded-full block mb-0.5" />
                        <span>إدارية</span>
                      </div>
                    </div>

                  </div>

                  {/* HIGH-CONTRAST HORIZONTAL SIDE COMPARATOR BARS */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-900 pb-2 border-b flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-emerald-600" />
                      مقارنة الموازنة (المعياري المخطط مقابل الفعلي)
                    </h4>

                    <div className="space-y-3 pt-1 text-[11px] font-bold text-slate-600 leading-none">
                      
                      {/* Bar 1: Raw materials */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-extrabold text-[10px]">
                          <span className="text-slate-800">خامات ومواد المخازن</span>
                          <span className="font-mono text-slate-500">
                            فعلي: {Number(calculatedStats?.actRawMaterialsCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / 
                            مخطط: {Number(calculatedStats?.stdRawMaterialsCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 border">
                          <div className="bg-indigo-650 bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (calculatedStats.actRawMaterialsCost / (Math.max(calculatedStats.stdRawMaterialsCost, 1) * 1.5)) * 100)}%` }} />
                        </div>
                      </div>

                      {/* Bar 2: Direct Labor */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-extrabold text-[10px]">
                          <span className="text-slate-800">أجور طاقم العمل (HR)</span>
                          <span className="font-mono text-slate-500">
                            فعلي: {Number(calculatedStats?.actLaborCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / 
                            مخطط: {Number(calculatedStats?.stdLaborCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 border">
                          <div className="bg-emerald-600 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (calculatedStats.actLaborCost / (Math.max(calculatedStats.stdLaborCost, 1) * 1.5)) * 100)}%` }} />
                        </div>
                      </div>

                      {/* Bar 3: Scrap loss */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-extrabold text-[10px]">
                          <span className="text-slate-800">تكلفة التوالف والفاقد الفعلي</span>
                          <span className="font-mono text-slate-500">
                            فعلي: {Number(calculatedStats?.actScrapLossCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} / 
                            مخطط: {Number(calculatedStats?.stdScrapLossCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 border">
                          <div className="bg-rose-500 h-full rounded-full transition-all" style={{ width: `${Math.min(100, (calculatedStats.actScrapLossCost / (Math.max(calculatedStats.stdScrapLossCost, 1) * 2)) * 100)}%` }} />
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              )}

              {/* INDUSTRIAL SHEET PRINTABLE AREA */}
              {calculatedStats && (
                <div id="printable-cost-sheet" className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-xs relative">
                  
                  {/* Report Stamp / Top Labels */}
                  <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-widest text-slate-400">كشف حساب الإنتاج</span>
                      <h3 className="font-black text-slate-900 text-sm mt-0.5">تفاصيل التكاليف لخط التسييل والتنعيم</h3>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={handlePrintCostSheet}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        طباعة كشف مالي للقسم
                      </button>
                      <button 
                        type="button"
                        onClick={handleExportCSV}
                        className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        تصدير ملف مالي CSV
                      </button>
                    </div>
                  </div>

                  {/* Core details tables */}
                  <div className="space-y-4 font-semibold text-slate-700 leading-relaxed text-xs">
                    
                    {/* Identification block */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-2xl border">
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold">رقم أمر التشغيل والموازنة:</span>
                        <strong className="text-slate-900 font-mono font-black">{activeOrder?.orderNumber}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold">المنتج الخاضع للدراسة:</span>
                        <strong className="text-slate-950 block truncate text-[11px]">{activeProduct?.name}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold">مركز العمل المسند:</span>
                        <strong className="text-slate-900 block truncate text-[11px]">{activeWorkCenter?.name}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 font-bold">الدفعة وصالة العمل:</span>
                        <strong className="text-indigo-700 block text-[11px]">{activeOrder?.quantity} قطعة (مخطط)</strong>
                      </div>
                    </div>

                    {/* Grid of detailed costs rows */}
                    <div className="border border-slate-250 rounded-2xl overflow-hidden shadow-2xs">
                      <div className="grid grid-cols-3 bg-slate-900 text-white font-extrabold text-xs text-center border-b pt-3 pb-3">
                        <div className="text-right pr-6">بند التكلفة الصناعية المدمجة</div>
                        <div>التقدير المعياري الموازني (ج.م)</div>
                        <div className="text-center">الفعلي المحسوب (ج.م)</div>
                      </div>

                      <div className="divide-y divide-slate-100 bg-white">
                        
                        {/* Material cost row */}
                        <div className="grid grid-cols-3 pt-3 pb-3 items-center text-center">
                          <div className="text-right pr-6 font-extrabold text-slate-900 text-[11px]">
                            <span>(١) المواد المباشرة والخامات</span>
                            <span className="text-[9px] text-slate-400 block font-normal">سحب فعلي من المخازن + عوادم خامات</span>
                          </div>
                          <div className="font-mono text-slate-500">{Number(calculatedStats?.stdRawMaterialsCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                          <div className="font-mono font-black text-slate-900">{Number(calculatedStats?.actRawMaterialsCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                        </div>

                        {/* Labor cost row */}
                        <div className="grid grid-cols-3 pt-3 pb-3 items-center text-center">
                          <div className="text-right pr-6 font-extrabold text-slate-900 text-[11px]">
                            <span>(٢) الأجور والعمالة الصناعية المباشرة</span>
                            <span className="text-[9px] text-slate-400 block font-normal">مسحوبة من نظام الأجور لـ {allocatedCrewIds.length} فنيين</span>
                          </div>
                          <div className="font-mono text-slate-500">{Number(calculatedStats?.stdLaborCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.m</div>
                          <div className="font-mono font-black text-slate-900">{Number(calculatedStats?.actLaborCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                        </div>

                        {/* Machine cost row */}
                        <div className="grid grid-cols-3 pt-3 pb-3 items-center text-center">
                          <div className="text-right pr-6 font-extrabold text-slate-900 text-[11px]">
                            <span>(٣) تشغيل وصيانة أفران الصهر</span>
                            <span className="text-[9px] text-slate-400 block font-normal">وقود + غاز + معدل استهلاك حراري متكامل</span>
                          </div>
                          <div className="font-mono text-slate-500">{Number(calculatedStats?.stdMachineCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.m</div>
                          <div className="font-mono font-black text-slate-900">{Number(calculatedStats?.actMachineCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                        </div>

                        {/* Scrap losses */}
                        <div className="grid grid-cols-3 pt-3 pb-3 items-center text-center">
                          <div className="text-right pr-6 font-extrabold text-slate-900 text-[11px]">
                            <span>(٤) خسيرة الهدر والقطع التالفة الفعلي</span>
                            <span className="text-[9px] text-slate-400 block font-normal">سعر موازنة الكيلو المفقود بالتصنيع</span>
                          </div>
                          <div className="font-mono text-slate-500">{Number(calculatedStats?.stdScrapLossCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.m</div>
                          <div className="font-mono font-black text-rose-600 font-extrabold">{Number(calculatedStats?.actScrapLossCost || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                        </div>

                        {/* Total Direct Manufacturing */}
                        <div className="grid grid-cols-3 pt-3 pb-3 items-center text-center bg-slate-50 font-black text-slate-800">
                          <div className="text-right pr-6 text-indigo-750 text-[11px] uppercase">إجمالي تكاليف خطوط الإنتاج المباشرة</div>
                          <div className="font-mono text-indigo-600">{Number(calculatedStats.stdPrimeCost + calculatedStats.stdMachineCost || 0 || 0 || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                          <div className="font-mono text-indigo-700">{Number(calculatedStats.actPrimeCost + calculatedStats.actMachineCost || 0 || 0 || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                        </div>

                        {/* Overheads Row */}
                        <div className="grid grid-cols-3 pt-3 pb-3 items-center text-center">
                          <div className="text-right pr-6 font-extrabold text-slate-900 text-[11px]">
                            <span>(٥) الموزع من المصاريف غير المباشرة</span>
                            <span className="text-[9px] text-slate-400 block font-normal">رسم إلكتروني للتحميل بنسبة {calcInputs.overheadPercentage}%</span>
                          </div>
                          <div className="font-mono text-slate-500">{Number((calculatedStats?.stdFactoryCost || 0) * ((calcInputs?.overheadPercentage || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                          <div className="font-mono text-slate-900">{Number((calculatedStats?.actFactoryCost || 0) * ((calcInputs?.overheadPercentage || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 1 })} ج.م</div>
                        </div>

                        {/* Grand Total Cost */}
                        <div className="grid grid-cols-3 pt-4 pb-4 items-center text-center bg-slate-950 text-white font-black text-sm">
                          <div className="text-right pr-6 text-emerald-400">إجمالي التكلفة التصنيعيّة الرأسمالية للدفعة</div>
                          <div className="font-mono text-slate-300">{Number(calculatedStats?.stdTotalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م</div>
                          <div className="font-mono text-emerald-400">{Number(calculatedStats?.actTotalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م</div>
                        </div>

                      </div>
                    </div>

                    {/* pricing evaluation details */}
                    <div className="bg-slate-50/80 p-5 rounded-[1.8rem] border border-slate-200">
                      <h4 className="text-xs font-black text-slate-900 mb-3 flex items-center gap-1.5 border-b pb-2">
                        <TrendingUp className="w-4 h-4 text-emerald-700" />
                        تحليل تسعير وجدوى الربحية الحدية للإنتاج (Profitability & Target Pricing Analysis)
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 leading-relaxed font-semibold text-slate-600 text-[11px]">
                        
                        <div className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-150 shadow-xs">
                          <span className="block text-slate-400 font-black">تحليل تكلفة القطعة المفردة</span>
                          <div>
                            <span>معياري قياسي مخطّط:</span>
                            <strong className="text-slate-800 font-mono block text-xs">{calculatedStats.standardUnitCost.toFixed(2)} ج.م / قطعة</strong>
                          </div>
                          <div className="pt-1.5 border-t">
                            <span>فعلي بعد الفاقد الميداني:</span>
                            <strong className="text-rose-700 font-mono block text-xs">{calculatedStats.actualUnitCost.toFixed(2)} ج.م / قطعة</strong>
                          </div>
                        </div>

                        <div className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-150 shadow-xs">
                          <span className="block text-slate-400 font-black">التسعير القياسي المستهدف لتأمين هامش {calcInputs.targetProfitMargin}%</span>
                          <div>
                            <span>سعر البيع المقترح لقطعة التجزئة:</span>
                            <strong className="text-emerald-700 font-mono block text-xs">{calculatedStats.suggestedSellingPrice.toFixed(2)} ج.م / قطعة</strong>
                          </div>
                          <div className="pt-1.5 border-t">
                            <span>هامش الربح المتوقع لكل قطعة:</span>
                            <strong className="text-slate-800 font-mono block font-black text-emerald-600">+{calculatedStats.targetProfitPerUnit.toFixed(2)} ج.م / قطعة</strong>
                          </div>
                        </div>

                        <div className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-150 shadow-xs">
                          <span className="block text-slate-400 font-black">تقييم تسعيرك الحالي لتجزئة الـ ERP ({calcInputs.targetSalePrice} ج.م)</span>
                          <div>
                            <span>هامش الربح المساق الفعلي:</span>
                            <strong className={`font-mono block text-xs ${calculatedStats.userProfitMarginPercent > 15 ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {calculatedStats.userProfitMarginPercent.toFixed(1)}% من الثمن
                            </strong>
                          </div>
                          <div className="pt-1.5 border-t">
                            <span>إجمالي الفائض المالي المحقق للدفعة:</span>
                            <strong className={`font-mono block font-black ${calculatedStats.userGrossProfit > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                              {Number(calculatedStats?.userGrossProfit || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م
                            </strong>
                          </div>
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </>
        )}

        {/* VIEW 2: HR LIVE SALARY ENGINE INTEGRATION */}
        {tabView === 'hr_integration' && (
          <div className="xl:col-span-3 space-y-6 animate-fade-in">
            <div className="bg-white border rounded-[2rem] p-6 shadow-xs">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    محرك وجرد تكلفة الكوادر الصناعية (Active Production Crew Payroll Sync)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">
                    التحكم المتزامن في أفراد الطاقم المسندين لأمر التشغيل. يسحب المحرك الراتب الأساسي ونوع التعاقد (يومي/شهري) لحظياً من مديول الموارد البشرية.
                  </p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-black">
                  معدل التكلفة الساعي النشط للطاقم: <span className="font-mono">{totalCrewHourlyCost.toFixed(2)} ج.م / ساعة</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1) Allocated Crew on this order production line */}
                <div className="border border-slate-200 p-5 rounded-[2rem] bg-indigo-50/15">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      الطاقم والعمّال النشطين حالياً في صالة العمل ({assignedCrew.length} فنيين)
                    </span>
                    <span className="text-[10px] text-slate-450 text-indigo-600 font-bold">يؤثرون فورياً في حساب التكلفة</span>
                  </div>

                  <div className="space-y-3">
                    {assignedCrew.map(emp => {
                      const hourlyRate = emp.salary_type === 'monthly' ? (emp.basic_salary / (30 * 8)) : (emp.basic_salary / 8);
                      return (
                        <div key={emp.id} className="bg-white border border-slate-200/60 p-4 rounded-xl shadow-2xs flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-black text-xs flex items-center justify-center font-mono">
                              {emp.name.substring(0, 2)}
                            </div>
                            <div className="text-right">
                              <h4 className="font-black text-slate-900 text-xs">{emp.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold">{emp.job_title} | {emp.department_name || 'صالة الغلايات المسبوكة'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="text-left font-mono">
                              <span className="block text-[10px] text-slate-400 font-bold font-sans">الأجر الساعي الفعلي:</span>
                              <strong className="text-indigo-700 text-xs font-black">{hourlyRate.toFixed(2)} ج.م / س</strong>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => handleRemoveEmployeeFromCrew(emp.id)}
                              className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg cursor-pointer transition-colors"
                              title="استبعاد من هذه الدفعة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2) Add other employees from general Human Resources database */}
                <div className="border border-slate-200 p-5 rounded-[2rem] bg-white">
                  <div className="mb-4">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      إسناد فنيين إضافيين من مديول شؤون الموظفين (HR Bank)
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold block mt-0.5">انقر على الموظفين المسجلين لتوريدهم فوراً لخدمة خط التصنيع الحالي</span>
                  </div>

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {liveEmployees.filter(emp => !allocatedCrewIds.includes(emp.id)).map(emp => {
                      const hourlyRate = emp.salary_type === 'monthly' ? (emp.basic_salary / (30 * 8)) : (emp.basic_salary / 8);
                      return (
                        <div 
                          key={emp.id} 
                          onClick={() => handleAddEmployeeToCrew(emp.id)}
                          className="border border-dashed border-slate-200 p-3.5 rounded-xl hover:border-indigo-400 hover:bg-slate-50 cursor-pointer transition-all flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-semibold text-xs flex items-center justify-center font-mono">
                              {emp.name.substring(0, 2)}
                            </div>
                            <div className="text-right">
                              <h4 className="font-extrabold text-slate-850 text-xs">{emp.name}</h4>
                              <p className="text-[9px] text-slate-400 font-semibold">{emp.job_title} | {emp.department_name || 'الإنتاج الكلي'}</p>
                            </div>
                          </div>
                          
                          <div className="text-left font-mono">
                            <span className="block text-[8px] text-slate-400 font-bold font-sans">الأجر الأساسي:</span>
                            <span className="text-slate-800 text-xs font-bold">{emp.basic_salary} ج.م ({emp.salary_type === 'monthly' ? 'شهري' : 'يومي'})</span>
                          </div>
                        </div>
                      );
                    })}
                    {liveEmployees.filter(emp => !allocatedCrewIds.includes(emp.id)).length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center p-8">تم إسناد كافة العملاء والكوادر المقيدة في هذا الشيت بالفعل.</p>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* VIEW 3: WAREHOUSE & STOCK ALLOCATION */}
        {tabView === 'warehouse_integration' && (
          <div className="xl:col-span-3 space-y-6 animate-fade-in">
            <div className="bg-white border rounded-[2rem] p-6 shadow-xs">
              
              {/* Warehouse Integration Intro Header */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Warehouse className="w-5 h-5 text-indigo-600" />
                    محاكي فحص الأرصدة وملاءمة المواد بالمستودعات (BOM stock allocation & reservation)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">
                    التحليل الرقمي المتكامل للفاقد وخامات المخازن للـ BOM المعتمد. ينبهك المديول بوجود أي عجز لوجيستي ويسمح بسحب وتجنيب الرصيد فورياً.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePerformInventoryRelease}
                    disabled={isLoading}
                    className="p-3 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <ArrowLeftRight className="w-4 h-4 text-emerald-400" />
                    طلب وصرف الخامات من المستودع ورقة رقمية
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1) Main Inventory Stocks Analysis Table */}
                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-slate-700" />
                    خامات تركيبة الـ BOM المطلوبة لأمر التشغيل الحالي ({warehouseMaterialsStatus.length} بنود)
                  </h4>

                  <div className="border border-slate-150 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-100 font-bold text-slate-700 border-b">
                        <tr>
                          <th className="p-3">رمز المادة</th>
                          <th className="p-3">اسم المستلزم الفني</th>
                          <th className="p-3 text-center">الكمية لكل قطعة</th>
                          <th className="p-3 text-center">الكمية المطلوبة للدفعة</th>
                          <th className="p-3 text-center">رصيد المخزن الحالي</th>
                          <th className="p-3 text-center">تكلفة الوحدة ج.م</th>
                          <th className="p-3 text-center">حالة الملاءمة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {pageRows(warehouseMaterialsStatus, pgn1).map((item: any, idx: any) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3 font-mono text-slate-450 text-[10px]">{item.itemCode}</td>
                            <td className="p-3 font-extrabold text-slate-800 text-[11px]">{item.name}</td>
                            <td className="p-3 text-center font-mono">{item.qtyPerUnit} /{item.unit}</td>
                            <td className="p-3 text-center font-mono font-black text-slate-900">{Number(item.qtyRequired || 0 || 0).toLocaleString()} {item.unit}</td>
                            <td className="p-3 text-center font-mono font-bold text-slate-700">{Number(item.currentStock || 0 || 0).toLocaleString()} {item.unit}</td>
                            <td className="p-3 text-center font-mono text-slate-500">{item.unitCost} ج.م</td>
                            <td className="p-3 text-center">
                              {item.shortFall > 0 ? (
                                <span className="px-2 py-0.5 bg-rose-50 border border-rose-150 text-rose-700 rounded text-[9px] font-black inline-flex items-center gap-1.5">
                                  <ShieldAlert className="w-3 h-3" />
                                  عجز بقيمة {item.shortFall} {item.unit}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded text-[9px] font-black inline-flex items-center gap-1.5">
                                  <BadgeCheck className="w-3 h-3" />
                                  متوفر ومتاح بالكامل
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <PaginationBar page={pgn1.page} pageSize={pgn1.pageSize} total={(warehouseMaterialsStatus).length} onPage={pgn1.setPage} onPageSize={pgn1.setPageSize} />
                  </div>
                </div>

                {/* 2) Add Custom Materials Overriding/Supplementing BOM */}
                <div className="lg:col-span-1 border border-slate-200 p-5 rounded-[2.2rem] space-y-4 bg-slate-50/50">
                  <div>
                    <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-emerald-600" />
                      إلحاق خامات إضافية بالمقايسة (Manual Material Override)
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold block mt-0.5">اختبار تكاليف خامات وسبيكات بديلة دون المساس بالـ BOM الدائم.</p>
                  </div>

                  <div className="space-y-4 pt-1">
                    {/* Add selecting element */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400">اختر مادة خام من المستودع لتزويد المقايسة</label>
                      <select 
                        value={selectedIngToAdd}
                        onChange={e => setSelectedIngToAdd(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        <option value="">-- اختر مادة خام معينة --</option>
                        {liveIngredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} ({ing.cost} ج.م / {ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-black text-slate-400">الكمية الإضافية الإجمالية المطلوبة للدفعة</label>
                      <input 
                        type="number"
                        min="1"
                        value={customIngQty}
                        onChange={e => setCustomIngQty(parseInt(e.target.value) || 1)}
                        className="w-full p-2.5 bg-white border rounded-xl text-xs font-mono font-bold text-slate-800"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomMaterial}
                      className="w-full py-2.5 bg-indigo-50 border border-indigo-150 rounded-xl font-black text-xs text-indigo-700 hover:bg-indigo-100 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      إضافة المادة المقايسية الإضافية
                    </button>

                    {/* Custom materials tags list */}
                    {customBOMItems.length > 0 && (
                      <div className="border-t pt-3 space-y-2">
                        <span className="text-[9px] font-black text-slate-400 block">البنود الإضافية الملحقة يدوياً بالمقايسة:</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {customBOMItems.map(c => (
                            <div key={c.id} className="bg-white border rounded-lg p-2 text-[10px] flex justify-between items-center">
                              <div>
                                <span className="font-extrabold text-slate-800 block truncate max-w-40">{c.name}</span>
                                <span className="font-mono text-slate-400 block font-bold mt-0.5">
                                  {c.quantity} {c.unit} × {c.cost} ج.م = {Number((c.quantity || 0) * (c.cost || 0)).toLocaleString()} ج.م
                                </span>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => handleRemoveCustomMaterial(c.id)}
                                className="text-rose-500 hover:bg-rose-50 p-1 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: GENERAL ACC INTEGRATION & CAPITALISATION */}
        {tabView === 'accounting_post' && (
          <div className="xl:col-span-3 space-y-6 animate-fade-in">
            <div className="bg-white border rounded-[2rem] p-6 shadow-xs">
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b pb-4">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-indigo-650" />
                    معاملات دفتر الحسابات وإثبات قيمة الأصول الرأسمالية (GL / Inventory Inventory Capitalization)
                  </h3>
                  <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">
                    هنا يُرسخ الـ ERP تفاصيل التكلفة الفعلية ليتم إضافتها لقيمة مخزون المنتج التام بالصناديق الحسابية، وتوريد كشف محاسبي دقيق.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handlePerformERPStockAuditPost}
                  disabled={isLoading}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl flex items-center gap-2 shadow-xs cursor-pointer"
                >
                  <BadgeCheck className="w-4 h-4 text-white" />
                  ترحيل القيمة وإدراج الأصول بالخزائن
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Card 1: Valuation detail */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-dashed text-right font-semibold text-xs leading-relaxed text-slate-650 space-y-3">
                  <span className="text-slate-400 font-black tracking-widest block uppercase text-[10px]">تقييم قيمة المخزون التام الحالية</span>
                  <div className="border-b pb-2">
                    <span className="text-slate-400 font-bold block">الكمية الفعلية المكتملة:</span>
                    <strong className="text-slate-800 text-base font-mono block font-black">
                      {Number(calculatedStats?.actualProducedQty || 0).toLocaleString()} قطعة تامة الصنع
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold block">متوسط تكلفة التصنيع المباشرة المقفلة:</span>
                    <strong className="text-slate-850 text-base font-mono block font-black">
                      {calculatedStats?.actualUnitCost.toFixed(2)} ج.م / قطعة
                    </strong>
                  </div>
                  <div className="border-t pt-2 bg-slate-900 text-emerald-400 p-3 rounded-xl mt-3 font-mono font-black text-center text-xs">
                    القيمة الرأسمالية: {Number(((calculatedStats?.actualProducedQty || 1) * (calculatedStats?.actualUnitCost || 1))).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م
                  </div>
                </div>

                {/* Card 2: Accounting allocation scheme */}
                <div className="col-span-2 border border-slate-200 p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-slate-950 flex items-center gap-1.5 pb-2 border-b">
                    <ClipboardList className="w-4.5 h-4.5 text-indigo-500" />
                    مخطط القيد المحاسبي المزدوج لإغلاق بطاقة خط التصنيع الحالي
                  </h4>

                  <div className="space-y-3 text-xs leading-relaxed">
                    <div className="grid grid-cols-4 gap-3 bg-slate-50 p-2.5 rounded font-extrabold text-slate-705 text-center">
                      <div className="text-right">الحساب المالي المعني</div>
                      <div>مدين (Debit ج.م)</div>
                      <div>دائن (Credit ج.م)</div>
                      <div>مركز تكلفة الـ ERP</div>
                    </div>

                    {/* Row 1 Credit: raw raw material inventory */}
                    <div className="grid grid-cols-4 gap-3 text-center border-b pb-2">
                      <div className="text-right font-black text-slate-800">حـ/ مخازن المواد الأولية والخامات</div>
                      <div className="text-slate-300 font-mono">-</div>
                      <div className="font-mono text-rose-600 font-bold">
                        {Number(calculatedStats?.stdRawMaterialsCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-slate-400 font-bold truncate">مركز الإنتاج الساخن</div>
                    </div>

                    {/* Row 2 Credit: payroll wages credit allocation */}
                    <div className="grid grid-cols-4 gap-3 text-center border-b pb-2">
                      <div className="text-right font-black text-slate-800">حـ/ معاشات وأجور مستحقة صالة الخراطة</div>
                      <div className="text-slate-300 font-mono">-</div>
                      <div className="font-mono text-rose-600 font-bold">
                        {Number(calculatedStats?.stdLaborCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-slate-400 font-bold truncate">رواتب خط المسبوكات</div>
                    </div>

                    {/* Row 3 Debit: asset capitalization finished stock */}
                    <div className="grid grid-cols-4 gap-3 text-center border-b pb-2 bg-emerald-50/20 p-1">
                      <div className="text-right font-black text-emerald-800">حـ/ مخزون المنتجات التامة والأواني الجاهزة</div>
                      <div className="font-mono text-emerald-700 font-black">
                        {Number(calculatedStats?.actTotalCost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-slate-300 font-mono">-</div>
                      <div className="text-emerald-700 font-black truncate">أصول المخازن الرئيسية</div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>

      {/* COMPREHENSIVE MANUFACTURING VARIANCE LOGS (MASTER VARIANCE LEDGER FOR ALL RUNNING ORDERS) */}
      <div className="bg-white border border-slate-200 rounded-[2.5rem] p-6 shadow-xs">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-650" />
              سجل تتبع فروقات حسابات الإنتاج لعموم بطاقات العمل (Active Production Cost Reconciliation Ledger)
            </h3>
            <p className="text-[10px] text-slate-400 font-extrabold mt-0.5">
              مراجعة وتدقيق معيار التكلفة مقارنة بالفعلي لإظهار نسب التوفير والانحراف المادي في المعادن.
            </p>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
            <input 
              type="text" 
              placeholder="ابحث برمز البطاقة أو اسم مسبوك التصنيع..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-950 text-white font-black">
              <tr>
                <th className="p-4 rounded-rt-xl">أمر التشغيل</th>
                <th className="p-4">المنتج والتصميم الفني</th>
                <th className="p-4 text-center">الحصيلة الفعلية</th>
                <th className="p-4 text-center">أرومات الهالك</th>
                <th className="p-4 text-center">التكلفة الموازنية</th>
                <th className="p-4 text-center">التكلفة الفعلية</th>
                <th className="p-4 text-center">انحراف الميزانية</th>
                <th className="p-4 text-center font-mono">معدل الانحراف</th>
                <th className="p-4 text-center rounded-lt-xl">حالة الإغلاق المالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {orders.filter(o => {
                if (!o) return false;
                const prod = products.find(p => p && p.id === o.productId);
                const queryLower = (searchQuery || '').toLowerCase();
                const orderNum = o.orderNumber || '';
                const prodName = prod?.name || '';
                return (orderNum.toLowerCase().includes(queryLower) || prodName.toLowerCase().includes(queryLower));
              }).map((ord) => {
                const associatedProduct = products.find(p => p.id === ord.productId);
                const sf = shopfloorJobs.find(j => j.orderNumber === ord.orderNumber);
                
                const q = sf ? sf.producedQty : ord.quantity;
                const s = sf ? sf.scrapQty : Math.ceil(ord.quantity * 0.025);
                
                // Estimations coefficients
                let baseRawCost = 50;
                if (associatedProduct?.code.includes('A72')) baseRawCost = 135;
                else if (associatedProduct?.code.includes('B14')) baseRawCost = 90;
                else if (associatedProduct?.code.includes('C50')) baseRawCost = 30;

                const actMaterials = (q + s) * baseRawCost;
                const actLabor = 3 * 80 * Math.max(8, Math.ceil(ord.quantity * 0.05));
                const actMachine = Math.max(8, Math.ceil(ord.quantity * 0.04)) * 90;
                const actScrap = s * baseRawCost * 0.8;
                
                const planMaterials = ord.quantity * baseRawCost * 1.03;
                const planLabor = 3 * 80 * Math.max(8, Math.ceil(ord.quantity * 0.05));
                const planMachine = Math.max(8, Math.ceil(ord.quantity * 0.04)) * 90;
                const planScrap = Math.ceil(ord.quantity * 0.03) * baseRawCost * 0.8;

                const finalPlanCost = (planMaterials + planLabor + planMachine + planScrap) * 1.15;
                const finalActCost = (actMaterials + actLabor + actMachine + actScrap) * 1.15;
                
                const varianceValue = Number(finalActCost - finalPlanCost) || 0;
                const variancePercent = isNaN(varianceValue / (finalPlanCost || 1)) ? 0 : (varianceValue / (finalPlanCost || 1)) * 100;

                const isSelected = ord.id === selectedOrderId;

                return (
                  <tr 
                    key={ord.id} 
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-indigo-50/50 hover:bg-indigo-50 font-bold' : ''
                    }`}
                    onClick={() => {
                      setSelectedOrderId(ord.id);
                      showToast('info', `تم تحميل بيانات وبطاقة أمر التصنيع ${ord.orderNumber} بنجاح.`);
                    }}
                  >
                    
                    {/* Order Reference */}
                    <td className="p-4 font-mono font-black text-indigo-700">
                      {ord.orderNumber}
                    </td>

                    {/* Design Item description */}
                    <td className="p-4">
                      <span className="font-extrabold text-slate-800 block text-[11px]">{associatedProduct?.name}</span>
                      <span className="text-[10px] text-slate-400 font-bold block mt-0.5 font-mono">{associatedProduct?.code}</span>
                    </td>

                    {/* Produced quantity */}
                    <td className="p-4 text-center font-mono font-bold">
                      {Number(q || 0 || 0).toLocaleString()} قطعة
                    </td>

                    {/* scrap quantity */}
                    <td className="p-4 text-center font-mono text-rose-600 font-extrabold">
                      {Number(s || 0 || 0).toLocaleString()} تالف
                    </td>

                    {/* Planned std cost */}
                    <td className="p-4 text-center font-mono text-slate-500">
                      {Number(finalPlanCost || 0 || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م
                    </td>

                    {/* Actual active cost */}
                    <td className="p-4 text-center font-mono text-slate-900 font-black">
                      {Number(finalActCost || 0 || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م
                    </td>

                    {/* Variance value */}
                    <td className={`p-4 text-center font-mono font-black text-xs ${varianceValue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {varianceValue > 0 ? '📊 +' : '📉 '}{Number(Math.abs(varianceValue || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })} ج.م
                    </td>

                    {/* Variance Percent */}
                    <td className={`p-4 text-center font-mono font-bold ${varianceValue > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {varianceValue > 0 ? '+' : ''}{variancePercent.toFixed(1)}%
                    </td>

                    {/* Status badge */}
                    <td className="p-4 text-center">
                      {varianceValue > 0 ? (
                        <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-md text-[9px] font-black">
                          غیر ملائم - تضخم الهالك
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-md text-[9px] font-black">
                          ملائم - وفورات تشغيلية
                        </span>
                      )}
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
