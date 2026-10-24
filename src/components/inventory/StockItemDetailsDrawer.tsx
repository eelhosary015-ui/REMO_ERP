import React, { useState, useEffect } from "react";
import {
  X, Box, MapPin, Lock, Truck, Tag, Hash, FileText,
  History, TrendingUp, AlertTriangle, CheckCircle2,
  Calendar, Layers, ShieldCheck, RefreshCw,
  Clock, Sparkles, Edit3
} from "lucide-react";
import { api } from "../../utils/api";

interface StockItemDetailsDrawerProps {
  itemId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, type?: "success" | "error" | "info") => void;
  onRefreshParent?: () => void;
}

export const StockItemDetailsDrawer: React.FC<StockItemDetailsDrawerProps> = ({
  itemId,
  isOpen,
  onClose,
  onNotify,
  onRefreshParent
}) => {
  const [activeTab, setActiveTab] = useState<
    "summary" | "locations" | "reservations" | "batches" | "serials" | "receipts" | "issues" | "consumption" | "ledger" | "audit"
  >("summary");
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [locationsList, setLocationsList] = useState<any[]>([]);
  const [selectedLocationMap, setSelectedLocationMap] = useState<Record<number, number>>({});
  const [savingLocation, setSavingLocation] = useState(false);

  const fetchDetails = async () => {
    if (!itemId) return;
    setLoading(true);
    try {
      const [res, locRes] = await Promise.all([
        api.get(`/api/inventory/item-details/${itemId}`),
        api.get("/api/warehouse-locations")
      ]);

      if (res.ok) {
        const d = await res.json();
        setData(d);
        // initialize location map
        if (d.stocks) {
          const locMap: Record<number, number> = {};
          d.stocks.forEach((s: any) => {
            if (s.location_id) locMap[s.id] = s.location_id;
          });
          setSelectedLocationMap(locMap);
        }
      }
      if (locRes.ok) {
        const locs = await locRes.json();
        setLocationsList(Array.isArray(locs) ? locs : locs.data || []);
      }
    } catch (e) {
      console.error("Failed to load item details", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && itemId) {
      fetchDetails();
    } else {
      setData(null);
    }
  }, [isOpen, itemId]);

  if (!isOpen || !itemId) return null;

  const fmt = (n: any) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const fmtMoney = (n: any) => `${fmt(n)} ج.م`;

  const cleanCode = (rawCode: any, id?: any) => {
    if (!rawCode || rawCode === "NULL" || rawCode === "null" || rawCode === "undefined") {
      return id ? `ITEM-${id}` : "";
    }
    const s = String(rawCode).trim();
    if (s.startsWith("-")) return `ITEM-${s.replace("-", "")}`;
    if (!s.startsWith("ITEM-") && !isNaN(Number(s))) return `ITEM-${s}`;
    return s;
  };

  const cleanStr = (val: any) => {
    if (!val || val === "NULL" || val === "null" || val === "undefined") return null;
    const s = String(val).trim();
    return s || null;
  };

  const item = data?.item;
  const stocks = data?.stocks || [];
  const batches = data?.batches || [];
  const serials = data?.serials || [];
  const reservations = data?.reservations || [];
  const movements = data?.movements || [];
  const receipts = data?.receipts || [];
  const issues = data?.issues || [];
  const uomConversions = data?.uom_conversions || [];
  const auditLogs = data?.audit_logs || [];

  const totalQty = stocks.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
  const totalReserved = stocks.reduce((s: number, i: any) => s + Number(i.reserved || 0), 0);
  const totalInTransit = stocks.reduce((s: number, i: any) => s + Number(i.in_transit || 0), 0);
  const totalAvailable = Math.max(totalQty - totalReserved, 0);
  const avgCost = Number(item?.avg_cost || item?.cost || 0);
  const totalValue = totalQty * avgCost;

  const handleUpdateLocation = async (invItemId: number, locId: number) => {
    setSavingLocation(true);
    try {
      const res = await api.put("/api/inventory/update-location", {
        inventory_item_id: invItemId,
        location_id: locId || null,
        user_name: "مدير المخزن"
      });
      if (res.ok) {
        onNotify?.("تم تحديث موقع التخزين بنجاح", "success");
        fetchDetails();
        onRefreshParent?.();
      } else {
        onNotify?.("فشل تحديث موقع التخزين", "error");
      }
    } catch (e) {
      onNotify?.("خطأ في الاتصال", "error");
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-xs transition-opacity duration-300 flex justify-end">
      <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
        {/* Drawer Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-black">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">{item?.name || "تفاصيل الصنف"}</h2>
                {cleanCode(item?.code || item?.item_code, item?.id) && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-orange-500/20 text-orange-400 font-mono text-xs font-bold border border-orange-500/30">
                    {cleanCode(item?.code || item?.item_code, item?.id)}
                  </span>
                )}
                {item?.tracking_type && item.tracking_type !== "none" && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 text-xs font-bold border border-purple-500/30">
                    {item.tracking_type === "batch" ? "تتبع تشغيلات" : "تتبع سيريال"}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                <span>التصنيف: <strong className="text-slate-200">{cleanStr(item?.category) || "عام"}</strong></span>
                {cleanStr(item?.brand) && <span>الماركة: <strong className="text-slate-200">{cleanStr(item.brand)}</strong></span>}
                {cleanStr(item?.barcode) && <span>الباركود: <strong className="font-mono text-slate-200">{cleanStr(item.barcode)}</strong></span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetails}
              title="تحديث البيانات"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Quick KPI Strip */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-slate-500">إجمالي الرصيد</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{fmt(totalQty)} <span className="text-xs font-medium text-slate-500">{item?.unit || "وحدة"}</span></p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-emerald-600">المتاح للصرف</p>
            <p className="text-lg font-black text-emerald-600 mt-0.5">{fmt(totalAvailable)} <span className="text-xs font-medium text-emerald-500">{item?.unit}</span></p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-amber-600">المحجوز</p>
            <p className="text-lg font-black text-amber-600 mt-0.5">{fmt(totalReserved)} <span className="text-xs font-medium text-amber-500">{item?.unit}</span></p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
            <p className="text-[11px] font-bold text-blue-600">قيد النقل</p>
            <p className="text-lg font-black text-blue-600 mt-0.5">{fmt(totalInTransit)} <span className="text-xs font-medium text-blue-500">{item?.unit}</span></p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs col-span-2 sm:col-span-1">
            <p className="text-[11px] font-bold text-slate-500">قيمة المخزون</p>
            <p className="text-lg font-black text-slate-900 mt-0.5">{fmtMoney(totalValue)}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 bg-white border-b border-slate-200 overflow-x-auto scrollbar-none">
          {[
            { id: "summary", label: "ملخص الأرصدة والمخازن", icon: Box },
            { id: "locations", label: "مواقع التخزين والأرفف", icon: MapPin },
            { id: "reservations", label: `الحجوزات (${reservations.length})`, icon: Lock },
            { id: "batches", label: `التشغيلات (${batches.length})`, icon: Tag },
            { id: "serials", label: `السيريال (${serials.length})`, icon: Hash },
            { id: "receipts", label: `الاستلامات (${receipts.length})`, icon: ShieldCheck },
            { id: "issues", label: `الصرفيات (${issues.length})`, icon: FileText },
            { id: "consumption", label: "تحليل الاستهلاك", icon: TrendingUp },
            { id: "ledger", label: `سجل الحركات (${movements.length})`, icon: History },
            { id: "audit", label: "سجل التدقيق", icon: Clock },
          ].map(t => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`flex items-center gap-2 py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-orange-500 text-orange-600 bg-orange-50/50"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-orange-500" : "text-slate-400"}`} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Drawer Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-orange-500" />
              <p className="text-sm font-bold">جاري تحميل بيانات الصنف التفصيلية...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: SUMMARY & WAREHOUSE DISTRIBUTION */}
              {activeTab === "summary" && (
                <div className="space-y-6">
                  {/* Master Specs Grid */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block mb-1">وحدة التخزين الأساسية:</span>
                      <span className="font-black text-slate-800 text-sm">{item?.unit || "قطعة"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">وحدة الشراء:</span>
                      <span className="font-black text-slate-800 text-sm">
                        {item?.purchase_unit || item?.unit || "—"}
                        {item?.conversion_factor > 1 && ` (معامل: ${item.conversion_factor})`}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">متوسط التكلفة:</span>
                      <span className="font-black text-emerald-700 text-sm">{fmtMoney(item?.avg_cost || item?.cost || 0)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">طريقة التقييم:</span>
                      <span className="font-bold text-slate-700 uppercase">{item?.valuation_method || "weighted_average"}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">الحد الأدنى (Min Stock):</span>
                      <span className="font-bold text-slate-800">{fmt(item?.min_stock)} {item?.unit}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">نقطة إعادة الطلب (ROP):</span>
                      <span className="font-bold text-amber-700">{fmt(item?.reorder_point || item?.min_stock)} {item?.unit}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">الحد الأقصى (Max Stock):</span>
                      <span className="font-bold text-slate-800">{fmt(item?.max_stock)} {item?.unit}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block mb-1">مخزون الأمان (Safety):</span>
                      <span className="font-bold text-blue-700">{fmt(item?.safety_stock)} {item?.unit}</span>
                    </div>
                  </div>

                  {/* Warehouse Distribution Table */}
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <Box className="w-4 h-4 text-orange-500" /> توزيع الأرصدة عبر المخازن
                    </h3>
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="p-3 font-bold text-slate-600">المخزن</th>
                            <th className="p-3 font-bold text-slate-600">مكان التخزين (Location)</th>
                            <th className="p-3 font-bold text-slate-600 text-center">الكمية</th>
                            <th className="p-3 font-bold text-slate-600 text-center">المحجوز</th>
                            <th className="p-3 font-bold text-slate-600 text-center">المتاح</th>
                            <th className="p-3 font-bold text-slate-600 text-center">قيد النقل</th>
                            <th className="p-3 font-bold text-slate-600 text-center">القيمة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {stocks.length === 0 ? (
                            <tr><td colSpan={7} className="p-6 text-center text-slate-400">لا توجد أرصدة مسجلة في المخازن</td></tr>
                          ) : (
                            stocks.map((stk: any) => {
                              const sQty = Number(stk.quantity || 0);
                              const sRes = Number(stk.reserved || 0);
                              const sAvail = Math.max(sQty - sRes, 0);
                              const sVal = sQty * avgCost;
                              return (
                                <tr key={stk.id} className="hover:bg-slate-50">
                                  <td className="p-3 font-bold text-slate-900">{stk.warehouse_name} ({stk.warehouse_code})</td>
                                  <td className="p-3 text-slate-600">
                                    {stk.location_code ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-mono text-[11px]">
                                        <MapPin className="w-3 h-3 text-amber-600" />
                                        {stk.location_code} ({stk.zone || "—"}/{stk.rack || "—"}/{stk.bin || "—"})
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 italic">غير محدد (مخزن عام)</span>
                                    )}
                                  </td>
                                  <td className="p-3 text-center font-bold text-slate-900">{fmt(sQty)}</td>
                                  <td className="p-3 text-center font-bold text-amber-600">{fmt(sRes)}</td>
                                  <td className="p-3 text-center font-bold text-emerald-600">{fmt(sAvail)}</td>
                                  <td className="p-3 text-center font-bold text-blue-600">{fmt(stk.in_transit || 0)}</td>
                                  <td className="p-3 text-center font-bold text-slate-800">{fmtMoney(sVal)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Multi-UOM Table */}
                  {uomConversions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-purple-600" /> وحدات القياس والتحويلات
                      </h3>
                      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                              <th className="p-3 font-bold text-slate-600">الوحدة البديلة</th>
                              <th className="p-3 font-bold text-slate-600">معامل التحويل للوحدة الأساسية</th>
                              <th className="p-3 font-bold text-slate-600 text-center">الرصيد المعادل</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {uomConversions.map((u: any) => {
                              const eq = Number(u.conversion_factor) > 0 ? totalQty / Number(u.conversion_factor) : 0;
                              return (
                                <tr key={u.id}>
                                  <td className="p-3 font-bold text-slate-800">{u.uom_name}</td>
                                  <td className="p-3 text-slate-600 font-mono">1 {u.uom_name} = {u.conversion_factor} {item?.unit}</td>
                                  <td className="p-3 text-center font-bold text-purple-700">{fmt(eq)} {u.uom_name}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: LOCATIONS & BINS */}
              {activeTab === "locations" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">تعيين موقع التخزين للصنف بالمخازن</h3>
                      <p className="text-xs text-slate-500">حدد الرف أو الحاوية الدقيقة لتسهيل الوصول والتجهيز وسرعة الجرد</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {stocks.map((stk: any) => {
                      const currentLocId = selectedLocationMap[stk.id] || 0;
                      const whLocations = locationsList.filter((l: any) => l.warehouse_id === stk.warehouse_id);

                      return (
                        <div key={stk.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Box className="w-4 h-4 text-orange-500" />
                              <h4 className="font-bold text-slate-800 text-sm">{stk.warehouse_name}</h4>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">الرصيد في هذا المخزن: <strong className="text-slate-800">{fmt(stk.quantity)} {item?.unit}</strong></p>
                          </div>

                          <div className="flex items-center gap-3 w-full md:w-auto">
                            <select
                              value={currentLocId}
                              onChange={e => setSelectedLocationMap({ ...selectedLocationMap, [stk.id]: Number(e.target.value) })}
                              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-orange-500 w-full md:w-64"
                            >
                              <option value={0}>-- غير محدد (مخزن عام) --</option>
                              {whLocations.map((loc: any) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.code} ({loc.name}) - {loc.type} [Z:{loc.zone || "-"} / R:{loc.rack || "-"} / B:{loc.bin || "-"}]
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleUpdateLocation(stk.id, currentLocId)}
                              disabled={savingLocation}
                              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap"
                            >
                              حفظ الموقع
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: RESERVATIONS */}
              {activeTab === "reservations" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-600" /> الحجوزات النشطة على هذا الصنف
                    </h3>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">المخزن</th>
                          <th className="p-3 font-bold text-slate-600">الجهة / المرجع</th>
                          <th className="p-3 font-bold text-slate-600">رقم السند</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الكمية المحجوزة</th>
                          <th className="p-3 font-bold text-slate-600">تاريخ الحجز</th>
                          <th className="p-3 font-bold text-slate-600">المستخدم</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reservations.length === 0 ? (
                          <tr><td colSpan={7} className="p-6 text-center text-slate-400">لا توجد كميات محجوزة حالياً على هذا الصنف</td></tr>
                        ) : (
                          reservations.map((r: any) => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="p-3 font-bold text-slate-900">{r.warehouse_name}</td>
                              <td className="p-3 text-slate-700">{r.reserved_for_type || "أمر بيع / طلب صرف"}</td>
                              <td className="p-3 font-mono font-bold text-amber-700">#{r.reference_id || r.id}</td>
                              <td className="p-3 text-center font-bold text-amber-600">{fmt(r.quantity)} {item?.unit}</td>
                              <td className="p-3 text-slate-500">{new Date(r.created_at).toLocaleDateString("ar-EG-u-nu-latn")}</td>
                              <td className="p-3 text-slate-700">{r.created_by_user || "النظام"}</td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px] border border-amber-200">
                                  {r.status || "active"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: BATCHES & EXPIRY */}
              {activeTab === "batches" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-purple-600" /> التشغيلات وتواريخ الصلاحية (FEFO/FIFO)
                    </h3>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">رقم التشغيلة (Batch)</th>
                          <th className="p-3 font-bold text-slate-600">المخزن</th>
                          <th className="p-3 font-bold text-slate-600">تاريخ الإنتاج</th>
                          <th className="p-3 font-bold text-slate-600">تاريخ الانتهاء</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الكمية المتبقية</th>
                          <th className="p-3 font-bold text-slate-600 text-center">حالة الصلاحية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batches.length === 0 ? (
                          <tr><td colSpan={6} className="p-6 text-center text-slate-400">لا توجد تشغيلات مسجلة لهذا الصنف</td></tr>
                        ) : (
                          batches.map((b: any) => {
                            const exp = b.expiry_date ? new Date(b.expiry_date).getTime() : null;
                            const now = new Date().getTime();
                            const daysLeft = exp ? Math.ceil((exp - now) / (1000 * 60 * 60 * 24)) : 999;
                            let alertBadge = <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold text-[10px]">صالح ({daysLeft} يوم)</span>;
                            if (daysLeft < 0) {
                              alertBadge = <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold text-[10px]">منتهي الصلاحية</span>;
                            } else if (daysLeft <= 7) {
                              alertBadge = <span className="px-2 py-0.5 rounded-md bg-red-50 text-red-700 font-bold text-[10px]">حرج ({daysLeft} يوم)</span>;
                            } else if (daysLeft <= 30) {
                              alertBadge = <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-bold text-[10px]">قرب الانتهاء ({daysLeft} يوم)</span>;
                            }

                            return (
                              <tr key={b.id} className="hover:bg-slate-50">
                                <td className="p-3 font-mono font-bold text-purple-700">{b.batch_number}</td>
                                <td className="p-3 font-bold text-slate-800">{b.warehouse_name}</td>
                                <td className="p-3 text-slate-500">{b.manufacturing_date ? new Date(b.manufacturing_date).toLocaleDateString("ar-EG-u-nu-latn") : "—"}</td>
                                <td className="p-3 font-bold text-slate-800">{b.expiry_date ? new Date(b.expiry_date).toLocaleDateString("ar-EG-u-nu-latn") : "—"}</td>
                                <td className="p-3 text-center font-bold text-slate-900">{fmt(b.remaining_quantity || b.quantity)} {item?.unit}</td>
                                <td className="p-3 text-center">{alertBadge}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 5: SERIAL NUMBERS */}
              {activeTab === "serials" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Hash className="w-4 h-4 text-blue-600" /> الأرقام التسلسلية المسجلة
                    </h3>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">الرقم التسلسلي (Serial No.)</th>
                          <th className="p-3 font-bold text-slate-600">المخزن والموقع</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الحالة</th>
                          <th className="p-3 font-bold text-slate-600">نهاية الضمان</th>
                          <th className="p-3 font-bold text-slate-600">الملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {serials.length === 0 ? (
                          <tr><td colSpan={5} className="p-6 text-center text-slate-400">لا توجد أرقام تسلسلية مسجلة</td></tr>
                        ) : (
                          serials.map((s: any) => (
                            <tr key={s.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-blue-700">{s.serial_number}</td>
                              <td className="p-3 text-slate-800">{s.warehouse_name || "—"} {s.location_code ? `(${s.location_code})` : ""}</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                  s.status === "in_stock" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"
                                }`}>
                                  {s.status === "in_stock" ? "بالمخزن" : s.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500">{s.warranty_end_date ? new Date(s.warranty_end_date).toLocaleDateString("ar-EG-u-nu-latn") : "—"}</td>
                              <td className="p-3 text-slate-500">{s.notes || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: GOODS RECEIPTS */}
              {activeTab === "receipts" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> سجل الاستلامات وسندات التوريد وتقييم الإنتاج (GRN & Production Receipts)
                  </h3>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">رقم السند (GRN / Receipt)</th>
                          <th className="p-3 font-bold text-slate-600">المورد / أمر الإنتاج</th>
                          <th className="p-3 font-bold text-slate-600">التاريخ</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الكمية المستلمة</th>
                          <th className="p-3 font-bold text-slate-600 text-center">سعر / تكلفة الوحدة</th>
                          <th className="p-3 font-bold text-slate-600">مكونات التكلفة</th>
                          <th className="p-3 font-bold text-slate-600">المستلم</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {receipts.length === 0 ? (
                          <tr><td colSpan={7} className="p-6 text-center text-slate-400">لا توجد استلامات مسجلة</td></tr>
                        ) : (
                          receipts.map((r: any, idx: number) => {
                            let compText = "—";
                            if (r.cost_components) {
                              try {
                                const parsed = typeof r.cost_components === "string" ? JSON.parse(r.cost_components) : r.cost_components;
                                const comp = Array.isArray(parsed) ? parsed[0]?.cost_components : parsed;
                                if (comp && typeof comp === "object") {
                                  compText = `خامات: ${fmt(comp.direct_materials || 0)} | عمالة: ${fmt(comp.direct_labor || 0)} | غير مباشرة: ${fmt(comp.overhead || 0)}`;
                                }
                              } catch (_) {}
                            }
                            return (
                              <tr key={`${r.id}-${idx}`} className="hover:bg-slate-50">
                                <td className="p-3 font-mono font-bold text-emerald-700">{r.grn_number}</td>
                                <td className="p-3 font-bold text-slate-800">{r.supplier_name || (r.production_order ? `أمر إنتاج ${r.production_order}` : "—")}</td>
                                <td className="p-3 text-slate-500">{r.receipt_date ? new Date(r.receipt_date).toLocaleDateString("ar-EG-u-nu-latn") : "—"}</td>
                                <td className="p-3 text-center font-bold text-slate-900">{fmt(r.received_quantity || r.quantity)} {item?.unit}</td>
                                <td className="p-3 text-center font-bold text-emerald-700">{fmtMoney(r.unit_price || 0)}</td>
                                <td className="p-3 text-[11px] font-mono text-slate-600">{compText}</td>
                                <td className="p-3 text-slate-600">{r.received_by || "—"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 7: MATERIAL ISSUES */}
              {activeTab === "issues" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" /> سجل الصرف للأقسام والتشغيل
                  </h3>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">رقم الطلب</th>
                          <th className="p-3 font-bold text-slate-600">القسم / مركز التكلفة</th>
                          <th className="p-3 font-bold text-slate-600">نوع الصرف</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الكمية المنصرفة</th>
                          <th className="p-3 font-bold text-slate-600">التاريخ</th>
                          <th className="p-3 font-bold text-slate-600">الطالب</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {issues.length === 0 ? (
                          <tr><td colSpan={6} className="p-6 text-center text-slate-400">لا توجد عمليات صرف مسجلة</td></tr>
                        ) : (
                          issues.map((iss: any) => (
                            <tr key={iss.id} className="hover:bg-slate-50">
                              <td className="p-3 font-mono font-bold text-blue-700">{iss.request_number}</td>
                              <td className="p-3 font-bold text-slate-800">{iss.department || "عام"}</td>
                              <td className="p-3 text-slate-600">{iss.request_type}</td>
                              <td className="p-3 text-center font-bold text-red-600">{fmt(iss.issued_quantity || iss.quantity)} {item?.unit}</td>
                              <td className="p-3 text-slate-500">{new Date(iss.issue_date).toLocaleDateString("ar-EG-u-nu-latn")}</td>
                              <td className="p-3 text-slate-600">{iss.requester_name || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 8: CONSUMPTION & ROP INTELLIGENCE */}
              {activeTab === "consumption" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">معدل الاستهلاك اليومي (30 يوم)</span>
                      <p className="text-2xl font-black text-slate-900">
                        {fmt(data?.item?.daily_avg_consumption || 0)} <span className="text-xs font-medium text-slate-500">{item?.unit}/يوم</span>
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">أيام التغطية (Days of Supply)</span>
                      <p className="text-2xl font-black text-emerald-600">
                        {data?.item?.days_of_supply ? `${data.item.days_of_supply} يوم` : "غير محدد"}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                      <span className="text-xs text-slate-500 font-bold block mb-1">الكمية المقترحة للشراء</span>
                      <p className="text-2xl font-black text-orange-600">
                        {fmt(data?.item?.suggested_order_qty || 0)} <span className="text-xs font-medium text-slate-500">{item?.unit}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
                    <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-600" /> تحليل إعادة الطلب ونقاط الأمان
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      يتم حساب نقطة إعادة الطلب آلياً بناءً على معادلة:
                      <strong className="text-slate-900 mr-1"> (متوسط الاستهلاك اليومي × فترة التوريد {item?.lead_time_days || 7} أيام) + مخزون الأمان</strong>
                    </p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <span className="text-slate-500 block mb-1">الرصيد المتاح:</span>
                        <strong className="text-emerald-700 text-sm">{fmt(totalAvailable)} {item?.unit}</strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <span className="text-slate-500 block mb-1">نقطة إعادة الطلب (ROP):</span>
                        <strong className="text-amber-700 text-sm">{fmt(item?.reorder_point || item?.min_stock)} {item?.unit}</strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <span className="text-slate-500 block mb-1">مخزون الأمان (Safety):</span>
                        <strong className="text-blue-700 text-sm">{fmt(item?.safety_stock)} {item?.unit}</strong>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl">
                        <span className="text-slate-500 block mb-1">الحد الأقصى (Max):</span>
                        <strong className="text-slate-800 text-sm">{fmt(item?.max_stock)} {item?.unit}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: STOCK CARD (LEDGER) */}
              {activeTab === "ledger" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-600" /> بطاقة حركة الصنف (Stock Ledger)
                  </h3>

                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="p-3 font-bold text-slate-600">التاريخ والوقت</th>
                          <th className="p-3 font-bold text-slate-600">المخزن</th>
                          <th className="p-3 font-bold text-slate-600">نوع الحركة</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الرصيد قبل</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الحركة</th>
                          <th className="p-3 font-bold text-slate-600 text-center">الرصيد بعد</th>
                          <th className="p-3 font-bold text-slate-600">المستخدم</th>
                          <th className="p-3 font-bold text-slate-600">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {movements.length === 0 ? (
                          <tr><td colSpan={8} className="p-6 text-center text-slate-400">لا توجد حركات مسجلة</td></tr>
                        ) : (
                          movements.map((m: any) => {
                            const isPositive = Number(m.delta) > 0;
                            return (
                              <tr key={m.id} className="hover:bg-slate-50">
                                <td className="p-3 text-slate-500 font-mono">{new Date(m.created_at).toLocaleString("ar-EG-u-nu-latn")}</td>
                                <td className="p-3 font-bold text-slate-800">{m.warehouse_name}</td>
                                <td className="p-3 font-bold text-slate-700">{m.ref_type}</td>
                                <td className="p-3 text-center text-slate-600">{fmt(m.before_qty)}</td>
                                <td className={`p-3 text-center font-black ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                                  {isPositive ? `+${fmt(m.delta)}` : fmt(m.delta)}
                                </td>
                                <td className="p-3 text-center font-bold text-slate-900">{fmt(m.after_qty)}</td>
                                <td className="p-3 text-slate-600">{m.user || "—"}</td>
                                <td className="p-3 text-slate-500">{m.notes || "—"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 10: AUDIT TRAIL */}
              {activeTab === "audit" && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-600" /> سجل العمليات والتدقيق (Audit Log)
                  </h3>

                  <div className="space-y-3">
                    {auditLogs.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl">لا توجد سجلات تدقيق مسجلة</div>
                    ) : (
                      auditLogs.map((log: any) => (
                        <div key={log.id} className="bg-white rounded-xl border border-slate-200 p-4 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900">{log.action} ({log.entity_type})</span>
                            <span className="text-slate-400 font-mono">{new Date(log.created_at).toLocaleString("ar-EG-u-nu-latn")}</span>
                          </div>
                          <p className="text-slate-600 mb-1">{log.details}</p>
                          <span className="text-[11px] text-slate-400">بواسطة: <strong className="text-slate-600">{log.user_name}</strong></span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            الصنف معرف: <span className="font-mono font-bold text-slate-700">#{item?.id}</span> | كود: <span className="font-mono font-bold text-orange-600">{item?.code || "—"}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
