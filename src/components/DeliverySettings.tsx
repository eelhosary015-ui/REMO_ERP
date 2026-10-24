import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { MapPin, Plus, Trash2, Save, Edit2, X } from "lucide-react";
import { api } from "../utils/api";
import { Branch, DeliveryArea } from "../types";
import { useAuth } from "../contexts/AuthContext";

interface DeliverySettingsProps {
  onBack: () => void;
}

export const DeliverySettings: React.FC<DeliverySettingsProps> = ({
  onBack,
}) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: "", price: 0 });

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (selectedBranchId) {
      fetchAreas(selectedBranchId);
    } else {
      setAreas([]);
    }
  }, [selectedBranchId]);

  const fetchBranches = async () => {
    try {
      const res = await api.get("/api/branches");
      if (res.ok) {
        const data = await res.json();
        const branchList = Array.isArray(data) ? data : [];
        setBranches(branchList);
        if (branchList.length > 0) {
          const defaultBranch = user?.branch_id
            ? branchList.find((b) => b.id === user.branch_id)
            : branchList[0];
          setSelectedBranchId(
            defaultBranch?.id?.toString() || branchList[0]?.id?.toString(),
          );
        }
      }
    } catch (error) {
      console.error("Failed to fetch branches", error);
    }
  };

  const fetchAreas = async (branchId: string) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/delivery-areas?branch_id=${branchId}`);
      if (res.ok) {
        setAreas(await res.json());
      }
    } catch (error) {
      console.error("Failed to fetch delivery areas", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert("يرجى إدخال اسم المنطقة");
      return;
    }
    if (formData.price < 0) {
      alert("لا يمكن أن يكون السعر بالسالب");
      return;
    }

    try {
      if (editingId) {
        await api.put(`/api/delivery-areas/${editingId}`, {
          name: formData.name,
          price: formData.price,
          is_active: true,
        });
      } else {
        await api.post("/api/delivery-areas", {
          id: Date.now().toString(),
          branch_id: selectedBranchId,
          name: formData.name,
          price: formData.price,
          is_active: true,
        });
      }

      setFormData({ name: "", price: 0 });
      setIsAdding(false);
      setEditingId(null);
      fetchAreas(selectedBranchId);
    } catch (error) {
      console.error("Failed to save delivery area", error);
      alert("حدث خطأ أثناء الحفظ");
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذه المنطقة؟")) return;
    try {
      await api.delete(`/api/delivery-areas/${id}`);
      fetchAreas(selectedBranchId);
    } catch (error) {
      console.error("Failed to delete delivery area", error);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  const handleEdit = (area: DeliveryArea) => {
    setEditingId(area.id);
    setFormData({ name: area.name, price: area.price });
    setIsAdding(true);
  };

  return (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <MapPin className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              إعدادات الدليفري والمناطق
            </h1>
            <p className="text-slate-500 text-sm">
              إدارة مناطق التوصيل وأسعارها لكل فرع
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-300 transition-all"
        >
          رجوع
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              الفرع
            </label>
            <select
              value={selectedBranchId ?? ""}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
              setFormData({ name: "", price: 0 });
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-xl flex items-center gap-2 transition-all w-full md:w-auto mt-auto"
          >
            <Plus className="w-5 h-5" />
            <span>إضافة منطقة جديدة</span>
          </button>
        </div>

        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">
                {editingId ? "تعديل منطقة" : "إضافة منطقة جديدة"}
              </h3>
              <button
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  اسم المنطقة
                </label>
                <input
                  type="text"
                  value={formData.name ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="مثال: مدينة نصر، التجمع..."
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  سعر التوصيل (0 = مجاناً)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.price ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, price: Number(e.target.value) })
                  }
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 transition-all"
              >
                <Save className="w-5 h-5" />
                <span>حفظ</span>
              </button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-500">
            جاري التحميل...
          </div>
        ) : areas.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">
              لا توجد مناطق توصيل
            </h3>
            <p className="text-slate-500">
              قم بإضافة مناطق توصيل لهذا الفرع للبدء
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-4 font-semibold text-slate-700">
                    اسم المنطقة
                  </th>
                  <th className="p-4 font-semibold text-slate-700">
                    سعر التوصيل
                  </th>
                  <th className="p-4 font-semibold text-slate-700 text-left">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody>
                {areas.map((area) => (
                  <tr
                    key={area.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="p-4 font-medium text-slate-900">
                      {area.name}
                    </td>
                    <td className="p-4">
                      {area.price === 0 ? (
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-sm font-medium">
                          مجاناً
                        </span>
                      ) : (
                        <span className="font-bold text-slate-700">
                          {area.price} ج.م
                        </span>
                      )}
                    </td>
                    <td className="p-4 flex justify-end gap-2">
                      <button
                        onClick={() => handleEdit(area)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(area.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
