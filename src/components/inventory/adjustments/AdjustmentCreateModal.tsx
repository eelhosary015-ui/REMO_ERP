import React, { useState, useEffect } from 'react';
import { X, Save, CheckCircle2, AlertCircle, Plus, Trash2, Search, FileDown, ScanBarcode, ArrowRightLeft } from 'lucide-react';
import { api } from '../../../utils/api';

export default function AdjustmentCreateModal({ 
  adjustmentId, 
  onClose, 
  onSuccess 
}: { 
  adjustmentId?: number | null, 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stockBalances, setStockBalances] = useState<Record<number, number>>({});
  
  // Header state
  const [form, setForm] = useState({
    adjustment_number: "ADJ-NEW",
    adjustment_date: new Date().toISOString().split('T')[0],
    warehouse_id: "",
    type: "shortage", // 'shortage' | 'surplus'
    reason_id: "",
    reference_no: "",
    notes: "",
    status: "draft"
  });

  // Items grid state
  const [items, setItems] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const isReadonly = form.status === 'approved' || form.status === 'cancelled';

  useEffect(() => {
    fetchInitialData();
    if (adjustmentId) {
      loadAdjustment(adjustmentId);
    }
  }, [adjustmentId]);

  useEffect(() => {
    if (form.type) {
      // Refresh reasons based on type
      api.get(`/api/adjustment-reasons?type=${form.type}`)
        .then(res => res.json())
        .then(data => setReasons(data))
        .catch(console.error);
    }
  }, [form.type]);

  const fetchInitialData = async () => {
    try {
      const [whRes, prRes] = await Promise.all([
        api.get('/api/warehouses'),
        api.get('/api/products')
      ]);
      setWarehouses(await whRes.json());
      setProducts(await prRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  const loadAdjustment = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/inventory-adjustments/${id}`);
      if (res.ok) {
        const data = await res.json();
        setForm({
          adjustment_number: data.adjustment_number,
          adjustment_date: new Date(data.adjustment_date).toISOString().split('T')[0],
          warehouse_id: String(data.warehouse_id),
          type: data.type,
          reason_id: String(data.reason_id),
          reference_no: data.reference_no || "",
          notes: data.notes || "",
          status: data.status
        });
        setItems(data.items.map((i: any) => ({
          id: i.id,
          product_id: i.product_id,
          name: i.product_name,
          unit: i.unit,
          current_qty: Number(i.current_qty),
          physical_qty: Number(i.physical_qty),
          adjustment_qty: Number(i.adjustment_qty),
          unit_cost: Number(i.unit_cost),
          total_cost: Number(i.total_cost)
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStock = async (whId: string) => {
    if (!whId) return;
    try {
      const res = await api.get(`/api/enterprise/stock?warehouse_id=${whId}`);
      if (res.ok) {
        const data = await res.json();
        const stockMap: Record<number, number> = {};
        data.forEach((s: any) => stockMap[s.product_id] = Number(s.quantity));
        setStockBalances(stockMap);
        
        // Update current items
        setItems(items.map(it => {
          const current = stockMap[it.product_id] || 0;
          return {
            ...it,
            current_qty: current,
            adjustment_qty: it.physical_qty - current,
            total_cost: Math.abs(it.physical_qty - current) * it.unit_cost
          };
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setForm({ ...form, warehouse_id: val });
    loadStock(val);
  };

  const addItem = (product: any) => {
    if (items.find(i => i.product_id === product.id)) return; // Prevent dup
    
    const currentQty = stockBalances[product.id] || 0;
    const unitCost = Number(product.cost_price || 0);
    
    setItems([...items, {
      product_id: product.id,
      name: product.name,
      unit: product.unit || "قطعة",
      current_qty: currentQty,
      physical_qty: currentQty,
      adjustment_qty: 0,
      unit_cost: unitCost,
      total_cost: 0
    }]);
    setProductSearch("");
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    const it = newItems[index];
    it[field] = value;

    if (field === 'physical_qty') {
      let physical = Number(value) || 0;
      if (physical < 0) physical = 0;
      it.physical_qty = physical;
      it.adjustment_qty = physical - it.current_qty;
      it.total_cost = Math.abs(it.adjustment_qty) * it.unit_cost;
    }
    if (field === 'adjustment_qty') {
      let adj = Number(value) || 0;
      if (form.type === 'shortage' && adj > 0) adj = -Math.abs(adj);
      if (form.type === 'surplus' && adj < 0) adj = Math.abs(adj);
      
      let physical = it.current_qty + adj;
      if (physical < 0) {
        physical = 0;
        adj = 0 - it.current_qty;
      }
      
      it.adjustment_qty = adj;
      it.physical_qty = physical;
      it.total_cost = Math.abs(adj) * it.unit_cost;
    }
    if (field === 'unit_cost') {
      it.total_cost = Math.abs(it.adjustment_qty) * Number(value);
    }

    setItems(newItems);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const totalValue = items.reduce((s, it) => s + it.total_cost, 0);
  const totalCount = items.length;

  const handleSave = async (status: string) => {
    // Validate shortage
    if (form.type === 'shortage') {
      const hasInvalid = items.some(it => it.adjustment_qty > 0);
      if (hasInvalid) {
        alert("لا يمكن إضافة زيادة (بالموجب) في تسوية العجز. الكمية الفعلية يجب أن تكون أقل من أو تساوي الرصيد الحالي.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        warehouse_id: Number(form.warehouse_id),
        reason_id: Number(form.reason_id),
        status,
        total_value: totalValue,
        items
      };

      const res = await api.post('/api/inventory-adjustments', payload);
      if (res.ok) {
        onSuccess();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      const res = await api.post(`/api/inventory-adjustments/${adjustmentId}/approve`, {});
      if (res.ok) onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background">
      <div className="text-muted-foreground animate-pulse">جاري التحميل...</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-950" dir="rtl">
      {/* App-like Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white dark:bg-slate-900 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="w-6 h-6" />
          </button>
          <div>
            <h2 className="text-xl font-black text-foreground">
              {adjustmentId ? `تسوية ${form.adjustment_number}` : 'إنشاء تسوية جديدة'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                form.status === 'draft' ? 'bg-slate-100 text-slate-600' : 
                form.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {form.status === 'draft' ? 'مسودة' : form.status === 'pending' ? 'بانتظار الاعتماد' : 'معتمدة'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!isReadonly && (
            <>
              <button onClick={() => handleSave('draft')} disabled={submitting} className="px-5 py-2.5 bg-background border border-border rounded-xl text-sm font-bold hover:bg-muted transition-all">
                حفظ كمسودة
              </button>
              <button onClick={() => handleSave('pending')} disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all hover:scale-105">
                <CheckCircle2 className="w-4 h-4" /> إرسال للاعتماد
              </button>
            </>
          )}
          {form.status === 'pending' && (
            <button onClick={handleApprove} disabled={submitting} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-emerald-700 transition-all">
              <CheckCircle2 className="w-4 h-4" /> اعتماد وتسجيل القيود
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/80 dark:bg-slate-900/50">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Section A: Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-bold mb-5 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-slate-800 dark:text-slate-100">
              <ArrowRightLeft className="w-5 h-5 text-primary" />
              البيانات الأساسية للتسوية
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">رقم التسوية</label>
                <input type="text" disabled value={form.adjustment_number ?? ""} className="w-full h-10 px-3 bg-transparent border-0 rounded-lg font-mono text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-0" />
              </div>
              
              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <label className="block text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2">تاريخ التسوية *</label>
                <input type="date" disabled={isReadonly} value={form.adjustment_date ?? ""} onChange={e => setForm({...form, adjustment_date: e.target.value})} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
              </div>

              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <label className="block text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-2">المخزن *</label>
                <select disabled={isReadonly} value={form.warehouse_id ?? ""} onChange={handleWarehouseChange} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
                  <option value="">اختر المخزن...</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">نوع التسوية *</label>
                <div className="flex bg-slate-200/50 dark:bg-slate-900 p-1 rounded-lg">
                  <button type="button" disabled={isReadonly} onClick={() => setForm({...form, type: 'shortage', reason_id: ''})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${form.type === 'shortage' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800'}`}>- عجز</button>
                  <button type="button" disabled={isReadonly} onClick={() => setForm({...form, type: 'surplus', reason_id: ''})} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${form.type === 'surplus' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:bg-white dark:hover:bg-slate-800'}`}>+ زيادة</button>
                </div>
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <label className="block text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">السبب *</label>
                <select disabled={isReadonly} value={form.reason_id ?? ""} onChange={e => setForm({...form, reason_id: e.target.value})} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500">
                  <option value="">اختر السبب...</option>
                  {reasons.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
                </select>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">رقم المرجع (محضر جرد)</label>
                <input disabled={isReadonly} type="text" value={form.reference_no ?? ""} onChange={e => setForm({...form, reference_no: e.target.value})} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="مثال: INV-2023-001" />
              </div>

              <div className="lg:col-span-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">الملاحظات</label>
                <input disabled={isReadonly} type="text" value={form.notes ?? ""} onChange={e => setForm({...form, notes: e.target.value})} className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary" placeholder="أي ملاحظات إضافية بخصوص التسوية..." />
              </div>
            </div>
          </div>

          {/* Section B: Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-base font-bold flex items-center gap-2">
                جدول الأصناف والتسويات
                <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-mono">{items.length} صنف</span>
              </h3>
              {!isReadonly && (
                <div className="flex items-center gap-3">
                  <div className="relative w-64">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input 
                      type="text" 
                      placeholder="بحث للصنف بالاسم أو الباركود..." 
                      value={productSearch}
                      onChange={e => setProductSearch(e.target.value)}
                      className="w-full h-10 pl-3 pr-10 bg-background border border-border/80 rounded-xl text-xs focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                    {productSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {products.filter(p => p.name.includes(productSearch) || (p.barcode && p.barcode.includes(productSearch))).map(p => (
                          <button key={p.id} onClick={() => addItem(p)} className="w-full text-right px-4 py-2 text-sm hover:bg-muted flex justify-between items-center border-b border-border/30 last:border-0">
                            <span className="font-semibold">{p.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">{p.barcode}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-xl text-xs font-bold hover:bg-muted/80 transition-colors">
                    <FileDown className="w-4 h-4" /> استيراد إكسيل
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4 w-12 text-center font-bold">#</th>
                    <th className="py-3 px-4 min-w-[200px] font-bold">الصنف</th>
                    <th className="py-3 px-4 w-20 text-center font-bold">الوحدة</th>
                    <th className="py-3 px-4 w-28 text-center bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold border-r border-slate-200 dark:border-slate-700">الرصيد الحالي</th>
                    <th className="py-3 px-4 w-32 text-center bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold border-r border-slate-200 dark:border-slate-700">الكمية الفعلية (جرد)</th>
                    <th className="py-3 px-4 w-32 text-center font-bold border-r border-slate-200 dark:border-slate-700">التسوية (+ / -)</th>
                    <th className="py-3 px-4 w-32 text-center font-bold border-r border-slate-200 dark:border-slate-700">تكلفة الوحدة</th>
                    <th className="py-3 px-4 w-32 text-center font-bold border-r border-slate-200 dark:border-slate-700">إجمالي التكلفة</th>
                    {!isReadonly && <th className="py-3 px-4 w-12 text-center border-r border-slate-200 dark:border-slate-700">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, idx) => {
                    const isInvalid = form.type === 'shortage' && item.adjustment_qty > 0;
                    
                    return (
                      <tr key={idx} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isInvalid ? 'bg-red-50 dark:bg-red-900/20' : 'bg-white dark:bg-slate-900'}`}>
                        <td className="py-3 px-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                        <td className="py-3 px-4 text-center text-slate-500">{item.unit}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">{item.current_qty}</td>
                        <td className="py-3 px-4 text-center bg-emerald-50 dark:bg-emerald-900/20 border-r border-slate-100 dark:border-slate-800">
                          <input 
                            disabled={isReadonly}
                            type="number" 
                            step="any"
                            value={item.physical_qty} 
                            onChange={(e) => updateItem(idx, 'physical_qty', e.target.value)}
                            className="w-full h-8 px-2 text-center bg-white dark:bg-slate-950 border border-emerald-300 dark:border-emerald-700 rounded-md font-mono font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm"
                          />
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-100 dark:border-slate-800">
                          <input 
                            disabled={isReadonly}
                            type="number" 
                            step="any"
                            value={item.adjustment_qty} 
                            onChange={(e) => updateItem(idx, 'adjustment_qty', e.target.value)}
                            className={`w-full h-8 px-2 text-center bg-white dark:bg-slate-950 border rounded-md font-mono font-bold focus:ring-1 shadow-sm ${item.adjustment_qty > 0 ? 'border-emerald-300 text-emerald-600 focus:border-emerald-500' : item.adjustment_qty < 0 ? 'border-red-300 text-red-600 focus:border-red-500' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'}`}
                          />
                        </td>
                        <td className="py-3 px-4 text-center border-r border-slate-100 dark:border-slate-800">
                          <input 
                            disabled={isReadonly || form.type === 'shortage'}
                            type="number" 
                            step="any"
                            value={item.unit_cost} 
                            onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                            className="w-full h-8 px-2 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono focus:border-primary focus:ring-1 text-slate-700 dark:text-slate-300 shadow-sm"
                          />
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">
                          {item.total_cost.toLocaleString('ar-EG', {minimumFractionDigits: 2})}
                        </td>
                        {!isReadonly && (
                          <td className="py-3 px-4 text-center border-r border-slate-100 dark:border-slate-800">
                            <button onClick={() => removeItem(idx)} className="p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  
                  {items.length === 0 && (
                    <tr className="bg-white dark:bg-slate-900">
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <ScanBarcode className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700" />
                          <p className="font-semibold text-slate-600 dark:text-slate-400">لا يوجد أصناف بالتسوية</p>
                          <p className="text-[11px] mt-1 text-slate-400">قم بالبحث عن صنف لإضافته للجدول أو استيراد ملف إكسيل</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between shrink-0 shadow-inner">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                إجمالي الأصناف: <strong className="text-slate-900 dark:text-slate-100 font-mono px-2">{totalCount}</strong>
              </span>
              <span className="text-base font-black text-slate-900 dark:text-slate-100">
                إجمالي القيمة التقديرية: <span className={`font-mono px-2 ${form.type === 'surplus' ? 'text-emerald-600' : 'text-red-600'}`}>{totalValue.toLocaleString('ar-EG', {minimumFractionDigits: 2})} ر.س</span>
              </span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
