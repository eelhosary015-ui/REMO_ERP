import React, { useState, useEffect } from "react";
import { Plus, Search, XCircle } from "lucide-react";
import { api } from "../utils/api";

export function PutawayRules() {
  const [rules, setRules] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    ingredient_id: "",
    warehouse_id: "",
    priority: "1",
    capacity: "0",
  });

  useEffect(() => {
    fetchRules();
    fetchWarehouses();
    fetchIngredients();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await api.get("/api/inventory/putaway-rules");
      if (res.ok) setRules(await res.json());
    } catch (e) {}
  };

  const fetchWarehouses = async () => {
    try {
      const res = await api.get("/api/inventory/warehouses");
      if (res.ok) setWarehouses(await res.json());
    } catch (e) {}
  };

  const fetchIngredients = async () => {
    try {
      const res = await api.get("/api/ingredients");
      if (res.ok) setIngredients(await res.json());
    } catch (e) {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post("/api/inventory/putaway-rules", formData);
      if (res.ok) {
        setShowModal(false);
        fetchRules();
        setFormData({
          ingredient_id: "",
          warehouse_id: "",
          priority: "1",
          capacity: "0",
        });
      }
    } catch (e) {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه القاعدة؟")) return;
    try {
      const res = await api.delete(`/api/inventory/putaway-rules/${id}`);
      if (res.ok) fetchRules();
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold text-slate-800">
          قواعد التخزين (Putaway Rules)
        </h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة قاعدة
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-right min-w-[800px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">الصنف</th>
              <th className="p-4 font-bold text-slate-600">المستودع</th>
              <th className="p-4 font-bold text-slate-600">الأولوية</th>
              <th className="p-4 font-bold text-slate-600">السعة التخزينية</th>
              <th className="p-4 font-bold text-slate-600">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((rule) => (
              <tr key={rule.id} className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-800">
                  {rule.ingredient_name}
                </td>
                <td className="p-4 text-slate-600">{rule.warehouse_name}</td>
                <td className="p-4 font-bold text-blue-600">{rule.priority}</td>
                <td className="p-4 text-slate-600">{rule.capacity}</td>
                <td className="p-4">
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-rose-500 hover:text-rose-600 font-bold text-sm"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  لا توجد قواعد تخزين.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                قاعدة تخزين جديدة
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  الصنف
                </label>
                <select
                  required
                  value={formData.ingredient_id}
                  onChange={(e) =>
                    setFormData({ ...formData, ingredient_id: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="">اختر الصنف...</option>
                  {ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  المستودع (المخزن)
                </label>
                <select
                  required
                  value={formData.warehouse_id}
                  onChange={(e) =>
                    setFormData({ ...formData, warehouse_id: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="">اختر المستودع...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  الأولوية (1 أعلى)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  السعة (Capacity)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600"
                >
                  حفظ القاعدة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
