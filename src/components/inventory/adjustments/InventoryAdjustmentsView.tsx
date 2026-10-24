import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, RefreshCw, FileText, CheckCircle2, AlertTriangle, ArrowRightLeft, Clock, Eye, Trash2, X } from 'lucide-react';
import { api } from '../../../utils/api';
import AdjustmentCreateModal from './AdjustmentCreateModal';

export default function InventoryAdjustmentsView({ onNotify }: { onNotify: (msg: string, type?: 'success'|'error') => void }) {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [warehouses, setWarehouses] = useState<any[]>([]);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAdjId, setSelectedAdjId] = useState<number | null>(null);

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/api/warehouses');
      if (res.ok) {
        const data = await res.json();
        setWarehouses(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (warehouseId) params.append("warehouse_id", warehouseId);
      if (type) params.append("type", type);
      if (status) params.append("status", status);
      if (dateFrom) params.append("date_from", dateFrom);
      if (dateTo) params.append("date_to", dateTo);

      const res = await api.get(`/api/inventory-adjustments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAdjustments(data);
      }
    } catch (err) {
      console.error(err);
      onNotify("فشل تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
    fetchAdjustments();
  }, []);

  const resetFilters = () => {
    setSearch("");
    setWarehouseId("");
    setType("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setTimeout(fetchAdjustments, 100);
  };

  // KPI Calculations
  const totalCount = adjustments.length;
  const totalShortage = adjustments.filter(a => a.type === 'shortage').reduce((sum, a) => sum + Number(a.total_value || 0), 0);
  const totalSurplus = adjustments.filter(a => a.type === 'surplus').reduce((sum, a) => sum + Number(a.total_value || 0), 0);
  const pendingCount = adjustments.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6 text-right" dir="rtl" id="inventory-adjustments-view">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card border border-border p-5 rounded-2xl shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-md">
            <ArrowRightLeft className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">
              التسويات الجردية (Inventory Adjustments)
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              إدارة تسويات المخزون، العجز والزيادة، واعتماد التعديلات
            </p>
          </div>
        </div>

        <button
          onClick={() => { setSelectedAdjId(null); setShowCreateModal(true); }}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold shadow-md transition-all hover:scale-[1.02] shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>تسوية جديدة</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-muted-foreground">إجمالي تسويات الشهر</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg"><FileText className="w-4 h-4" /></div>
          </div>
          <span className="text-2xl font-black">{totalCount}</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-muted-foreground">إجمالي قيمة العجز</span>
            <div className="p-2 bg-red-500/10 text-red-600 rounded-lg"><AlertTriangle className="w-4 h-4" /></div>
          </div>
          <span className="text-2xl font-black text-red-600">{totalShortage.toLocaleString()} ر.س</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-muted-foreground">إجمالي قيمة الزيادة</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg"><CheckCircle2 className="w-4 h-4" /></div>
          </div>
          <span className="text-2xl font-black text-emerald-600">{totalSurplus.toLocaleString()} ر.س</span>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-muted-foreground">بانتظار الاعتماد</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg"><Clock className="w-4 h-4" /></div>
          </div>
          <span className="text-2xl font-black text-amber-600">{pendingCount}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="بحث برقم التسوية، الملاحظات..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-3 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
        
        <select value={warehouseId ?? ""} onChange={e => setWarehouseId(e.target.value)} className="min-w-[150px] py-2.5 px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
          <option value="">كل المخازن</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>

        <select value={type ?? ""} onChange={e => setType(e.target.value)} className="min-w-[120px] py-2.5 px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
          <option value="">كل الأنواع</option>
          <option value="surplus">زيادة جرد</option>
          <option value="shortage">عجز جرد</option>
        </select>

        <select value={status ?? ""} onChange={e => setStatus(e.target.value)} className="min-w-[120px] py-2.5 px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all">
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="pending">بانتظار الاعتماد</option>
          <option value="approved">معتمدة</option>
          <option value="cancelled">ملغاة</option>
        </select>

        <input type="date" value={dateFrom ?? ""} onChange={e => setDateFrom(e.target.value)} className="py-2.5 px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />
        <input type="date" value={dateTo ?? ""} onChange={e => setDateTo(e.target.value)} className="py-2.5 px-3 bg-background border border-border rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all" />

        <button onClick={fetchAdjustments} className="p-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
          <Search className="w-4 h-4" />
        </button>
        <button onClick={resetFilters} className="p-2.5 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-colors shadow-sm" title="إعادة تعيين الفلاتر">
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center">
            <RefreshCw className="w-8 h-8 animate-spin mb-4" />
            <p>جاري تحميل البيانات...</p>
          </div>
        ) : adjustments.length === 0 ? (
          <div className="p-14 text-center text-muted-foreground flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 shadow-sm border border-primary/20">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-foreground">لا يوجد تسويات</h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
              لم يتم العثور على أي تسويات مخزنية. يمكنك استيراد نتيجة جرد فعلية أو إنشاء تسوية يدوية لضبط الأرصدة.
            </p>
            <button
              onClick={() => { setSelectedAdjId(null); setShowCreateModal(true); }}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md hover:bg-primary/90 transition-all cursor-pointer hover:scale-105"
            >
              <Plus className="w-4 h-4" />
              <span>إنشاء أول تسوية</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-muted/40 text-muted-foreground border-b border-border/70 font-semibold tracking-tight">
                  <th className="py-3 px-4 min-w-[130px]">رقم التسوية</th>
                  <th className="py-3 px-4 min-w-[100px]">التاريخ</th>
                  <th className="py-3 px-4 min-w-[120px]">المخزن</th>
                  <th className="py-3 px-4 w-24">النوع</th>
                  <th className="py-3 px-4 min-w-[120px]">السبب</th>
                  <th className="py-3 px-4 text-center w-24">عدد الأصناف</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">إجمالي القيمة</th>
                  <th className="py-3 px-4 text-center w-28">الحالة</th>
                  <th className="py-3 px-4 min-w-[100px]">بواسطة</th>
                  <th className="py-3 px-4 text-center w-20">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-3 px-4">
                      <button onClick={() => { setSelectedAdjId(adj.id); setShowCreateModal(true); }} className="font-mono font-bold text-primary hover:underline">
                        {adj.adjustment_number}
                      </button>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                      {new Date(adj.adjustment_date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-foreground">
                      {adj.warehouse_name || `مخزن #${adj.warehouse_id}`}
                    </td>
                    <td className="py-3 px-4">
                      {adj.type === 'surplus' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold text-[10px] border border-emerald-500/20">
                          <Plus className="w-3 h-3" /> زيادة
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-600 font-bold text-[10px] border border-red-500/20">
                          - عجز
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {adj.reason_name}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold">
                      {adj.items_count}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-black">
                      {Number(adj.total_value).toLocaleString('ar-EG', {minimumFractionDigits: 2})}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {adj.status === 'draft' && <span className="px-2 py-1 bg-slate-500/10 text-slate-600 rounded-md text-[10px] font-bold">مسودة</span>}
                      {adj.status === 'pending' && <span className="px-2 py-1 bg-amber-500/10 text-amber-600 rounded-md text-[10px] font-bold">بانتظار الاعتماد</span>}
                      {adj.status === 'approved' && <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded-md text-[10px] font-bold">معتمدة</span>}
                      {adj.status === 'cancelled' && <span className="px-2 py-1 bg-red-500/10 text-red-600 rounded-md text-[10px] font-bold">ملغاة</span>}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-[11px]">
                      {adj.created_by_name || 'Admin'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button onClick={() => { setSelectedAdjId(adj.id); setShowCreateModal(true); }} className="p-1.5 text-muted-foreground hover:bg-muted rounded-lg transition-colors" title="عرض التفاصيل">
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <AdjustmentCreateModal 
          adjustmentId={selectedAdjId} 
          onClose={() => setShowCreateModal(false)} 
          onSuccess={() => { setShowCreateModal(false); fetchAdjustments(); onNotify("تمت العملية بنجاح", "success"); }}
        />
      )}
    </div>
  );
}
