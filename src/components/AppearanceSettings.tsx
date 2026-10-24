import React, { useState, useEffect } from "react";
import { Image as ImageIcon, Video, Upload, Trash2, CheckCircle2 } from "lucide-react";
import { api, authHeaders } from "../utils/api";

interface AppearanceSettingsProps {
  onBack: () => void;
}

export const AppearanceSettings: React.FC<AppearanceSettingsProps> = ({
  onBack,
}) => {
  // Dashboard background state
  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [backgroundType, setBackgroundType] = useState<"image" | "video">("image");
  const [uploading, setUploading] = useState(false);

  // Login background state
  const [loginBgUrl, setLoginBgUrl] = useState("");
  const [loginBgType, setLoginBgType] = useState<"image" | "video">("image");
  const [uploadingLogin, setUploadingLogin] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async (retries = 3) => {
    try {
      const res = await api.get("/api/settings/system_background");
      if (res.ok) {
        const data = await res.json();
        if (data.value) {
          const parsed = JSON.parse(data.value);
          setBackgroundUrl(parsed.url || "");
          setBackgroundType(parsed.type || "image");
        }
      }

      const resLogin = await api.get("/api/settings/login_background");
      if (resLogin.ok) {
        const dataLogin = await resLogin.json();
        if (dataLogin.value) {
          const parsedLogin = JSON.parse(dataLogin.value);
          setLoginBgUrl(parsedLogin.url || "");
          setLoginBgType(parsedLogin.type || "image");
        }
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchSettings(retries - 1), 1000);
      } else {
        console.error("Failed to fetch background settings", error);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isLogin: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (isLogin) {
      setUploadingLogin(true);
    } else {
      setUploading(true);
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: authHeaders(),
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        if (isLogin) {
          setLoginBgUrl(data.url);
        } else {
          setBackgroundUrl(data.url);
        }
      }
    } catch (error) {
      console.error("Failed to upload file", error);
    } finally {
      if (isLogin) {
        setUploadingLogin(false);
      } else {
        setUploading(false);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        api.post("/api/settings", {
          key: "system_background",
          value: JSON.stringify({ url: backgroundUrl, type: backgroundType }),
        }),
        api.post("/api/settings", {
          key: "login_background",
          value: JSON.stringify({ url: loginBgUrl, type: loginBgType }),
        })
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

      // Force reload to apply backgrounds globally
      window.location.reload();
    } catch (error) {
      console.error("Failed to save background settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async (isLogin: boolean = false) => {
    if (isLogin) {
      setLoginBgUrl("");
      try {
        await api.post("/api/settings", {
          key: "login_background",
          value: JSON.stringify({ url: "", type: "image" }),
        });
      } catch (error) {
        console.error("Failed to clear login background", error);
      }
    } else {
      setBackgroundUrl("");
      try {
        await api.post("/api/settings", {
          key: "system_background",
          value: JSON.stringify({ url: "", type: "image" }),
        });
      } catch (error) {
        console.error("Failed to clear system background", error);
      }
    }
  };

  return (
    <div className="p-6 w-full font-cairo" dir="rtl">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl hover:bg-slate-300 transition-colors text-sm font-bold"
          >
            رجوع
          </button>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-600" />
            تخصيص المظهر والهوية البصرية
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Panel 1: Dashboard Background */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-5 bg-indigo-600 rounded-full"></span>
              خلفية النظام ولوحة التحكم (الداخلية)
            </h2>
            <p className="text-slate-500 text-xs">
              قم بإضافة صورة أو فيديو متحرك ليتم عرضه كخلفية داخل لوحات التحكم الداخلية للنظام.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setBackgroundType("image")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                  backgroundType === "image"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold"
                    : "border-slate-200 hover:border-slate-300 text-slate-600 font-semibold"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm">صورة ثابتة</span>
              </button>
              <button
                onClick={() => setBackgroundType("video")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                  backgroundType === "video"
                    ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold"
                    : "border-slate-200 hover:border-slate-300 text-slate-600 font-semibold"
                }`}
              >
                <Video className="w-4 h-4" />
                <span className="text-sm">فيديو متحرك</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ملف الخلفية للوحة التحكم
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept={backgroundType === "image" ? "image/*" : "video/*"}
                    onChange={(e) => handleFileUpload(e, false)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploading}
                  />
                  <div className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer">
                    <span className="truncate text-xs font-medium">
                      {uploading
                        ? "جاري الرفع..."
                        : backgroundUrl
                          ? "تم اختيار الملف بنجاح (اضغط للتغيير)"
                          : "اضغط هنا لاختيار ملف من جهازك"}
                    </span>
                    <Upload className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                {backgroundUrl && (
                  <button
                    onClick={() => handleClear(false)}
                    className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
                    title="إزالة الخلفية"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {backgroundUrl && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-700 mb-2">معاينة خلفية النظام:</h3>
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {backgroundType === "image" ? (
                    <img
                      src={backgroundUrl}
                      alt="معاينة الخلفية"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={backgroundUrl}
                      autoPlay
                      loop
                      muted
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Login Page Background */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="w-2 h-5 bg-amber-550 bg-amber-500 rounded-full"></span>
              خلفية صفحة تسجيل الدخول (Login Page)
            </h2>
            <p className="text-slate-500 text-xs">
              قم بإضافة صورة أو فيديو متحرك ليتم عرضه كخلفية لصفحة تسجيل الدخول الرئيسية للنظام.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-3">
              <button
                onClick={() => setLoginBgType("image")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                  loginBgType === "image"
                    ? "border-amber-500 bg-amber-50 text-amber-700 font-bold"
                    : "border-slate-200 hover:border-slate-300 text-slate-600 font-semibold"
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm">صورة ثابتة</span>
              </button>
              <button
                onClick={() => setLoginBgType("video")}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-colors ${
                  loginBgType === "video"
                    ? "border-amber-500 bg-amber-50 text-amber-700 font-bold"
                    : "border-slate-200 hover:border-slate-300 text-slate-600 font-semibold"
                }`}
              >
                <Video className="w-4 h-4" />
                <span className="text-sm">فيديو متحرك</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                ملف الخلفية لصفحة اللوجن
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="file"
                    accept={loginBgType === "image" ? "image/*" : "video/*"}
                    onChange={(e) => handleFileUpload(e, true)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    disabled={uploadingLogin}
                  />
                  <div className="w-full p-3 border border-slate-200 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-between hover:bg-slate-100 transition-colors cursor-pointer">
                    <span className="truncate text-xs font-medium">
                      {uploadingLogin
                        ? "جاري الرفع..."
                        : loginBgUrl
                          ? "تم اختيار الملف بنجاح (اضغط للتغيير)"
                          : "اضغط هنا لاختيار ملف من جهازك"}
                    </span>
                    <Upload className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
                {loginBgUrl && (
                  <button
                    onClick={() => handleClear(true)}
                    className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 transition-colors"
                    title="إزالة الخلفية"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {loginBgUrl && (
              <div className="mt-4">
                <h3 className="text-xs font-bold text-slate-700 mb-2">معاينة خلفية اللوجن:</h3>
                <div className="relative w-full h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  {loginBgType === "image" ? (
                    <img
                      src={loginBgUrl}
                      alt="معاينة الخلفية"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={loginBgUrl}
                      autoPlay
                      loop
                      muted
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-4 flex justify-between items-center shadow-sm">
        <span className="text-xs text-slate-500 font-semibold">
          * سيتم تطبيق التغييرات على جميع المستخدمين فور الحفظ وتحديث الصفحة تلقائياً.
        </span>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50 text-sm shadow-md shadow-indigo-600/10"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              تم الحفظ بنجاح
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              {isSaving ? "جاري حفظ التغييرات..." : "حفظ جميع التغييرات وتطبيقها"}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
