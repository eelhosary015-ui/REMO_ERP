import React from 'react';
import { Plus, Trash2, Building2, Package, Truck, Percent, Info } from 'lucide-react';
import { OverheadItem, PackagingItem, LogisticsItem } from './types';

interface OverheadAndLogisticsTabProps {
  overheads: OverheadItem[];
  onChangeOverheads: (overheads: OverheadItem[]) => void;
  packaging: PackagingItem[];
  onChangePackaging: (packaging: PackagingItem[]) => void;
  logistics: LogisticsItem[];
  onChangeLogistics: (logistics: LogisticsItem[]) => void;
  batchSize: number;
}

export const OverheadAndLogisticsTab: React.FC<OverheadAndLogisticsTabProps> = ({
  overheads,
  onChangeOverheads,
  packaging,
  onChangePackaging,
  logistics,
  onChangeLogistics,
  batchSize
}) => {
  // Overhead handlers
  const handleUpdateOverhead = (index: number, updates: Partial<OverheadItem>) => {
    const updated = [...overheads];
    updated[index] = { ...updated[index], ...updates };
    onChangeOverheads(updated);
  };

  const handleAddOverhead = () => {
    onChangeOverheads([
      ...overheads,
      {
        name: `بند تكلفة غير مباشرة ${overheads.length + 1}`,
        method: 'percentage',
        rate: 5.0
      }
    ]);
  };

  const handleDeleteOverhead = (index: number) => {
    if (overheads.length <= 1) return;
    onChangeOverheads(overheads.filter((_, i) => i !== index));
  };

  // Packaging handlers
  const handleUpdatePackaging = (index: number, updates: Partial<PackagingItem>) => {
    const updated = [...packaging];
    updated[index] = { ...updated[index], ...updates };
    onChangePackaging(updated);
  };

  const handleAddPackaging = () => {
    onChangePackaging([
      ...packaging,
      {
        name: `مادة تغليف ${packaging.length + 1}`,
        qty: batchSize,
        unit: 'علبة',
        unit_cost: 2.0
      }
    ]);
  };

  const handleDeletePackaging = (index: number) => {
    if (packaging.length <= 1) return;
    onChangePackaging(packaging.filter((_, i) => i !== index));
  };

  // Logistics handlers
  const handleUpdateLogistics = (index: number, updates: Partial<LogisticsItem>) => {
    const updated = [...logistics];
    updated[index] = { ...updated[index], ...updates };
    onChangeLogistics(updated);
  };

  const handleAddLogistics = () => {
    onChangeLogistics([
      ...logistics,
      {
        name: `بند شحن ولوجستيات ${logistics.length + 1}`,
        method: 'per_batch',
        amount: 25.0
      }
    ]);
  };

  const handleDeleteLogistics = (index: number) => {
    if (logistics.length <= 1) return;
    onChangeLogistics(logistics.filter((_, i) => i !== index));
  };

  const totalPackaging = packaging.reduce((sum, p) => sum + (p.qty * p.unit_cost), 0);
  const totalLogistics = logistics.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="space-y-6">
      
      {/* 1. Manufacturing Overhead (MOH) with Multi-Allocation Rules */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">المصاريف الصناعية غير المباشرة وطرق التوزيع (Overheads)</h3>
              <p className="text-xs font-bold text-slate-400">
                طرق التوزيع: نسبة مئوية من التكلفة الأولية، لكل وحدة منتجة، لكل ساعة، لكل دفعة، أو مبلغ ثابت
              </p>
            </div>
          </div>

          <button
            onClick={handleAddOverhead}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 flex items-center gap-1 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة بند غير مباشر</span>
          </button>
        </div>

        {/* Overhead Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {overheads.map((oh, idx) => (
            <div 
              key={idx}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-amber-200 transition space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={oh.name}
                  onChange={(e) => handleUpdateOverhead(idx, { name: e.target.value })}
                  className="font-black text-slate-800 text-xs bg-transparent border-0 focus:ring-0 p-0 flex-1"
                  placeholder="اسم البند (إيجار، كهرباء، صيانة...)"
                />
                <button
                  onClick={() => handleDeleteOverhead(idx)}
                  className="text-slate-300 hover:text-rose-600 p-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">طريقة التوزيع (Allocation)</label>
                  <select
                    value={oh.method}
                    onChange={(e) => handleUpdateOverhead(idx, { method: e.target.value as OverheadItem['method'] })}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs font-bold text-slate-700"
                  >
                    <option value="percentage">نسبة مئوية (%) من التكلفة الأولية</option>
                    <option value="per_unit">مبلغ محدد لكل وحدة منتجة</option>
                    <option value="per_batch">مبلغ ثابت للدفعة بالكامل</option>
                    <option value="per_hour">معدل لكل ساعة تشغيل/عمالة</option>
                    <option value="fixed">مبلغ ثابت إجمالي</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 block mb-1">المعدل / القيمة</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={oh.rate}
                      onChange={(e) => handleUpdateOverhead(idx, { rate: parseFloat(e.target.value) || 0 })}
                      className="w-full text-center font-bold bg-white border border-slate-200 rounded-lg p-1 text-xs"
                    />
                    <span className="text-[11px] text-slate-400 font-bold">
                      {oh.method === 'percentage' ? '%' : 'ج.م.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Packaging & Logistics (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Packaging Materials */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">مواد التعبئة والتغليف (Packaging)</h3>
                <p className="text-xs font-bold text-slate-400">العلب، الأكياس، ورق التغليف، واستيكرات الباركود</p>
              </div>
            </div>

            <button
              onClick={handleAddPackaging}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مادة تغليف</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {packaging.map((pkg, idx) => (
              <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2 text-xs">
                <input
                  type="text"
                  value={pkg.name}
                  onChange={(e) => handleUpdatePackaging(idx, { name: e.target.value })}
                  className="font-bold text-slate-800 bg-transparent border-0 flex-1 p-0 focus:ring-0"
                  placeholder="اسم مادة التغليف..."
                />
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">الكمية:</span>
                  <input
                    type="number"
                    min="1"
                    value={pkg.qty}
                    onChange={(e) => handleUpdatePackaging(idx, { qty: parseFloat(e.target.value) || 0 })}
                    className="w-14 text-center font-bold bg-white border border-slate-200 rounded p-1 text-xs"
                  />
                  <span className="text-slate-400">سعر الوحدة:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={pkg.unit_cost}
                    onChange={(e) => handleUpdatePackaging(idx, { unit_cost: parseFloat(e.target.value) || 0 })}
                    className="w-16 text-center font-bold bg-white border border-slate-200 rounded p-1 text-xs"
                  />
                  <span className="font-black text-teal-700 min-w-[70px] text-left">
                    {(pkg.qty * pkg.unit_cost).toFixed(2)} ج.م.
                  </span>
                  <button
                    onClick={() => handleDeletePackaging(idx)}
                    className="text-slate-300 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-teal-50/50 border border-teal-100 flex items-center justify-between text-xs font-bold">
            <span className="text-teal-900">إجمالي التعبئة والتغليف:</span>
            <span className="text-base font-black text-teal-700">{totalPackaging.toFixed(2)} ج.م.</span>
          </div>
        </div>

        {/* Logistics & Freight */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">النقل والشحن واللوجستيات (Logistics)</h3>
                <p className="text-xs font-bold text-slate-400">نقل المواد الخام وتوزيع المنتج التام</p>
              </div>
            </div>

            <button
              onClick={handleAddLogistics}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 flex items-center gap-1 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة شحن</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {logistics.map((lg, idx) => (
              <div key={idx} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-2 text-xs">
                <input
                  type="text"
                  value={lg.name}
                  onChange={(e) => handleUpdateLogistics(idx, { name: e.target.value })}
                  className="font-bold text-slate-800 bg-transparent border-0 flex-1 p-0 focus:ring-0"
                  placeholder="بند النقل أو التوريد..."
                />
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">التكلفة للدفعة:</span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={lg.amount}
                    onChange={(e) => handleUpdateLogistics(idx, { amount: parseFloat(e.target.value) || 0 })}
                    className="w-20 text-center font-bold bg-white border border-slate-200 rounded p-1 text-xs"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">ج.م.</span>
                  <button
                    onClick={() => handleDeleteLogistics(idx)}
                    className="text-slate-300 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-sky-50/50 border border-sky-100 flex items-center justify-between text-xs font-bold">
            <span className="text-sky-900">إجمالي النقل واللوجستيات:</span>
            <span className="text-base font-black text-sky-700">{totalLogistics.toFixed(2)} ج.م.</span>
          </div>
        </div>

      </div>

    </div>
  );
};
