import React, { useState, useEffect } from "react";
import {
  Layers, Plus, Search, RefreshCw, Edit3, Trash2,
  FolderPlus, Eye, CheckCircle2, AlertCircle, MapPin
} from "lucide-react";

interface LocationNode {
  id: number;
  warehouse_id: number;
  warehouse_name?: string;
  parent_id?: number | null;
  code: string;
  name: string;
  type: string; // zone, rack, shelf, bin, bulk, quarantine
  zone?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  barcode?: string;
  max_weight: number;
  max_volume: number;
  is_active: boolean;
  notes?: string;
  children?: LocationNode[];
}

export const WarehouseLocationsView: React.FC<{
  warehouses: any[];
  onNotify: (msg: string, type: "success" | "error") => void;
}> = ({ warehouses, onNotify }) => {
  const [selectedWh, setSelectedWh] = useState<number>(warehouses[0]?.id || 1);
  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingLoc, setEditingLoc] = useState<LocationNode | null>(null);

  const [formData, setFormData] = useState({
    parent_id: "" as string | number,
    code: "",
    name: "",
    type: "bin",
    zone: "",
    rack: "",
    shelf: "",
    bin: "",
    barcode: "",
    max_weight: 0,
    max_volume: 0,
    notes: ""
  });

  const fetchLocations = async () => {
    if (!selectedWh) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/warehouse-locations?warehouse_id=${selectedWh}`);
      const data = await res.json();
      if (data.success) {
        setLocations(data.locations || []);
      }
    } catch (err: any) {
      onNotify("فشل تحميل مواقع التخزين", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [selectedWh]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingLoc ? `/api/warehouse-locations/${editingLoc.id}` : "/api/warehouse-locations";
      const method = editingLoc ? "PUT" : "POST";
      const body = {
        ...formData,
        warehouse_id: selectedWh,
        parent_id: formData.parent_id ? Number(formData.parent_id) : null
      };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.success) {
        onNotify(editingLoc ? "تم تحديث الموقع بنجاح" : "تم إنشاء الموقع بنجاح", "success");
        setShowModal(false);
        setEditingLoc(null);
        fetchLocations();
      } else {
        onNotify(data.error || "حدث خطأ أثناء الحفظ", "error");
      }
    } catch (err: any) {
      onNotify("خطأ في الاتصال بالخادم", "error");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الموقع؟")) return;
    try {
      const res = await fetch(`/api/warehouse-locations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        onNotify("تم حذف الموقع بنجاح", "success");
        fetchLocations();
      } else {
        onNotify(data.error || "فشل الحذف", "error");
      }
    } catch (err) {
      onNotify("خطأ أثناء حذف الموقع", "error");
    }
  };

  const filteredLocations = locations.filter(l =>
    (l.code && String(l.code).toLowerCase().includes(search.toLowerCase())) ||
    (l.name && String(l.name).toLowerCase().includes(search.toLowerCase())) ||
    (l.zone && String(l.zone).toLowerCase().includes(search.toLowerCase())) ||
    (l.barcode && String(l.barcode).includes(search))
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Warehouse Selector */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">هيكل مواقع التخزين والأرفف (Bins & Racks)</h2>
            <p className="text-xs text-slate-500">إدارة المناطق (Zones)، الأرفف الرأسية (Racks)، الرفوف (Shelves)، والحاويات (Bins)</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedWh}
            onChange={(e) => setSelectedWh(Number(e.target.value))}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500"
          >
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name} ({w.code || `WH-${w.id}`})</option>
            ))}
          </select>

          <button
            onClick={() => {
              setEditingLoc(null);
              setFormData({
                parent_id: "",
                code: `LOC-${Date.now().toString().slice(-4)}`,
                name: "",
                type: "bin",
                zone: "",
                rack: "",
                shelf: "",
                bin: "",
                barcode: "",
                max_weight: 0,
                max_volume: 0,
                notes: ""
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" /> إضافة موقع جديد
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block mb-1">إجمالي المواقع</span>
          <span className="text-2xl font-black text-slate-800">{locations.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block mb-1">المناطق (Zones)</span>
          <span className="text-2xl font-black text-amber-600">{locations.filter(l => l.type === 'zone').length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block mb-1">الأرفف (Racks & Shelves)</span>
          <span className="text-2xl font-black text-blue-600">{locations.filter(l => l.type === 'rack' || l.type === 'shelf').length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-500 block mb-1">الحاويات الدقيقة (Bins)</span>
          <span className="text-2xl font-black text-emerald-600">{locations.filter(l => l.type === 'bin').length}</span>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث بالكود، الاسم، المنطقة، الباركود..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          onClick={fetchLocations}
          className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
          title="تحديث"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Locations Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-xs font-bold border-b border-slate-200">
                <th className="p-4">كود الموقع</th>
                <th className="p-4">اسم الموقع</th>
                <th className="p-4">النوع الهيكلي</th>
                <th className="p-4">المنطقة / الرف / الحاوية</th>
                <th className="p-4">الباركود</th>
                <th className="p-4">الحالة</th>
                <th className="p-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLocations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    لا توجد مواقع مسجلة في هذا المخزن بعد. اضغط "إضافة موقع جديد" لإنشاء الهيكل التخزيني.
                  </td>
                </tr>
              ) : (
                filteredLocations.map(loc => (
                  <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                      {loc.code}
                    </td>
                    <td className="p-4 font-medium text-slate-800">{loc.name}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        loc.type === 'zone' ? 'bg-amber-100 text-amber-800' :
                        loc.type === 'rack' ? 'bg-blue-100 text-blue-800' :
                        loc.type === 'shelf' ? 'bg-indigo-100 text-indigo-800' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {loc.type === 'zone' ? 'منطقة (Zone)' :
                         loc.type === 'rack' ? 'حامل (Rack)' :
                         loc.type === 'shelf' ? 'رف (Shelf)' :
                         loc.type === 'bin' ? 'حاوية (Bin)' : loc.type}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-600">
                      {[loc.zone, loc.rack, loc.shelf, loc.bin].filter(Boolean).join(" ❯ ") || "-"}
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-600">{loc.barcode || "-"}</td>
                    <td className="p-4">
                      {loc.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> نشط
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-400 font-bold">
                          <AlertCircle className="w-3.5 h-3.5" /> معطل
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingLoc(loc);
                            setFormData({
                              parent_id: loc.parent_id || "",
                              code: loc.code,
                              name: loc.name,
                              type: loc.type,
                              zone: loc.zone || "",
                              rack: loc.rack || "",
                              shelf: loc.shelf || "",
                              bin: loc.bin || "",
                              barcode: loc.barcode || "",
                              max_weight: loc.max_weight || 0,
                              max_volume: loc.max_volume || 0,
                              notes: loc.notes || ""
                            });
                            setShowModal(true);
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900">
              {editingLoc ? `تعديل الموقع: ${editingLoc.code}` : "إضافة موقع تخزين جديد"}
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود الموقع *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                    placeholder="مثال: Z-A-R01-B01"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم الموقع *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="مثال: حاوية المواد الجافة A1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">النوع الهيكلي</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="zone">منطقة رئيسية (Zone)</option>
                    <option value="rack">حامل رأسي (Rack)</option>
                    <option value="shelf">رف أفقي (Shelf)</option>
                    <option value="bin">حاوية تخزين دقيقة (Bin)</option>
                    <option value="bulk">مساحة تخزين ضخمة (Bulk)</option>
                    <option value="quarantine">منطقة حجر وعزل (Quarantine)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الموقع الأب (Parent)</label>
                  <select
                    value={formData.parent_id}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- بدون موقع أب (مستوى رئيسي) --</option>
                    {locations.filter(l => !editingLoc || l.id !== editingLoc.id).map(l => (
                      <option key={l.id} value={l.id}>{l.code} - {l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">المنطقة (Zone)</label>
                  <input
                    type="text"
                    value={formData.zone}
                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    placeholder="Zone A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">الرف الرأسي (Rack)</label>
                  <input
                    type="text"
                    value={formData.rack}
                    onChange={(e) => setFormData({ ...formData, rack: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    placeholder="Rack 01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">الرف (Shelf)</label>
                  <input
                    type="text"
                    value={formData.shelf}
                    onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    placeholder="Shelf 02"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">الحاوية (Bin)</label>
                  <input
                    type="text"
                    value={formData.bin}
                    onChange={(e) => setFormData({ ...formData, bin: e.target.value })}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                    placeholder="Bin 05"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الباركود للماسح</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                  placeholder="اتركه فارغاً ليطابق الكود تلقائياً"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  placeholder="أي تفاصيل أو إرشادات تخص هذا الموقع..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl"
                >
                  {editingLoc ? "حفظ التعديلات" : "إنشاء الموقع"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
