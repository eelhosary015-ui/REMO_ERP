import React, { useState } from "react";
import {
  Layers,
  Plus,
  ShieldCheck,
  Calendar,
  Wallet,
  Package,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Save
} from "lucide-react";
import { TreasuryCustodyType } from "../../../types";
import { api } from "../../../utils/api";

interface TypesViewProps {
  types: TreasuryCustodyType[];
  onRefresh: () => void;
}

export const CustodyTypesView: React.FC<TypesViewProps> = ({ types, onRefresh }) => {
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<TreasuryCustodyType | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    name_ar: "",
    name_en: "",
    category: "cash" as 'cash' | 'asset' | 'equipment' | 'inventory' | 'vehicle' | 'temporary' | 'permanent',
    requires_asset: false,
    requires_inventory: false,
    requires_treasury: true,
    max_limit: "0",
    default_duration_days: "30",
    description: "",
    is_active: true
  });

  const handleOpenCreate = () => {
    setSelectedType(null);
    setFormData({
      code: `TYPE-${types.length + 1}`,
      name_ar: "",
      name_en: "",
      category: "cash",
      requires_asset: false,
      requires_inventory: false,
      requires_treasury: true,
      max_limit: "50000",
      default_duration_days: "30",
      description: "",
      is_active: true
    });
    setShowModal(true);
  };

  const handleOpenEdit = (t: TreasuryCustodyType) => {
    setSelectedType(t);
    setFormData({
      code: t.code,
      name_ar: t.name_ar,
      name_en: t.name_en || "",
      category: t.category || "cash",
      requires_asset: t.requires_asset,
      requires_inventory: t.requires_inventory,
      requires_treasury: t.requires_treasury,
      max_limit: t.max_limit ? t.max_limit.toString() : "0",
      default_duration_days: t.default_duration_days ? t.default_duration_days.toString() : "30",
      description: t.description || "",
      is_active: t.is_active
    });
    setShowModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name_ar.trim()) {
      alert("يرجى كتابة اسم نوع العهدة بالعربية");
      return;
    }

    try {
      const payload = {
        code: formData.code,
        name_ar: formData.name_ar,
        name_en: formData.name_en,
        category: formData.category,
        requires_asset: formData.requires_asset,
        requires_inventory: formData.requires_inventory,
        requires_treasury: formData.requires_treasury,
        max_limit: parseFloat(formData.max_limit) || 0,
        default_duration_days: parseInt(formData.default_duration_days) || 30,
        description: formData.description,
        is_active: formData.is_active
      };

      const res = selectedType
        ? await api.put(`/api/treasury/custody-types/${selectedType.id}`, payload)
        : await api.post("/api/treasury/custody-types", payload);

      if (res.ok) {
        setShowModal(false);
        onRefresh();
        alert("تم حفظ نوع وسياسة العهدة بنجاح");
      } else {
        const err = await res.json();
        alert(`فشل الحفظ: ${err.error || "خطأ غير متوقع"}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4 text-right">
      {/* Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            أنواع العهد والسياسات والحدود الرقابية
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            تحديد تصنيفات العهد (نقدية، أصول، معدات، بضاعة)، الحدود القصوى للمبالغ، والمدد الافتراضية للتسوية
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة نوع عهدة جديد</span>
        </button>
      </div>

      {/* Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {types.map((t) => (
          <div
            key={t.id}
            className="bg-white p-5 rounded-3xl border border-slate-200 hover:border-indigo-300 shadow-sm space-y-3 transition-all flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                  {t.code}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {t.is_active ? 'نشط ومعتمد' : 'معطل'}
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-800">{t.name_ar}</h4>
              <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                {t.description || "لا يوجد وصف محدد"}
              </p>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الحد المالي الأقصى:</span>
                  <strong className="text-slate-800 font-mono">
                    {t.max_limit ? `${Number(t.max_limit).toLocaleString()} ج.م` : 'غير مقيد'}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">مدة التسوية الافتراضية:</span>
                  <strong className="text-slate-800 font-mono">
                    {t.default_duration_days} يوم
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">الخصم من الخزينة:</span>
                  <strong className={t.requires_treasury ? "text-indigo-600" : "text-slate-400"}>
                    {t.requires_treasury ? "نعم (سند صرف)" : "لا"}
                  </strong>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ربط بأصول عينية:</span>
                  <strong className={t.requires_asset ? "text-indigo-600" : "text-slate-400"}>
                    {t.requires_asset ? "نعم (أجهزة/معدات)" : "لا"}
                  </strong>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <div className="text-[11px] text-slate-400 font-bold">
                {t.active_custodies_count ? `${t.active_custodies_count} عهدة نشطة` : "0 عهدة نشطة"}
              </div>
              <button
                onClick={() => handleOpenEdit(t)}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="تعديل السياسة"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-100 my-6 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h4 className="text-sm font-black text-slate-900">
                {selectedType ? "تعديل نوع وسياسة العهدة" : "إضافة نوع وسياسة عهدة جديدة"}
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">كود النوع</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">التصنيف العام</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="cash">عهدة نقدية</option>
                    <option value="asset">أصول ومعدات</option>
                    <option value="equipment">أدوات تشغيل</option>
                    <option value="inventory">أمانات بضاعة</option>
                    <option value="vehicle">سيارات ومركبات</option>
                    <option value="temporary">عهدة مؤقتة</option>
                    <option value="permanent">عهدة مستديمة</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">الاسم بالعربية *</label>
                <input
                  type="text"
                  placeholder="مثال: عهدة نثريات المشتريات اليومية..."
                  value={formData.name_ar}
                  onChange={(e) => setFormData(prev => ({ ...prev, name_ar: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">الحد الأقصى للمبلغ (ج.م)</label>
                  <input
                    type="number"
                    value={formData.max_limit}
                    onChange={(e) => setFormData(prev => ({ ...prev, max_limit: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">المدة الافتراضية (أيام)</label>
                  <input
                    type="number"
                    value={formData.default_duration_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, default_duration_days: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold"
                  />
                </div>
              </div>

              {/* Requirement Checkboxes */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req_treasury"
                    checked={formData.requires_treasury}
                    onChange={(e) => setFormData(prev => ({ ...prev, requires_treasury: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="req_treasury" className="font-bold text-slate-700 cursor-pointer">
                    تتطلب خصم وصرف نقدي من الخزينة
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req_asset"
                    checked={formData.requires_asset}
                    onChange={(e) => setFormData(prev => ({ ...prev, requires_asset: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  <label htmlFor="req_asset" className="font-bold text-slate-700 cursor-pointer">
                    تتطلب ربط بأصل ثابت أو جهاز عيني
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">الوصف والضوابط</label>
                <textarea
                  placeholder="اكتب تفاصيل وضوابط صرف واستخدام هذا النوع..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs min-h-[60px]"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 text-xs rounded-xl font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ السياسة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
