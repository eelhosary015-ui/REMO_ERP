import React, { useState, useEffect } from "react";
import { ChevronLeft, MapPin, Plus, Edit, Trash2, Save, X, QrCode, RefreshCw, Compass, ShieldCheck, Radio } from "lucide-react";
import { Branch } from "../types";
import { api } from "../utils/api";

interface BranchesProps {
  branches: Branch[];
  onBack: () => void;
  onRefresh: () => void;
}

export const Branches: React.FC<BranchesProps> = ({
  branches,
  onBack,
  onRefresh,
}) => {
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [newBranch, setNewBranch] = useState({
    name: "",
    tables_count: 0,
    latitude: 30.04442,
    longitude: 31.235712,
    geofence_radius_meters: 200,
    geofence_enabled: true,
    qr_attendance_enabled: true
  });

  // Dynamic QR Screen Modal State
  const [qrModalBranch, setQrModalBranch] = useState<Branch | null>(null);
  const [dynamicQrToken, setDynamicQrToken] = useState<string>("");
  const [qrExpiresIn, setQrExpiresIn] = useState<number>(60);
  const [loadingQr, setLoadingQr] = useState<boolean>(false);

  const handleAddBranch = async () => {
    if (!newBranch.name) return;
    await api.post("/api/branches", {
      ...newBranch,
      latitude: Number(newBranch.latitude) || 30.04442,
      longitude: Number(newBranch.longitude) || 31.235712,
      tables_count: Number(newBranch.tables_count) || 0,
      geofence_radius_meters: Number(newBranch.geofence_radius_meters) || 200
    });
    setNewBranch({
      name: "",
      tables_count: 0,
      latitude: 30.04442,
      longitude: 31.235712,
      geofence_radius_meters: 200,
      geofence_enabled: true,
      qr_attendance_enabled: true
    });
    onRefresh();
  };

  const handleUpdateBranch = async () => {
    if (!editingBranch) return;
    await api.put(`/api/branches/${editingBranch.id}`, {
      ...editingBranch,
      latitude: Number(editingBranch.latitude) || 30.04442,
      longitude: Number(editingBranch.longitude) || 31.235712,
      tables_count: Number(editingBranch.tables_count) || 0,
      geofence_radius_meters: Number(editingBranch.geofence_radius_meters) || 200
    });
    setEditingBranch(null);
    onRefresh();
  };

  const handleDeleteBranch = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا الفرع؟")) return;
    await api.delete(`/api/branches/${id}`);
    onRefresh();
  };

  const fetchCurrentGpsForBranch = (isEditMode: boolean) => {
    if (!navigator.geolocation) {
      alert("خدمة الموقع الجغرافي GPS غير مدعومة بهذا المتصفح");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        if (isEditMode && editingBranch) {
          setEditingBranch({ ...editingBranch, latitude: lat, longitude: lng });
        } else {
          setNewBranch({ ...newBranch, latitude: lat, longitude: lng });
        }
        alert(`تم التقاط موقعك الجغرافي بنجاح: ${lat}, ${lng}`);
      },
      (err) => {
        alert("فشل التقاط الموقع الجغرافي: " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Fetch Dynamic QR Token for Branch
  const fetchDynamicQr = async (branchId: number) => {
    setLoadingQr(true);
    try {
      const res = await api.get(`/api/hr/branches/${branchId}/dynamic-qr`);
      const data = await res.json();
      if (data && data.qr_token) {
        setDynamicQrToken(data.qr_token);
        setQrExpiresIn(data.expires_in_seconds || 60);
      }
    } catch (err: any) {
      console.error("Failed to load branch QR:", err);
    } finally {
      setLoadingQr(false);
    }
  };

  // Auto-refresh QR code every second & regenerate when counter hits 0
  useEffect(() => {
    if (!qrModalBranch) return;

    fetchDynamicQr(qrModalBranch.id);

    const timer = setInterval(() => {
      setQrExpiresIn((prev) => {
        if (prev <= 1) {
          fetchDynamicQr(qrModalBranch.id);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrModalBranch]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 p-6 md:p-8" dir="rtl">
      <div className="w-full max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-6 h-6 rotate-180" />
            <span className="text-lg font-bold">العودة</span>
          </button>
          <h1 className="text-3xl font-bold flex items-center gap-3 text-slate-900">
            <MapPin className="w-8 h-8 text-emerald-600" />
            إدارة الفروع والبصمة الجغرافية ورمز QR
          </h1>
        </div>

        {/* Add New Branch Card */}
        <div className="bg-white border border-slate-200 p-6 rounded-3xl mb-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-emerald-600" />
            إضافة فرع جديد مع إعدادات النطاق الجغرافي (Geofencing)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-600 font-semibold mb-1">اسم الفرع</label>
              <input
                type="text"
                value={newBranch.name ?? ""}
                onChange={(e) => setNewBranch({ ...newBranch, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-medium"
                placeholder="مثال: فرع الرياض - المركز الرئيسي"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 font-semibold mb-1">عدد الطاولات</label>
              <input
                type="number"
                value={newBranch.tables_count ?? ""}
                onChange={(e) => setNewBranch({ ...newBranch, tables_count: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 font-semibold mb-1">نطاق الحضور المسموح (بالأمتار)</label>
              <input
                type="number"
                value={newBranch.geofence_radius_meters ?? ""}
                onChange={(e) => setNewBranch({ ...newBranch, geofence_radius_meters: parseInt(e.target.value) || 200 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 font-semibold text-emerald-700"
                placeholder="200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-slate-600 font-semibold mb-1">دائرة العرض (Latitude)</label>
              <input
                type="number"
                step="any"
                value={newBranch.latitude ?? ""}
                onChange={(e) => setNewBranch({ ...newBranch, latitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 font-semibold mb-1">خط الطول (Longitude)</label>
              <input
                type="number"
                step="any"
                value={newBranch.longitude ?? ""}
                onChange={(e) => setNewBranch({ ...newBranch, longitude: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-900 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => fetchCurrentGpsForBranch(false)}
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center gap-2 text-sm"
              >
                <Compass className="w-4 h-4" />
                تحديد موقعي الحضور الآن كإحداثيات للفرع
              </button>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={newBranch.geofence_enabled}
                  onChange={(e) => setNewBranch({ ...newBranch, geofence_enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                تفعيل الحظر الجغرافي (Geofencing)
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={newBranch.qr_attendance_enabled}
                  onChange={(e) => setNewBranch({ ...newBranch, qr_attendance_enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                تفعيل بصمة QR المتجددة للفرع
              </label>
            </div>

            <button
              onClick={handleAddBranch}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3 rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <Plus className="w-5 h-5" />
              إضافة الفرع
            </button>
          </div>
        </div>

        {/* Branches List */}
        <div className="space-y-4">
          {Array.isArray(branches) &&
            branches.map((branch) => (
              <div
                key={branch.id}
                className="bg-white border border-slate-200 p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm hover:border-emerald-500/30 transition-all"
              >
                {editingBranch?.id === branch.id ? (
                  <div className="w-full space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">اسم الفرع</label>
                        <input
                          type="text"
                          value={editingBranch.name ?? ""}
                          onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">نطاق الحضور (متر)</label>
                        <input
                          type="number"
                          value={editingBranch.geofence_radius_meters || 200}
                          onChange={(e) => setEditingBranch({ ...editingBranch, geofence_radius_meters: parseInt(e.target.value) || 200 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">عدد الطاولات</label>
                        <input
                          type="number"
                          value={editingBranch.tables_count ?? ""}
                          onChange={(e) => setEditingBranch({ ...editingBranch, tables_count: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={editingBranch.latitude ?? 30.04442}
                          onChange={(e) => setEditingBranch({ ...editingBranch, latitude: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={editingBranch.longitude ?? 31.235712}
                          onChange={(e) => setEditingBranch({ ...editingBranch, longitude: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-900 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={() => fetchCurrentGpsForBranch(true)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        التقاط موقعي الحالي
                      </button>

                      <div className="flex gap-2">
                        <button
                          onClick={handleUpdateBranch}
                          className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold flex items-center gap-1"
                        >
                          <Save className="w-4 h-4" />
                          حفظ التغييرات
                        </button>
                        <button
                          onClick={() => setEditingBranch(null)}
                          className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold flex items-center gap-1"
                        >
                          <X className="w-4 h-4" />
                          إلغاء
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                        <MapPin className="w-6 h-6 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-900">
                          {branch.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                          <span>طاولات: {branch.tables_count ?? 0}</span>
                          <span>•</span>
                          <span className="font-semibold text-slate-700 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            النطاق الجغرافي: {branch.geofence_radius_meters || 200}m
                          </span>
                          <span>•</span>
                          <span className="font-mono text-slate-500">
                            GPS:{" "}
                            {branch.latitude != null && !isNaN(Number(branch.latitude))
                              ? Number(branch.latitude).toFixed(4)
                              : "—"}
                            ,{" "}
                            {branch.longitude != null && !isNaN(Number(branch.longitude))
                              ? Number(branch.longitude).toFixed(4)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQrModalBranch(branch)}
                        className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-2xl font-bold transition-all flex items-center gap-2 text-sm shadow-sm"
                      >
                        <QrCode className="w-4 h-4" />
                        عرض شاشة QR الفرع
                      </button>

                      <button
                        onClick={() => setEditingBranch(branch)}
                        className="p-3 text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                        title="تعديل"
                      >
                        <Edit className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(branch.id)}
                        className="p-3 text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                        title="حذف"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}

          {branches.length === 0 && (
            <div className="text-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
              <MapPin className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p>لا يوجد فروع مضافة حالياً</p>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic QR Display Modal for Branch Wall Screen */}
      {qrModalBranch && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl relative text-center border border-slate-100">
            <button
              onClick={() => setQrModalBranch(null)}
              className="absolute top-4 left-4 p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>

            <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center mb-4">
              <QrCode className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-1">
              رمز QR التفاعلي للحضور
            </h2>
            <p className="text-slate-500 font-bold mb-6">
              {qrModalBranch.name}
            </p>

            {/* Live QR Box */}
            <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-inner mb-6 relative overflow-hidden">
              <div className="absolute top-2 right-3 flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">
                <Radio className="w-3 h-3 animate-pulse" />
                متجدد تلقائياً كل 60s
              </div>

              {loadingQr ? (
                <div className="h-64 flex flex-col items-center justify-center">
                  <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mb-2" />
                  <span className="text-xs text-slate-400">جاري استخراج رمز الشفرة الأمني...</span>
                </div>
              ) : (
                <div className="py-4">
                  {/* Generated QR visual code representation */}
                  <div className="bg-white p-4 rounded-2xl w-52 h-52 mx-auto flex flex-col items-center justify-center shadow-lg border-4 border-indigo-500/30">
                    <QrCode className="w-36 h-36 text-slate-900" />
                    <span className="text-[10px] text-slate-400 font-mono mt-1 tracking-widest uppercase">
                      {dynamicQrToken.substring(0, 16)}...
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 mt-4 font-semibold">
                    امسح هذا الكود من تطبيق الموبايل لتسجيل البصمة
                  </p>
                </div>
              )}

              {/* Progress Countdown Bar */}
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mt-2">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-1000"
                  style={{ width: `${(qrExpiresIn / 60) * 100}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-mono">
                <span>ينتهي خلال: {qrExpiresIn} ثانية</span>
                <button
                  onClick={() => fetchDynamicQr(qrModalBranch.id)}
                  className="hover:text-white flex items-center gap-1 text-[11px]"
                >
                  <RefreshCw className="w-3 h-3" />
                  تحديث يدوي
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-200">
              💡 <span className="font-bold">ملاحظة للأدمن:</span> يمكن ترك هذه الشاشة مفتوحة على شاشة العرض أو التابلت بمدخل الفرع ليمسحها الموظفون يومياً عند الدخول والانصراف.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
