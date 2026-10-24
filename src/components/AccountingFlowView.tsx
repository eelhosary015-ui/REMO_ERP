import React from "react";
import {
  FolderTree,
  BookOpen,
  Users,
  FileText,
  Scale,
  Percent,
  Receipt,
  Filter,
  History,
  BarChart3,
  PieChart,
  TrendingUp,
  ArrowDown,
  ChevronLeft,
  ArrowRightLeft,
  Info,
  HelpCircle,
  Clock,
} from "lucide-react";
import { motion } from "motion/react";

interface AccountingFlowViewProps {
  onNavigate: (
    tabId:
      | "accounts"
      | "journal"
      | "trial_balance"
      | "income_statement"
      | "balance_sheet"
      | "cost_centers"
      | "ledger"
      | "customers_suppliers"
      | "vouchers"
      | "bank_reconciliation"
      | "fixed_assets"
      | "taxes",
  ) => void;
}

export const AccountingFlowView: React.FC<AccountingFlowViewProps> = ({
  onNavigate,
}) => {
  // Define metadata for all nodes in the accounting cycle
  const nodes = {
    accounts: {
      title: "شجرة الحسابات",
      englishTitle: "Chart of Accounts",
      description:
        "الهيكل التنظيمي الأساسي لكافة الحسابات المالية والأصول والخصوم المصنفة هرمياً.",
      icon: FolderTree,
      color:
        "from-amber-500 to-amber-605 bg-amber-50 border-amber-200 text-amber-700 hover:shadow-amber-100",
      tabId: "accounts" as const,
      badge: "المرجع والأساس",
    },
    journal: {
      title: "القيود اليومية",
      englishTitle: "Journal Entries",
      description:
        "مرحلة تسجيل وإثبات كافة العمليات المالية واليومية المباشرة والمرحلة.",
      icon: BookOpen,
      color:
        "from-blue-500 to-sky-505 bg-blue-50 border-blue-200 text-blue-700 hover:shadow-blue-100",
      tabId: "journal" as const,
      badge: "التسجيل المركزي",
    },
    // Sub-ledger modules supporting the Journal phase
    subModules: [
      {
        id: "customers_suppliers",
        title: "العملاء والموردين",
        englishTitle: "Customers & Suppliers",
        description:
          "متابعة حسابات المبيعات، المشتريات، الذمم الدائنة والمدينة وتسديداتها.",
        icon: Users,
        color:
          "from-violet-500 to-purple-605 bg-purple-50 border-purple-200 text-purple-700 hover:shadow-purple-100",
        tabId: "customers_suppliers" as const,
      },
      {
        id: "vouchers",
        title: "سندات القبض والصرف",
        englishTitle: "Receipt & Vouchers",
        description:
          "إصدار وتوثيق المقبوضات النقدية والمدفوعات والمصاريف المباشرة.",
        icon: FileText,
        color:
          "from-emerald-500 to-teal-605 bg-emerald-50 border-emerald-200 text-emerald-700 hover:shadow-emerald-100",
        tabId: "vouchers" as const,
      },
      {
        id: "bank_reconciliation",
        title: "البنك والتسوية البنكية",
        englishTitle: "Bank Reconciliation",
        description:
          "ربط كشوف الحسابات الحقيقية ومطابقتها دفترياً مع حسابات البنك.",
        icon: Scale,
        color:
          "from-cyan-500 to-cyan-605 bg-cyan-50 border-cyan-200 text-cyan-750 hover:shadow-cyan-100",
        tabId: "bank_reconciliation" as const,
      },
      {
        id: "fixed_assets",
        title: "الأصول الثابتة",
        englishTitle: "Fixed Assets",
        description:
          "متابعة أصول المؤسسة، وحساب نسب الإهلاك الشهري والسنوي آلياً.",
        icon: Percent,
        color:
          "from-rose-500 to-rose-605 bg-rose-50 border-rose-200 text-rose-700 hover:shadow-rose-100",
        tabId: "fixed_assets" as const,
      },
      {
        id: "taxes",
        title: "الضرائب والزكاة",
        englishTitle: "Tax Management",
        description:
          "احتساب ضريبة القيمة المضافة، الخصم والتحصيل، وإصدار الإقرارات الجاهزة.",
        icon: Receipt,
        color:
          "from-indigo-500 to-indigo-605 bg-indigo-50 border-indigo-200 text-indigo-700 hover:shadow-indigo-100",
        tabId: "taxes" as const,
      },
      {
        id: "cost_centers",
        title: "مراكز التكلفة",
        englishTitle: "Cost Centers",
        description:
          "توزيع الإيرادات والمصاريف على الأقسام والمشاريع والتحليل التفصيلي.",
        icon: Filter,
        color:
          "from-orange-500 to-amber-505 bg-orange-50 border-orange-200 text-orange-700 hover:shadow-orange-100",
        tabId: "cost_centers" as const,
      },
    ],
    ledger: {
      title: "دفتر الأستاذ العام",
      englishTitle: "General Ledger",
      description:
        "ترحيل وتجميع القيود والعمليات بشكل تفصيلي لكل حساب على حدة لمتابعة الأرصدة.",
      icon: History,
      color:
        "from-sky-600 to-indigo-605 bg-sky-50 border-sky-200 text-sky-800 hover:shadow-sky-100",
      tabId: "ledger" as const,
      badge: "الترحيل التراكمي",
    },
    trialBalance: {
      title: "ميزان المراجعة",
      englishTitle: "Trial Balance",
      description:
        "فحص مالي شامل للتحقق من توازن أرصدة المدين والدائن لجميع الحسابات لضمان الدقة المطلقة.",
      icon: BarChart3,
      color:
        "from-fuchsia-500 to-pink-505 bg-fuchsia-50/70 border-fuchsia-200 text-fuchsia-800 hover:shadow-fuchsia-100",
      tabId: "trial_balance" as const,
      badge: "التدقيق والتحقق",
    },
    reports: [
      {
        id: "income_statement",
        title: "قائمة الدخل",
        englishTitle: "Income Statement",
        description:
          "ملخص للأرباح والخسائر عن طريق طرح تكاليف النشاط والرواتب والمصاريف من المبيعات.",
        icon: PieChart,
        color:
          "from-teal-500 to-emerald-605 bg-teal-50 border-teal-200 text-teal-800 hover:shadow-teal-100",
        tabId: "income_statement" as const,
        badge: "الأرباح والخسائر",
      },
      {
        id: "balance_sheet",
        title: "الميزانية العمومية",
        englishTitle: "Balance Sheet",
        description:
          "التوازن المالي المالي الختامي للمؤسسة: يعكس ما تملكه من أصول مقابل التزاماتها وحقوق ملكيتها.",
        icon: FileText,
        color:
          "from-emerald-600 to-green-605 bg-green-50 border-green-250 text-green-800 hover:shadow-green-105",
        tabId: "balance_sheet" as const,
        badge: "قائمة المركز المالي",
      },
    ],
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Intro Header & Explanation */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50/40 border border-amber-100 rounded-3xl p-6 lg:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-right">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full">
            <Info className="w-3.5 h-3.5" />
            <span>خريطة تدفق العمليات الحسابية المتكاملة</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-black text-slate-900">
            ترابط وتكامل خصائص الحسابات العامة بالبرنامج
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
            شاهد كيف تتدفق دورتك المستندية والمالية داخل النظام بسلاسة وعلاقة
            تكاملية. تتبدأ من هيكلة
            <strong className="text-amber-805"> شجرة الحسابات </strong> لتخلق
            أساس <strong className="text-blue-805">القيود اليومية</strong>،
            وتستقي ببياناتها النقدية والتسويات من العملاء، السندات، البنوك،
            الأصول، والضرائب لتنتقل إلى{" "}
            <strong className="text-sky-850">دفتر الأستاذ</strong> ثم توازن
            وتدقق بـ{" "}
            <strong className="text-fuchsia-800">ميزان المراجعة</strong> وتتوج
            أخيراً بـ{" "}
            <strong className="text-emerald-800">
              التقارير المالية الختامية
            </strong>
            .
          </p>
        </div>

        {/* Helper Note with click hint */}
        <div className="bg-white border border-rose-100/80 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-sm shrink-0">
          <div className="w-9 h-9 bg-rose-50 rounded-xl flex items-center justify-center text-rose-505 animate-bounce">
            <ChevronLeft className="w-5 h-5 rtl:hidden" />
            <ChevronLeft className="w-5 h-5 ltr:hidden rotate-180" />
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-slate-800">تصفح تفاعلي فوري</p>
            <p className="text-slate-500">
              انقر على أي كارد محاسبي للانتقال للقسم فوراً
            </p>
          </div>
        </div>
      </div>

      {/* VISUAL FLOW MAP CONTAINER */}
      <div className="relative bg-slate-50 border border-slate-200/60 rounded-3xl p-6 lg:p-10 space-y-12 overflow-hidden">
        {/* BACKGROUND RENDER DESIGN LINES (Vertical flow helper behind) */}
        <div className="absolute top-24 bottom-24 left-1/2 -translate-x-1/2 w-0.5 border-r border-dashed border-slate-300 pointer-events-none hidden md:block" />

        {/* =========================================
            STAGE 1: Chart of Accounts (شجرة الحسابات)
            ========================================= */}
        <div className="flex flex-col items-center relative z-10">
          <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={() => onNavigate(nodes.accounts.tabId)}
            className={`w-full max-w-sm cursor-pointer p-6 bg-white border rounded-2xl shadow-sm transition-all duration-300 hover:border-amber-400 border-amber-200 text-right group relative`}
          >
            <div className="absolute -top-3 right-5 bg-amber-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-mini">
              {nodes.accounts.badge}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-black text-slate-900 group-hover:text-amber-700 transition-colors flex items-center gap-1.5 justify-end">
                  <span>{nodes.accounts.title}</span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  {nodes.accounts.englishTitle}
                </p>
                <p className="text-xs text-slate-550 leading-relaxed mt-1">
                  {nodes.accounts.description}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner group-hover:bg-amber-100 transition-all shrink-0">
                <FolderTree className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-amber-650 font-bold">
              <span>هيكل البيانات العام للمنشأة</span>
              <span className="flex items-center gap-0.5 bg-amber-50 group-hover:bg-amber-100/80 px-2 py-1 rounded-lg transition-colors">
                فتح الشجرة <ChevronLeft className="w-3 h-3" />
              </span>
            </div>
          </motion.div>

          {/* Flow Arrow Down */}
          <div className="my-4 flex justify-center items-center">
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="w-8 h-8 rounded-full bg-amber-50 border border-amber-150 text-amber-600 flex items-center justify-center shadow-mini"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.div>
          </div>
        </div>

        {/* =========================================
            STAGE 2: Journal Entries (القيود اليومية)
            ========================================= */}
        <div className="flex flex-col items-center relative z-10">
          <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={() => onNavigate(nodes.journal.tabId)}
            className={`w-full max-w-md cursor-pointer p-6 bg-white border border-blue-200 rounded-3xl shadow-sm hover:border-blue-450 transition-all duration-300 text-right group relative`}
          >
            <div className="absolute -top-3 right-5 bg-blue-600 text-white text-[10px] font-black px-2 .5 rounded-md shadow-mini">
              {nodes.journal.badge}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-black text-slate-900 group-hover:text-blue-700 transition-colors flex items-center gap-1.5 justify-end">
                  <span>{nodes.journal.title}</span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  {nodes.journal.englishTitle}
                </p>
                <p className="text-xs text-slate-550 leading-relaxed mt-1">
                  {nodes.journal.description}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner group-hover:bg-blue-105 transition-all shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-650 font-bold">
              <span>طرفي القيد: مدين / دائن متوازن</span>
              <span className="flex items-center gap-0.5 bg-blue-50 group-hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors">
                استعراض القيود <ChevronLeft className="w-3 h-3" />
              </span>
            </div>
          </motion.div>

          {/* Subheader Title for Subsidiaries */}
          <div className="text-center mt-6">
            <span className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded-full font-black text-xs inline-flex items-center gap-1.5 shadow-sm border border-slate-300">
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500 animate-pulse" />
              <span>
                الدفاتر المساعدة والعمليات الفرعية الفعّالة (تغذي وتؤثر في
                القيود اليومية)
              </span>
            </span>
          </div>

          {/* Connection Lines Grid for Sub-modules (Visual branches) - Large screens only */}
          <div className="w-full max-w-5xl h-8 relative hidden lg:block">
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ transform: "scaleX(-1)" }}
            >
              {/* horizontal spine */}
              <line
                x1="8%"
                y1="10"
                x2="92%"
                y2="10"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {/* lines down onto modules */}
              <line
                x1="8%"
                y1="10"
                x2="8%"
                y2="32"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="25%"
                y1="10"
                x2="25%"
                y2="32"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="42%"
                y1="10"
                x2="42%"
                y2="32"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="58%"
                y1="10"
                x2="58%"
                y2="32"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="75%"
                y1="10"
                x2="75%"
                y2="32"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="92%"
                y1="10"
                x2="92%"
                y2="32"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              {/* Central flow drop */}
              <line
                x1="50%"
                y1="0"
                x2="50%"
                y2="32"
                stroke="#3b82f6"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* =========================================
            STAGE 3: The 6 Subsidiaries Group Grid
            ========================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 xl:gap-2 relative z-10 w-full px-4">
          {nodes.subModules.map((sub, idx) => (
            <motion.div
              key={sub.id}
              whileHover={{ y: -4, scale: 1.01 }}
              onClick={() => onNavigate(sub.tabId)}
              className="bg-white border border-slate-200/90 rounded-2xl p-4 cursor-pointer text-right transition-all duration-300 hover:border-indigo-400 hover:shadow-lg flex flex-col justify-between group"
            >
              <div className="space-y-2">
                {/* Header Icon + Label */}
                <div className="flex items-center justify-between">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-slate-50 group-hover:bg-slate-105 text-slate-600 transition-colors`}
                  >
                    <sub.icon className="w-4 h-4 text-slate-800" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    0{idx + 1}
                  </span>
                </div>

                {/* Text Description */}
                <div>
                  <h4 className="font-black text-xs text-slate-900 group-hover:text-indigo-650 transition-all">
                    {sub.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {sub.englishTitle}
                  </p>
                  <p className="text-[11px] text-slate-500 line-clamp-3 leading-relaxed mt-1.5 h-12">
                    {sub.description}
                  </p>
                </div>
              </div>

              {/* Action Trigger Link */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-500 group-hover:text-indigo-600">
                <span>تأثير وتكامل بالقيد</span>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 transition-transform group-hover:-translate-x-1" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Connect Drop after the Subsidiary Row to Ledger */}
        <div className="flex flex-col items-center justify-center relative z-10 py-2">
          {/* Arrow branches matching down */}
          <div className="w-full max-w-5xl h-8 relative hidden lg:block">
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ transform: "scaleX(-1)" }}
            >
              <line
                x1="8%"
                y1="0"
                x2="8%"
                y2="15"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="25%"
                y1="0"
                x2="25%"
                y2="15"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="42%"
                y1="0"
                x2="42%"
                y2="15"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="58%"
                y1="0"
                x2="58%"
                y2="15"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="75%"
                y1="0"
                x2="75%"
                y2="15"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />
              <line
                x1="92%"
                y1="0"
                x2="92%"
                y2="15"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4"
              />

              <line
                x1="8%"
                y1="15"
                x2="92%"
                y2="15"
                stroke="#cbd5e1"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
              {/* Center spine leads down to GL */}
              <line
                x1="50%"
                y1="15"
                x2="50%"
                y2="32"
                stroke="#6366f1"
                strokeWidth="2"
              />
            </svg>
          </div>

          <div className="my-2 text-center">
            <div className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-800 text-[10px] font-extrabold px-3 py-1 rounded-full">
              <span>ترحيل القيود اليومية</span>
            </div>
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="mt-2 w-8 h-8 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-600 flex items-center justify-center shadow-mini mx-auto"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.div>
          </div>
        </div>

        {/* =========================================
            STAGE 4: General Ledger (الأستاذ العام)
            ========================================= */}
        <div className="flex flex-col items-center relative z-10 animate-fade">
          <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={() => onNavigate(nodes.ledger.tabId)}
            className={`w-full max-w-sm cursor-pointer p-5 bg-white border border-sky-250 rounded-2xl shadow-sm hover:border-sky-400 transition-all duration-300 text-right group relative`}
          >
            <div className="absolute -top-3 right-5 bg-sky-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-mini">
              {nodes.ledger.badge}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-black text-slate-900 group-hover:text-sky-700 transition-colors flex items-center gap-1.5 justify-end">
                  <span>{nodes.ledger.title}</span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  {nodes.ledger.englishTitle}
                </p>
                <p className="text-xs text-slate-550 leading-relaxed mt-1">
                  {nodes.ledger.description}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-inner group-hover:bg-sky-100 transition-all shrink-0">
                <History className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-sky-700 font-bold">
              <span>كشف حركة وتفاصيل الحسابات منفصلة</span>
              <span className="flex items-center gap-0.5 bg-sky-50 group-hover:bg-sky-100 px-2 py-1 rounded-lg transition-colors">
                فتح دفتر الأستاذ <ChevronLeft className="w-3 h-3" />
              </span>
            </div>
          </motion.div>

          {/* Flow Link Arrow */}
          <div className="my-4 flex justify-center items-center">
            <motion.div
              animate={{ y: [0, 4, 0] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
              className="w-8 h-8 rounded-full bg-sky-50 border border-sky-150 text-sky-600 flex items-center justify-center shadow-mini"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.div>
          </div>
        </div>

        {/* =========================================
            STAGE 5: Trial Balance (ميزان المراجعة)
            ========================================= */}
        <div className="flex flex-col items-center relative z-10">
          <motion.div
            whileHover={{ scale: 1.02 }}
            onClick={() => onNavigate(nodes.trialBalance.tabId)}
            className={`w-full max-w-sm cursor-pointer p-5 bg-white border border-fuchsia-200 rounded-2xl shadow-sm hover:border-fuchsia-400 transition-all duration-300 text-right group relative`}
          >
            <div className="absolute -top-3 right-5 bg-fuchsia-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow-mini">
              {nodes.trialBalance.badge}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-black text-slate-900 group-hover:text-fuchsia-700 transition-colors flex items-center gap-1.5 justify-end">
                  <span>{nodes.trialBalance.title}</span>
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  {nodes.trialBalance.englishTitle}
                </p>
                <p className="text-xs text-slate-550 leading-relaxed mt-1">
                  {nodes.trialBalance.description}
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-fuchsia-50/70 text-fuchsia-600 flex items-center justify-center shadow-inner group-hover:bg-fuchsia-100 transition-all shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-fuchsia-700 font-bold">
              <span>ضبط ميزان المراجعة بالأرصدة والمجاميع</span>
              <span className="flex items-center gap-0.5 bg-fuchsia-50/55 group-hover:bg-fuchsia-105 px-2 py-1 rounded-lg transition-colors">
                فتح ميزان المراجعة <ChevronLeft className="w-3 h-3" />
              </span>
            </div>
          </motion.div>

          {/* Flow Arrow to Financial Reports */}
          <div className="my-5 flex flex-col items-center">
            <span className="px-3.5 py-1 bg-slate-200 text-slate-600 rounded-full font-bold text-[10px] inline-flex items-center gap-1 shadow-sm mb-1.5">
              <span>استخراج القوائم النهائية</span>
            </span>
            <div className="w-full max-w-sm h-6 relative hidden md:block">
              <svg
                className="absolute inset-0 w-full h-full"
                style={{ transform: "scaleX(-1)" }}
              >
                <line
                  x1="25%"
                  y1="0"
                  x2="25%"
                  y2="10"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
                <line
                  x1="75%"
                  y1="0"
                  x2="75%"
                  y2="10"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
                <line
                  x1="25%"
                  y1="10"
                  x2="75%"
                  y2="10"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="3 2"
                />
                <line
                  x1="50%"
                  y1="10"
                  x2="50%"
                  y2="24"
                  stroke="#10b981"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <motion.div
              animate={{ y: [0, 3, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-8 h-8 rounded-full bg-emerald-50 border border-emerald-150 text-emerald-600 flex items-center justify-center shadow-mini"
            >
              <ArrowDown className="w-4 h-4" />
            </motion.div>
          </div>
        </div>

        {/* =========================================
            STAGE 6: Financial Reports (التقارير المالية)
            ========================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full relative z-10">
          {nodes.reports.map((report) => (
            <motion.div
              key={report.id}
              whileHover={{ y: -3, scale: 1.02 }}
              onClick={() => onNavigate(report.tabId)}
              className="bg-white border-2 border-emerald-150 rounded-2xl p-5 cursor-pointer text-right transition-all duration-300 hover:border-emerald-450 hover:shadow-xl flex flex-col justify-between group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner group-hover:bg-emerald-100 transition-all shrink-0">
                    <report.icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] bg-emerald-105 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-full">
                    {report.badge}
                  </span>
                </div>

                <div className="pt-1.5">
                  <h3 className="font-black text-sm text-slate-905 flex items-center gap-1.5 justify-end">
                    <span>{report.title}</span>
                  </h3>
                  <p className="text-[10px] font-mono text-slate-400">
                    {report.englishTitle}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed mt-2">
                    {report.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-emerald-700">
                <span>توليد كشف الميزانية الختامي</span>
                <span className="flex items-center gap-0.5 bg-emerald-50 group-hover:bg-emerald-100/80 px-2 py-1 rounded-lg transition-colors">
                  فتح التقرير <ChevronLeft className="w-3 h-3" />
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FOOTER GENERAL ACCOUNTING GUIDE & TIP */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-2 text-right">
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-slate-805 text-sm">
            تسلسل البيانات الفوري
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed">
            تمت تهيئة الحركات لإجراء التحديثات تلقائياً. أي قيد يومي تحفظه يؤثر
            بنفس اللحظة على أرصدة ميزان المراجعة والقوائم المالية الختامية.
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-2 text-right">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-slate-805 text-sm">
            ربط الدفاتر الفرعية
          </h4>
          <p className="text-xs text-slate-550 leading-relaxed">
            العملاء، الموردين، وسندات المقبوضات ترحل بطريقة آلية للقيود اليومية
            التابعة لحماية الدفاتر من إغفال المعاملات الفردية وتصديق التوافق.
          </p>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-2 text-right">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-slate-805 text-sm">
            سلامة الدورة المحاسبية
          </h4>
          <p className="text-xs text-slate-550 leading-relaxed">
            يقفل النظام ويرتحل محاسبياً بإصدار كشف الأرباح وميزانية الربع
            والتحقق من عدم تكرار وتعارض الفواتير مع ضريبة القيمة المضافة.
          </p>
        </div>
      </div>
    </div>
  );
};
