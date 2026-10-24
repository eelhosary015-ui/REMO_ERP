import React, { useState, useEffect } from "react";
import {
  TrendingUp, Search, RefreshCw, ShoppingCart, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, ShieldAlert, BarChart3
} from "lucide-react";

export const InventoryPlanningView: React.FC<{
  warehouses: any[];
  onNotify: (msg: string, type: "success" | "error") => void;
}> = ({ warehouses, onNotify }) => {
  const [items, setItems] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ total_items: 0, reorder_needed: 0, overstock: 0, optimal: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedWh, setSelectedWh] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const fetchPlanning = async () => {
    setLoading(true);
    try {
      let url = `/api/inventory/planning?`;
      if (selectedWh !== "all") url += `warehouse_id=${selectedWh}&`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setSummary(data.summary || {});
      }
    } catch (err) {
      onNotify("فشل تحميل بيانات تخطيط المخزون", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlanning();
  }, [selectedWh]);

  const filteredItems = items.filter(it => {
    const matchesSearch = it.item_name?.toLowerCase().includes(search.toLowerCase()) ||
                          it.item_code?.toLowerCase().includes(search.toLowerCase()) ||
                          it.category?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || it.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-violet-50 rounded-xl text-violet-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">تخطيط الاحتياجات وإعادة الطلب الذكي (ROP & Planning)</h2>
            <p className="text-xs text-slate-500">حساب نقطة إعادة الطلب، مخزون الأمان، وتوليد مقترحات الشراء التلقائية</p>
          </div>
        </div>

        <select
          value={selectedWh}
          onChange={(e) => setSelectedWh(e.target.value)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700"
        >
          <option value="all">جميع المخازن المجمعة</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block mb-1">إجمالي الأصناف المراقبة</span>
          <span className="text-2xl font-black text-slate-800">{summary.total_items}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-r-4 border-r-red-500">
          <span className="text-xs text-red-600 block mb-1 font-bold">بحاجة لإعادة طلب عاجل</span>
          <span className="text-2xl font-black text-red-600">{summary.reorder_needed}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-r-4 border-r-emerald-500">
          <span className="text-xs text-emerald-600 block mb-1 font-bold">في النطاق المثالي</span>
          <span className="text-2xl font-black text-emerald-600">{summary.optimal}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm border-r-4 border-r-amber-500">
          <span className="text-xs text-amber-600 block mb-1 font-bold">مخزون فائض (Overstock)</span>
          <span className="text-2xl font-black text-amber-600">{summary.overstock}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="بحث بالصنف، الكود، التصنيف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700"
          >
            <option value="all">جميع الحالات</option>
            <option value="reorder_required">بحاجة لإعادة طلب (Low Stock)</option>
            <option value="out_of_stock">منفد تماماً (Stockout)</option>
            <option value="optimal">مستقر ومثالي (Optimal)</option>
            <option value="overstock">فائض عن الحد الأقصى (Overstock)</option>
          </select>
        </div>

        <button
          onClick={fetchPlanning}
          className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Planning Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <th className="p-4">الصنف والكود</th>
                <th className="p-4">الرصيد المتاح</th>
                <th className="p-4">نقطة إعادة الطلب (ROP)</th>
                <th className="p-4">الاستهلاك اليومي</th>
                <th className="p-4">أيام التغطية</th>
                <th className="p-4">الكمية المقترح شراؤها</th>
                <th className="p-4">التكلفة التقديرية</th>
                <th className="p-4">الحالة والتوصية</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    لا توجد بيانات مطابقة لمعايير البحث.
                  </td>
                </tr>
              ) : (
                filteredItems.map((it: any, itIdx: number) => (
                  <tr key={`inv-plan-${it.ingredient_id ?? it.id ?? itIdx}-${itIdx}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-slate-900 block">{it.item_name}</span>
                      <span className="text-xs text-slate-400 font-mono">{it.item_code} | {it.category || "عام"}</span>
                    </td>
                    <td className="p-4 font-mono font-bold">
                      <span className={it.available_stock <= 0 ? "text-red-600" : "text-slate-800"}>
                        {Number(it.available_stock).toLocaleString()} {it.unit || ""}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-700 text-xs">
                      {Number(it.calculated_rop).toLocaleString()} {it.unit || ""}
                    </td>
                    <td className="p-4 font-mono text-slate-600 text-xs">
                      {Math.round(Number(it.avg_daily_usage) * 10) / 10} / يوم
                    </td>
                    <td className="p-4 font-mono text-xs">
                      {it.days_of_supply <= 5 ? (
                        <span className="text-red-600 font-bold">{it.days_of_supply} يوم ⚠️</span>
                      ) : it.days_of_supply <= 15 ? (
                        <span className="text-amber-600 font-bold">{it.days_of_supply} يوم</span>
                      ) : (
                        <span className="text-slate-600">{it.days_of_supply > 365 ? "> سنة" : `${it.days_of_supply} يوم`}</span>
                      )}
                    </td>
                    <td className="p-4 font-mono font-bold text-violet-700">
                      {it.suggested_order_qty > 0 ? (
                        <span className="bg-violet-50 px-2.5 py-1 rounded-lg">
                          +{Number(it.suggested_order_qty).toLocaleString()} {it.unit || ""}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-700">
                      {it.estimated_order_cost > 0 ? `${Number(it.estimated_order_cost).toLocaleString()} ج.م` : "-"}
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        it.status === 'out_of_stock' ? 'bg-red-100 text-red-800' :
                        it.status === 'reorder_required' ? 'bg-amber-100 text-amber-800' :
                        it.status === 'overstock' ? 'bg-blue-100 text-blue-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {it.status === 'out_of_stock' ? 'منفد تماماً' :
                         it.status === 'reorder_required' ? 'إعادة طلب مطلوبة' :
                         it.status === 'overstock' ? 'فائض' : 'مثالي'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
