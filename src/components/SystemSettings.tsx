import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Save,
  Settings,
  Sparkles,
  Eye,
  EyeOff,
  Smartphone,
  Globe,
  QrCode,
  Wifi,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Cpu
} from "lucide-react";
import { api } from "../utils/api";
import { SystemDateTimeWidget } from "./SystemDateTimeWidget";

interface SystemSettingsProps {
  onBack: () => void;
}

export const SystemSettings: React.FC<SystemSettingsProps> = ({ onBack }) => {
  const [systemName, setSystemName] = useState("REMO PRO");
  const [autoAddDelivery, setAutoAddDelivery] = useState(true);
  const [customerMenuLogo, setCustomerMenuLogo] = useState("");
  const [kitchenWarningTime, setKitchenWarningTime] = useState("30");
  const [businessType, setBusinessType] = useState("general");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async (retries = 3) => {
    try {
      const resName = await api.get("/api/settings/system_name");
      if (resName.ok) {
        const data = await resName.json();
        if (data.value) setSystemName(data.value);
      }

      const resDelivery = await api.get(
        "/api/settings/auto_add_delivery_to_salary",
      );
      if (resDelivery.ok) {
        const data = await resDelivery.json();
        if (data.value !== undefined) setAutoAddDelivery(data.value === "true");
      }

      const resLogo = await api.get("/api/settings/customer_menu_logo");
      if (resLogo.ok) {
        const data = await resLogo.json();
        if (data.value) setCustomerMenuLogo(data.value);
      }

      const resKitchenTime = await api.get(
        "/api/settings/kitchen_warning_time",
      );
      if (resKitchenTime.ok) {
        const data = await resKitchenTime.json();
        if (data.value) setKitchenWarningTime(data.value);
      }

      const resType = await api.get("/api/settings/business_type");
      if (resType.ok) {
        const data = await resType.json();
        if (data.value) setBusinessType(data.value);
      }

      const resGeminiKey = await api.get("/api/settings/gemini_api_key");
      if (resGeminiKey.ok) {
        const data = await resGeminiKey.json();
        if (data.value) setGeminiApiKey(data.value);
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchSettings(retries - 1), 1000);
      } else {
        console.error("Failed to fetch settings");
      }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("حجم الصورة يجب أن لا يتجاوز 2 ميجابايت");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomerMenuLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await Promise.all([
        api.post("/api/settings", { key: "system_name", value: systemName }),
        api.post("/api/settings", {
          key: "auto_add_delivery_to_salary",
          value: autoAddDelivery.toString(),
        }),
        api.post("/api/settings", {
          key: "customer_menu_logo",
          value: customerMenuLogo,
        }),
        api.post("/api/settings", {
          key: "kitchen_warning_time",
          value: kitchenWarningTime.toString(),
        }),
        api.post("/api/settings", {
          key: "business_type",
          value: businessType,
        }),
        api.post("/api/settings", {
          key: "gemini_api_key",
          value: geminiApiKey,
        }),
      ]);

      alert("تم حفظ الإعدادات بنجاح.");
      window.location.reload();
    } catch (error) {
      console.error("Failed to save settings");
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Settings className="w-6 h-6" />
          إعدادات النظام
        </h1>
        <button
          onClick={onBack}
          className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300"
        >
          رجوع
        </button>
      </div>

      <SystemDateTimeWidget />

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            اسم النظام
          </label>
          <input
            type="text"
            value={systemName}
            onChange={(e) => setSystemName(e.target.value)}
            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="أدخل اسم النظام..."
            dir="rtl"
          />
          <p className="text-sm text-slate-500 mt-2">
            سيظهر هذا الاسم في أعلى الشاشة وفي الفواتير والتقارير.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3 font-bold">
            نوع النشاط ووضع تشغيل النظام (System Mode)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setBusinessType("general")}
              className={`p-4 rounded-xl border-2 text-right transition-all flex flex-col gap-1.5 ${
                businessType === "general"
                  ? "border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="font-extrabold text-base flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${businessType === "general" ? "bg-blue-600" : "bg-slate-300"}`}></span>
                نظام تجاري / إداري شامل (مؤسسات وشركات)
              </span>
              <span className="text-xs text-slate-500 font-semibold leading-relaxed">
                يقوم بتكييف النظام بالكامل ليكون نظام ERP عاماً ومتكاملاً لإدارة الفروع والمخازن، الحسابات العامة، الموارد البشرية، الإنتاج والتصنيع، وعمليات التجهيز والمبيعات العامة.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBusinessType("restaurant")}
              className={`p-4 rounded-xl border-2 text-right transition-all flex flex-col gap-1.5 ${
                businessType === "restaurant"
                  ? "border-emerald-600 bg-emerald-50/50 text-emerald-900 shadow-sm"
                  : "border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="font-extrabold text-base flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${businessType === "restaurant" ? "bg-emerald-600" : "bg-slate-300"}`}></span>
                نظام إدارة المطاعم والكافيهات والأغذية
              </span>
              <span className="text-xs text-slate-500 font-semibold leading-relaxed">
                يقوم بتوجيه وتكييف واجهات النظام لتعرض ميزات الصالات، وحالة الطاولات، وحجوزات الويترز، وشاشات المطبخ والمقادير وعمليات الوجبات والمشروبات المخصصة.
              </span>
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            لوجو المنيو (يظهر للعميل عند فتح الباركود)
          </label>
          <div className="flex flex-col gap-4">
            {customerMenuLogo && (
              <div className="w-32 h-32 border-2 border-slate-200 rounded-2xl overflow-hidden relative group">
                <img
                  src={customerMenuLogo}
                  alt="Menu Logo"
                  className="w-full h-full object-contain p-2"
                />
                <button
                  onClick={() => setCustomerMenuLogo("")}
                  className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center font-bold"
                >
                  إزالة
                </button>
              </div>
            )}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className="cursor-pointer inline-flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-xl transition-colors font-medium"
              >
                اختيار صورة
              </label>
              <p className="text-xs text-slate-400 mt-2">
                يفضل استخدام صورة بخلفية شفافة (PNG) وأبعاد مناسبة. الحد الأقصى
                2 ميجا.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={autoAddDelivery}
              onChange={(e) => setAutoAddDelivery(e.target.checked)}
              className="w-5 h-5 accent-blue-600"
            />
            <div>
              <span className="block font-bold text-slate-800">
                إضافة عمولات التوصيل للمرتب تلقائياً
              </span>
              <span className="text-sm text-slate-500">
                عند تفعيل هذا الخيار، سيتم إضافة إجمالي رسوم التوصيل للأوردرات
                التي تم تسليمها إلى مرتب الطيار تلقائياً.
              </span>
            </div>
          </label>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">إعدادات المطبخ</h3>
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              مدة التحذير للطلبات المتأخرة بالدقائق
            </label>
            <input
              type="number"
              min="1"
              value={kitchenWarningTime}
              onChange={(e) => setKitchenWarningTime(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="مثلا 30"
              dir="rtl"
            />
            <p className="text-sm text-slate-500 mt-2">
              سيتغير لون الطلب في شاشة المطبخ إلى الأحمر الداكن إذا تجاوز هذه
              المدة (منذ دخول الطلب).
            </p>
          </div>
        </div>

        <div className="mb-6 p-5 bg-gradient-to-tr from-slate-50 to-teal-50/20 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-teal-600" />
            إعدادات المساعد الذكي والذكاء الاصطناعي (Google Gemini AI)
          </h3>
          <p className="text-xs text-slate-500 mb-4 font-semibold leading-relaxed">
            يستخدم نظام المساعد الذكي تقنية Google Gemini API لتحليل أداء الفروع والمبيعات، والإجابة الفورية وتوليد القيود المحاسبية التلقائية وتتبع الفواتير المستندية عبر الذكاء الاصطناعي.
          </p>
          <div className="mb-4">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              مفتاح واجهة برمجة التطبيقات (Gemini API Key)
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full p-3 pl-12 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 outline-none font-mono"
                placeholder="أدخل مفتاح Gemini API هنا (مثال: AIzaSy...)"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 transition-colors"
              >
                {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              * عند تشغيل النظام محلياً (Locally)، يمكنك الحصول على مفتاح مجاني من <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline font-bold hover:text-teal-700">Google AI Studio</a> ولصقه هنا لتفعيل مميزات الذكاء الاصطناعي على الفور.
            </p>
          </div>
        </div>

        <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-3">
            إعدادات الدليفري العامة
          </h3>
          <p className="text-sm text-slate-500 mb-4">
            هذه الإعدادات تتحكم في كيفية عمل نظام الدليفري في جميع الفروع.
          </p>
          {/* يمكنك إضافة خيارات إضافية هنا لاحقاً */}
          <div className="text-sm text-amber-600 font-bold">
            نظام الدليفري مفعل حالياً. يمكنك إدارة مناطق التوصيل والأسعار من
            شاشة "إدارة مناطق التوصيل".
          </div>
        </div>

        {/* بوابة تطبيق الموظفين والربط الخارجي */}
        <div className="mb-6 p-5 bg-gradient-to-tr from-slate-50 to-blue-50/10 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600 animate-pulse" />
            تطبيق الهاتف المحمول للموظفين والربط الخارجي (Employee Mobile App & Outside Connection)
          </h3>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            يحتوي هذا النظام على تطبيق ويب تقدمي متكامل (PWA) مخصص للهواتف المحمولة للموظفين، يتيح لهم تسجيل الحضور والانصراف ببصمة السيلفي الحية مع تتبع الموقع الجغرافي (GPS)، وطلب الإجازات، والاطلاع على كشف المرتبات، والمذكرات والشكاوى بشكل مستقل تماماً عن الواجهة الإدارية.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-right" dir="rtl">
            {/* القسم الأول: روابط تشغيل تطبيق الموبايل */}
            <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-3">
              <span className="font-extrabold text-xs text-blue-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                روابط التشغيل المباشرة للموظفين
              </span>
              <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                انسخ وشارك أحد الروابط التالية مع موظفيك لفتح تطبيق الموبايل مباشرة على هواتفهم:
              </p>

              {/* الرابط المباشر 1 */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-600 block">رابط البوابة السريع (عبر المسار):</span>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/employee`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-700 outline-none"
                  />
                  <button
                    onClick={() => handleCopy(`${window.location.origin}/employee`, "pathUrl")}
                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold shrink-0 transition"
                  >
                    {copiedText === "pathUrl" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={`${window.location.origin}/employee`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg shrink-0 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* الرابط البديل الآمن لجميع السيرفرات */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-600 block">الرابط المضمون المتوافق (مع أي استضافة محلية):</span>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/?portal=employee`}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-700 outline-none"
                  />
                  <button
                    onClick={() => handleCopy(`${window.location.origin}/?portal=employee`, "queryUrl")}
                    className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-bold shrink-0 transition"
                  >
                    {copiedText === "queryUrl" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <a
                    href={`${window.location.origin}/?portal=employee`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg shrink-0 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl text-[10px] text-emerald-800 leading-relaxed font-bold">
                📱 <span className="font-extrabold text-emerald-950">ميزة التثبيت كـتطبيق مستقل (PWA):</span> عند فتح هذا الرابط في متصفح الهاتف (Safari للآيفون أو Chrome للأندرويد)، سيظهر خيار "إضافة إلى الشاشة الرئيسية" (Add to Home Screen)، وبذلك يتم تثبيت التطبيق على هاتف الموظف بأيقونة مستقلة ليعمل كـتطبيق حقيقي بعيداً عن المتصفح!
              </div>
            </div>

            {/* القسم الثاني: الاتصال من الخارج والدخول من خارج الفروع */}
            <div className="p-4 bg-white border border-slate-100 rounded-xl space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="font-extrabold text-xs text-amber-800 flex items-center gap-1.5">
                  <Wifi className="w-4 h-4" />
                  إمكانية الدخول والربط من خارج الكافيه / المحل
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                  كيف يمكن للموظفين فتح التطبيق وتسجيل حضورهم من خارج المحل أو عند تشغيل السيستم محلياً (Offline Local Host)؟
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="text-[10px] text-slate-700 leading-relaxed space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-900 block">💡 في حالة التشغيل المحلي (سيرفر داخلي):</span>
                  <div>إذا كان جهاز السيستم الرئيسي داخل الكافيه، وتريد ربطه بالإنترنت الخارجي ليعمل الموظفون من منازلهم، يمكنك إنشاء "نفق خارجي آمن" مجاني عبر سطر الأوامر (CMD) كالتالي:</div>
                  <div className="bg-slate-900 text-slate-200 font-mono p-1.5 rounded text-[10px] mt-1 text-left select-all whitespace-nowrap overflow-x-auto" dir="ltr">
                    cloudflared tunnel --url http://localhost:3000
                  </div>
                  <div className="text-slate-500 text-[9px] mt-1 font-semibold">
                    * سيقوم هذا الأمر بإنشاء رابط ويب عام مشفر (مجاني) ينتهي بـ <span className="text-slate-700 font-mono">.trycloudflare.com</span> يمكنك مشاركته معهم فوراً للربط الخارجي!
                  </div>
                </div>

                <div className="text-[10px] text-emerald-800 leading-relaxed space-y-1 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-200/60">
                  <span className="font-bold text-emerald-950 block">🚀 في حالة التشغيل السحابي (Cloud Hosting):</span>
                  <div>السيستم متاح للجميع من خارج الفروع ومن أي مكان تلقائياً ومربوط بالكامل بالخادم دون أي إعدادات إضافية!</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={loading || !systemName.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            <span>{loading ? "جاري الحفظ..." : "حفظ التغييرات"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
