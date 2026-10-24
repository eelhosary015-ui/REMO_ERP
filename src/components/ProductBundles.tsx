import React, { useState, useEffect } from "react";
import { Plus, Search, XCircle, Package } from "lucide-react";
import { api } from "../utils/api";

export function ProductBundles() {
  const [bundles, setBundles] = useState<any[]>([]);
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    parent_item_id: "",
    description: "",
  });
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    fetchBundles();
    fetchIngredients();
  }, []);

  const fetchBundles = async () => {
    try {
      const res = await api.get("/api/inventory/product-bundles");
      if (res.ok) setBundles(await res.json());
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
    if (items.length === 0) return;
    try {
      const res = await api.post("/api/inventory/product-bundles", {
        ...formData,
        items,
      });
      if (res.ok) {
        setShowModal(false);
        fetchBundles();
        setFormData({ parent_item_id: "", description: "" });
        setItems([]);
      }
    } catch (e) {}
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه الحزمة؟")) return;
    try {
      const res = await api.delete(`/api/inventory/product-bundles/${id}`);
      if (res.ok) fetchBundles();
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-500" />
            حزم المنتجات (Product Bundles)
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تجميع عدة منتجات في منتج واحد ليتم بيعه كحزمة
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-colors"
        >
          <Plus className="w-5 h-5" />
          إضافة حزمة منتجات
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="p-4 font-bold text-slate-600">
                المنتج الأساسي (الحزمة)
              </th>
              <th className="p-4 font-bold text-slate-600">الوصف</th>
              <th className="p-4 font-bold text-slate-600">المحتويات</th>
              <th className="p-4 font-bold text-slate-600">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {bundles.map((bundle) => (
              <tr key={bundle.id} className="hover:bg-slate-50">
                <td className="p-4 font-bold text-slate-800">
                  {bundle.parent_item_name}
                </td>
                <td className="p-4 text-slate-600">{bundle.description}</td>
                <td className="p-4">
                  <div className="space-y-1">
                    {bundle.items?.map((i: any, idx: number) => (
                      <div key={idx} className="text-xs text-slate-600">
                        <span className="font-bold">{i.quantity}</span> {i.unit}{" "}
                        × {i.item_name}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleDelete(bundle.id)}
                    className="text-rose-500 hover:text-rose-600 font-bold text-xs p-2"
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
            {bundles.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  لا توجد حزم منتجات.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-500" />
                حزمة منتجات جديدة
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      البند الأصلي (المنتج الحزمة)
                    </label>
                    <select
                      required
                      value={formData.parent_item_id ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          parent_item_id: e.target.value,
                        })
                      }
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">اختر...</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      وصف
                    </label>
                    <input
                      type="text"
                      value={formData.description ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="امثلة: عرض العائلة, باقة التوفير..."
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex gap-4">
                    <select
                      className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-sm outline-none"
                      onChange={(e) => {
                        if (e.target.value) {
                          const ing = ingredients.find(
                            (i) => i.id === parseInt(e.target.value),
                          );
                          if (ing) {
                            setItems([
                              ...items,
                              {
                                item_id: ing.id,
                                name: ing.name,
                                unit: ing.unit,
                                quantity: 1,
                              },
                            ]);
                          }
                          e.target.value = "";
                        }
                      }}
                    >
                      <option value="">إضافة صنف فرعي للحزمة...</option>
                      {ingredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {items.length > 0 && (
                    <table className="w-full text-right text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="p-3">السلعة</th>
                          <th className="p-3">الكمية</th>
                          <th className="p-3">الوحدة</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="p-3 font-bold">{item.name}</td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                value={item.quantity ?? ""}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[idx].quantity =
                                    parseFloat(e.target.value) || 0;
                                  setItems(newItems);
                                }}
                                className="w-24 p-2 border border-slate-200 rounded-lg text-center outline-none"
                              />
                            </td>
                            <td className="p-3 text-slate-500">{item.unit}</td>
                            <td className="p-3">
                              <button
                                type="button"
                                onClick={() =>
                                  setItems(items.filter((_, i) => i !== idx))
                                }
                                className="text-rose-500"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 rounded-b-2xl bg-white mt-auto">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={items.length === 0}
                  className="px-6 py-2 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 disabled:opacity-50"
                >
                  حفظ الحزمة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
