import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  Info, 
  History, 
  Shuffle, 
  Coins, 
  Check, 
  ArrowUpDown,
  Layers,
  Sparkles
} from 'lucide-react';
import { MaterialItem } from './types';
import { pageRows, PaginationBar, usePaginationState } from "../../PaginationBar";

interface BOMMaterialsTableProps {
  materials: MaterialItem[];
  onChangeMaterials: (materials: MaterialItem[]) => void;
  availableIngredients: any[];
  batchSize: number;
}

export const BOMMaterialsTable: React.FC<BOMMaterialsTableProps> = ({
  materials,
  onChangeMaterials,
  availableIngredients,
  batchSize
}) => {  const pgn1 = usePaginationState();

  const [activeHistoryItem, setActiveHistoryItem] = useState<MaterialItem | null>(null);

  const handleUpdateItem = (index: number, updates: Partial<MaterialItem>) => {
    const updated = [...materials];
    const item = { ...updated[index], ...updates };

    // Auto calculate actual qty and total cost
    const req = Number(item.required_qty || 0);
    const waste = Number(item.waste_pct || 0);
    const cost = Number(item.unit_cost || 0);
    const wasteQty = req * (waste / 100);
    const actualQty = req + wasteQty;

    item.waste_qty = Number(wasteQty.toFixed(4));
    item.actual_qty = Number(actualQty.toFixed(4));
    item.total_cost = Number((actualQty * cost).toFixed(2));
    item.item_waste_cost = Number((wasteQty * cost).toFixed(2));

    updated[index] = item;
    onChangeMaterials(updated);
  };

  const handleAddMaterial = () => {
    const defaultIng = availableIngredients[0] || { id: Date.now(), name: 'خامة جديدة', unit: 'كجم', cost: 10 };
    const newItem: MaterialItem = {
      ingredient_id: defaultIng.id,
      name: defaultIng.name,
      code: defaultIng.item_code || `MAT-${materials.length + 101}`,
      unit: defaultIng.unit || 'كجم',
      required_qty: 1,
      waste_pct: 3,
      waste_qty: 0.03,
      actual_qty: 1.03,
      unit_cost: Number(defaultIng.cost || 10),
      cost_source: 'last_purchase',
      total_cost: Number((1.03 * Number(defaultIng.cost || 10)).toFixed(2)),
      item_waste_cost: Number((0.03 * Number(defaultIng.cost || 10)).toFixed(2)),
      last_purchase_price: Number(defaultIng.cost || 10),
      avg_purchase_price: Number(defaultIng.cost || 10),
      min_purchase_price: Number(defaultIng.cost || 10) * 0.9,
      max_purchase_price: Number(defaultIng.cost || 10) * 1.15,
      last_purchase_date: '2026-09-01'
    };
    onChangeMaterials([...materials, newItem]);
  };

  const handleDeleteMaterial = (index: number) => {
    if (materials.length <= 1) return;
    const updated = materials.filter((_, i) => i !== index);
    onChangeMaterials(updated);
  };

  const handleApplySourceToAll = (source: MaterialItem['cost_source']) => {
    const updated = materials.map(m => {
      let cost = m.unit_cost;
      if (source === 'last_purchase' && m.last_purchase_price) cost = m.last_purchase_price;
      else if (source === 'avg_purchase' && m.avg_purchase_price) cost = m.avg_purchase_price;
      else if (source === 'standard_cost') cost = m.unit_cost;

      const req = Number(m.required_qty || 0);
      const waste = Number(m.waste_pct || 0);
      const actualQty = req * (1 + waste / 100);

      return {
        ...m,
        cost_source: source,
        unit_cost: cost,
        total_cost: Number((actualQty * cost).toFixed(2)),
        item_waste_cost: Number((req * (waste / 100) * cost).toFixed(2))
      };
    });
    onChangeMaterials(updated);
  };

  const totalRawCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  const totalWasteCost = materials.reduce((sum, m) => sum + (m.item_waste_cost || 0), 0);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      {/* Section Header & Bulk Source Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <span>قائمة المواد الخام والمكونات (Bill of Materials - BOM)</span>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
              {materials.length} خامات
            </span>
          </h3>
          <p className="text-xs font-bold text-slate-500 mt-0.5">
            تحديد الكميات المطلوبة، نسب الهالك الفعلي، ومصادر تسعير التكلفة من المشتريات والمخازن
          </p>
        </div>

        {/* Quick Cost Source Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-400">تطبيق المصدر:</span>
          <button
            onClick={() => handleApplySourceToAll('last_purchase')}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            آخر سعر شراء
          </button>
          <button
            onClick={() => handleApplySourceToAll('avg_purchase')}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            متوسط المشتريات
          </button>
          <button
            onClick={handleAddMaterial}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة خامة</span>
          </button>
        </div>
      </div>

      {/* Responsive Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-slate-600 border-y border-slate-200">
              <th className="py-3 px-3 font-black">اسم الخامة والمكون</th>
              <th className="py-3 px-2 font-black">الكود</th>
              <th className="py-3 px-2 font-black">الوحدة</th>
              <th className="py-3 px-2 font-black">الكمية المطلوبة</th>
              <th className="py-3 px-2 font-black">الهالك %</th>
              <th className="py-3 px-2 font-black">الكمية الفعلية</th>
              <th className="py-3 px-2 font-black">مصدر السعر</th>
              <th className="py-3 px-2 font-black">سعر الوحدة</th>
              <th className="py-3 px-3 font-black">تكلفة الهالك</th>
              <th className="py-3 px-3 font-black">إجمالي التكلفة</th>
              <th className="py-3 px-2 font-black text-center">سجل الأسعار</th>
              <th className="py-3 px-2 font-black text-center">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {pageRows(materials, pgn1).map((item, index) => {
              const req = Number(item.required_qty || 0);
              const wastePct = Number(item.waste_pct || 0);
              const actualQty = Number((req * (1 + wastePct / 100)).toFixed(3));
              const wasteCost = Number((req * (wastePct / 100) * Number(item.unit_cost || 0)).toFixed(2));
              const totalCost = Number((actualQty * Number(item.unit_cost || 0)).toFixed(2));

              return (
                <tr key={index} className="hover:bg-slate-50/60 transition group">
                  {/* Name & Supplier */}
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(index, { name: e.target.value })}
                      className="w-full font-bold text-slate-900 bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:ring-0 p-1 rounded hover:bg-slate-100/50"
                    />
                    {item.supplier_name && (
                      <span className="text-[10px] text-slate-400 block px-1">
                        المورد: {item.supplier_name}
                      </span>
                    )}
                  </td>

                  {/* Code */}
                  <td className="py-2.5 px-2">
                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {item.code || `M-${index + 1}`}
                    </span>
                  </td>

                  {/* Unit */}
                  <td className="py-2.5 px-2">
                    <input
                      type="text"
                      value={item.unit}
                      onChange={(e) => handleUpdateItem(index, { unit: e.target.value })}
                      className="w-16 text-center text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-1 text-xs font-bold"
                    />
                  </td>

                  {/* Required Qty */}
                  <td className="py-2.5 px-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.required_qty}
                      onChange={(e) => handleUpdateItem(index, { required_qty: parseFloat(e.target.value) || 0 })}
                      className="w-20 text-center font-black text-slate-900 bg-white border border-slate-200 rounded-lg p-1 text-xs focus:ring-1 focus:ring-indigo-500"
                    />
                  </td>

                  {/* Waste % */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={item.waste_pct}
                        onChange={(e) => handleUpdateItem(index, { waste_pct: parseFloat(e.target.value) || 0 })}
                        className={`w-14 text-center font-black rounded-lg p-1 text-xs border ${
                          wastePct > 5 ? 'border-amber-300 bg-amber-50/30 text-amber-700' : 'border-slate-200 bg-white text-slate-800'
                        }`}
                      />
                      <span className="text-slate-400 text-[11px]">%</span>
                    </div>
                  </td>

                  {/* Actual Required Qty */}
                  <td className="py-2.5 px-2">
                    <span className="font-bold text-slate-800 bg-slate-100/80 px-2 py-1 rounded-lg">
                      {actualQty}
                    </span>
                  </td>

                  {/* Cost Source Selector */}
                  <td className="py-2.5 px-2">
                    <select
                      value={item.cost_source}
                      onChange={(e) => {
                        const newSource = e.target.value as MaterialItem['cost_source'];
                        let newUnitCost = item.unit_cost;
                        if (newSource === 'last_purchase' && item.last_purchase_price) newUnitCost = item.last_purchase_price;
                        else if (newSource === 'avg_purchase' && item.avg_purchase_price) newUnitCost = item.avg_purchase_price;
                        handleUpdateItem(index, { cost_source: newSource, unit_cost: newUnitCost });
                      }}
                      className="text-[11px] font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-1 focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="last_purchase">آخر سعر شراء</option>
                      <option value="avg_purchase">متوسط المشتريات</option>
                      <option value="weighted_avg">متوسط مرجح</option>
                      <option value="standard_cost">معياري (Standard)</option>
                      <option value="contract_price">سعر العقد</option>
                      <option value="manual">سعر يدوي</option>
                    </select>
                  </td>

                  {/* Unit Cost */}
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={item.unit_cost}
                        onChange={(e) => handleUpdateItem(index, { unit_cost: parseFloat(e.target.value) || 0, cost_source: 'manual' })}
                        className="w-20 text-center font-black text-slate-900 bg-white border border-slate-200 rounded-lg p-1 text-xs focus:ring-1 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400 font-bold">ج.م.</span>
                    </div>
                  </td>

                  {/* Waste Cost */}
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded text-[11px]">
                      {wasteCost.toFixed(2)} ج.م.
                    </span>
                  </td>

                  {/* Line Total Cost */}
                  <td className="py-2.5 px-3">
                    <span className="font-black text-slate-900 text-sm">
                      {totalCost.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">ج.م.</span>
                    </span>
                  </td>

                  {/* Purchase History Inspection Button */}
                  <td className="py-2.5 px-2 text-center">
                    <button
                      onClick={() => setActiveHistoryItem(item)}
                      title="سجل أسعار الفواتير"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </td>

                  {/* Delete Item */}
                  <td className="py-2.5 px-2 text-center">
                    <button
                      onClick={() => handleDeleteMaterial(index)}
                      title="حذف الخامة"
                      className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <PaginationBar page={pgn1.page} pageSize={pgn1.pageSize} total={(materials).length} onPage={pgn1.setPage} onPageSize={pgn1.setPageSize} />
      </div>

      {/* BOM Summary Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <span className="text-slate-400">إجمالي المواد الخام للدفعة: </span>
            <strong className="text-sm font-black text-slate-900">{totalRawCost.toFixed(2)} ج.م.</strong>
          </div>
          <div>
            <span className="text-slate-400">إجمالي تكلفة الهالك المضافة: </span>
            <strong className="text-sm font-black text-rose-600">{totalWasteCost.toFixed(2)} ج.م.</strong>
          </div>
          <div>
            <span className="text-slate-400">تكلفة خامات الوحدة الواحدة: </span>
            <strong className="text-sm font-black text-indigo-700">{(totalRawCost / (batchSize || 1)).toFixed(2)} ج.م.</strong>
          </div>
        </div>

        <button
          onClick={handleAddMaterial}
          className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 transition shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>إضافة مكون جديد للـ BOM</span>
        </button>
      </div>

      {/* Modal / Dialog for Purchase History Analysis */}
      {activeHistoryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" dir="rtl">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h4 className="font-black text-slate-900 text-sm">
                  سجل أسعار فواتير الشراء: {activeHistoryItem.name}
                </h4>
              </div>
              <button 
                onClick={() => setActiveHistoryItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold block">آخر سعر شراء</span>
                  <strong className="text-base font-black text-slate-900">{activeHistoryItem.last_purchase_price != null ? Number(activeHistoryItem.last_purchase_price).toFixed(2) : '—'}</strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{activeHistoryItem.last_purchase_date || '2026-08-25'}</span>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200">
                  <span className="text-indigo-500 text-[10px] font-bold block">متوسط الشراء</span>
                  <strong className="text-base font-black text-indigo-900">{activeHistoryItem.avg_purchase_price != null ? Number(activeHistoryItem.avg_purchase_price).toFixed(2) : '—'}</strong>
                  <span className="text-[10px] text-indigo-400 block mt-0.5">آخر 5 فواتير</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-slate-400 text-[10px] font-bold block">نطاق الأسعار</span>
                  <strong className="text-xs font-black text-slate-800 block mt-1">
                    {activeHistoryItem.min_purchase_price != null ? Number(activeHistoryItem.min_purchase_price).toFixed(1) : '—'} - {activeHistoryItem.max_purchase_price != null ? Number(activeHistoryItem.max_purchase_price).toFixed(1) : '—'}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">أدنى / أقصى</span>
                </div>
              </div>

              {/* Alternative Material Available */}
              {activeHistoryItem.alternatives && activeHistoryItem.alternatives.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <span className="font-bold text-amber-800 flex items-center gap-1.5">
                    <Shuffle className="w-3.5 h-3.5 text-amber-600" />
                    خامات بديلة مسجلة في شجرة الأصناف:
                  </span>
                  {activeHistoryItem.alternatives.map((alt, idx) => (
                    <div key={idx} className="flex items-center justify-between text-slate-700 pt-1">
                      <span>{alt.name} ({alt.supplier})</span>
                      <span className="font-black text-amber-900">{alt.cost} ج.م.</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setActiveHistoryItem(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
