import React from 'react';
import { 
  Calculator, 
  Save, 
  CheckCircle2, 
  Printer, 
  FileSpreadsheet, 
  RefreshCw, 
  Sliders, 
  TrendingUp, 
  Coins, 
  Layers, 
  Users, 
  Cpu, 
  Building2, 
  Package, 
  Truck, 
  Trash2, 
  Target, 
  DollarSign,
  ChevronDown
} from 'lucide-react';
import { CostingTotals } from './types';

interface HeaderAndKPIsProps {
  product: {
    id: number;
    name: string;
    item_code: string;
    barcode: string;
    category_name: string;
    unit: string;
    branch: string;
    warehouse: string;
    last_updated: string;
    status: string;
  };
  totals: CostingTotals;
  batchSize: number;
  onRecalculate: () => void;
  onSave: () => void;
  onApprove: () => void;
  onPrint: () => void;
  onExport: () => void;
  onOpenSimulation: () => void;
  onOpenProductSelector: () => void;
  isSaving: boolean;
  isApproving: boolean;
}

export const HeaderAndKPIs: React.FC<HeaderAndKPIsProps> = ({
  product,
  totals,
  batchSize,
  onRecalculate,
  onSave,
  onApprove,
  onPrint,
  onExport,
  onOpenSimulation,
  onOpenProductSelector,
  isSaving,
  isApproving
}) => {
  const isHealthyMargin = totals.actual_margin_pct >= 20;

  return (
    <div className="space-y-4">
      {/* Top Banner & Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Product Identification & Selector Button */}
          <div className="flex items-start gap-3">
            <button 
              onClick={onOpenProductSelector}
              className="p-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 transition flex items-center gap-2 group text-right"
              title="تغيير المنتج"
            >
              <Calculator className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
              <ChevronDown className="w-4 h-4 text-indigo-500" />
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-slate-900">{product.name}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {product.item_code}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {product.category_name}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black flex items-center gap-1 ${
                  product.status === 'معتمد' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {product.status}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-500 mt-1.5 flex-wrap">
                <span>الباركود: <strong className="text-slate-700">{product.barcode}</strong></span>
                <span>الفرع: <strong className="text-slate-700">{product.branch}</strong></span>
                <span>المستودع: <strong className="text-slate-700">{product.warehouse}</strong></span>
                <span>الوحدة: <strong className="text-slate-700">{product.unit}</strong></span>
                <span>آخر تحديث: <strong className="text-slate-700">{product.last_updated}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center flex-wrap gap-2">
            <button
              onClick={onRecalculate}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition active:scale-95"
              title="إعادة احتساب التكاليف بالمعادلات الدقيقة"
            >
              <RefreshCw className="w-4 h-4 text-slate-600" />
              <span>إعادة احتساب</span>
            </button>

            <button
              onClick={onOpenSimulation}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1.5 transition active:scale-95"
              title="محاكاة ماذا لو What-If"
            >
              <Sliders className="w-4 h-4 text-amber-600" />
              <span>محاكاة What-If</span>
            </button>

            <button
              onClick={onApprove}
              disabled={isApproving}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isApproving ? 'جاري الاعتماد...' : 'اعتماد التكلفة'}</span>
            </button>

            <button
              onClick={onSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'جاري الحفظ...' : 'حفظ كنسخة جديدة'}</span>
            </button>

            <div className="h-6 w-px bg-slate-200 mx-0.5 hidden sm:block"></div>

            <button
              onClick={onExport}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
              title="تصدير شيت إكسل"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </button>

            <button
              onClick={onPrint}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition"
              title="طباعة بطاقة التكلفة"
            >
              <Printer className="w-4 h-4 text-slate-600" />
            </button>
          </div>
        </div>
      </div>

      {/* 12 Enterprise KPI Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Card 1: Unit Cost */}
        <div className="bg-white p-3.5 rounded-2xl border-2 border-indigo-500 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-indigo-600 mb-1">
            <span className="text-[11px] font-black">تكلفة الوحدة (Unit Cost)</span>
            <Coins className="w-4 h-4" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {totals.unit_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            لكل {product.unit} (دفعة {batchSize})
          </p>
        </div>

        {/* Card 2: Total Batch Cost */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">إجمالي تكلفة الدفعة</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-black text-slate-800">
            {totals.total_batch_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            إجمالي {batchSize} {product.unit}
          </p>
        </div>

        {/* Card 3: Selling Price */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-[11px] font-bold">سعر البيع الحالي</span>
            <DollarSign className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-emerald-700">
            {totals.selling_price.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            الموصى به: {totals.recommended_selling_price.toFixed(2)} ج.م.
          </p>
        </div>

        {/* Card 4: Profit Margin % */}
        <div className={`bg-white p-3.5 rounded-2xl border ${isHealthyMargin ? 'border-emerald-300 bg-emerald-50/20' : 'border-rose-300 bg-rose-50/20'} shadow-sm`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-600">هامش الربح %</span>
            <TrendingUp className={`w-4 h-4 ${isHealthyMargin ? 'text-emerald-500' : 'text-rose-500'}`} />
          </div>
          <div className={`text-xl font-black ${isHealthyMargin ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totals.actual_margin_pct.toFixed(1)}%
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            الهدف: {totals.target_margin_pct}% | مجمل: {totals.profit_per_unit.toFixed(2)} ج.م.
          </p>
        </div>

        {/* Card 5: Raw Materials Cost */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">المواد الخام (BOM)</span>
            <span className="text-xs">🌾</span>
          </div>
          <div className="text-lg font-black text-slate-800">
            {totals.total_material_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {totals.breakdown_percentages.materials_pct}% من التكلفة
          </p>
        </div>

        {/* Card 6: Direct Labor */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">أجور العمالة المباشرة</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-black text-slate-800">
            {totals.total_labor_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {totals.breakdown_percentages.labor_pct}% من التكلفة
          </p>
        </div>

        {/* Card 7: Machine Costs */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">المعدات والتشغيل</span>
            <Cpu className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-black text-slate-800">
            {totals.total_machine_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {totals.breakdown_percentages.machines_pct}% من التكلفة
          </p>
        </div>

        {/* Card 8: Manufacturing Overhead */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">المصاريف غير المباشرة</span>
            <Building2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-black text-slate-800">
            {totals.total_overhead_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {totals.breakdown_percentages.overhead_pct}% من التكلفة
          </p>
        </div>

        {/* Card 9: Packaging */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">التعبئة والتغليف</span>
            <Package className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-lg font-black text-slate-800">
            {totals.total_packaging_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {totals.breakdown_percentages.packaging_pct}% من التكلفة
          </p>
        </div>

        {/* Card 10: Logistics */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">النقل واللوجستيات</span>
            <Truck className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-lg font-black text-slate-800">
            {totals.total_logistics_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {totals.breakdown_percentages.logistics_pct}% من التكلفة
          </p>
        </div>

        {/* Card 11: Waste & Scrap Cost */}
        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-sm">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-[11px] font-bold">الهالك والفاقد المضاف</span>
            <Trash2 className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-lg font-black text-rose-700">
            {totals.total_waste_cost.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            {totals.breakdown_percentages.waste_pct}% من إجمالي التكلفة
          </p>
        </div>

        {/* Card 12: Break-Even Volume */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-[11px] font-bold">نقطة التعادل (Break-Even)</span>
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-black text-slate-800">
            {totals.break_even_units} <span className="text-xs font-bold text-slate-400">{product.unit}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            لتغطية المصاريف الثابتة
          </p>
        </div>
      </div>
    </div>
  );
};
