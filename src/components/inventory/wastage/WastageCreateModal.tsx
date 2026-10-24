import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Search, CheckCircle2, AlertTriangle, ScanBarcode, Trash2, Save, FileCheck2, User, FileText, RefreshCw, PackageCheck, Warehouse, ShieldAlert, TrendingDown } from 'lucide-react';
import { api } from '../../../utils/api';

interface WastageCreateModalProps {
  wastageId: number | null;
  onClose: () => void;
  onSuccess: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
  userRole?: string;
}

interface AvailableItem {
  product_id: number;
  ingredient_id: number | null;
  name: string;
  unit: string;
  code?: string | null;
  barcode?: string | null;
  quantity: number;
  reserved: number;
  available_qty: number;
  unit_cost: number;
  tracked: boolean;
}

interface WastageLine {
  product_id: number;
  ingredient_id: number | null;
  name: string;
  unit: string;
  current_qty: number;
  available_qty: number;
  reserved: number;
  wastage_qty: number;
  unit_cost: number;
  total_cost: number;
}

const fmtNum = (value: number, digits = 2) =>
  Number(value || 0).toLocaleString('ar-EG', { minimumFractionDigits: digits, maximumFractionDigits: 3 });

const WASTAGE_TYPE_LABELS: Record<string, string> = {
  storage: 'تالف تخزين',
  breakage: 'كسر',
  expired: 'منتهي صلاحية',
  manufacturing: 'هالك تصنيع',
};

export default function WastageCreateModal({ wastageId, onClose, onSuccess, onNotify, userRole }: WastageCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [availableItems, setAvailableItems] = useState<AvailableItem[]>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [includeZero, setIncludeZero] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const [form, setForm] = useState({
    wastage_number: 'جديد (Wastage)',
    wastage_date: new Date().toISOString().substring(0, 10),
    warehouse_id: '',
    wastage_type: '',
    reason_id: '',
    responsible_person: '',
    notes: '',
    status: 'draft',
  });

  const [items, setItems] = useState<WastageLine[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const isReadonly = form.status === 'approved' || form.status === 'cancelled';
  const canApprove = !userRole || userRole === 'admin' || userRole === 'inventory_manager';
  const selectedWarehouse = warehouses.find((w) => String(w.id) === String(form.warehouse_id));

  useEffect(() => {
    fetchInitialData();
    if (wastageId) fetchWastage(wastageId);
  }, [wastageId]);

  const fetchInitialData = async () => {
    try {
      const [whRes, reasRes] = await Promise.all([api.get('/api/warehouses'), api.get('/api/wastage-reasons')]);
      if (whRes.ok) {
        const data = await whRes.json();
        setWarehouses(Array.isArray(data) ? data : data.warehouses || []);
      }
      if (reasRes.ok) {
        const data = await reasRes.json();
        setReasons(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
      onNotify('تعذر تحميل بيانات المخازن أو أسباب الهالك', 'error');
    }
  };

  const fetchAvailabilityList = async (warehouseId: string): Promise<AvailableItem[] | null> => {
    try {
      const res = await api.get(`/api/inventory-wastage/available-items?warehouse_id=${warehouseId}&include_zero=1`);
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data.items) ? data.items : [];
    } catch {
      return null;
    }
  };

  const fetchWastage = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/inventory-wastage/${id}`);
      if (!res.ok) throw new Error('تعذر تحميل إذن الهالك');
      const data = await res.json();
      setForm({
        wastage_number: data.wastage_number,
        wastage_date: (data.wastage_date || '').substring(0, 10),
        warehouse_id: String(data.warehouse_id ?? ''),
        wastage_type: data.wastage_type || '',
        reason_id: data.reason_id ? String(data.reason_id) : '',
        responsible_person: data.responsible_person || '',
        notes: data.notes || '',
        status: data.status,
      });

      // تحديث الأرصدة لحظياً عند فتح مسودة قديمة حتى لا يعتمد المستخدم على رصيد قديم
      const fresh = data.warehouse_id ? await fetchAvailabilityList(String(data.warehouse_id)) : null;
      if (fresh) {
        setAvailableItems(fresh);
        setIncludeZero(true);
      }
      const freshMap = new Map<number, AvailableItem>((fresh || []).map((row) => [Number(row.product_id), row]));

      setItems(
        (data.items || []).map((i: any) => {
          const live = freshMap.get(Number(i.product_id));
          const unitCost = Number(i.unit_cost || 0) || Number(live?.unit_cost || 0);
          const qty = Number(i.wastage_qty || 0);
          return {
            product_id: Number(i.product_id),
            ingredient_id: i.ingredient_id ? Number(i.ingredient_id) : live?.ingredient_id ?? null,
            name: i.product_name || `صنف #${i.product_id}`,
            unit: i.unit || live?.unit || 'وحدة',
            current_qty: live ? live.quantity : Number(i.current_qty || 0),
            available_qty: live ? live.available_qty : Number(i.available_qty ?? i.current_qty ?? 0),
            reserved: live ? live.reserved : 0,
            wastage_qty: qty,
            unit_cost: unitCost,
            total_cost: qty * unitCost,
          };
        })
      );
    } catch (err: any) {
      onNotify(err.message || 'تعذر تحميل إذن الهالك', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * تحميل أرصدة المخزن المختار من المصدر الرسمي (inventory_items).
   * كانت الشاشة تقرأ /api/inventory/stock وتتوقع مصفوفة بينما يرجّع كائناً،
   * فكان الرصيد يظهر صفراً دائماً وتمنع الواجهة إدخال أي كمية.
   */
  const loadAvailableItems = useCallback(async (warehouseId: string, search = '', withZero = includeZero) => {
    if (!warehouseId) {
      setAvailableItems([]);
      return;
    }
    setStockLoading(true);
    setStockError(null);
    try {
      const params = new URLSearchParams({ warehouse_id: warehouseId });
      if (search) params.set('search', search);
      if (withZero) params.set('include_zero', '1');
      const res = await api.get(`/api/inventory-wastage/available-items?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'تعذر تحميل أرصدة المخزن');
      setAvailableItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      setAvailableItems([]);
      setStockError(err.message || 'تعذر تحميل أرصدة المخزن');
    } finally {
      setStockLoading(false);
    }
  }, [includeZero]);

  useEffect(() => {
    if (!form.warehouse_id) {
      setAvailableItems([]);
      return;
    }
    // البحث على السيرفر مع تأخير بسيط لتقليل الطلبات
    const timer = setTimeout(() => loadAvailableItems(form.warehouse_id, productSearch.trim()), 250);
    return () => clearTimeout(timer);
  }, [form.warehouse_id, productSearch, includeZero, loadAvailableItems]);

  const filteredReasons = useMemo(
    () => reasons.filter((r) => !form.wastage_type || form.wastage_type === 'manufacturing' || r.type === form.wastage_type),
    [reasons, form.wastage_type]
  );

  const searchResults = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    const list = availableItems.filter((item) => includeZero || item.available_qty > 0);
    const filtered = !term
      ? list
      : list.filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            String(item.code || '').toLowerCase().includes(term) ||
            String(item.barcode || '').toLowerCase().includes(term)
        );
    return filtered.slice(0, 8);
  }, [availableItems, productSearch, includeZero]);

  const addProduct = (item: AvailableItem) => {
    if (!form.warehouse_id) {
      onNotify('الرجاء اختيار المخزن أولاً', 'error');
      return;
    }
    if (!item.tracked || !item.ingredient_id) {
      onNotify(`الصنف «${item.name}» غير مرتبط بصنف مخزني — اربطه من شاشة المنتجات أولاً`, 'error');
      return;
    }
    if (item.available_qty <= 0) {
      onNotify(`لا يوجد رصيد متاح للصنف «${item.name}» في هذا المخزن`, 'error');
      return;
    }
    if (items.some((i) => i.product_id === item.product_id)) {
      onNotify('الصنف موجود بالفعل في القائمة — عدّل الكمية في السطر الموجود', 'error');
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        product_id: item.product_id,
        ingredient_id: item.ingredient_id,
        name: item.name,
        unit: item.unit,
        current_qty: item.quantity,
        available_qty: item.available_qty,
        reserved: item.reserved,
        wastage_qty: 0,
        unit_cost: item.unit_cost,
        total_cost: 0,
      },
    ]);
    setProductSearch('');
    setFormError(null);
  };

  const updateItem = (index: number, field: 'wastage_qty' | 'unit_cost', value: string) => {
    setItems((prev) =>
      prev.map((line, idx) => {
        if (idx !== index) return line;
        if (field === 'wastage_qty') {
          const qty = Math.max(Number(value) || 0, 0);
          return { ...line, wastage_qty: qty, total_cost: qty * line.unit_cost };
        }
        const cost = Math.max(Number(value) || 0, 0);
        return { ...line, unit_cost: cost, total_cost: line.wastage_qty * cost };
      })
    );
    setFormError(null);
  };

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    if (itemCountGuard()) return;
    setForm({ ...form, warehouse_id: nextId });
    setItems([]);
    setProductSearch('');
    setFormError(null);
  };

  const itemCountGuard = () => {
    if (items.length > 0 && !window.confirm('تغيير المخزن سيؤدي إلى مسح الأصناف الحالية. هل أنت متأكد؟')) {
      return true;
    }
    return false;
  };

  const invalidLines = items.filter((line) => line.wastage_qty <= 0 || line.wastage_qty > line.available_qty);
  const totalValue = items.reduce((sum, item) => sum + item.total_cost, 0);
  const totalQty = items.reduce((sum, item) => sum + item.wastage_qty, 0);

  const buildPayload = () => ({
    wastage_number: form.wastage_number,
    wastage_date: form.wastage_date,
    warehouse_id: form.warehouse_id,
    wastage_type: form.wastage_type,
    reason_id: form.reason_id,
    responsible_person: form.responsible_person,
    notes: form.notes,
    items: items.map((line) => ({
      product_id: line.product_id,
      wastage_qty: line.wastage_qty,
      unit_cost: line.unit_cost,
    })),
  });

  const readError = async (res: Response) => {
    const data = await res.json().catch(() => ({}));
    return data?.error || 'تعذر تنفيذ العملية';
  };

  const handleSave = async (status: 'draft' | 'approved') => {
    setFormError(null);
    if (!form.warehouse_id || !form.wastage_type || !form.reason_id) {
      setFormError('الرجاء إكمال البيانات الأساسية: المخزن، نوع الهالك، والسبب');
      return;
    }
    if (items.length === 0) {
      setFormError('الرجاء إضافة صنف واحد على الأقل إلى إذن الهالك');
      return;
    }
    const invalid = items.find((line) => line.wastage_qty <= 0);
    if (invalid) {
      setFormError(`أدخل كمية هالكة أكبر من صفر للصنف «${invalid.name}»`);
      return;
    }
    const over = items.find((line) => line.wastage_qty > line.available_qty);
    if (over) {
      setFormError(
        `الكمية الهالكة للصنف «${over.name}» أكبر من المتاح (${fmtNum(over.available_qty)} ${over.unit})`
      );
      return;
    }

    setSubmitting(true);
    try {
      let docId = wastageId;
      const payload = buildPayload();

      if (!docId) {
        const createRes = await api.post('/api/inventory-wastage', payload);
        if (!createRes.ok) throw new Error(await readError(createRes));
        const created = await createRes.json();
        docId = Number(created.id);
      } else {
        const draftState = form.status !== 'approved' && form.status !== 'cancelled';
        if (draftState) {
          const updateRes = await api.put(`/api/inventory-wastage/${docId}`, payload);
          if (!updateRes.ok) throw new Error(await readError(updateRes));
        }
      }

      if (status === 'approved') {
        if (!docId) throw new Error('تعذر حفظ إذن الهالك قبل الاعتماد');
        const approveRes = await api.post(`/api/inventory-wastage/${docId}/approve`, {});
        const data = await approveRes.json().catch(() => ({}));
        if (!approveRes.ok) throw new Error(data?.error || 'تعذر اعتماد إذن الهالك');
        if (data?.accounting?.posted) {
          onNotify(`تم اعتماد الهالك وخصمه من المخزن — قيد محاسبي #${data.accounting.entry_id}`, 'success');
        } else if (data?.accounting?.message) {
          onNotify(`تم خصم الكميات من المخزن. ملاحظة: ${data.accounting.message}`, 'success');
        } else {
          onNotify('تم اعتماد الهالك وخصم الكميات من المخزن بنجاح', 'success');
        }
      } else {
        onNotify('تم حفظ إذن الهالك كمسودة — لن يؤثر على الرصيد قبل الاعتماد', 'success');
      }

      onSuccess();
    } catch (err: any) {
      setFormError(err?.message || 'تعذر حفظ إذن الهالك');
      onNotify(err?.message || 'تعذر حفظ إذن الهالك', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-50 dark:bg-slate-950" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">تسجيل هالك وتالف</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono font-bold text-slate-500">{form.wastage_number}</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    form.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : form.status === 'cancelled'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {form.status === 'approved' ? 'معتمد وخصم من المخزن' : form.status === 'cancelled' ? 'ملغى' : 'مسودة — لا تؤثر على الرصيد'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isReadonly && (
            <>
              <button
                onClick={() => handleSave('draft')}
                disabled={submitting || loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                <Save className="w-4 h-4" /> حفظ كمسودة
              </button>

              {canApprove && (
                <button
                  onClick={() => {
                    if (window.confirm('اعتماد الهالك سيخصم الكميات من المخزن نهائياً ويُنشئ قيداً محاسبياً. هل أنت متأكد؟')) {
                      handleSave('approved');
                    }
                  }}
                  disabled={submitting || loading || items.length === 0}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
                >
                  <FileCheck2 className="w-4 h-4" /> اعتماد وخصم من المخزن
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-5">
          {formError && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* البيانات الأساسية */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <h3 className="text-sm font-black mb-4 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 text-slate-800 dark:text-slate-100">
              <FileText className="w-4 h-4 text-red-500" /> البيانات الأساسية
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">رقم العملية</label>
                <input
                  type="text"
                  disabled
                  value={form.wastage_number ?? ''}
                  className="w-full h-10 px-3 bg-transparent border-0 rounded-lg font-mono text-sm font-bold text-slate-700 dark:text-slate-300 focus:ring-0"
                />
              </div>

              <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <label className="block text-[11px] font-bold text-blue-600 dark:text-blue-400 mb-1.5">تاريخ الهالك *</label>
                <input
                  type="date"
                  disabled={isReadonly}
                  value={form.wastage_date ?? ''}
                  onChange={(e) => setForm({ ...form, wastage_date: e.target.value })}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-lg font-mono text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
                <label className="block text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1.5">المخزن *</label>
                <select
                  disabled={isReadonly}
                  value={form.warehouse_id ?? ''}
                  onChange={handleWarehouseChange}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">اختر المخزن...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">نوع الهالك *</label>
                <select
                  disabled={isReadonly}
                  value={form.wastage_type ?? ''}
                  onChange={(e) => setForm({ ...form, wastage_type: e.target.value, reason_id: '' })}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                >
                  <option value="">اختر النوع...</option>
                  <option value="storage">تالف تخزين</option>
                  <option value="breakage">كسر</option>
                  <option value="expired">منتهي صلاحية</option>
                  <option value="manufacturing">هالك تصنيع</option>
                </select>
              </div>

              <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-xl border border-amber-100 dark:border-amber-900/30">
                <label className="block text-[11px] font-bold text-amber-600 dark:text-amber-400 mb-1.5">السبب (حسب النوع) *</label>
                <select
                  disabled={isReadonly}
                  value={form.reason_id ?? ''}
                  onChange={(e) => setForm({ ...form, reason_id: e.target.value })}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 rounded-lg text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">اختر السبب...</option>
                  {filteredReasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name_ar}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">الشخص المسؤول / المتسبب</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    disabled={isReadonly}
                    type="text"
                    value={form.responsible_person ?? ''}
                    onChange={(e) => setForm({ ...form, responsible_person: e.target.value })}
                    className="w-full h-10 pr-9 pl-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    placeholder="اسم الموظف أو القسم"
                  />
                </div>
              </div>

              <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1.5">الملاحظات</label>
                <input
                  disabled={isReadonly}
                  type="text"
                  value={form.notes ?? ''}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full h-10 px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  placeholder="وصف إضافي للحالة..."
                />
              </div>
            </div>
          </div>

          {/* الأصناف */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="flex flex-col gap-3 px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <PackageCheck className="w-4 h-4 text-red-500" /> أصناف الهالك
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-[11px] font-mono">{items.length} صنف</span>
                </div>

                {form.warehouse_id && (
                  <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5">
                      <Warehouse className="w-3.5 h-3.5 text-indigo-500" />
                      {selectedWarehouse?.name || '—'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-emerald-700">
                      <TrendingDown className="w-3.5 h-3.5" />
                      {availableItems.filter((i) => i.available_qty > 0).length} صنف له رصيد
                    </span>
                    <button
                      type="button"
                      onClick={() => loadAvailableItems(form.warehouse_id, productSearch.trim())}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2.5 py-1.5 hover:bg-slate-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${stockLoading ? 'animate-spin' : ''}`} /> تحديث الأرصدة
                    </button>
                  </div>
                )}
              </div>

              {!isReadonly && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={form.warehouse_id ? 'ابحث بالاسم أو الكود أو الباركود لإضافة صنف...' : 'اختر المخزن أولاً لعرض الأصناف وأرصدتها'}
                      value={productSearch}
                      disabled={!form.warehouse_id || isReadonly}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full h-10 pr-9 pl-4 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:bg-slate-100"
                    />
                    {form.warehouse_id && productSearch.trim() !== '' && (
                      <div className="absolute top-full right-0 left-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-20 max-h-72 overflow-y-auto">
                        {stockLoading && <div className="px-4 py-3 text-xs text-slate-500">جاري تحميل الأرصدة...</div>}
                        {!stockLoading && searchResults.length === 0 && (
                          <div className="px-4 py-3 text-xs text-slate-500">لا توجد أصناف مطابقة في هذا المخزن</div>
                        )}
                        {searchResults.map((item) => {
                          const notTracked = !item.tracked || !item.ingredient_id;
                          const noStock = item.available_qty <= 0;
                          const disabled = notTracked || noStock;
                          return (
                            <button
                              key={item.product_id}
                              type="button"
                              disabled={disabled}
                              onClick={() => addProduct(item)}
                              className={`w-full text-right px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-center justify-between gap-3 ${
                                disabled ? 'opacity-60 cursor-not-allowed bg-slate-50/60' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block font-bold text-slate-800 dark:text-slate-200 truncate">{item.name}</span>
                                <span className="block text-[10px] text-slate-500 font-mono">
                                  {item.code || item.barcode || '—'} · {item.unit}
                                </span>
                              </span>
                              <span className="text-left shrink-0">
                                {notTracked ? (
                                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">غير مرتبط بالمخزون</span>
                                ) : (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                                      noStock ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'
                                    }`}
                                  >
                                    {noStock ? 'لا يوجد رصيد' : `متاح ${fmtNum(item.available_qty, 0)}`}
                                  </span>
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <label className="inline-flex items-center gap-2 text-[11px] font-bold text-slate-600 whitespace-nowrap">
                    <input type="checkbox" checked={includeZero} onChange={(e) => setIncludeZero(e.target.checked)} />
                    إظهار الأصناف بدون رصيد
                  </label>
                </div>
              )}

              {stockError && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-700">
                  {stockError}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-3 w-10 text-center font-bold">#</th>
                    <th className="py-3 px-3 min-w-[200px] font-bold">الصنف</th>
                    <th className="py-3 px-3 w-16 text-center font-bold">الوحدة</th>
                    <th className="py-3 px-3 w-28 text-center bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold border-r border-slate-200 dark:border-slate-700">
                      المتاح بالمخزن
                    </th>
                    <th className="py-3 px-3 w-32 text-center bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 font-bold border-r border-slate-200 dark:border-slate-700">
                      الكمية الهالكة
                    </th>
                    <th className="py-3 px-3 w-28 text-center font-bold border-r border-slate-200 dark:border-slate-700">المتبقي بعد الهالك</th>
                    <th className="py-3 px-3 w-28 text-center font-bold border-r border-slate-200 dark:border-slate-700">تكلفة الوحدة</th>
                    <th className="py-3 px-3 w-32 text-center font-bold border-r border-slate-200 dark:border-slate-700">إجمالي التكلفة</th>
                    {!isReadonly && <th className="py-3 px-3 w-12 text-center border-r border-slate-200 dark:border-slate-700">حذف</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((item, idx) => {
                    const over = item.wastage_qty > item.available_qty;
                    const remaining = item.available_qty - item.wastage_qty;
                    return (
                      <tr key={item.product_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors bg-white dark:bg-slate-900">
                        <td className="py-2.5 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800 dark:text-slate-200">{item.name}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500 text-xs">{item.unit}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-r border-slate-100 dark:border-slate-800">
                          {fmtNum(item.available_qty)}
                          {item.reserved > 0 && (
                            <span className="block text-[9px] font-normal text-slate-500">محجوز {fmtNum(item.reserved)}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center bg-red-50 dark:bg-red-900/20 border-r border-slate-100 dark:border-slate-800">
                          <input
                            disabled={isReadonly}
                            type="number"
                            min={0}
                            max={item.available_qty}
                            step="any"
                            value={item.wastage_qty}
                            onChange={(e) => updateItem(idx, 'wastage_qty', e.target.value)}
                            className={`w-full h-9 px-2 text-center bg-white dark:bg-slate-950 border rounded-md font-mono font-bold shadow-sm focus:ring-1 ${
                              over
                                ? 'border-red-500 text-red-700 focus:border-red-500 focus:ring-red-500'
                                : 'border-red-300 dark:border-red-700 text-red-800 dark:text-red-300 focus:border-red-500 focus:ring-red-500'
                            }`}
                          />
                          {over && <span className="block text-[9px] font-bold text-red-600 mt-1">أكبر من المتاح</span>}
                        </td>
                        <td className={`py-2.5 px-3 text-center font-mono font-bold border-r border-slate-100 dark:border-slate-800 ${remaining < 0 ? 'text-red-600' : 'text-slate-600'}`}>
                          {fmtNum(remaining)}
                        </td>
                        <td className="py-2.5 px-3 text-center border-r border-slate-100 dark:border-slate-800">
                          <input
                            disabled={isReadonly}
                            type="number"
                            min={0}
                            step="any"
                            value={item.unit_cost}
                            onChange={(e) => updateItem(idx, 'unit_cost', e.target.value)}
                            className="w-full h-9 px-2 text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md font-mono text-slate-700 dark:text-slate-300 shadow-sm focus:border-slate-400 focus:ring-1"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-red-700 border-r border-slate-100 dark:border-slate-800">
                          {fmtNum(item.total_cost)}
                        </td>
                        {!isReadonly && (
                          <td className="py-2.5 px-3 text-center border-r border-slate-100 dark:border-slate-800">
                            <button onClick={() => removeItem(idx)} className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}

                  {items.length === 0 && (
                    <tr className="bg-white dark:bg-slate-900">
                      <td colSpan={isReadonly ? 8 : 9} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <ScanBarcode className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-700" />
                          <p className="font-semibold text-slate-600 dark:text-slate-400">
                            {form.warehouse_id ? 'لا توجد أصناف في إذن الهالك' : 'اختر المخزن لعرض الأصناف وأرصدتها'}
                          </p>
                          <p className="text-[11px] mt-1 text-slate-400">
                            {form.warehouse_id
                              ? 'ابحث عن الصنف لإضافته — سيظهر الرصيد المتاح تلقائياً'
                              : 'الرصيد المتاح يُقرأ من حركات المخزن الفعلية'}
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <span>
                  عدد الأصناف: <strong className="text-slate-900 dark:text-slate-100 font-mono px-1.5">{items.length}</strong>
                </span>
                <span>
                  إجمالي الكمية الهالكة: <strong className="text-slate-900 dark:text-slate-100 font-mono px-1.5">{fmtNum(totalQty, 2)}</strong>
                </span>
                {invalidLines.length > 0 && (
                  <span className="text-red-600 font-bold">{invalidLines.length} سطر يحتاج مراجعة قبل الاعتماد</span>
                )}
              </div>
              <span className="text-base font-black text-slate-900 dark:text-slate-100">
                إجمالي تكلفة الهالك: <span className="text-red-600 font-mono px-2">{fmtNum(totalValue)} ج.م</span>
              </span>
            </div>
          </div>

          {/* تنبيه الأثر */}
          {!isReadonly && (
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[11px] font-semibold text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>
                الاعتماد يخصم الكميات من رصيد المخزن المختار ويُسجّلها في سجل الحركات (بطاقة الصنف والتقارير)، ويُرحّل قيداً
                محاسبياً Dr تكلفة الهالك / Cr المخزون، ويُحمّل التكلفة على موديول التكاليف. المسودة لا تؤثر على الرصيد.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
