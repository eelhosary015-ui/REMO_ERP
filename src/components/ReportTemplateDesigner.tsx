import React, { useState, useEffect } from "react";
import { authHeaders } from "../utils/api";
import { motion, AnimatePresence } from "motion/react";
import {
  Save,
  FileText,
  Type,
  Image as ImageIcon,
  Layout,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Bold,
  Italic,
  Underline,
  Trash2,
  Plus,
  Upload,
  Settings,
  Palette,
  Check,
  Columns,
  Grid,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  Printer,
  Undo,
  Redo,
  HelpCircle,
  FileDown,
  Table,
  PlusCircle,
  MinusCircle,
  FileEdit,
  Eye,
  Minimize2,
  List,
  Maximize2
} from "lucide-react";

export interface ReportTemplate {
  headerTitle: string;
  headerSubTitle: string;
  logoUrl?: string;
  logoWidth?: number;
  logoPosition?: "right" | "left" | "center";
  footerText: string;
  borderStyle: "none" | "thin" | "double" | "classic";
  borderColor?: string;
  accentColor: string;
  signatureText: string;
  showDate: boolean;
  showPageNumbers: boolean;
  fontSize: "small" | "medium" | "large";
  fontFamily: "cairo" | "traditional" | "modern" | "amiri" | "arial";
  
  // Word-like additions
  lineSpacing?: "1.0" | "1.15" | "1.5" | "2.0";
  pageMargins?: "normal" | "narrow" | "wide";
  paperOrientation?: "portrait" | "landscape";
  watermarkText?: string;
  watermarkColor?: string;
  showHeaderLine?: boolean;
  headerLayout?: "classic" | "modern" | "centered";
  tableHeaderBg?: string;
  tableHeaderTextColor?: string;
  tableStriped?: boolean;
  
  // Custom content editable states
  reportTitle?: string;
  reportContentText?: string;
}

const defaultTemplate: ReportTemplate = {
  headerTitle: "شركة ريستو ماستر برو المحدودة",
  headerSubTitle: "الإدارة العامة ومراقبة جودة الإنتاج والعمليات",
  logoUrl: "",
  logoWidth: 90,
  logoPosition: "left",
  footerText: "جميع الحقوق محفوظة © منظومة ريستو ماستر برو الذكية ERP",
  borderStyle: "thin",
  borderColor: "#2563eb",
  accentColor: "#2563eb",
  signatureText: "توقيع واعتماد الإدارة العامة المسؤول",
  showDate: true,
  showPageNumbers: true,
  fontSize: "medium",
  fontFamily: "cairo",
  
  // Word-like defaults
  lineSpacing: "1.15",
  pageMargins: "normal",
  paperOrientation: "portrait",
  watermarkText: "معتمد وموثق",
  watermarkColor: "#e2e8f0",
  showHeaderLine: true,
  headerLayout: "classic",
  tableHeaderBg: "#2563eb",
  tableHeaderTextColor: "#ffffff",
  tableStriped: true,

  // Default content
  reportTitle: "تقرير تقييم وتدقيق الحسابات والإنتاج اليومي",
  reportContentText: "بناءً على الصلاحيات الممنوحة لنا وتوجيهات مجلس الإدارة الموقر، نرفق لكم طيه التقرير التفصيلي المتكامل لكافة حركة قيود المبيعات والإنتاج والمطابقة الفنية لوحدات التشغيل. تم جلب وتدقيق كافة الأرقام المبيّنة بالجدول من دفاتر الحسابات والمخازن المركزية لعام 2026."
};

export const ReportTemplateDesigner: React.FC = () => {
  const [template, setTemplate] = useState<ReportTemplate>(defaultTemplate);
  const [isLoading, setIsLoading] = useState(true);
  const [ribbonTab, setRibbonTab] = useState<"home" | "insert" | "layout" | "design" | "help">("home");
  
  // Interactive mock table state for the Word document preview
  const [tableHeaders, setTableHeaders] = useState<string[]>(["البند والبيان الفني", "الكمية المعتمدة", "سعر الوحدة", "الإجمالي النهائي"]);
  const [tableRows, setTableRows] = useState<string[][]>([
    ["توريد مواد خام وصناعية فاخرة قسم أ", "١,٤٥٠ كجم", "٤٥ ج.م", "٦٥,٢٥٠ ج.م"],
    ["تجهيز وجبات دجاج فريش متبلة للإنتاج", "٨٥٠ وجبة", "١٢٠ ج.م", "١٠٢,٠٠٠ ج.م"],
    ["تشغيل وتحويل حزم مواد تموينية للفرع الرئيسي", "٦٠٠ وحدة", "٨٥ ج.م", "٥١,٠٠٠ ج.م"]
  ]);

  // MS Word Home state simulations
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlignment, setTextAlignment] = useState<"right" | "center" | "left" | "justify">("justify");
  const [selectedPresetStyle, setSelectedPresetStyle] = useState<string>("Normal");

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch("/api/system/settings/report_template", {
          headers: {
            ...authHeaders(),
          },
        });
        if (response.ok) {
          const data = await response.json();
          setTemplate({ ...defaultTemplate, ...data });
          
          if (data?.accentColor) {
            setIsBold(true);
          }
        }
      } catch (error) {
        console.error("Failed to fetch report template:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTemplate();
  }, []);

  const saveTemplate = async () => {
    try {
      const response = await fetch("/api/system/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          key: "report_template",
          value: template,
        }),
      });

      if (response.ok) {
        alert(
          "🎉 تهانينا! تم حفظ وتثبيت قالب مستندات Word المخصص بنجاح!\nسيتم تطبيق التنسيقات، الشعار المرفوع، الألوان، العلامة المائية، والهوامش التي صممتها على كافة عمليات التصدير والتحميل لملفات Word والتقارير عبر المنظومة بالكامل."
        );
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      console.error("Failed to save template:", error);
      alert("فشل حفظ القالب في خادم الحسابات");
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500 * 1024) {
      alert("تنبيه: حجم الصورة كبير (يفضل استخدام ملف شعار أقل من 500 كيلوبايت لسرعة التصدير والتحميل للمستندات).");
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      setTemplate((prev) => ({
        ...prev,
        logoUrl: base64,
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setTemplate((prev) => ({
      ...prev,
      logoUrl: "",
    }));
  };

  const addTableRow = () => {
    setTableRows([...tableRows, ["بند إنتاجي جديد", "١٠٠ وحدة", "٥٠ ج.م", "٥,٠٠٠ ج.م"]]);
  };

  const removeTableRow = (index: number) => {
    if (tableRows.length <= 1) return;
    setTableRows(tableRows.filter((_, i) => i !== index));
  };

  const applyPresetStyle = (styleName: string) => {
    setSelectedPresetStyle(styleName);
    switch (styleName) {
      case "Title":
        setTemplate(prev => ({
          ...prev,
          fontSize: "large",
          fontFamily: "traditional",
          lineSpacing: "1.5",
          accentColor: "#1e3a8a"
        }));
        setIsBold(true);
        break;
      case "Subtitle":
        setTemplate(prev => ({
          ...prev,
          fontSize: "medium",
          fontFamily: "cairo",
          lineSpacing: "1.15",
          accentColor: "#475569"
        }));
        setIsBold(false);
        setIsItalic(true);
        break;
      case "Heading 1":
        setTemplate(prev => ({
          ...prev,
          fontSize: "large",
          fontFamily: "cairo",
          accentColor: "#0f766e"
        }));
        setIsBold(true);
        break;
      case "Normal":
      default:
        setTemplate(prev => ({
          ...prev,
          fontSize: "medium",
          fontFamily: "cairo",
          lineSpacing: "1.15",
          accentColor: "#2563eb"
        }));
        setIsBold(true);
        setIsItalic(false);
        setIsUnderline(false);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-slate-50 rounded-2xl border border-slate-100">
        <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mb-4"></div>
        <p className="text-sm font-bold text-slate-500">جاري تحميل واجهة محاكي Word لتصميم وتنسيق التقارير...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-1 bg-slate-100 rounded-2xl border border-slate-300 shadow-lg text-slate-800" dir="rtl">
      
      {/* 1. TOP WINDOW HEADER TITLE BAR */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white px-5 py-3 rounded-t-2xl flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-blue-700 font-bold shadow-inner">
            W
          </div>
          <div>
            <h1 className="font-black text-sm tracking-wide">مصمم القوالب ومحرر التقارير التفاعلي | Microsoft Word Style</h1>
            <p className="text-[10px] text-blue-100">تخصيص متطور، إضافة شعارات، ألوان مخصصة، وعلامات مائية تتوافق بنسبة 100% مع مخرجات Word</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={saveTemplate}
            className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500 active:scale-95 transition-all shadow-md"
          >
            <Save className="w-4 h-4" />
            حفظ وتعميم القالب على المنظومة
          </button>
        </div>
      </div>

      {/* 2. MICROSOFT WORD RIBBON CONTROL PANEL */}
      <div className="bg-slate-50 border border-slate-300 shadow-sm mx-2 rounded-xl overflow-hidden">
        {/* Ribbon Tab Selectors */}
        <div className="flex border-b border-slate-300 bg-slate-200 px-3 pt-1.5 gap-1">
          <button
            onClick={() => setRibbonTab("home")}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-lg transition-all ${
              ribbonTab === "home"
                ? "bg-slate-50 text-blue-800 border-t border-x border-slate-300 shadow-sm font-black"
                : "text-slate-600 hover:bg-slate-300"
            }`}
          >
            الصفحة الرئيسية (Home)
          </button>
          <button
            onClick={() => setRibbonTab("insert")}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-lg transition-all ${
              ribbonTab === "insert"
                ? "bg-slate-50 text-blue-800 border-t border-x border-slate-300 shadow-sm font-black"
                : "text-slate-600 hover:bg-slate-300"
            }`}
          >
            إدراج عناصر (Insert)
          </button>
          <button
            onClick={() => setRibbonTab("layout")}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-lg transition-all ${
              ribbonTab === "layout"
                ? "bg-slate-50 text-blue-800 border-t border-x border-slate-300 shadow-sm font-black"
                : "text-slate-600 hover:bg-slate-300"
            }`}
          >
            تخطيط الصفحة (Layout)
          </button>
          <button
            onClick={() => setRibbonTab("design")}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-lg transition-all ${
              ribbonTab === "design"
                ? "bg-slate-50 text-blue-800 border-t border-x border-slate-300 shadow-sm font-black"
                : "text-slate-600 hover:bg-slate-300"
            }`}
          >
            علامة مائية وهيدر (Design)
          </button>
          <button
            onClick={() => setRibbonTab("help")}
            className={`px-4 py-2 text-xs font-extrabold rounded-t-lg transition-all ${
              ribbonTab === "help"
                ? "bg-slate-50 text-blue-800 border-t border-x border-slate-300 shadow-sm font-black"
                : "text-slate-600 hover:bg-slate-300"
            }`}
          >
            دليل المساعدة (Help)
          </button>
        </div>

        {/* Ribbon Toolbar Content */}
        <div className="p-3.5 bg-slate-50 grid grid-cols-12 gap-4 items-center min-h-[92px] text-slate-700">
          
          {/* TAB: HOME - Font and Paragraph formatting */}
          {ribbonTab === "home" && (
            <>
              {/* Group 1: Font Selection & Size */}
              <div className="col-span-12 md:col-span-4 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">الخط والمقاس</span>
                <div className="flex gap-2">
                  {/* Font Dropdown */}
                  <select
                    value={template.fontFamily}
                    onChange={(e) => setTemplate({ ...template, fontFamily: e.target.value as any })}
                    className="bg-white border border-slate-300 px-2 py-1 rounded text-xs font-bold outline-none flex-1 h-8"
                  >
                    <option value="cairo">Cairo (عصري ومقرؤ)</option>
                    <option value="traditional">Traditional Arabic (رسمي)</option>
                    <option value="amiri">Amiri (أميري عريق)</option>
                    <option value="modern">Segoe UI (حديث)</option>
                    <option value="arial">Arial (قياسي)</option>
                  </select>

                  {/* Font Size Dropdown */}
                  <select
                    value={template.fontSize}
                    onChange={(e) => setTemplate({ ...template, fontSize: e.target.value as any })}
                    className="bg-white border border-slate-300 px-2 py-1 rounded text-xs font-bold outline-none w-24 h-8"
                  >
                    <option value="small">11 (صغير)</option>
                    <option value="medium">14 (متوسط)</option>
                    <option value="large">18 (كبير)</option>
                  </select>
                </div>

                {/* Font decorations buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsBold(!isBold)}
                    className={`p-1.5 rounded text-xs font-black transition-colors ${
                      isBold ? "bg-slate-300 text-slate-900" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    title="عريض Bold"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsItalic(!isItalic)}
                    className={`p-1.5 rounded text-xs transition-colors ${
                      isItalic ? "bg-slate-300 text-slate-900" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    title="مائل Italic"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUnderline(!isUnderline)}
                    className={`p-1.5 rounded text-xs transition-colors ${
                      isUnderline ? "bg-slate-300 text-slate-900" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    title="تحته خط Underline"
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </button>
                  
                  {/* Accent Color picker */}
                  <div className="h-5 w-[1px] bg-slate-300 mx-1"></div>
                  <label className="text-[10px] font-bold text-slate-500 ml-1">لون السمة:</label>
                  <input
                    type="color"
                    value={template.accentColor}
                    onChange={(e) => setTemplate({ ...template, accentColor: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border border-slate-300 p-0"
                    title="لون السمة المخصصة بالمستند"
                  />
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase">{template.accentColor}</span>
                </div>
              </div>

              {/* Group 2: Paragraph Alignment and spacing */}
              <div className="col-span-12 md:col-span-3 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">محاذاة وتباعد الفقرات</span>
                <div className="flex gap-1.5 items-center">
                  <button
                    type="button"
                    onClick={() => setTextAlignment("right")}
                    className={`p-1.5 rounded transition-colors ${
                      textAlignment === "right" ? "bg-slate-300 text-slate-900" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    title="محاذاة لليمين"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextAlignment("center")}
                    className={`p-1.5 rounded transition-colors ${
                      textAlignment === "center" ? "bg-slate-300 text-slate-900" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    title="محاذاة للوسط"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextAlignment("left")}
                    className={`p-1.5 rounded transition-colors ${
                      textAlignment === "left" ? "bg-slate-300 text-slate-900" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    title="محاذاة لليسار"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTextAlignment("justify")}
                    className={`p-1.5 rounded transition-colors ${
                      textAlignment === "justify" ? "bg-slate-300 text-slate-900" : "hover:bg-slate-200 text-slate-500"
                    }`}
                    title="ضبط كلي بالهوامش"
                  >
                    <AlignJustify className="w-4 h-4" />
                  </button>

                  <div className="h-5 w-[1px] bg-slate-300 mx-1"></div>
                  
                  {/* Line Spacing */}
                  <select
                    value={template.lineSpacing || "1.15"}
                    onChange={(e) => setTemplate({ ...template, lineSpacing: e.target.value as any })}
                    className="bg-white border border-slate-300 px-2 py-0.5 rounded text-[11px] font-bold outline-none h-7"
                    title="تباعد الأسطر بالمستند"
                  >
                    <option value="1.0">1.0 pt</option>
                    <option value="1.15">1.15 pt</option>
                    <option value="1.5">1.5 pt</option>
                    <option value="2.0">2.0 pt</option>
                  </select>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">التباعد يتحكم بارتياح قراءة نصوص التقرير المطبوع.</div>
              </div>

              {/* Group 3: Quick Styles Gallery */}
              <div className="col-span-12 md:col-span-5 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">أنماط وورد سريعة (Styles)</span>
                <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
                  {["Normal", "Title", "Subtitle", "Heading 1"].map((styleName) => (
                    <button
                      key={styleName}
                      type="button"
                      onClick={() => applyPresetStyle(styleName)}
                      className={`px-3 py-1.5 rounded border text-right transition-all flex flex-col justify-between shrink-0 w-24 h-12 ${
                        selectedPresetStyle === styleName
                          ? "bg-white border-blue-600 ring-2 ring-blue-100"
                          : "bg-white border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      <span className="text-[11px] font-bold text-slate-800 leading-none">{styleName}</span>
                      <span className="text-[8px] text-slate-400 truncate">أب ت ج ح خ</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* TAB: INSERT - Logo / Images and tables customizers */}
          {ribbonTab === "insert" && (
            <>
              {/* Group 1: Logo & Image Insertion */}
              <div className="col-span-12 md:col-span-5 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">إدراج صورة أو شعار رسمي (Logo)</span>
                <div className="flex items-center gap-3">
                  {template.logoUrl ? (
                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <img src={template.logoUrl} className="h-8 w-8 object-contain bg-white rounded p-0.5" alt="Logo mini preview" />
                      <div className="text-right">
                        <span className="text-[10px] font-bold text-emerald-700 block">✓ الشعار مدرج</span>
                        <button onClick={removeLogo} className="text-[9px] text-red-500 font-bold hover:underline block">حذف واستبدال</button>
                      </div>
                    </div>
                  ) : (
                    <label className="bg-blue-50 border border-blue-200 hover:bg-blue-100 px-3 py-1.5 rounded text-xs font-bold text-blue-700 cursor-pointer flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      اختر صورة الشعار للرفع
                      <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    </label>
                  )}

                  {template.logoUrl && (
                    <div className="flex items-center gap-2">
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-bold text-slate-500 block">عرض الشعار (بكسل)</label>
                        <input
                          type="number"
                          value={template.logoWidth || 90}
                          onChange={(e) => setTemplate({ ...template, logoWidth: parseInt(e.target.value) || 90 })}
                          className="w-16 bg-white border border-slate-300 px-1.5 py-0.5 rounded text-xs font-bold outline-none"
                        />
                      </div>
                      <div className="space-y-0.5">
                        <label className="text-[9px] font-bold text-slate-500 block">الموقع</label>
                        <select
                          value={template.logoPosition || "left"}
                          onChange={(e) => setTemplate({ ...template, logoPosition: e.target.value as any })}
                          className="bg-white border border-slate-300 px-1 py-0.5 rounded text-xs font-bold"
                        >
                          <option value="left">يسار</option>
                          <option value="right">يمين</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Group 2: Table Rows customization */}
              <div className="col-span-12 md:col-span-4 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">خصائص الجدول بالمستند</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={addTableRow}
                    className="bg-slate-200 hover:bg-slate-300 px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1 text-slate-700"
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-blue-600" />
                    إضافة صف
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTableRow(tableRows.length - 1)}
                    disabled={tableRows.length <= 1}
                    className="bg-slate-200 hover:bg-slate-300 disabled:opacity-50 px-2.5 py-1.5 rounded text-xs font-bold flex items-center gap-1 text-slate-700"
                  >
                    <MinusCircle className="w-3.5 h-3.5 text-red-600" />
                    حذف صف
                  </button>
                </div>
                <div className="text-[10px] text-slate-400">يمكنك النقر مباشرة على خلايا الجدول ومعاينتها للتعديل اليدوي للنص!</div>
              </div>

              {/* Group 3: Default Text inputs */}
              <div className="col-span-12 md:col-span-3 space-y-1 block">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">عنوان ومحتوى الصفحة الملحقة</span>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={template.reportTitle || ""}
                    onChange={(e) => setTemplate({ ...template, reportTitle: e.target.value })}
                    className="w-full bg-white border border-slate-300 px-2 py-1 rounded text-xs font-bold text-slate-800 outline-none"
                    placeholder="تعديل عنوان التقرير"
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB: LAYOUT - Page margins, Orientation, border styles */}
          {ribbonTab === "layout" && (
            <>
              {/* Orientation */}
              <div className="col-span-12 md:col-span-3 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">إتجاه صفحة الطباعة</span>
                <select
                  value={template.paperOrientation || "portrait"}
                  onChange={(e) => setTemplate({ ...template, paperOrientation: e.target.value as any })}
                  className="bg-white border border-slate-300 px-2 py-1 rounded text-xs font-bold outline-none w-full h-8"
                >
                  <option value="portrait">📄 رأسي (Portrait A4)</option>
                  <option value="landscape">📊 أفقي (Landscape A4)</option>
                </select>
                <div className="text-[9px] text-slate-400 font-medium">الاتجاه الأفقي مثالي للجداول الحسابية العريضة.</div>
              </div>

              {/* Margins */}
              <div className="col-span-12 md:col-span-3 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">هوامش الصفحة (Margins)</span>
                <select
                  value={template.pageMargins || "normal"}
                  onChange={(e) => setTemplate({ ...template, pageMargins: e.target.value as any })}
                  className="bg-white border border-slate-300 px-2 py-1 rounded text-xs font-bold outline-none w-full h-8"
                >
                  <option value="normal">عادية (2.54 سم من كل جانب)</option>
                  <option value="narrow">ضيقة (1.27 سم لتفاصيل أكثر)</option>
                  <option value="wide">عريضة (5.08 سم لهامش فسيح)</option>
                </select>
                <div className="text-[9px] text-slate-400 font-medium">الهوامش الضيقة تقلل عدد الصفحات عند الطباعة.</div>
              </div>

              {/* Page Border Styles */}
              <div className="col-span-12 md:col-span-3 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">نمط الإطار الخارجي</span>
                <select
                  value={template.borderStyle}
                  onChange={(e) => setTemplate({ ...template, borderStyle: e.target.value as any })}
                  className="bg-white border border-slate-300 px-2 py-1 rounded text-xs font-bold outline-none w-full h-8"
                >
                  <option value="none">بدون إطار</option>
                  <option value="thin">إطار رفيع بسيط</option>
                  <option value="double">إطار مزدوج رسمي</option>
                  <option value="classic">إطار كلاسيكي مزخرف</option>
                </select>
                <div className="text-[9px] text-slate-400 font-medium">يمكنك أيضاً تغيير لون إطار الصفحة بالكامل.</div>
              </div>

              {/* Page Border color */}
              <div className="col-span-12 md:col-span-3 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">لون إطار الصفحة</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={template.borderColor || template.accentColor}
                    onChange={(e) => setTemplate({ ...template, borderColor: e.target.value })}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase">{template.borderColor || template.accentColor}</span>
                </div>
              </div>
            </>
          )}

          {/* TAB: DESIGN - Watermark options, layout styling and header configurations */}
          {ribbonTab === "design" && (
            <>
              {/* Watermark text */}
              <div className="col-span-12 md:col-span-4 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">علامة مائية بالخلفية (Watermark)</span>
                <input
                  type="text"
                  placeholder="مثال: سري جداً، مسودة، معتمد"
                  value={template.watermarkText || ""}
                  onChange={(e) => setTemplate({ ...template, watermarkText: e.target.value })}
                  className="w-full bg-white border border-slate-300 px-2.5 py-1 rounded text-xs font-bold text-slate-800 outline-none h-8"
                />
                <div className="text-[9px] text-slate-400">اترك الحقل فارغاً لإلغاء العلامة المائية.</div>
              </div>

              {/* Watermark color picker */}
              <div className="col-span-12 md:col-span-2 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">لون العلامة</span>
                <input
                  type="color"
                  value={template.watermarkColor || "#e2e8f0"}
                  onChange={(e) => setTemplate({ ...template, watermarkColor: e.target.value })}
                  className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                />
              </div>

              {/* Table header styling customizer */}
              <div className="col-span-12 md:col-span-3 border-l border-slate-300 pl-4 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">خلفية عناوين الجدول</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    value={template.tableHeaderBg || "#2563eb"}
                    onChange={(e) => setTemplate({ ...template, tableHeaderBg: e.target.value })}
                    className="w-8 h-8 rounded border border-slate-300 cursor-pointer"
                  />
                  <select
                    value={template.tableHeaderTextColor || "#ffffff"}
                    onChange={(e) => setTemplate({ ...template, tableHeaderTextColor: e.target.value })}
                    className="bg-white border border-slate-300 px-1 py-1 rounded text-[11px] font-bold flex-1"
                  >
                    <option value="#ffffff">نص أبيض</option>
                    <option value="#1e293b">نص غامق</option>
                  </select>
                </div>
              </div>

              {/* Header layout settings */}
              <div className="col-span-12 md:col-span-3 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 block uppercase tracking-wider">شكل ونمط الهيدر والترويسة</span>
                <select
                  value={template.headerLayout || "classic"}
                  onChange={(e) => setTemplate({ ...template, headerLayout: e.target.value as any })}
                  className="bg-white border border-slate-300 px-2 py-1 rounded text-xs font-bold outline-none w-full h-8"
                >
                  <option value="classic">كلاسيكي (مؤسسة يمين / شعار يسار)</option>
                  <option value="centered">موسط بالكامل (شعار وعناوين بالمنتصف)</option>
                  <option value="modern">حديث (بطاقة مظللة مع شريط ملون جانبي)</option>
                </select>
              </div>
            </>
          )}

          {/* TAB: HELP - Quick guidelines */}
          {ribbonTab === "help" && (
            <div className="col-span-12 bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs font-medium text-blue-800 flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="font-bold">نصائح لتصميم أرقى قوالب ومستندات Word:</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-600 font-bold text-[11px]">
                  <li>المستند يدعم بالكامل إدراج الشعار وحفظه كصورة مشفرة (Base64) ليظهر معك بدون أي روابط معطلة داخل ملفات الـ Word.</li>
                  <li>النقر المباشر على عناوين الجدول أو نصوص التقرير في المعاينة على اليسار يتيح لك تعديل المحتوى مباشرة لمعاينته قبل التصدير.</li>
                  <li>تم تهيئة القوالب لتكون متطابقة ومستقرة تماماً مع برامج وورد بمختلف إصداراتها وتطبيق التنسيق بدقة متناهية.</li>
                </ul>
              </div>
            </div>
          )}
          
        </div>
      </div>

      {/* 3. CORE DESIGNER BODY (INPUTS FORM + INTERACTIVE WORD SHEET SIMULATOR) */}
      <div className="flex flex-col lg:flex-row gap-6 p-2">
        
        {/* Left Side: Additional Data Form */}
        <div className="w-full lg:w-4/12 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm">
            <h3 className="font-extrabold text-sm border-b pb-2 flex items-center gap-1.5 text-slate-900">
              <FileEdit className="w-4 h-4 text-blue-600" />
              إعدادات نصوص وثيقة التقرير
            </h3>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">اسم المؤسسة الرئيسي (الهيدر)</label>
              <input
                type="text"
                value={template.headerTitle}
                onChange={(e) => setTemplate({ ...template, headerTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-extrabold outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">العنوان الفرعي للترويسة</label>
              <input
                type="text"
                value={template.headerSubTitle}
                onChange={(e) => setTemplate({ ...template, headerSubTitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-extrabold outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">نص التوقيع والاعتماد بالأسفل</label>
              <input
                type="text"
                value={template.signatureText}
                onChange={(e) => setTemplate({ ...template, signatureText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-extrabold outline-none focus:border-blue-500 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-600 block">نص التذييل وحفظ الحقوق</label>
              <textarea
                value={template.footerText}
                onChange={(e) => setTemplate({ ...template, footerText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-extrabold outline-none focus:border-blue-500 transition-all h-16 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="designer_showDate"
                  checked={template.showDate}
                  onChange={(e) => setTemplate({ ...template, showDate: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 cursor-pointer"
                />
                <label htmlFor="designer_showDate" className="text-[11px] font-bold text-slate-600 cursor-pointer">
                  تاريخ الطباعة تلقائي
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="designer_showPageNumbers"
                  checked={template.showPageNumbers}
                  onChange={(e) => setTemplate({ ...template, showPageNumbers: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 cursor-pointer"
                />
                <label htmlFor="designer_showPageNumbers" className="text-[11px] font-bold text-slate-600 cursor-pointer">
                  ترقيم الصفحات أسفل
                </label>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="designer_tableStriped"
                checked={template.tableStriped !== false}
                onChange={(e) => setTemplate({ ...template, tableStriped: e.target.checked })}
                className="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 border-slate-300 cursor-pointer"
              />
              <label htmlFor="designer_tableStriped" className="text-[11px] font-bold text-slate-600 cursor-pointer">
                تفعيل صفوف الجداول الملونة بالتبادل
              </label>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-5 text-white space-y-3.5 shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h4 className="font-extrabold text-xs">تكامل التقارير والنظام المالي</h4>
            </div>
            <p className="text-[10px] text-slate-300 font-medium leading-relaxed">
              عند نقرك لحفظ هذا القالب، سيقوم نظام <b>ريستو ماستر برو</b> بتخزينه كإعداد مركزي. عند تصدير أي فاتورة مشتريات، تقارير الفروع، دفاتر اليومية، أو حركة الأستاذ العام بصيغة Word، ستظهر تلقائياً بذات السمة البصرية والشعار الذي صممته هنا.
            </p>
            <button
              onClick={saveTemplate}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
            >
              <Check className="w-4 h-4" />
              تطبيق فوري على كافة المديولات
            </button>
          </div>
        </div>

        {/* Right Side: Beautiful Microsoft Word Mock Paper Sheets Container */}
        <div className="flex-1">
          {/* Word Paper Grey stage */}
          <div className="bg-slate-400/90 rounded-2xl p-6 md:p-10 flex flex-col items-center justify-start min-h-[900px] border-2 border-slate-500 overflow-auto relative shadow-inner">
            
            {/* Quick Helper Ribbon above sheet */}
            <div className="w-full max-w-[800px] bg-slate-100 rounded-t-lg border-t border-x border-slate-300 px-4 py-2 flex items-center justify-between text-xs text-slate-500 font-bold mb-0.5">
              <div className="flex items-center gap-1">
                <Printer className="w-4 h-4" />
                <span>معاينة طباعة مستند Word (مقاس A4 الحقيقي)</span>
              </div>
              <div className="flex items-center gap-1 text-slate-400 font-normal">
                <span>تعديل مباشر مفعل</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              </div>
            </div>

            {/* Simulated Word Sheet Paper Canvas */}
            <motion.div
              layout
              className="bg-white shadow-2xl relative transition-all duration-300 overflow-hidden select-text w-full max-w-[800px]"
              style={{
                minHeight: template.paperOrientation === "landscape" ? "595px" : "842px",
                padding: template.pageMargins === "narrow" ? "24px" : template.pageMargins === "wide" ? "80px" : "48px",
                borderColor: template.borderColor || template.accentColor,
                borderWidth: template.borderStyle === "none" ? "0px" : template.borderStyle === "thin" ? "2px" : template.borderStyle === "double" ? "6px" : "12px",
                borderStyle: template.borderStyle === "double" ? "double" : template.borderStyle === "classic" ? "double" : "solid",
                outline: template.borderStyle === "classic" ? `4px solid ${template.borderColor || template.accentColor}` : "none",
                outlineOffset: template.borderStyle === "classic" ? "-20px" : "0px",
                fontFamily:
                  template.fontFamily === "traditional"
                    ? "Traditional Arabic, serif"
                    : template.fontFamily === "amiri"
                    ? "Amiri, serif"
                    : template.fontFamily === "modern"
                    ? "Segoe UI, Arial, sans-serif"
                    : "Cairo, sans-serif"
              }}
            >
              {/* Dynamic Watermark Backing layer */}
              {template.watermarkText && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 select-none"
                  style={{
                    transform: "rotate(-30deg)",
                    color: template.watermarkColor || "#e2e8f0",
                    fontSize: template.paperOrientation === "landscape" ? "80px" : "60px",
                    fontWeight: "900",
                    opacity: 0.15,
                    whiteSpace: "nowrap"
                  }}
                >
                  {template.watermarkText}
                </div>
              )}

              {/* Sheet content flow */}
              <div className="relative z-10 h-full flex flex-col justify-between" style={{ minHeight: "680px" }}>
                
                {/* Header configuration */}
                <div>
                  <div
                    className={`pb-4 ${template.showHeaderLine !== false ? "border-b-2" : ""} mb-6`}
                    style={{ borderColor: template.accentColor }}
                  >
                    {template.headerLayout === "centered" ? (
                      <div className="text-center space-y-2">
                        {template.logoUrl && (
                          <div className="flex justify-center mb-2">
                            <img
                              src={template.logoUrl}
                              style={{ height: `${template.logoWidth || 90}px` }}
                              className="object-contain"
                              alt="Brand Logo"
                            />
                          </div>
                        )}
                        <h1 className="text-2xl font-black text-slate-900 leading-tight">
                          {template.headerTitle}
                        </h1>
                        <p className="text-xs font-bold text-slate-500">
                          {template.headerSubTitle}
                        </p>
                        {template.showDate && (
                          <span className="text-[10px] text-slate-400 block pt-1">
                            تاريخ تحرير التقرير: {new Date().toLocaleDateString("ar-EG")} | {new Date().toLocaleTimeString("ar-EG")}
                          </span>
                        )}
                      </div>
                    ) : template.headerLayout === "modern" ? (
                      <div
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border-r-4 shadow-sm"
                        style={{ borderRightColor: template.accentColor }}
                      >
                        <div className="space-y-1">
                          <h1 className="text-lg font-black text-slate-900">
                            {template.headerTitle}
                          </h1>
                          <p className="text-xs font-bold text-slate-500">
                            {template.headerSubTitle}
                          </p>
                        </div>
                        {template.logoUrl ? (
                          <img
                            src={template.logoUrl}
                            style={{ height: `${(template.logoWidth || 90) * 0.8}px` }}
                            className="object-contain"
                            alt="Brand Logo"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded bg-slate-200 flex items-center justify-center text-slate-400 border border-slate-300">
                            <ImageIcon className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    ) : (
                      // Classic Alignment (Right / Left)
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          {template.logoPosition === "right" && template.logoUrl && (
                            <img
                              src={template.logoUrl}
                              style={{ height: `${(template.logoWidth || 90) * 0.8}px`, marginBottom: "8px" }}
                              className="object-contain"
                              alt="Brand Logo"
                            />
                          )}
                          <h1 className="text-xl font-black text-slate-900 leading-tight">
                            {template.headerTitle}
                          </h1>
                          <p className="text-xs font-bold text-slate-500">
                            {template.headerSubTitle}
                          </p>
                        </div>
                        <div className="text-left flex flex-col items-end">
                          {template.logoPosition !== "right" && template.logoUrl ? (
                            <img
                              src={template.logoUrl}
                              style={{ height: `${(template.logoWidth || 90) * 0.8}px`, marginBottom: "8px" }}
                              className="object-contain animate-fadeIn"
                              alt="Brand Logo"
                            />
                          ) : null}
                          {template.showDate && (
                            <div className="text-[9px] font-bold text-slate-400 space-y-0.5 text-left">
                              <p>تاريخ التصدير: {new Date().toLocaleDateString("ar-EG")}</p>
                              <p>وقت المستند: {new Date().toLocaleTimeString("ar-EG")}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Document editable body */}
                  <div
                    className="space-y-5"
                    style={{
                      lineHeight: template.lineSpacing || "1.15",
                      fontSize: template.fontSize === "small" ? "12px" : template.fontSize === "large" ? "17px" : "14px",
                      textAlign: textAlignment,
                      fontWeight: isBold ? "bold" : "normal",
                      fontStyle: isItalic ? "italic" : "normal",
                      textDecoration: isUnderline ? "underline" : "none"
                    }}
                  >
                    {/* Editable Main Title */}
                    <input
                      type="text"
                      value={template.reportTitle || ""}
                      onChange={(e) => setTemplate({ ...template, reportTitle: e.target.value })}
                      className="w-full bg-blue-50/50 hover:bg-blue-100/50 px-2.5 py-1.5 rounded-lg border-b-2 border-dashed border-slate-300 text-lg font-black text-slate-900 outline-none text-center"
                      title="انقر لتعديل عنوان التقرير"
                    />

                    {/* Editable body paragraph */}
                    <textarea
                      value={template.reportContentText || ""}
                      onChange={(e) => setTemplate({ ...template, reportContentText: e.target.value })}
                      className="w-full bg-slate-50/30 hover:bg-slate-100/30 px-3 py-2 rounded-xl border border-dashed border-slate-200 outline-none h-24 resize-none leading-relaxed text-justify text-slate-700 font-semibold"
                      placeholder="اكتب هنا محتوى نص التقرير المكتوب في الصفحة..."
                      title="انقر لتعديل نص التقرير مباشرة"
                    />

                    {/* Dynamic Table Simulation */}
                    <div className="overflow-x-auto my-4">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr
                            style={{
                              backgroundColor: template.tableHeaderBg || template.accentColor,
                              color: template.tableHeaderTextColor || "#ffffff"
                            }}
                          >
                            {tableHeaders.map((header, colIndex) => (
                              <th key={colIndex} className="p-2 text-xs border border-slate-300 font-extrabold">
                                <input
                                  type="text"
                                  value={header}
                                  onChange={(e) => {
                                    const next = [...tableHeaders];
                                    next[colIndex] = e.target.value;
                                    setTableHeaders(next);
                                  }}
                                  className="bg-transparent border-0 text-inherit font-black focus:ring-1 focus:ring-white w-full text-right outline-none"
                                />
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row, rowIndex) => (
                            <tr
                              key={rowIndex}
                              className={template.tableStriped && rowIndex % 2 === 0 ? "bg-slate-50/70" : "bg-white"}
                            >
                              {row.map((cell, colIndex) => (
                                <td key={colIndex} className="p-2 text-[11px] border border-slate-300 font-bold text-slate-700">
                                  <input
                                    type="text"
                                    value={cell}
                                    onChange={(e) => {
                                      const next = [...tableRows];
                                      next[rowIndex][colIndex] = e.target.value;
                                      setTableRows(next);
                                    }}
                                    className="bg-transparent border-0 text-slate-700 focus:bg-slate-100 w-full text-right outline-none font-bold"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <p className="text-xs text-slate-400 italic">
                      * تلميح: كافة البيانات في الجدول أعلاه يمكن تعديلها يدوياً وتجربتها بشكل كامل كما في برنامج Microsoft Word.
                    </p>
                  </div>
                </div>

                {/* Bottom Signature & Footer layout */}
                <div className="mt-8 pt-4">
                  {/* Signature block aligned to left (standard Arabic official pattern) */}
                  <div className="flex justify-start pl-8 mb-6">
                    <div className="text-center w-52 space-y-1">
                      <div className="border-t border-slate-400 mb-1"></div>
                      <p className="text-[11px] font-extrabold text-slate-900 leading-tight">
                        {template.signatureText}
                      </p>
                      <span className="text-[9px] text-slate-400 font-bold">(التوقيع والمصادقة الإلكترونية)</span>
                    </div>
                  </div>

                  {/* Footnotes and Page number indicator */}
                  <div className="border-t pt-3.5 flex justify-between text-[10px] font-bold text-slate-400">
                    <p>{template.footerText}</p>
                    {template.showPageNumbers && <p className="font-mono">صفحة ١ من ١</p>}
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
          
          <div className="mt-4 flex gap-4">
            <button
              onClick={saveTemplate}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition-all flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              حفظ القالب وتنسيق الوورد
            </button>
          </div>
        </div>

      </div>
      
    </div>
  );
};
