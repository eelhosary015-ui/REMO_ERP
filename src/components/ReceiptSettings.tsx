import React, { useState, useEffect } from "react";
import {
  Printer,
  Check,
  Layout,
  Type,
  AlignCenter,
  Smartphone,
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "../utils/api";

interface ReceiptTemplate {
  id: string;
  name: string;
  description: string;
  preview: React.ReactNode;
}

const TEMPLATES: ReceiptTemplate[] = [
  {
    id: "standard",
    name: "النمط القياسي",
    description: "تصميم بسيط وواضح مناسب لجميع الطابعات",
    preview: (
      <div className="w-full h-full bg-white shadow-sm rounded-lg p-3 flex flex-col gap-2 text-[6px] font-mono text-black">
        <div className="text-center border-b border-dashed border-black pb-1 mb-1">
          <p className="font-bold uppercase">اسم المطعم</p>
          <p>فاتورة طلب</p>
        </div>
        <div className="space-y-0.5 mb-1">
          <div className="flex justify-between">
            <span>بيتزا x1</span>
            <span>150</span>
          </div>
          <div className="flex justify-between">
            <span>بيبسي x2</span>
            <span>40</span>
          </div>
        </div>
        <div className="border-t border-dashed border-black pt-1 flex justify-between font-bold">
          <span>الإجمالي</span>
          <span>190</span>
        </div>
        <p className="mt-2 text-center italic opacity-60">شكراً!</p>
      </div>
    ),
  },
  {
    id: "modern",
    name: "النمط العصري",
    description: "تصميم حديث مع حدود واضحة وتقسيمات منظمة",
    preview: (
      <div className="w-full h-full bg-white shadow-sm rounded-lg flex flex-col text-[6px] font-mono text-black overflow-hidden border border-slate-100">
        <div className="bg-slate-900 text-white p-1.5 text-center">
          <p className="font-bold uppercase">اسم المطعم</p>
        </div>
        <div className="p-2 flex-1 flex flex-col">
          <div className="space-y-0.5 mb-1">
            <div className="flex justify-between text-slate-400 border-b border-slate-50 pb-0.5">
              <span>الصنف</span>
              <span>السعر</span>
            </div>
            <div className="flex justify-between">
              <span>بيتزا x1</span>
              <span>150</span>
            </div>
            <div className="flex justify-between">
              <span>بيبسي x2</span>
              <span>40</span>
            </div>
          </div>
          <div className="border-t border-slate-50 pt-1 mt-auto flex justify-between font-bold text-indigo-600">
            <span>الإجمالي</span>
            <span>190</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "classic",
    name: "النمط الكلاسيكي",
    description: "تصميم تقليدي يركز على سهولة القراءة",
    preview: (
      <div className="w-full h-full bg-white shadow-sm rounded-lg p-3 flex flex-col gap-1 text-[6px] font-mono text-black border-2 border-double border-slate-200">
        <div className="text-center border-b-2 border-double border-slate-900 pb-1 mb-1">
          <p className="font-bold uppercase">اسم المطعم</p>
        </div>
        <div className="space-y-0.5 mb-1">
          <div className="flex justify-between">
            <span>بيتزا x1</span>
            <span>150</span>
          </div>
          <div className="flex justify-between">
            <span>بيبسي x2</span>
            <span>40</span>
          </div>
        </div>
        <div className="border-t-2 border-double border-slate-900 pt-1 flex justify-between font-bold">
          <span>الإجمالي</span>
          <span>190</span>
        </div>
        <p className="mt-2 text-center italic opacity-60">شكراً لزيارتكم!</p>
      </div>
    ),
  },
  {
    id: "compact",
    name: "النمط المدمج",
    description: "تصميم موفر للمساحة، مثالي للفواتير الطويلة",
    preview: (
      <div className="w-full h-full bg-white shadow-sm rounded-lg p-2 flex flex-col text-[5px] font-mono text-black">
        <div className="text-center border-b border-slate-200 pb-0.5 mb-1">
          <p className="font-bold uppercase">اسم المطعم</p>
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>بيتزا x1</span>
            <span>150</span>
          </div>
          <div className="flex justify-between">
            <span>بيبسي x2</span>
            <span>40</span>
          </div>
          <div className="flex justify-between font-bold pt-0.5 border-t border-slate-100">
            <span>الإجمالي</span>
            <span>190</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "grid",
    name: "نمط الجدول التفصيلي",
    description:
      "تصميم احترافي يعتمد على الجداول المنظمة لبيانات الكاشير والطلبات",
    preview: (
      <div className="w-full h-full bg-white shadow-sm rounded-lg p-2 flex flex-col text-[4px] font-sans text-black border border-slate-200 overflow-y-auto">
        <div className="text-center mb-1">
          <p className="font-bold text-[6px]">شارع الثورة</p>
          <div className="w-4 h-4 mx-auto my-0.5 border border-black rounded-full flex items-center justify-center text-[3px]">
            LOGO
          </div>
          <p className="font-bold">END</p>
          <p className="text-[8px] font-black">42</p>
          <p className="font-bold">DineIN</p>
        </div>

        <table className="w-full border-collapse border border-black mb-1 text-center">
          <tbody>
            <tr className="border-b border-black">
              <td className="border-r border-black p-0.5">3/27/2026</td>
              <td className="p-0.5">3:28:45 PM</td>
            </tr>
            <tr className="border-b border-black">
              <td className="border-r border-black p-0.5">مروة البنا</td>
              <td className="p-0.5 font-bold">الكاشير</td>
            </tr>
            <tr className="border-b border-black">
              <td className="border-r border-black p-0.5">فاروق السيد</td>
              <td className="p-0.5 font-bold">كابتن</td>
            </tr>
            <tr>
              <td className="border-r border-black p-0.5">DineIN 6</td>
              <td className="p-0.5 font-bold">الطاولة</td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse border border-black text-center">
          <thead>
            <tr className="bg-slate-50 border-b border-black font-bold">
              <th className="border-r border-black p-0.5">إجمالي</th>
              <th className="border-r border-black p-0.5">سعر</th>
              <th className="border-r border-black p-0.5">الصنف</th>
              <th className="p-0.5">كمية</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black">
              <td className="border-r border-black p-0.5">160</td>
              <td className="border-r border-black p-0.5">160</td>
              <td className="border-r border-black p-0.5">سوبر لايت بوكس</td>
              <td className="p-0.5">1</td>
            </tr>
            <tr className="border-b border-black">
              <td className="border-r border-black p-0.5">35</td>
              <td className="border-r border-black p-0.5">35</td>
              <td className="border-r border-black p-0.5">براد شاي</td>
              <td className="p-0.5">1</td>
            </tr>
            <tr className="border-b border-black font-bold bg-slate-50">
              <td className="border-r border-black p-0.5">622</td>
              <td colSpan={3} className="p-0.5">
                الإجمالي
              </td>
            </tr>
          </tbody>
        </table>

        <p className="text-center font-bold mt-1 text-[5px]">نقدي</p>
        <div className="mt-1 pt-1 border-t border-black text-center opacity-70">
          <p>لطلب الاوردرات الخط الساخن 17533</p>
          <p className="text-[3px]">Powered by : Backend</p>
        </div>
      </div>
    ),
  },
];

export const ReceiptSettings: React.FC<{ onBack: () => void }> = ({
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<"customer" | "internal">(
    "customer",
  );

  // Customer Settings
  const [selectedTemplate, setSelectedTemplate] = useState("standard");
  const [fontSize, setFontSize] = useState(12);
  const [fontWeight, setFontWeight] = useState(400);
  const [reverseArabic, setReverseArabic] = useState(false);

  // Internal Settings
  const [selectedTemplateInternal, setSelectedTemplateInternal] =
    useState("grid");
  const [fontSizeInternal, setFontSizeInternal] = useState(12);
  const [fontWeightInternal, setFontWeightInternal] = useState(400);
  const [hidePricesInternal, setHidePricesInternal] = useState(false);
  const [codePageInternal, setCodePageInternal] = useState("42");
  const [reverseArabicInternal, setReverseArabicInternal] = useState(false);
  const [printerWidthInternal, setPrinterWidthInternal] = useState(32);

  // Custom Settings
  const [codePage, setCodePage] = useState("42");
  const [printerWidth, setPrinterWidth] = useState(32);
  const [receiptHotline, setReceiptHotline] = useState("");
  const [receiptLogo, setReceiptLogo] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const [
        templateRes,
        sizeRes,
        weightRes,
        templateIntRes,
        sizeIntRes,
        weightIntRes,
        hidePricesRes,
        codePageRes,
        widthRes,
        codePageIntRes,
        reverseArRes,
        reverseArIntRes,
        widthIntRes,
        hotlineRes,
        logoRes,
      ] = await Promise.all([
        api.get("/api/settings/receipt_template"),
        api.get("/api/settings/receipt_font_size"),
        api.get("/api/settings/receipt_font_weight"),
        api.get("/api/settings/receipt_template_internal"),
        api.get("/api/settings/receipt_font_size_internal"),
        api.get("/api/settings/receipt_font_weight_internal"),
        api.get("/api/settings/receipt_hide_prices_internal"),
        api.get("/api/settings/receipt_code_page"),
        api.get("/api/settings/receipt_printer_width"),
        api.get("/api/settings/receipt_code_page_internal"),
        api.get("/api/settings/receipt_reverse_arabic"),
        api.get("/api/settings/receipt_reverse_arabic_internal"),
        api.get("/api/settings/receipt_printer_width_internal"),
        api.get("/api/settings/receipt_hotline"),
        api.get("/api/settings/receipt_logo"),
      ]);

      if (templateRes.ok) {
        const data = await templateRes.json();
        if (data.value) setSelectedTemplate(data.value);
      }
      if (sizeRes.ok) {
        const data = await sizeRes.json();
        if (data.value) setFontSize(parseInt(data.value));
      }
      if (weightRes.ok) {
        const data = await weightRes.json();
        if (data.value) setFontWeight(parseInt(data.value));
      }

      if (reverseArRes.ok) {
        const data = await reverseArRes.json();
        if (data.value !== undefined) setReverseArabic(data.value === "true");
      }

      if (templateIntRes.ok) {
        const data = await templateIntRes.json();
        if (data.value) setSelectedTemplateInternal(data.value);
      }
      if (sizeIntRes.ok) {
        const data = await sizeIntRes.json();
        if (data.value) setFontSizeInternal(parseInt(data.value));
      }
      if (weightIntRes.ok) {
        const data = await weightIntRes.json();
        if (data.value) setFontWeightInternal(parseInt(data.value));
      }

      if (hidePricesRes.ok) {
        const data = await hidePricesRes.json();
        if (data.value) setHidePricesInternal(data.value === "true");
      }

      if (reverseArIntRes.ok) {
        const data = await reverseArIntRes.json();
        if (data.value !== undefined)
          setReverseArabicInternal(data.value === "true");
      }

      if (codePageRes.ok) {
        const data = await codePageRes.json();
        if (data.value) setCodePage(data.value);
      }

      if (codePageIntRes.ok) {
        const data = await codePageIntRes.json();
        if (data.value) setCodePageInternal(data.value);
      }

      if (widthRes.ok) {
        const data = await widthRes.json();
        if (data.value) setPrinterWidth(parseInt(data.value));
      }
      if (widthIntRes.ok) {
        const data = await widthIntRes.json();
        if (data.value) setPrinterWidthInternal(parseInt(data.value));
      }
      if (hotlineRes.ok) {
        const data = await hotlineRes.json();
        if (data.value !== undefined) setReceiptHotline(data.value);
      }
      if (logoRes && logoRes.ok) {
        const data = await logoRes.json();
        if (data.value) setReceiptLogo(data.value);
      }
    } catch (error) {
      console.error("Failed to fetch receipt settings", error);
    } finally {
      setLoading(false);
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
        setReceiptLogo(reader.result as string);
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGlobalSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.post("/api/settings", {
          key: "receipt_template",
          value: selectedTemplate,
        }),
        api.post("/api/settings", {
          key: "receipt_font_size",
          value: fontSize.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_font_weight",
          value: fontWeight.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_template_internal",
          value: selectedTemplateInternal,
        }),
        api.post("/api/settings", {
          key: "receipt_font_size_internal",
          value: fontSizeInternal.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_font_weight_internal",
          value: fontWeightInternal.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_hide_prices_internal",
          value: hidePricesInternal.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_code_page",
          value: codePage,
        }),
        api.post("/api/settings", {
          key: "receipt_code_page_internal",
          value: codePageInternal,
        }),
        api.post("/api/settings", {
          key: "receipt_reverse_arabic",
          value: reverseArabic.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_reverse_arabic_internal",
          value: reverseArabicInternal.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_printer_width",
          value: printerWidth.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_printer_width_internal",
          value: printerWidthInternal.toString(),
        }),
        api.post("/api/settings", {
          key: "receipt_hotline",
          value: receiptHotline,
        }),
        api.post("/api/settings", { key: "receipt_logo", value: receiptLogo }),
      ]);
      setHasChanges(false);
      alert("تم حفظ التغييرات بنجاح");
    } catch (error) {
      alert("فشل حفظ التغييرات");
    } finally {
      setSaving(false);
    }
  };

  const currentTemplate =
    activeTab === "customer" ? selectedTemplate : selectedTemplateInternal;
  const currentFontSize =
    activeTab === "customer" ? fontSize : fontSizeInternal;
  const currentFontWeight =
    activeTab === "customer" ? fontWeight : fontWeightInternal;
  const currentPrinterWidth =
    activeTab === "customer" ? printerWidth : printerWidthInternal;

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Printer className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              تخصيص شكل الريست
            </h1>
            <p className="text-slate-500 text-sm">
              اختر التصميم المناسب لفواتير مطعمك
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGlobalSave}
            disabled={!hasChanges || saving}
            className={`px-6 py-2 rounded-xl font-bold transition-all flex items-center gap-2 shadow-lg ${
              hasChanges
                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-500/30"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Check className="w-5 h-5" />
            )}
            حفظ التغييرات
          </button>
          <button
            onClick={onBack}
            className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl transition-all"
          >
            رجوع
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab === "customer" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          إيصال العميل
        </button>
        <button
          onClick={() => setActiveTab("internal")}
          className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab === "internal" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
        >
          الإيصال الداخلي (المطبخ)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {TEMPLATES.map((template) => (
          <motion.div
            key={template.id}
            whileHover={{ y: -5 }}
            onClick={() => {
              if (activeTab === "customer") setSelectedTemplate(template.id);
              else setSelectedTemplateInternal(template.id);
              setHasChanges(true);
            }}
            className={`relative bg-white rounded-3xl p-6 border-2 transition-all cursor-pointer shadow-sm hover:shadow-xl ${
              currentTemplate === template.id
                ? "border-indigo-500 ring-4 ring-indigo-500/10"
                : "border-slate-100 hover:border-indigo-200"
            }`}
          >
            {currentTemplate === template.id && (
              <div className="absolute top-4 left-4 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg">
                <Check className="w-5 h-5 text-white" />
              </div>
            )}

            <div
              className={`w-full aspect-[3/4] rounded-2xl mb-4 flex flex-col p-4 overflow-hidden border border-slate-100 ${
                template.id === "standard"
                  ? "bg-slate-50"
                  : template.id === "modern"
                    ? "bg-indigo-50/30"
                    : template.id === "classic"
                      ? "bg-orange-50/30"
                      : "bg-emerald-50/30"
              }`}
            >
              {template.preview}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {template.name}
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              {template.description}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-12 bg-indigo-50 rounded-3xl p-8 border border-indigo-100">
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          <div className="flex-1 space-y-8">
            <div>
              <h2 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <Printer className="w-6 h-6" />
                معاينة حية لـ{" "}
                {activeTab === "customer" ? "إيصال العميل" : "الإيصال الداخلي"}
              </h2>
              <p className="text-indigo-700 mb-6">
                هذا التصميم سيتم تطبيقه على{" "}
                {activeTab === "customer"
                  ? "الفواتير التي يستلمها العميل"
                  : "الفواتير التي ترسل للمطبخ أو التجهيز"}
                .
              </p>
            </div>

            <div className="space-y-6 bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Type className="w-5 h-5 text-indigo-500" />
                إعدادات الخط والوضوح
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-bold text-slate-600">
                        حجم الخط
                      </label>
                      <span className="text-sm font-bold text-indigo-600">
                        {currentFontSize}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="8"
                      max="24"
                      value={currentFontSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (activeTab === "customer") setFontSize(val);
                        else setFontSizeInternal(val);
                        setHasChanges(true);
                      }}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-bold text-slate-600">
                        وضوح الخط (السمك)
                      </label>
                      <span className="text-sm font-bold text-indigo-600">
                        {currentFontWeight === 400
                          ? "عادي"
                          : currentFontWeight === 600
                            ? "متوسط"
                            : "عريض"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {[400, 600, 800].map((weight) => (
                        <button
                          key={weight}
                          onClick={() => {
                            if (activeTab === "customer") setFontWeight(weight);
                            else setFontWeightInternal(weight);
                            setHasChanges(true);
                          }}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                            currentFontWeight === weight
                              ? "bg-indigo-600 text-white shadow-md"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {weight === 400
                            ? "عادي"
                            : weight === 600
                              ? "متوسط"
                              : "عريض"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-bold text-slate-600 block mb-2">
                      كود الصفحة (Code Page)
                    </label>
                    <select
                      value={
                        activeTab === "customer" ? codePage : codePageInternal
                      }
                      onChange={(e) => {
                        if (activeTab === "customer") {
                          setCodePage(e.target.value);
                        } else {
                          setCodePageInternal(e.target.value);
                        }
                        setHasChanges(true);
                      }}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="42">Windows-1256 (Page 42)</option>
                      <option value="13">Arabic (Page 13 - CP864)</option>
                      <option value="22">Arabic (Page 22 - CP864)</option>
                      <option value="17">Arabic (Page 17 - CP864)</option>
                      <option value="28">Arabic (Page 28 - CP1256)</option>
                      <option value="255">User Defined (255)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      غير هذا الخيار إذا كانت الحروف تظهر كعلامات استفهام أو
                      رموز غريبة
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-bold text-slate-600 block mb-2">
                      عرض الورقة (عدد الحروف)
                    </label>
                    <div className="flex gap-2">
                      {[32, 42, 48].map((width) => (
                        <button
                          key={width}
                          onClick={() => {
                            if (activeTab === "customer")
                              setPrinterWidth(width);
                            else setPrinterWidthInternal(width);
                            setHasChanges(true);
                          }}
                          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
                            currentPrinterWidth === width
                              ? "bg-indigo-600 text-white shadow-md"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {width} ( {width === 32 ? "58mm" : "80mm"} )
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 text-indigo-600 bg-white px-4 py-2 rounded-xl border border-indigo-200">
                <AlignCenter className="w-5 h-5" />
                <span className="text-sm font-bold">توسيط الشعار</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-600 bg-white px-4 py-2 rounded-xl border border-indigo-200">
                <Layout className="w-5 h-5" />
                <span className="text-sm font-bold">تنسيق تلقائي</span>
              </div>
              <button
                onClick={() => {
                  if (activeTab === "customer")
                    setReverseArabic(!reverseArabic);
                  else setReverseArabicInternal(!reverseArabicInternal);
                  setHasChanges(true);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm ${
                  (
                    activeTab === "customer"
                      ? reverseArabic
                      : reverseArabicInternal
                  )
                    ? "bg-indigo-50 text-indigo-600 border-indigo-200"
                    : "bg-slate-50 text-slate-600 border-slate-200"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 border-current flex items-center justify-center`}
                >
                  {(activeTab === "customer"
                    ? reverseArabic
                    : reverseArabicInternal) && (
                    <div className="w-2 h-2 bg-current rounded-full" />
                  )}
                </div>
                {(
                  activeTab === "customer"
                    ? reverseArabic
                    : reverseArabicInternal
                )
                  ? "عكس اتجاه النص (مفعل)"
                  : "عكس اتجاه النص (معطل)"}
              </button>
              <p className="text-[10px] text-slate-400 w-full">
                قم بتعطيل هذا الخيار إذا كانت الحروف تظهر مرتبة من اليسار لليمين
                (مقلوبة)
              </p>

              {activeTab === "internal" && (
                <button
                  onClick={() => {
                    setHidePricesInternal(!hidePricesInternal);
                    setHasChanges(true);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-sm ${
                    hidePricesInternal
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-emerald-50 text-emerald-600 border-emerald-200"
                  }`}
                >
                  <Smartphone className="w-5 h-5" />
                  {hidePricesInternal
                    ? "إخفاء الأسعار (الرسيت الداخلي)"
                    : "إظهار الأسعار (الرسيت الداخلي)"}
                </button>
              )}
            </div>

            <div className="space-y-6 bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm mt-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Layout className="w-5 h-5 text-indigo-500" />
                شعار الفاتورة (Logo)
              </h3>
              <div className="flex flex-col gap-4">
                {receiptLogo && (
                  <div className="w-24 h-24 border border-slate-200 rounded-xl overflow-hidden relative group">
                    <img
                      src={receiptLogo}
                      alt="Receipt Logo"
                      className="w-full h-full object-contain p-1"
                    />
                    <button
                      onClick={() => {
                        setReceiptLogo("");
                        setHasChanges(true);
                      }}
                      className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-xs font-bold"
                    >
                      إزالة الشعار
                    </button>
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="receipt-logo-upload"
                  />
                  <label
                    htmlFor="receipt-logo-upload"
                    className="cursor-pointer inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors font-semibold text-sm"
                  >
                    رفع لوجو الفاتورة
                  </label>
                  <p className="text-xs text-slate-400 mt-2">
                    سيظهر هذا الشعار في أعلى الإيصال عند الطباعة. الحد الأقصى 2
                    ميجا.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm mt-6">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-500" />
                بيانات إضافية
              </h3>
              <div>
                <label className="text-sm font-bold text-slate-600 block mb-2">
                  رقم الخط الساخن (سيظهر أسفل الفاتورة)
                </label>
                <input
                  type="text"
                  value={receiptHotline}
                  onChange={(e) => {
                    setReceiptHotline(e.target.value);
                    setHasChanges(true);
                  }}
                  placeholder="مثال: 17533"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                />
              </div>
            </div>
          </div>

          <div
            className={`w-full md:w-80 bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 font-mono transition-all overflow-hidden receipt-content ${currentTemplate === "grid" ? "p-0" : ""}`}
            style={{
              fontSize: `${currentFontSize}px`,
              fontWeight: currentFontWeight,
            }}
          >
            {currentTemplate === "grid" ? (
              <div className="w-full flex flex-col text-black font-sans">
                <div className="text-center p-4">
                  <p className="font-bold text-lg">شارع الثورة</p>
                  {receiptLogo ? (
                    <img
                      src={receiptLogo}
                      className="w-12 h-12 mx-auto my-2 object-contain"
                      alt="Logo"
                    />
                  ) : (
                    <div className="w-12 h-12 mx-auto my-2 border-2 border-black rounded-full flex items-center justify-center text-[8px]">
                      LOGO
                    </div>
                  )}
                  <p className="font-bold">END</p>
                  <p className="text-4xl font-black my-1">42</p>
                  <p className="font-bold">DineIN</p>
                </div>

                <table className="w-full border-collapse border-y border-black text-center">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-2 w-1/2">
                        3/27/2026
                      </td>
                      <td className="p-2 w-1/2">3:28:45 PM</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-2">مروة البنا</td>
                      <td className="p-2 font-bold">الكاشير</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-2">فاروق السيد</td>
                      <td className="p-2 font-bold">كابتن</td>
                    </tr>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-2">DineIN 6</td>
                      <td className="p-2 font-bold">الطاولة</td>
                    </tr>
                  </tbody>
                </table>

                <table className="w-full border-collapse text-center">
                  <thead>
                    <tr className="bg-slate-50 border-b border-black font-bold">
                      {!(activeTab === "internal" && hidePricesInternal) && (
                        <th className="border-l border-black p-2">إجمالي</th>
                      )}
                      {!(activeTab === "internal" && hidePricesInternal) && (
                        <th className="border-l border-black p-2">سعر</th>
                      )}
                      <th className="border-l border-black p-2">الصنف</th>
                      <th className="p-2">كمية</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-black">
                      {!(activeTab === "internal" && hidePricesInternal) && (
                        <td className="border-l border-black p-2">160</td>
                      )}
                      {!(activeTab === "internal" && hidePricesInternal) && (
                        <td className="border-l border-black p-2">160</td>
                      )}
                      <td className="border-l border-black p-2">
                        سوبر لايت بوكس
                      </td>
                      <td className="p-2">1</td>
                    </tr>
                    <tr className="border-b border-black">
                      {!(activeTab === "internal" && hidePricesInternal) && (
                        <td className="border-l border-black p-2">35</td>
                      )}
                      {!(activeTab === "internal" && hidePricesInternal) && (
                        <td className="border-l border-black p-2">35</td>
                      )}
                      <td className="border-l border-black p-2">براد شاي</td>
                      <td className="p-2">1</td>
                    </tr>
                    {!(activeTab === "internal" && hidePricesInternal) && (
                      <tr className="border-b border-black font-bold bg-slate-50">
                        <td className="border-l border-black p-2">622</td>
                        <td colSpan={3} className="p-2 text-left px-4">
                          الإجمالي
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="p-2 border-b border-black text-right text-[6px]">
                  <p className="font-bold">ملاحظات:</p>
                  <p>بدون بصل - زيادة صوص</p>
                </div>

                <p className="text-center font-bold py-4 text-xl">نقدي</p>
                <div className="p-4 border-t border-black text-center opacity-70 space-y-1">
                  {receiptHotline && (
                    <p className="font-bold">
                      لطلب الاوردرات الخط الساخن {receiptHotline}
                    </p>
                  )}
                  <p className="text-[10px]">Powered by : Backend</p>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-4 flex flex-col items-center">
                  {receiptLogo && (
                    <img
                      src={receiptLogo}
                      className="w-16 h-16 object-contain mb-2"
                      alt="Logo"
                    />
                  )}
                  <h3
                    className="font-bold"
                    style={{ fontSize: `${currentFontSize + 4}px` }}
                  >
                    مطعم ريستو ماستر
                  </h3>
                  <p
                    className="opacity-60"
                    style={{ fontSize: `${currentFontSize - 2}px` }}
                  >
                    فاتورة مبيعات
                  </p>
                </div>
                <div
                  className="flex justify-between opacity-80 mb-2"
                  style={{ fontSize: `${currentFontSize - 2}px` }}
                >
                  <span>التاريخ: 2024/03/17</span>
                  <span>رقم: #1234</span>
                </div>
                <div className="border-t border-dashed border-slate-300 my-3"></div>
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span>بيتزا مارجريتا x2</span>
                    {!(activeTab === "internal" && hidePricesInternal) && (
                      <span>240.00</span>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span>كوكاكولا x1</span>
                    {!(activeTab === "internal" && hidePricesInternal) && (
                      <span>25.00</span>
                    )}
                  </div>
                </div>
                <div className="border-t border-dashed border-slate-300 my-3"></div>
                {!(activeTab === "internal" && hidePricesInternal) && (
                  <div
                    className="flex justify-between font-bold"
                    style={{ fontSize: `${currentFontSize + 2}px` }}
                  >
                    <span>الإجمالي</span>
                    <span className="text-indigo-600">265.00 ج.م</span>
                  </div>
                )}
                <div
                  className="mt-6 text-center italic opacity-40"
                  style={{ fontSize: `${currentFontSize - 2}px` }}
                >
                  شكراً لزيارتكم!
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
