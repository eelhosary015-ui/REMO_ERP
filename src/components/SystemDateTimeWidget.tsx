import React, { useState, useEffect } from "react";
import { Clock, Calendar, RefreshCw, AlertCircle, CheckCircle2, Save, ShieldCheck } from "lucide-react";
import { api } from "../utils/api";

export const SystemDateTimeWidget: React.FC = () => {
  const [sysDateTime, setSysDateTime] = useState<{
    server_date: string;
    server_time: string;
    timezone: string;
    override_enabled: boolean;
    custom_date: string;
    custom_time: string;
    effective_date: string;
    effective_time: string;
  }>({
    server_date: "",
    server_time: "",
    timezone: "Africa/Cairo",
    override_enabled: false,
    custom_date: "",
    custom_time: "",
    effective_date: "",
    effective_time: "",
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSystemDateTime();
  }, []);

  const fetchSystemDateTime = async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/system/datetime");
      if (res.ok) {
        const data = await res.json();
        setSysDateTime({
          server_date: data.server_date || "",
          server_time: data.server_time || "",
          timezone: data.timezone || "Africa/Cairo",
          override_enabled: Boolean(data.override_enabled),
          custom_date: data.custom_date || data.server_date || "",
          custom_time: data.custom_time || data.server_time || "",
          effective_date: data.effective_date || "",
          effective_time: data.effective_time || "",
        });
      }
    } catch (e) {
      console.error("Failed to fetch system datetime settings", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (overrideStatus?: boolean) => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        override_enabled: overrideStatus !== undefined ? overrideStatus : sysDateTime.override_enabled,
        custom_date: sysDateTime.custom_date,
        custom_time: sysDateTime.custom_time,
      };
      const res = await api.post("/api/system/datetime", payload);
      if (res.ok) {
        setMsg({ type: "success", text: "تم حفظ إعدادات تاريخ ووقت النظام بنجاح" });
        fetchSystemDateTime();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "فشل حفظ التغييرات" });
      }
    } catch (e) {
      setMsg({ type: "error", text: "حدث خطأ أثناء الاتصال بالسيرفر" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        override_enabled: false,
        custom_date: sysDateTime.server_date,
        custom_time: sysDateTime.server_time,
      };
      const res = await api.post("/api/system/datetime", payload);
      if (res.ok) {
        setMsg({ type: "success", text: "تم إعادة ضبط تاريخ ووقت النظام للتلقائي" });
        fetchSystemDateTime();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "فشل إعادة الضبط" });
      }
    } catch (e) {
      setMsg({ type: "error", text: "حدث خطأ أثناء الاتصال بالسيرفر" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-bold">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              تعديل تاريخ ووقت النظام (السيستم)
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  sysDateTime.override_enabled
                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
              >
                {sysDateTime.override_enabled ? "مُعدّل يدوياً" : "تلقائي (توقيت السيرفر)"}
              </span>
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              تغيير تاريخ ووقت النظام المستخدم في جميع شاشات البرنامج وبصمات الحضور والتقارير
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSystemDateTime()}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              const nextState = !sysDateTime.override_enabled;
              setSysDateTime({ ...sysDateTime, override_enabled: nextState });
              handleSave(nextState);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              sysDateTime.override_enabled
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{sysDateTime.override_enabled ? "إلغاء التعديل اليدوي" : "تفعيل التعديل اليدوي"}</span>
          </button>
        </div>
      </div>

      {msg && (
        <div
          className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
            msg.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
        >
          {msg.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 block mb-1">توقيت السيرفر الحقيقي</span>
          <div className="flex items-center justify-between mt-2">
            <div>
              <div className="text-base font-extrabold text-slate-800">{sysDateTime.server_date || "---"}</div>
              <div className="text-xs font-medium text-slate-500">{sysDateTime.server_time || "--:--"} (مصر UTC+3)</div>
            </div>
            <Clock className="w-8 h-8 text-slate-300" />
          </div>
        </div>

        <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-100 flex flex-col justify-between">
          <span className="text-xs font-bold text-indigo-700 block mb-1">التاريخ والوقت الفعّال للنظام حالياً</span>
          <div className="flex items-center justify-between mt-2">
            <div>
              <div className="text-base font-extrabold text-indigo-900">{sysDateTime.effective_date || "---"}</div>
              <div className="text-xs font-bold text-indigo-600">{sysDateTime.effective_time || "--:--"}</div>
            </div>
            <ShieldCheck className="w-8 h-8 text-indigo-400" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ السيستم</label>
              <input
                type="date"
                value={sysDateTime.custom_date || ""}
                disabled={!sysDateTime.override_enabled}
                onChange={(e) => setSysDateTime({ ...sysDateTime, custom_date: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">وقت السيستم</label>
              <input
                type="time"
                value={sysDateTime.custom_time || ""}
                disabled={!sysDateTime.override_enabled}
                onChange={(e) => setSysDateTime({ ...sysDateTime, custom_time: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || !sysDateTime.override_enabled}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all disabled:opacity-40"
            >
              إعادة للتلقائي
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving || !sysDateTime.override_enabled}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-40 flex items-center gap-1.5"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>حفظ التعديل</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
