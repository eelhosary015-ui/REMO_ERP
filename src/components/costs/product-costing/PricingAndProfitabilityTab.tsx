import React from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  Percent, 
  Sliders, 
  Scale, 
  Layers, 
  Receipt,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { CostingTotals } from './types';

interface PricingAndProfitabilityTabProps {
  batchSize: number;
  onChangeBatchSize: (size: number) => void;
  uom: string;
  onChangeUom: (uom: string) => void;
  targetMarginPct: number;
  onChangeTargetMargin: (margin: number) => void;
  sellingPrice: number;
  onChangeSellingPrice: (price: number) => void;
  totals: CostingTotals;
}

export const PricingAndProfitabilityTab: React.FC<PricingAndProfitabilityTabProps> = ({
  batchSize,
  onChangeBatchSize,
  uom,
  onChangeUom,
  targetMarginPct,
  onChangeTargetMargin,
  sellingPrice,
  onChangeSellingPrice,
  totals
}) => {
  const vatRate = 0.14; // 14% VAT
  const vatAmount = totals.selling_price * vatRate;
  const priceWithVat = totals.selling_price + vatAmount;

  return (
    <div className="space-y-6">
      
      {/* Batch & Production Order Sizing Configuration */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">إعدادات حجم الدفعة وأمر الإنتاج (Batch Sizing)</h3>
            <p className="text-xs font-bold text-slate-400">توزيع التكاليف الثابتة على عدد وحدات الدفعة الصناعية</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">حجم دفعة الإنتاج (Batch Size)</label>
            <input
              type="number"
              min="1"
              value={batchSize}
              onChange={(e) => onChangeBatchSize(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full font-black text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">وحدة القياس (UOM)</label>
            <input
              type="text"
              value={uom}
              onChange={(e) => onChangeUom(e.target.value)}
              className="w-full font-bold text-slate-900 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="قطعة، وجبة، كجم، علبة..."
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 block">إجمالي تكلفة الدفعة</span>
            <strong className="text-lg font-black text-slate-900">{totals.total_batch_cost.toFixed(2)} ج.م.</strong>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200">
            <span className="text-[10px] font-bold text-indigo-500 block">تكلفة الوحدة الصافية</span>
            <strong className="text-lg font-black text-indigo-700">{totals.unit_cost.toFixed(2)} ج.م.</strong>
          </div>
        </div>
      </div>

      {/* Pricing and Target Margin Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Margin & Price Sliders */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">محرك التسعير المستهدف وهامش الربحية</h3>
              <p className="text-xs font-bold text-slate-400">تحديد هامش الربح المستهدف لحساب سعر البيع المقترح بدقة</p>
            </div>
          </div>

          {/* Target Margin Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold">
              <label className="text-slate-700 flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-600" />
                <span>هامش الربح المستهدف (Target Margin %):</span>
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="0.5"
                  value={targetMarginPct}
                  onChange={(e) => onChangeTargetMargin(parseFloat(e.target.value) || 0)}
                  className="w-16 text-center font-black text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg p-1 text-sm"
                />
                <span className="text-indigo-600 font-black">%</span>
              </div>
            </div>

            <input
              type="range"
              min="5"
              max="75"
              step="1"
              value={targetMarginPct}
              onChange={(e) => onChangeTargetMargin(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-bold text-slate-400">
              <span>أدنى (5%)</span>
              <span>متوسط تنافسي (30% - 40%)</span>
              <span>فاخر / عالي الربح (75%)</span>
            </div>
          </div>

          {/* Recommended vs Actual Selling Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                سعر البيع المقترح طبقاً للهدف:
              </span>
              <div className="text-xl font-black text-indigo-700">
                {totals.recommended_selling_price.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
              </div>
              <button
                onClick={() => onChangeSellingPrice(totals.recommended_selling_price)}
                className="mt-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>اعتماد السعر المقترح</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                سعر البيع الفعلي المعتمد:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => onChangeSellingPrice(parseFloat(e.target.value) || 0)}
                  className="w-full font-black text-emerald-700 bg-white border-2 border-emerald-400 rounded-xl px-3 py-1.5 text-base focus:ring-2 focus:ring-emerald-400/20"
                />
                <span className="text-xs font-bold text-slate-400">ج.م.</span>
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mt-1">
                شامل هامش ربح {totals.actual_margin_pct}%
              </span>
            </div>
          </div>

          {/* Tax & VAT Impact Preview */}
          <div className="p-3.5 rounded-xl bg-slate-100/70 border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-slate-500" />
              <span>ضريبة القيمة المضافة (14% VAT):</span>
            </div>
            <div className="text-right">
              <span>{vatAmount.toFixed(2)} ج.م.</span>
              <span className="text-slate-400 block text-[10px]">
                السعر النهائي للمستهلك: <strong>{priceWithVat.toFixed(2)} ج.م.</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Profitability Metrics & Break-Even */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">مؤشرات الربحية والتعادل</h3>
              <p className="text-xs font-bold text-slate-400">تحليل الأثر المالي وهامش المساهمة</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Metric 1: Profit Per Unit */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">مجمل الربح للوحدة</span>
                <span className="text-[10px] text-slate-400 font-medium">سعر البيع - تكلفة الوحدة</span>
              </div>
              <span className="text-base font-black text-emerald-600">
                +{totals.profit_per_unit.toFixed(2)} ج.م.
              </span>
            </div>

            {/* Metric 2: Total Batch Gross Profit */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">مجمل ربح الدفعة بالكامل</span>
                <span className="text-[10px] text-slate-400 font-medium">{batchSize} × {totals.profit_per_unit.toFixed(2)}</span>
              </div>
              <span className="text-base font-black text-emerald-600">
                +{totals.total_gross_profit.toFixed(2)} ج.م.
              </span>
            </div>

            {/* Metric 3: Markup % */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 block">نسبة الإضافة على التكلفة (Markup %)</span>
                <span className="text-[10px] text-slate-400 font-medium">(الربح ÷ التكلفة) × 100</span>
              </div>
              <span className="text-base font-black text-indigo-600">
                {totals.markup_pct.toFixed(1)}%
              </span>
            </div>

            {/* Metric 4: Break-Even Units */}
            <div className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-900 block">حجم مبيعات التعادل (Break-Even)</span>
                <span className="text-[10px] text-indigo-500 font-medium">لتغطية المصاريف الثابتة بالكامل</span>
              </div>
              <span className="text-base font-black text-indigo-700">
                {totals.break_even_units} {uom}
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
