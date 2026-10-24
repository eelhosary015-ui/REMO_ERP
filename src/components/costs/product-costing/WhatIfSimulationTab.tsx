import React, { useState } from 'react';
import { 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { ProductCostSheet } from './types';
import { api } from '../../../utils/api';

interface WhatIfSimulationTabProps {
  currentSpecs: ProductCostSheet;
  onApplySimulatedPrice: (newPrice: number) => void;
}

export const WhatIfSimulationTab: React.FC<WhatIfSimulationTabProps> = ({
  currentSpecs,
  onApplySimulatedPrice
}) => {
  const [scenario, setScenario] = useState({
    name: 'تضخم وتقلبات الأسعار',
    material_pct: 15,
    labor_pct: 10,
    waste_pct: 3,
    overhead_pct: 10,
    logistics_pct: 12
  });

  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRunSimulation = async (customScenario = scenario) => {
    setIsLoading(true);
    try {
      const res = await api.post('/api/costs/simulate', {
        base_specs: currentSpecs,
        scenario: customScenario
      });
      const data = await res.json();
      if (data.success) {
        setSimulationResult(data.simulation);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run on first render if empty
  React.useEffect(() => {
    handleRunSimulation();
  }, [currentSpecs]);

  const applyPreset = (preset: { name: string; material_pct: number; labor_pct: number; waste_pct: number; overhead_pct: number; logistics_pct: number }) => {
    setScenario(preset);
    handleRunSimulation(preset);
  };

  const comp = simulationResult?.comparison;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">
      
      {/* Header & Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">محاكي سيناريوهات ماذا لو (What-If Analysis Engine)</h3>
            <p className="text-xs font-bold text-slate-400">
              اختبار حساسية التكلفة والربحية عند حدوث تقلبات في أسعار الخامات، أجور العمالة، ونسب الهالك
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-400">سيناريوهات جاهزة:</span>
          <button
            onClick={() => applyPreset({ name: 'تضخم خامات حاد', material_pct: 25, labor_pct: 5, waste_pct: 2, overhead_pct: 10, logistics_pct: 15 })}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition"
          >
            تضخم خامات (+25%)
          </button>
          <button
            onClick={() => applyPreset({ name: 'زيادة أجور ومرافق', material_pct: 5, labor_pct: 20, waste_pct: 0, overhead_pct: 15, logistics_pct: 5 })}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
          >
            زيادة أجور (+20%)
          </button>
          <button
            onClick={() => applyPreset({ name: 'إعادة ضبط', material_pct: 0, labor_pct: 0, waste_pct: 0, overhead_pct: 0, logistics_pct: 0 })}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>إعادة ضبط</span>
          </button>
        </div>
      </div>

      {/* Interactive Controls & Live Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        
        {/* Factor 1: Raw Materials */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700">أسعار المواد الخام:</span>
            <span className="text-indigo-600">{scenario.material_pct > 0 ? `+${scenario.material_pct}` : scenario.material_pct}%</span>
          </div>
          <input
            type="range"
            min="-30"
            max="60"
            step="1"
            value={scenario.material_pct}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const updated = { ...scenario, material_pct: val };
              setScenario(updated);
              handleRunSimulation(updated);
            }}
            className="w-full accent-indigo-600"
          />
        </div>

        {/* Factor 2: Direct Labor */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700">أجور العمالة:</span>
            <span className="text-blue-600">{scenario.labor_pct > 0 ? `+${scenario.labor_pct}` : scenario.labor_pct}%</span>
          </div>
          <input
            type="range"
            min="-20"
            max="50"
            step="1"
            value={scenario.labor_pct}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const updated = { ...scenario, labor_pct: val };
              setScenario(updated);
              handleRunSimulation(updated);
            }}
            className="w-full accent-blue-600"
          />
        </div>

        {/* Factor 3: Waste & Scrap Increase */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700">زيادة نسبة الهالك:</span>
            <span className="text-rose-600">+{scenario.waste_pct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={scenario.waste_pct}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              const updated = { ...scenario, waste_pct: val };
              setScenario(updated);
              handleRunSimulation(updated);
            }}
            className="w-full accent-rose-600"
          />
        </div>

        {/* Factor 4: Overheads */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700">المصاريف غير المباشرة:</span>
            <span className="text-amber-600">{scenario.overhead_pct > 0 ? `+${scenario.overhead_pct}` : scenario.overhead_pct}%</span>
          </div>
          <input
            type="range"
            min="-20"
            max="50"
            step="1"
            value={scenario.overhead_pct}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const updated = { ...scenario, overhead_pct: val };
              setScenario(updated);
              handleRunSimulation(updated);
            }}
            className="w-full accent-amber-600"
          />
        </div>

        {/* Factor 5: Logistics */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-700">الشحن واللوجستيات:</span>
            <span className="text-teal-600">{scenario.logistics_pct > 0 ? `+${scenario.logistics_pct}` : scenario.logistics_pct}%</span>
          </div>
          <input
            type="range"
            min="-20"
            max="60"
            step="1"
            value={scenario.logistics_pct}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const updated = { ...scenario, logistics_pct: val };
              setScenario(updated);
              handleRunSimulation(updated);
            }}
            className="w-full accent-teal-600"
          />
        </div>
      </div>

      {/* Comparison Results Card */}
      {comp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Box 1: Cost Change */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">تكلفة الوحدة (الحالية مقابل المحاكاة)</span>
              {comp.cost_diff > 0 ? (
                <span className="text-xs font-black text-rose-600 flex items-center gap-0.5 bg-rose-50 px-2 py-0.5 rounded-md">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{comp.cost_diff.toFixed(2)} ({comp.cost_diff_pct}%)
                </span>
              ) : (
                <span className="text-xs font-black text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-md">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {comp.cost_diff.toFixed(2)} ({comp.cost_diff_pct}%)
                </span>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{comp.new_unit_cost.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-400 line-through">{comp.old_unit_cost.toFixed(2)} ج.م.</span>
            </div>
            <p className="text-[11px] text-slate-400 font-bold">
              فارق التكلفة التقديري: {comp.cost_diff > 0 ? 'زيادة' : 'وفر'} قدره {Math.abs(comp.cost_diff).toFixed(2)} ج.م. للوحدة
            </p>
          </div>

          {/* Box 2: Margin Impact */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">هامش الربح (إذا ثبت سعر البيع)</span>
              <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                comp.new_margin_pct < 15 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
              }`}>
                {comp.margin_diff_pct}% تغير
              </span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${comp.new_margin_pct < 15 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {comp.new_margin_pct.toFixed(1)}%
              </span>
              <span className="text-xs font-bold text-slate-400">كان: {comp.old_margin_pct.toFixed(1)}%</span>
            </div>
            <p className="text-[11px] text-slate-400 font-bold">
              {comp.new_margin_pct < 15 ? 'تحذير: هامش الربح سينخفض إلى مستوى حرج' : 'هامش الربح لا يزال في النطاق الآمن'}
            </p>
          </div>

          {/* Box 3: Target Price to Maintain Margin */}
          <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/30 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900">سعر البيع المطلوب للحفاظ على الهامش</span>
              <span className="text-xs font-bold text-indigo-600">هدف {comp.old_margin_pct.toFixed(0)}%</span>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-700">
                {comp.target_price_to_maintain_margin.toFixed(2)} <span className="text-xs font-bold text-slate-400">ج.م.</span>
              </span>
              <span className="text-xs font-bold text-slate-400">الحالي: {comp.current_selling_price.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-bold text-slate-500">
                الزيادة المطلوبة: +{comp.required_price_increase.toFixed(2)} ج.م.
              </span>
              <button
                onClick={() => onApplySimulatedPrice(comp.target_price_to_maintain_margin)}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-xs"
              >
                <span>تطبيق السعر</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
