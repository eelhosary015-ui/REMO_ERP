import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Smartphone,
  ChevronLeft,
  Table2,
  Copy,
  Check,
  ExternalLink,
  Info,
  RefreshCw,
} from "lucide-react";
import { Branch } from "../types";
import { CustomerMenu } from "./CustomerMenu";
import { EmployeeMobilePortal } from "./EmployeeMobilePortal";

interface MobileAppsSimulatorViewProps {
  selectedBranch: Branch | null;
  onBack: () => void;
}

export const MobileAppsSimulatorView: React.FC<MobileAppsSimulatorViewProps> = ({
  selectedBranch,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<"menu" | "employee">("menu");
  const [simulatedTable, setSimulatedTable] = useState<number>(1);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [timeStr, setTimeStr] = useState("12:00");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("ar-EG", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const menuUrl = selectedBranch
    ? `${window.location.origin}/menu/${selectedBranch.id}/${simulatedTable}`
    : `${window.location.origin}/menu/1/${simulatedTable}`;

  const employeeUrl = `${window.location.origin}/employee`;

  const tablesCount = selectedBranch?.tables_count || 12;

  return (
    <div className="p-6 bg-slate-100 min-h-screen text-right font-cairo" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <Smartphone className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-800">
              محاكي تطبيقات الموبايل والربط الذكي
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">
              اعرض واختبر التطبيق الخاص بالطاولات أو الموظفين من واجهة المدير مباشرة
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
        >
          <ChevronLeft className="w-4 h-4" />
          رجوع لوحة التحكم
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Side: Controls & Info */}
        <div className="xl:col-span-5 space-y-5">
          {/* App Toggle Tabs */}
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex gap-2">
            <button
              onClick={() => setActiveTab("menu")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition text-sm ${
                activeTab === "menu"
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/10"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Table2 className="w-4 h-4" />
              تطبيق الطاولات والمنيو
            </button>
            <button
              onClick={() => setActiveTab("employee")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition text-sm ${
                activeTab === "employee"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Smartphone className="w-4 h-4" />
              تطبيق موبايل الموظفين
            </button>
          </div>

          {/* Conditional Controls */}
          {activeTab === "menu" ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-extrabold text-sm text-slate-800">
                  اختر رقم الطاولة للمحاكاة:
                </span>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                  طاولة {simulatedTable} حالياً
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                عند النقر على أي طاولة بالأسفل، سيقوم المحاكي بتحديث وعرض قائمة الطعام والطلبيات الخاصة بهذه الطاولة تماماً كما تظهر للعميل عند مسح كود QR.
              </p>

              {/* Tables Grid */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[180px] overflow-y-auto p-1 border border-slate-100 rounded-xl custom-scrollbar">
                {Array.from({ length: tablesCount }).map((_, i) => {
                  const tableNum = i + 1;
                  return (
                    <button
                      key={tableNum}
                      onClick={() => setSimulatedTable(tableNum)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                        simulatedTable === tableNum
                          ? "bg-emerald-50 text-emerald-700 border-emerald-500 scale-105 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      طاولة {tableNum}
                    </button>
                  );
                })}
              </div>

              {/* Direct URLs and actions */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="text-xs font-extrabold text-slate-700 block">
                  الرابط المباشر للمتصفحات والهواتف:
                </span>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    readOnly
                    value={menuUrl ?? ""}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none truncate"
                  />
                  <button
                    onClick={() => handleCopy(menuUrl, "menuUrl")}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl shrink-0 transition"
                    title="نسخ الرابط"
                  >
                    {copiedText === "menuUrl" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  </button>
                  <a
                    href={menuUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl shrink-0 transition"
                    title="فتح في نافذة جديدة"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <span className="font-extrabold text-sm text-slate-800 block">
                تطبيق الخدمة الذاتية للموظفين (Employee Self-Service)
              </span>
              <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                يتيح هذا التطبيق للموظفين تسجيل الحضور والانصراف السريع من هواتفهم الشخصية عبر بصمة السيلفي الحية مع مطابقة موقعهم الجغرافي (GPS) للفروع، وطلب الإجازات والاطلاع على المرتبات.
              </p>

              <div className="bg-blue-50/50 border border-blue-100 p-3.5 rounded-xl space-y-2">
                <span className="text-xs font-extrabold text-blue-900 flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  كيفية تسجيل دخول الموظفين:
                </span>
                <p className="text-[11px] text-blue-800 leading-relaxed font-medium">
                  لتجربة تسجيل الدخول على المحاكي، استخدم كود الموظف وكلمة المرور الخاصة به. يمكنك تعيين أو تغيير كلمة مرور أي موظف من صفحة الموارد البشرية (HR) أو شاشة الحضور والانصراف.
                </p>
              </div>

              {/* Direct URLs and actions */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <span className="text-xs font-extrabold text-slate-700 block">
                  رابط بوابة الموظفين العام:
                </span>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    readOnly
                    value={employeeUrl ?? ""}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none truncate"
                  />
                  <button
                    onClick={() => handleCopy(employeeUrl, "empUrl")}
                    className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl shrink-0 transition"
                    title="نسخ الرابط"
                  >
                    {copiedText === "empUrl" ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
                  </button>
                  <a
                    href={employeeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl shrink-0 transition"
                    title="فتح في نافذة جديدة"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Guidelines info box */}
          <div className="bg-slate-800 text-slate-200 p-5 rounded-2xl shadow-sm space-y-3">
            <span className="font-extrabold text-xs text-amber-400 flex items-center gap-1">
              📱 ميزة التثبيت PWA على الهواتف
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
              كلا التطبيقين يدعمان التثبيت الكامل على الهواتف الذكية (iOS & Android). بمجرد مشاركة الرابط مع العميل أو الموظف وفتحه في المتصفح، يمكنه النقر على <span className="font-bold text-white">"إضافة للشاشة الرئيسية" (Add to Home Screen)</span> ليظهر كـتطبيق مستقل وأيقونة على الهاتف دون الحاجة لتحميله من المتجر!
            </p>
          </div>
        </div>

        {/* Right Side: Simulated Phone Wrapper */}
        <div className="xl:col-span-7 flex justify-center items-center py-4 bg-slate-200/50 rounded-3xl border border-slate-200 min-h-[800px] shadow-inner relative">
          <div className="absolute top-4 left-4 flex gap-2">
            <button
              onClick={() => {
                const curr = activeTab;
                setActiveTab(curr === "menu" ? "employee" : "menu");
                setTimeout(() => setActiveTab(curr), 50);
              }}
              className="p-2 bg-white text-slate-600 hover:text-slate-800 rounded-full shadow border border-slate-200 transition"
              title="إعادة تحميل شاشة المحاكي"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Simulated Smartphone Chassis */}
          <div className="relative mx-auto w-[360px] sm:w-[375px] h-[750px] bg-slate-950 rounded-[48px] p-3 shadow-2xl border-4 border-slate-800 ring-8 ring-slate-900 flex flex-col overflow-hidden">
            {/* Dynamic Island / Camera Notch */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-between px-3">
              <div className="w-2.5 h-2.5 bg-slate-900 rounded-full border border-slate-800"></div>
              <div className="w-12 h-1 bg-slate-900 rounded-full"></div>
            </div>

            {/* Status Bar */}
            <div className="h-6 shrink-0 bg-white text-slate-950 flex justify-between items-center px-6 pt-1 text-[11px] font-bold select-none z-40 relative">
              <span className="font-mono text-[10px]" dir="ltr">
                {timeStr}
              </span>
              <div className="flex items-center gap-1.5" dir="ltr">
                <svg className="w-4 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 22h20V2z" className="opacity-30" />
                  <path d="M2 22h16V6z" />
                </svg>
                <span className="text-[8px] font-extrabold tracking-tighter">5G</span>
                <div className="w-5 h-2.5 border border-slate-950 rounded-sm p-0.5 flex items-center">
                  <div className="h-full w-4 bg-slate-950 rounded-xs"></div>
                </div>
              </div>
            </div>

            {/* Viewport content */}
            <div className="flex-1 bg-slate-50 overflow-y-auto custom-scrollbar rounded-b-[36px] relative flex flex-col">
              <AnimatePresence mode="wait">
                {activeTab === "menu" ? (
                  <motion.div
                    key={`menu-${simulatedTable}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex flex-col"
                  >
                    <CustomerMenu
                      branchId={selectedBranch?.id || 1}
                      tableId={simulatedTable}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="employee-sim"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex flex-col"
                  >
                    <EmployeeMobilePortal onBackToErp={() => setActiveTab("menu")} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
