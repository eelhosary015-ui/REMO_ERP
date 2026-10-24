import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, RefreshCw, CheckCircle2, AlertTriangle, PackageOpen, Calendar, Clock, Eye, Ban, Trash2, Wallet, FileWarning } from 'lucide-react';
import { api } from '../../../utils/api';
import WastageCreateModal from './WastageCreateModal';

interface WastageSummary {
  total_docs: number;
  total_value: number;
  total_qty: number;
  draft_count: number;
  approved_count: number;
  cancelled_count: number;
  month_docs: number;
  month_value: number;
  by_type: Array<{ type: string; docs: number; value: number }>;
  top_products: Array<{ name: string; qty: number; value: number }>;
}

const EMPTY_SUMMARY: WastageSummary = {
  total_docs: 0,
  total_value: 0,
  total_qty: 0,
  draft_count: 0,
  approved_count: 0,
  cancelled_count: 0,
  month_docs: 0,
  month_value: 0,
  by_type: [],
  top_products: [],
};

const fmtMoney = (value: number) =>
  Number(value || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtQty = (value: number) => Number(value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 3 });

const TYPE_LABELS: Record<string, string> = {
  storage: 'تالف تخزين',
  breakage: 'كسر',
  expired: 'منتهي صلاحية',
  manufacturing: 'هالك تصنيع',
};

export default function WastageView({ onNotify, userRole }: { onNotify: (msg: string, type?: 'success' | 'error') => void; userRole?: string }) {
  const [wastageList, setWastageList] = useState<any[]>([]);
  const [summary, setSummary] = useState<WastageSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [wastageType, setWastageType] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/api/warehouses');
      if (res.ok) {
        const data = await res.json();
        setWarehouses(Array.isArray(data) ? data : data.warehouses || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (warehouseId) params.append('warehouse_id', warehouseId);
    if (wastageType) params.append('wastage_type', wastageType);
    if (status) params.append('status', status);
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    return params;
  }, [search, warehouseId, wastageType, status, dateFrom, dateTo]);

  const fetchWastage = async () => {
    setLoading(true);
    try {
      const params = buildQuery();
      const [listRes, summaryRes] = await Promise.all([
        api.get('/api/inventory-wastage?' + params.toString()),
        api.get('/api/inventory-wastage/summary?' + params.toString()),
      ]);
      if (listRes.ok) {
        const data = await listRes.json();
        setWastageList(Array.isArray(data) ? data : []);
      }
      if (summaryRes.ok) {
        const data = await summaryRes.json();
        setSummary({ ...EMPTY_SUMMARY, ...(data || {}) });
      }
    } catch (err) {
      console.error(err);
      onNotify('فشل تحميل بيانات الهالك', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchWastage, 200);
    return () => clearTimeout(timer);
  }, [buildQuery]);

  const approve = async (row: any) => {
    if (!window.confirm(`اعتماد إذن ${row.wastage_number} سيخصم الكميات من المخزن ويُنشئ قيداً محاسبياً. متابعة؟`)) return;
    setBusyId(row.id);
    try {
      const res = await api.post(`/api/inventory-wastage/${row.id}/approve`, {});
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'تعذر اعتماد الهالك');
      onNotify(
        data?.accounting?.posted
          ? `تم الاعتماد والخصم — قيد محاسبي #${data.accounting.entry_id}`
          : data?.accounting?.message
          ? `تم الخصم من المخزن. ${data.accounting.message}`
          : 'تم اعتماد الهالك وخصمه من المخزن',
        'success'
      );
      fetchWastage();
    } catch (err: any) {
      onNotify(err.message || 'تعذر اعتماد الهالك', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (row: any) => {
    const reason = window.prompt(`سبب إلغاء إذن ${row.wastage_number}؟\nسيتم إرجاع الكميات إلى المخزن وعكس القيد المحاسبي.`, 'إلغاء اعتماد');
    if (reason === null) return;
    setBusyId(row.id);
    try {
      const res = await api.post(`/api/inventory-wastage/${row.id}/cancel`, { reason });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'تعذر إلغاء الإذن');
      onNotify(
        data?.stock_reversed
          ? 'تم الإلغاء وإرجاع الكميات للمخزن وعكس القيد'
          : 'تم إلغاء الإذن',
        'success'
      );
      fetchWastage();
    } catch (err: any) {
      onNotify(err.message || 'تعذر إلغاء الإذن', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeDraft = async (row: any) => {
    if (!window.confirm(`حذف المسودة ${row.wastage_number} نهائياً؟`)) return;
    setBusyId(row.id);
    try {
      const res = await api.delete(`/api/inventory-wastage/${row.id}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'تعذر حذف المسودة');
      onNotify('تم حذف المسودة', 'success');
      fetchWastage();
    } catch (err: any) {
      onNotify(err.message || 'تعذر حذف المسودة', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const topProduct = summary.top_products?.[0];
  const statusBadge = (value: string) => {
    if (value === 'approved') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> معتمد
        </span>
      );
    }
    if (value === 'cancelled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
          <Ban className="w-3.5 h-3.5" /> ملغى
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
        <Clock className="w-3.5 h-3.5" /> مسودة
      </span>
    );
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <AlertTriangle className="w-7 h-7 text-red-600" /> الهالك والتالف
          </h2>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            مسودة → اعتماد → خصم من المخزن + قيد محاسبي + تحميل التكلفة، مع إمكانية الإلغاء والعكس
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-lg shadow-red-600/20 transition-all"
        >
          <Plus className="w-5 h-5" /> تسجيل هالك
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-bold">أذون الهالك</p>
              <p className="text-2xl font-black text-slate-800">{summary.total_docs}</p>
              {summary.draft_count > 0 && (
                <p className="text-[10px] font-bold text-amber-600">{summary.draft_count} مسودة غير معتمدة</p>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
              <Wallet className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-bold">إجمالي تكلفة الهالك</p>
              <p className="text-xl font-black text-slate-800">{fmtMoney(summary.total_value)} ج.م</p>
              <p className="text-[10px] font-bold text-slate-400">الكمية: {fmtQty(summary.total_qty)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-purple-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-bold">هالك هذا الشهر</p>
              <p className="text-2xl font-black text-slate-800">{summary.month_docs}</p>
              <p className="text-[10px] font-bold text-slate-400">{fmtMoney(summary.month_value)} ج.م</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
              <PackageOpen className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 font-bold">أكثر صنف هالك</p>
              <p className="text-sm font-black text-slate-800 truncate">{topProduct?.name || '—'}</p>
              {topProduct && (
                <p className="text-[10px] font-bold text-slate-400">
                  {fmtQty(topProduct.qty)} وحدة · {fmtMoney(topProduct.value)} ج.م
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث برقم الإذن أو الملاحظات أو المسؤول..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pr-10 pl-4 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
          />
        </div>

        <select
          value={warehouseId ?? ''}
          onChange={(e) => setWarehouseId(e.target.value)}
          className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold min-w-[150px] focus:border-red-500 focus:ring-1"
        >
          <option value="">كل المخازن</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <select
          value={wastageType ?? ''}
          onChange={(e) => setWastageType(e.target.value)}
          className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold min-w-[150px] focus:border-red-500 focus:ring-1"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={status ?? ''}
          onChange={(e) => setStatus(e.target.value)}
          className="h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:border-red-500 focus:ring-1"
        >
          <option value="">الحالة (الكل)</option>
          <option value="draft">مسودة</option>
          <option value="approved">معتمد</option>
          <option value="cancelled">ملغى</option>
        </select>

        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom ?? ''} onChange={(e) => setDateFrom(e.target.value)} className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
          <span className="text-slate-400">-</span>
          <input type="date" value={dateTo ?? ''} onChange={(e) => setDateTo(e.target.value)} className="h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
        </div>

        <button onClick={fetchWastage} className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-600 transition-colors" title="تحديث">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table / Empty State */}
      {wastageList.length > 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4 font-bold text-slate-600">رقم الإذن</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600">التاريخ</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600">المخزن</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600 text-center">الأصناف</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600 text-center">الكمية</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600 text-center">التكلفة</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600 text-center">النوع</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600 text-center">السبب</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600 text-center">الحالة</th>
                  <th className="py-3.5 px-4 font-bold text-slate-600 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {wastageList.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-slate-800 text-xs">{row.wastage_number}</td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(row.wastage_date).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{row.warehouse_name || '—'}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-700">{row.items_count}</td>
                    <td className="py-3 px-4 text-center font-mono text-slate-600">{fmtQty(row.total_qty)}</td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-red-600">{fmtMoney(row.total_value)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600">
                        {TYPE_LABELS[row.wastage_type] || row.wastage_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-500 text-[11px]">{row.reason_name || '—'}</td>
                    <td className="py-3 px-4 text-center">{statusBadge(row.status)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedId(row.id)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="عرض / تعديل"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {row.status === 'draft' && (
                          <>
                            {(!userRole || userRole === 'admin' || userRole === 'inventory_manager') && (
                              <button
                                onClick={() => approve(row)}
                                disabled={busyId === row.id}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                                title="اعتماد وخصم من المخزن"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => removeDraft(row)}
                              disabled={busyId === row.id}
                              className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors disabled:opacity-40"
                              title="حذف المسودة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {row.status === 'approved' && (
                          <button
                            onClick={() => cancel(row)}
                            disabled={busyId === row.id}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-40"
                            title="إلغاء الاعتماد وعكس الأثر"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl py-20 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <FileWarning className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">لا توجد أذون هالك</h3>
          <p className="text-slate-500 max-w-md mb-6 text-sm">
            سجّل الهالك الناتج عن التخزين أو الكسر أو انتهاء الصلاحية. المسودة لا تؤثر على الرصيد، والاعتماد يخصم من المخزن ويُرحّل القيد.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition-all shadow-md"
          >
            <Plus className="w-5 h-5" /> إنشاء أول إذن هالك
          </button>
        </div>
      )}

      {(showCreateModal || selectedId) && (
        <WastageCreateModal
          wastageId={selectedId}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedId(null);
          }}
          onSuccess={() => {
            setShowCreateModal(false);
            setSelectedId(null);
            fetchWastage();
          }}
          userRole={userRole}
          onNotify={onNotify}
        />
      )}
    </div>
  );
}
