import React, { useState, useEffect } from 'react';
import { 
  Layers, 
  Users, 
  Building2, 
  DollarSign, 
  Sliders, 
  GitBranch, 
  BarChart3, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { HeaderAndKPIs } from './HeaderAndKPIs';
import { ProductSelectorModal } from './ProductSelectorModal';
import { BOMMaterialsTable } from './BOMMaterialsTable';
import { LaborAndMachinesTab } from './LaborAndMachinesTab';
import { OverheadAndLogisticsTab } from './OverheadAndLogisticsTab';
import { PricingAndProfitabilityTab } from './PricingAndProfitabilityTab';
import { WhatIfSimulationTab } from './WhatIfSimulationTab';
import { VarianceAndAuditTab } from './VarianceAndAuditTab';
import { CostReportsTab } from './CostReportsTab';
import { ProductCatalogItem, ProductCostSheet, CostVersion, VarianceAnalysis, AuditLogItem } from './types';
import { api } from '../../../utils/api';

export const ProductCostingEnterprise: React.FC = () => {
  const [productsCatalog, setProductsCatalog] = useState<ProductCatalogItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number>(101);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'bom' | 'labor_machines' | 'overheads_logistics' | 'pricing' | 'what_if' | 'variance_audit' | 'reports'>('bom');

  // Active Product & Cost Sheet State
  const [productData, setProductData] = useState<any>(null);
  const [costSheet, setCostSheet] = useState<ProductCostSheet | null>(null);
  const [versions, setVersions] = useState<CostVersion[]>([]);
  const [variance, setVariance] = useState<VarianceAnalysis | null>(null);
  const [historyTimeline, setHistoryTimeline] = useState<any[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditLogItem[]>([]);
  const [availableIngredients, setAvailableIngredients] = useState<any[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Fetch Products Catalog
  const fetchCatalog = async () => {
    try {
      const res = await api.get('/api/costs/products');
      const data = await res.json();
      if (data.success && data.data) {
        setProductsCatalog(data.data);
        if (!selectedProductId && data.data.length > 0) {
          setSelectedProductId(data.data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load products catalog:', err);
    }
  };

  // 2. Fetch Raw Materials / Ingredients from Integrations
  const fetchIngredients = async () => {
    try {
      const res = await api.get('/api/costs/integrations/ingredients');
      const data = await res.json();
      if (data.success && data.data) {
        setAvailableIngredients(data.data);
      }
    } catch (err) {}
  };

  // 3. Fetch Full Product Costing Sheet
  const fetchProductCostSheet = async (id: number) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/api/costs/products/${id}`);
      const data = await res.json();
      if (data.success) {
        setProductData(data.product);
        setCostSheet(data.specs);
        setVersions(data.versions || []);
        setVariance(data.variance_analysis || null);
        setHistoryTimeline(data.history_timeline || []);
        setAuditTrail(data.audit_trail || []);
      }
    } catch (err) {
      console.error(`Failed to load product ${id} cost sheet:`, err);
      showToast('تعذر تحميل بيانات تكلفة المنتج', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
    fetchIngredients();
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      fetchProductCostSheet(selectedProductId);
    }
  }, [selectedProductId]);

  // Recalculate cost sheet via server-side engine
  const handleRecalculate = async () => {
    if (!costSheet) return;
    try {
      const res = await api.post('/api/costs/calculate', costSheet);
      const data = await res.json();
      if (data.success) {
        setCostSheet(data.data);
        showToast('تمت إعادة احتساب التكاليف بالمعادلات الدقيقة بنجاح');
      }
    } catch (err) {
      showToast('حدث خطأ أثناء احتساب التكاليف', 'error');
    }
  };

  // Save as new version
  const handleSave = async () => {
    if (!costSheet || !productData) return;
    setIsSaving(true);
    try {
      const res = await api.post('/api/costs/save', {
        product_id: productData.id,
        specs: costSheet,
        version_name: 'تحديث بطاقة التكلفة والأسعار',
        change_reason: 'تحديث هوامش الربح وأسعار المشتريات'
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'تم حفظ بطاقة التكلفة بنجاح وتحديث أسعار المنتج');
        fetchCatalog();
        fetchProductCostSheet(selectedProductId);
      } else {
        showToast(data.error || 'فشل الحفظ', 'error');
      }
    } catch (err) {
      showToast('خطأ في الاتصال بالخادم أثناء الحفظ', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Approve workflow
  const handleApprove = async () => {
    if (!productData) return;
    setIsApproving(true);
    try {
      const res = await api.post('/api/costs/approve', {
        product_id: productData.id,
        notes: 'معتمد للتطبيق في فواتير المبيعات ونقاط البيع'
      });
      const data = await res.json();
      if (data.success) {
        showToast('تم اعتماد التكلفة والأسعار رسمياً');
        fetchProductCostSheet(selectedProductId);
      }
    } catch (err) {
      showToast('خطأ أثناء الاعتماد', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Export CSV
  const handleExport = () => {
    if (!costSheet || !productData) return;
    const rows = [
      ['اسم المنتج', productData.name],
      ['كود الصنف', productData.item_code],
      ['الوحدة', productData.unit],
      ['حجم الدفعة', costSheet.batch_size],
      [''],
      ['عنصر التكلفة', 'القيمة (ج.م.)', 'النسبة من الإجمالي %'],
      ['المواد الخام', costSheet.totals.total_material_cost, costSheet.totals.breakdown_percentages.materials_pct],
      ['الهالك والفاقد', costSheet.totals.total_waste_cost, costSheet.totals.breakdown_percentages.waste_pct],
      ['أجور العمالة', costSheet.totals.total_labor_cost, costSheet.totals.breakdown_percentages.labor_pct],
      ['تشغيل الآلات', costSheet.totals.total_machine_cost, costSheet.totals.breakdown_percentages.machines_pct],
      ['المصاريف غير المباشرة', costSheet.totals.total_overhead_cost, costSheet.totals.breakdown_percentages.overhead_pct],
      ['التعبئة والتغليف', costSheet.totals.total_packaging_cost, costSheet.totals.breakdown_percentages.packaging_pct],
      ['الشحن واللوجستيات', costSheet.totals.total_logistics_cost, costSheet.totals.breakdown_percentages.logistics_pct],
      [''],
      ['إجمالي تكلفة الدفعة', costSheet.totals.total_batch_cost],
      ['تكلفة الوحدة الصافية', costSheet.totals.unit_cost],
      ['سعر البيع المعتمد', costSheet.totals.selling_price],
      ['هامش الربح %', `${costSheet.totals.actual_margin_pct}%`]
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `CostSheet_${productData.item_code}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('تم تحميل شيت التكاليف بنجاح');
  };

  // Print
  const handlePrint = () => {
    window.print();
  };

  // Apply simulated price from What-If tab
  const handleApplySimulatedPrice = (newPrice: number) => {
    if (!costSheet) return;
    const updated = {
      ...costSheet,
      selling_price: newPrice
    };
    setCostSheet(updated);
    handleRecalculate();
    showToast(`تم تطبيق سعر البيع المقترح: ${newPrice.toFixed(2)} ج.م.`);
  };

  if (isLoading && !costSheet) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-600">جاري تحميل محرك حساب التكلفة والبيانات المالية...</p>
      </div>
    );
  }

  if (!costSheet || !productData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 font-bold">
        لا توجد بيانات متاحة لهذا المنتج
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-bottom-5 duration-200 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-900 text-emerald-100 border-emerald-700' 
            : 'bg-rose-900 text-rose-100 border-rose-700'
        }`}>
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-rose-400" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & 12 Financial KPI Cards */}
      <HeaderAndKPIs
        product={productData}
        totals={costSheet.totals}
        batchSize={costSheet.batch_size}
        onRecalculate={handleRecalculate}
        onSave={handleSave}
        onApprove={handleApprove}
        onPrint={handlePrint}
        onExport={handleExport}
        onOpenSimulation={() => setActiveTab('what_if')}
        onOpenProductSelector={() => setIsSelectorOpen(true)}
        isSaving={isSaving}
        isApproving={isApproving}
      />

      {/* Product Costing Sub-Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('bom')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'bom'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>قائمة المواد الخام (BOM) والهالك</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
            activeTab === 'bom' ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
          }`}>
            {costSheet.materials.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('labor_machines')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'labor_machines'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>أجور العمالة والآلات</span>
        </button>

        <button
          onClick={() => setActiveTab('overheads_logistics')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'overheads_logistics'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>المصاريف غير المباشرة والتغليف</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'pricing'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>التسعير وهوامش الربح والتعادل</span>
        </button>

        <button
          onClick={() => setActiveTab('what_if')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'what_if'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-500" />
          <span>محاكاة What-If</span>
        </button>

        <button
          onClick={() => setActiveTab('variance_audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'variance_audit'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <GitBranch className="w-4 h-4" />
          <span>الانحرافات والإصدارات والرقابة</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center gap-2 shrink-0 ${
            activeTab === 'reports'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>التقارير وهيكل التكلفة</span>
        </button>
      </div>

      {/* Tab 1: BOM Materials & Waste */}
      {activeTab === 'bom' && (
        <BOMMaterialsTable
          materials={costSheet.materials}
          onChangeMaterials={(mats) => {
            setCostSheet({ ...costSheet, materials: mats });
            handleRecalculate();
          }}
          availableIngredients={availableIngredients}
          batchSize={costSheet.batch_size}
        />
      )}

      {/* Tab 2: Labor & Machines */}
      {activeTab === 'labor_machines' && (
        <LaborAndMachinesTab
          labor={costSheet.labor}
          onChangeLabor={(lab) => {
            setCostSheet({ ...costSheet, labor: lab });
            handleRecalculate();
          }}
          machines={costSheet.machines}
          onChangeMachines={(mch) => {
            setCostSheet({ ...costSheet, machines: mch });
            handleRecalculate();
          }}
          batchSize={costSheet.batch_size}
        />
      )}

      {/* Tab 3: Overheads, Packaging & Logistics */}
      {activeTab === 'overheads_logistics' && (
        <OverheadAndLogisticsTab
          overheads={costSheet.overheads}
          onChangeOverheads={(oh) => {
            setCostSheet({ ...costSheet, overheads: oh });
            handleRecalculate();
          }}
          packaging={costSheet.packaging}
          onChangePackaging={(pkg) => {
            setCostSheet({ ...costSheet, packaging: pkg });
            handleRecalculate();
          }}
          logistics={costSheet.logistics}
          onChangeLogistics={(lg) => {
            setCostSheet({ ...costSheet, logistics: lg });
            handleRecalculate();
          }}
          batchSize={costSheet.batch_size}
        />
      )}

      {/* Tab 4: Pricing, Margin & Break-Even */}
      {activeTab === 'pricing' && (
        <PricingAndProfitabilityTab
          batchSize={costSheet.batch_size}
          onChangeBatchSize={(bs) => {
            setCostSheet({ ...costSheet, batch_size: bs });
            handleRecalculate();
          }}
          uom={costSheet.uom}
          onChangeUom={(uom) => setCostSheet({ ...costSheet, uom })}
          targetMarginPct={costSheet.totals.target_margin_pct}
          onChangeTargetMargin={(tm) => {
            setCostSheet({ ...costSheet, target_margin_pct: tm } as any);
            handleRecalculate();
          }}
          sellingPrice={costSheet.totals.selling_price}
          onChangeSellingPrice={(sp) => {
            setCostSheet({ ...costSheet, selling_price: sp } as any);
            handleRecalculate();
          }}
          totals={costSheet.totals}
        />
      )}

      {/* Tab 5: What-If Simulation Engine */}
      {activeTab === 'what_if' && (
        <WhatIfSimulationTab
          currentSpecs={costSheet}
          onApplySimulatedPrice={handleApplySimulatedPrice}
        />
      )}

      {/* Tab 6: Variance, Versions & Audit Log */}
      {activeTab === 'variance_audit' && (
        <VarianceAndAuditTab
          versions={versions}
          variance={variance || { standard_unit_cost: 0, actual_unit_cost: 0, variance_amount: 0, variance_pct: 0, variance_type: '', breakdown: [] }}
          auditTrail={auditTrail}
          onSelectVersion={(ver) => {
            showToast(`عرض بيانات الإصدار ${ver.version}`);
          }}
        />
      )}

      {/* Tab 7: Comprehensive Cost Reports & Printing */}
      {activeTab === 'reports' && (
        <CostReportsTab
          product={productData}
          specs={costSheet}
          historyTimeline={historyTimeline}
          onPrint={handlePrint}
          onExport={handleExport}
        />
      )}

      {/* Product Selector Dialog */}
      <ProductSelectorModal
        isOpen={isSelectorOpen}
        onClose={() => setIsSelectorOpen(false)}
        products={productsCatalog}
        selectedProductId={selectedProductId}
        onSelectProduct={(id) => setSelectedProductId(id)}
        branches={['المركز الرئيسي - القاهرة', 'فرع الإسكندرية', 'فرع الجيزة']}
        warehouses={['مستودع الخامات المركزي', 'مستودع التبريد والتجميد', 'مستودع التعبئة']}
      />

    </div>
  );
};
