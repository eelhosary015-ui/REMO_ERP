import React from 'react';
import { 
  PieChart, 
  TrendingUp, 
  BarChart3, 
  Printer, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { CostingTotals, ProductCostSheet } from './types';
import { pageRows, PaginationBar, usePaginationState } from "../../PaginationBar";

interface CostReportsTabProps {
  product: {
    id: number;
    name: string;
    item_code: string;
    category_name: string;
    unit: string;
  };
  specs: ProductCostSheet;
  historyTimeline: { date: string; cost: number; price: number; margin: number }[];
  onPrint: () => void;
  onExport: () => void;
}

export const CostReportsTab: React.FC<CostReportsTabProps> = ({
  product,
  specs,
  historyTimeline,
  onPrint,
  onExport
}) => {  const pgn1 = usePaginationState();

  const t = specs.totals;
  const bp = t.breakdown_percentages;

  const breakdownItems = [
    { label: 'المواد الخام المباشرة (BOM)', amount: t.total_material_cost, pct: bp.materials_pct, color: 'bg-indigo-500' },
    { label: 'أجور العمالة المباشرة (Labor)', amount: t.total_labor_cost, pct: bp.labor_pct, color: 'bg-blue-500' },
    { label: 'المعدات وتكاليف التشغيل (Machines)', amount: t.total_machine_cost, pct: bp.machines_pct, color: 'bg-purple-500' },
    { label: 'المصاريف الصناعية غير المباشرة (MOH)', amount: t.total_overhead_cost, pct: bp.overhead_pct, color: 'bg-amber-500' },
    { label: 'مواد التعبئة والتغليف (Packaging)', amount: t.total_packaging_cost, pct: bp.packaging_pct, color: 'bg-teal-500' },
    { label: 'الشحن واللوجستيات (Logistics)', amount: t.total_logistics_cost, pct: bp.logistics_pct, color: 'bg-sky-500' }
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Action Ribbon for Reports */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span>التقارير التحليلية وهيكل التكلفة: {product.name}</span>
          </h3>
          <p className="text-xs font-bold text-slate-400">ملخص تفصيلي شامل لعناصر التكلفة، الهوامش، والتطور التاريخي</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير تقرير Excel</span>
          </button>
          <button
            onClick={onPrint}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة بطاقة التكلفة الرسمية</span>
          </button>
        </div>
      </div>

      {/* Cost Structure Breakdown Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Component Contribution Bars */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h4 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-indigo-600" />
            <span>هيكل توزيع عناصر التكلفة (Cost Structure Breakdown)</span>
          </h4>

          {/* Unified Visual Progress Bar */}
          <div className="w-full h-5 rounded-xl overflow-hidden flex shadow-inner bg-slate-100">
            {breakdownItems.map((item, idx) => (
              <div
                key={idx}
                style={{ width: `${Math.max(2, item.pct)}%` }}
                className={`${item.color} transition-all relative group`}
                title={`${item.label}: ${item.pct}%`}
              />
            ))}
          </div>

          {/* Breakdown Items Detail List */}
          <div className="space-y-3 pt-2">
            {breakdownItems.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-md ${item.color}`} />
                  <span className="text-slate-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-mono">{item.amount.toFixed(2)} ج.م.</span>
                  <span className="w-12 text-left font-black text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">
                    {item.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Waste & Profitability Analysis Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <h4 className="text-sm font-black text-slate-900 pb-2 border-b border-slate-100 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>كفاءة التكلفة والفاقد التشغيلي</span>
          </h4>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500">الهالك والفاقد المضاف:</span>
              <span className="text-rose-600 font-black">{t.total_waste_cost.toFixed(2)} ج.م. ({bp.waste_pct}%)</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500">التكلفة الأولية المباشرة (Prime Cost):</span>
              <span className="text-slate-900 font-black">{(t.total_material_cost + t.total_labor_cost).toFixed(2)} ج.م.</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="text-slate-500">تكلفة التحويل (Conversion Cost):</span>
              <span className="text-slate-900 font-black">{(t.total_labor_cost + t.total_machine_cost + t.total_overhead_cost).toFixed(2)} ج.م.</span>
            </div>
          </div>

          {/* Historical Trend Timeline */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-bold text-slate-700 block">التطور الزمني لتكلفة الوحدة وهوامش الربح:</span>
            <div className="space-y-1.5">
              {historyTimeline.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs font-bold">
                  <span className="text-slate-500 font-mono">{item.date}</span>
                  <div className="flex items-center gap-4">
                    <span>التكلفة: <strong className="text-slate-800">{item.cost.toFixed(2)}</strong></span>
                    <span>السعر: <strong className="text-emerald-600">{item.price.toFixed(2)}</strong></span>
                    <span className="text-indigo-600 font-black">{item.margin.toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Printable Sheet Layout Preview (Off-screen or styled clean printable view) */}
      <div id="costing-printable-sheet" className="hidden print:block p-8 bg-white text-slate-900 text-xs space-y-6">
        <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black">بطاقة التكلفة القياسية للمنتج (Cost Sheet)</h1>
            <p className="font-bold text-slate-600">نظام إدارة التكاليف الصناعية والتشغيلية المعتمد</p>
          </div>
          <div className="text-left font-mono">
            <div>التاريخ: {new Date().toLocaleDateString('ar-EG')}</div>
            <div>رقم الصنف: {product.item_code}</div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 p-4 border border-slate-300 rounded font-bold">
          <div>اسم المنتج: <span className="font-black">{product.name}</span></div>
          <div>التصنيف: <span>{product.category_name}</span></div>
          <div>حجم الدفعة: <span>{specs.batch_size} {product.unit}</span></div>
          <div>تكلفة الوحدة: <span className="font-black text-indigo-800">{t.unit_cost.toFixed(2)} ج.م.</span></div>
        </div>

        <div>
          <h3 className="font-black text-sm mb-2">1. تفاصيل المواد الخام (BOM):</h3>
          <table className="w-full border-collapse border border-slate-300 text-right">
            <thead>
              <tr className="bg-slate-100 font-bold border-b border-slate-300">
                <th className="p-2 border-l border-slate-300">الخامة</th>
                <th className="p-2 border-l border-slate-300">الكمية</th>
                <th className="p-2 border-l border-slate-300">الهالك %</th>
                <th className="p-2 border-l border-slate-300">السعر</th>
                <th className="p-2">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {pageRows(specs.materials, pgn1).map((m, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-2 border-l border-slate-300">{m.name}</td>
                  <td className="p-2 border-l border-slate-300">{m.actual_qty} {m.unit}</td>
                  <td className="p-2 border-l border-slate-300">{m.waste_pct}%</td>
                  <td className="p-2 border-l border-slate-300">{Number(m.unit_cost || 0).toFixed(2)}</td>
                  <td className="p-2 font-black">{Number(m.total_cost || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <PaginationBar page={pgn1.page} pageSize={pgn1.pageSize} total={(specs.materials).length} onPage={pgn1.setPage} onPageSize={pgn1.setPageSize} />
        </div>

        <div className="flex justify-between p-4 border border-slate-900 rounded font-black text-sm">
          <span>إجمالي تكلفة الدفعة: {Number(t.total_batch_cost || 0).toFixed(2)} ج.م.</span>
          <span>تكلفة الوحدة: {Number(t.unit_cost || 0).toFixed(2)} ج.م.</span>
          <span>سعر البيع المعتمد: {Number(t.selling_price || 0).toFixed(2)} ج.م.</span>
          <span>هامش الربح: {t.actual_margin_pct}%</span>
        </div>

        <div className="pt-8 flex justify-between text-center font-bold">
          <div>أخصائي التكاليف: .........................</div>
          <div>المدير المالي: .........................</div>
          <div>الاعتماد العام: .........................</div>
        </div>
      </div>

    </div>
  );
};
