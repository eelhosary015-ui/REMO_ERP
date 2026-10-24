import React, { useState, useMemo } from "react";
import {
  FileText,
  FileSpreadsheet,
  Scale,
  BookOpen,
  Users,
  Search,
  Calendar,
  Clock,
  Filter,
  Plus,
  Download,
  Printer,
  MoreVertical,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  CheckCircle,
  Building,
  Briefcase,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface AccountingReportsViewProps {
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

export const AccountingReportsView: React.FC<AccountingReportsViewProps> = ({
  onNavigate,
}) => {
  // Filters State
  const [period, setPeriod] = useState<string>("today");
  const [selectedDate, setSelectedDate] = useState<string>("2026-06-22");
  const [selectedBranch, setSelectedBranch] = useState<string>("all");
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [recordsPerPage, setRecordsPerPage] = useState<number>(10);

  // Custom Toast/Notification Feedback
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: "success" | "info" | "error";
  } | null>(null);

  const triggerToast = (
    text: string,
    type: "success" | "info" | "error" = "success",
  ) => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Static reports configuration for top cards
  const reportCards = [
    {
      id: "ledger_statement",
      title: "كشف حساب",
      englishTitle: "Account Statement",
      description: "عرض كشف حساب تفصيلي لحساب معين خلال الفترة.",
      icon: Users,
      bgColor:
        "bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-300",
      tabId: "ledger" as const,
      color: "teal",
    },
    {
      id: "trial_balance_detailed",
      title: "ميزان المراجعة التفصيلي",
      englishTitle: "Detailed Trial Balance",
      description: "عرض أرصدة الحسابات بالتفاصيل والحركات التاريخية.",
      icon: FileSpreadsheet,
      bgColor:
        "bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-300",
      tabId: "trial_balance" as const,
      color: "indigo",
    },
    {
      id: "trial_balance_summary",
      title: "ميزان المراجعة",
      englishTitle: "Trial Balance",
      description: "عرض أرصدة جميع الحسابات مدين - دائن - رصيد ختامي.",
      icon: Scale,
      bgColor:
        "bg-orange-50 text-orange-600 border-orange-100 hover:border-orange-300",
      tabId: "trial_balance" as const,
      color: "orange",
    },
    {
      id: "ledger_general",
      title: "الأستاذ العام",
      englishTitle: "General Ledger",
      description: "عرض حركة حساب معين في فترة زمنية ومطابقتها دفترياً.",
      icon: BookOpen,
      bgColor: "bg-sky-50 text-sky-600 border-sky-100 hover:border-sky-300",
      tabId: "ledger" as const,
      color: "blue",
    },
    {
      id: "journal_all",
      title: "دفتر اليومية",
      englishTitle: "Journal Entries",
      description: "عرض جميع القيود اليومية المسجلة خلال الفترة المحددة.",
      icon: FileText,
      bgColor:
        "bg-purple-50 text-purple-600 border-purple-100 hover:border-purple-300",
      tabId: "journal" as const,
      color: "purple",
    },
  ];

  // Static list items mimicking the actual database/table rows in screenshot
  const initialReportsList = [
    {
      id: 1,
      name: "دفتر اليومية",
      englishName: "General Journal",
      description: "عرض جميع القيود اليومية خلال الفترة المحددة بقيد متوازن.",
      creationDate: "28/05/2024 10:25 ص",
      type: "تفصيلي",
      periodText: "اليوم",
      username: "أحمد محمد",
      tabId: "journal" as const,
    },
    {
      id: 2,
      name: "الأستاذ العام",
      englishName: "General Ledger",
      description: "عرض حركة حساب معين وتسلسلها المتراكم للتفاصيل.",
      creationDate: "28/05/2024 10:20 ص",
      type: "تفصيلي",
      periodText: "اليوم",
      username: "أحمد محمد",
      tabId: "ledger" as const,
    },
    {
      id: 3,
      name: "ميزان المراجعة",
      englishName: "Trial Balance",
      description: "عرض أرصدة جميع الحسابات مدين - دائن - رصيد بمستوياتها.",
      creationDate: "28/05/2024 10:15 ص",
      type: "إجمالي",
      periodText: "اليوم",
      username: "أحمد محمد",
      tabId: "trial_balance" as const,
    },
    {
      id: 4,
      name: "ميزان المراجعة التفصيلي",
      englishName: "Detailed Trial Balance",
      description: "عرض أرصدة الحسابات بالتفاصيل والحركات للتسوية المتبقية.",
      creationDate: "28/05/2024 10:10 ص",
      type: "تفصيلي",
      periodText: "اليوم",
      username: "أحمد محمد",
      tabId: "trial_balance" as const,
    },
    {
      id: 5,
      name: "كشف حساب",
      englishName: "Account Statement",
      description: "عرض كشف حساب لحساب معين ومجمل رصيده المستجد.",
      creationDate: "28/05/2024 10:05 ص",
      type: "تفصيلي",
      periodText: "اليوم",
      username: "أحمد محمد",
      tabId: "ledger" as const,
    },
    {
      id: 6,
      name: "تقرير أعمار الديون",
      englishName: "Aging Debtors Report",
      description:
        "عرض أعمار ديون العملاء والموردين لغايات التسهيلات الائتمانية.",
      creationDate: "28/05/2024 10:00 ص",
      type: "إجمالي",
      periodText: "اليوم",
      username: "أحمد محمد",
      tabId: "customers_suppliers" as const,
    },
    {
      id: 7,
      name: "تقرير المراكز المالية",
      englishName: "Financial Centers Report",
      description: "عرض المركز المالي في تاريخ محدد وتتبع الميزانية المقررة.",
      creationDate: "28/05/2024 09:55 ص",
      type: "إجمالي",
      periodText: "اليوم",
      username: "أحمد محمد",
      tabId: "balance_sheet" as const,
    },
    {
      id: 8,
      name: "قائمة الدخل الربع سنوي",
      englishName: "Quarterly Income Statement",
      description: "مقارنة الإيرادات والمصروفات على مدار الثلاثة أشهر السابقة.",
      creationDate: "27/05/2024 02:30 م",
      type: "إجمالي",
      periodText: "مخصص",
      username: "أحمد محمد",
      tabId: "income_statement" as const,
    },
    {
      id: 9,
      name: "تقرير مراكز التكلفة التفصيلي",
      englishName: "Detailed Cost Centers",
      description: "ربط المصروفات التشغيلية للمطاعم بمراكز التكلفة المحددة.",
      creationDate: "26/05/2024 11:15 ص",
      type: "تفصيلي",
      periodText: "هذا الشهر",
      username: "أحمد محمد",
      tabId: "cost_centers" as const,
    },
    {
      id: 10,
      name: "تقرير إهلاك الأصول الثابتة",
      englishName: "Fixed Assets Depreciation",
      description: "بيان بقيمة إهلاك الأصول المسجلة والآلات والطلب.",
      creationDate: "25/05/2024 09:40 ص",
      type: "تفصيلي",
      periodText: "هذا الشهر",
      username: "أحمد محمد",
      tabId: "fixed_assets" as const,
    },
    {
      id: 11,
      name: "تقرير ضريبة القيمة المضافة الإقراري",
      englishName: "VAT Declaration Report",
      description: "كشف مبيعات ومشتريات خاضعة للضريبة لحساب الإقرار في ثوانٍ.",
      creationDate: "24/05/2024 04:12 م",
      type: "إجمالي",
      periodText: "آخر 7 أيام",
      username: "أحمد محمد",
      tabId: "taxes" as const,
    },
    {
      id: 12,
      name: "تقرير التسويات البنكية",
      englishName: "Bank Settlement Tracker",
      description: "مطابقة الفروقات في حسابات البنوك مع كشف البنك الفعلي.",
      creationDate: "23/05/2024 01:20 م",
      type: "تفصيلي",
      periodText: "أمس",
      username: "أحمد محمد",
      tabId: "bank_reconciliation" as const,
    },
  ];

  // Search and Filtering Logic
  const filteredReports = useMemo(() => {
    return initialReportsList.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.englishName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchPeriod =
        period === "all" ||
        (period === "today" && item.periodText === "اليوم") ||
        (period === "yesterday" && item.periodText === "أمس") ||
        (period === "week" && item.periodText === "آخر 7 أيام") ||
        (period === "month" && item.periodText === "هذا الشهر") ||
        (period === "custom" && item.periodText === "مخصص");

      return matchSearch && matchPeriod;
    });
  }, [searchQuery, period]);

  // Pagination Helper
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * recordsPerPage;
    return filteredReports.slice(startIndex, startIndex + recordsPerPage);
  }, [filteredReports, currentPage, recordsPerPage]);

  const totalPages = Math.ceil(filteredReports.length / recordsPerPage) || 1;

  // Handle Export Click
  const handleExport = (
    type: "pdf" | "excel" | "word" | "print",
    reportName?: string,
  ) => {
    const name = reportName ? `"${reportName}"` : "التقارير المحددة";
    let message = "";

    if (type === "pdf")
      message = `جاري توليد ملف PDF لـ ${name} وتجهيزه للتحميل...`;
    else if (type === "excel")
      message = `جاري تصدير بيانات ${name} بصيغة Excel (xlsx)...`;
    else if (type === "word")
      message = `جاري حزم تقرير ${name} على ملف Word ترفيقي...`;
    else if (type === "print")
      message = `جاري تجميع التنسيقات وإرسال طلب الطباعة لطابعة النظام لـ ${name}...`;

    triggerToast(message, "info");

    // Mimic real async generation with success callback
    setTimeout(() => {
      triggerToast(`تم تصدير وتنزيل ${name} بنجاح!`, "success");
    }, 1800);
  };

  const [activeActionMenuId, setActiveActionMenuId] = useState<number | null>(
    null,
  );

  return (
    <div className="space-y-6 pb-24 text-right">
      {/* Toast Notification Container */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "50%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-700 max-w-md text-sm"
          >
            {toastMessage.type === "success" && (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            )}
            {toastMessage.type === "info" && (
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            )}
            <span className="font-bold">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title Header Section */}
      <div className="bg-white border select-none border-slate-200/95 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-slate-400 text-xs font-bold">
              التقارير / التقارير المحاسبية
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 justify-end">
            <span>التقارير المحاسبية والقوائم المالية</span>
            <span className="text-xs font-bold bg-amber-550/15 text-amber-800 px-3 py-1 rounded-full border border-amber-200/50">
              قسم المحاسب القانوني
            </span>
          </h1>
          <p className="text-slate-500 text-xs">
            عرض وتصدير ومطابقة حسابات المنشأة والضرائب والأرباح.
          </p>
        </div>

        <div>
          <button
            onClick={() =>
              triggerToast(
                "جاري فتح نموذج بناء وإنشاء تقرير محاسبي مخصص جديد...",
                "info",
              )
            }
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-850 px-5 py-2.5 rounded-2xl font-extrabold text-sm transition-all shadow-sm hover:shadow-md cursor-pointer border border-slate-800"
          >
            <Plus className="w-4 h-4" />
            <span>تقرير جديد لعام 2026</span>
          </button>
        </div>
      </div>

      {/* REALTIME ACTION BAR AND FILTER CRITERIAS (as in screenshot) */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-4">
        {/* Filter Input Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* SEARCH FIELD */}
          <div className="md:col-span-4 relative group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-amber-600 transition-colors w-4 h-4" />
            <input
              type="text"
              placeholder="بحث في التقارير..."
              value={searchQuery ?? ""}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-4 pr-10 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-550 transition-all text-right font-medium"
            />
          </div>

          {/* COST CENTERS SELECT */}
          <div className="md:col-span-2 relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Briefcase className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedCostCenter ?? ""}
              onChange={(e) => setSelectedCostCenter(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-550/20 focus:border-amber-550 transition-all text-right font-medium appearance-none cursor-pointer"
            >
              <option value="all">جميع مراكز التكلفة</option>
              <option value="main">المركز الرئيسي</option>
              <option value="delivery">خدمات التوصيل</option>
              <option value="marketing">التسويق والدعاية</option>
              <option value="riyadh-kitchen">مطبخ الرياض</option>
            </select>
          </div>

          {/* BRANCH SELECT */}
          <div className="md:col-span-2 relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Building className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedBranch ?? ""}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-550/20 focus:border-amber-550 transition-all text-right font-medium appearance-none cursor-pointer"
            >
              <option value="all">كل الفروع</option>
              <option value="riyadh">فرع الرياض</option>
              <option value="jeddah">فرع جدة</option>
              <option value="damam">فرع الدمام</option>
              <option value="mecca">فرع مكة</option>
            </select>
          </div>

          {/* DATE SELECTOR (calendar) */}
          <div className="md:col-span-2 relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Calendar className="w-3.5 h-3.5" />
            </div>
            <input
              type="date"
              value={selectedDate ?? ""}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                triggerToast(`تم تحديد التاريخ: ${e.target.value}`, "success");
              }}
              className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-550/20 focus:border-amber-550 transition-all text-right font-mono font-bold cursor-pointer"
            />
          </div>

          {/* PERIOD FILTER */}
          <div className="md:col-span-2 relative">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <select
              value={period ?? ""}
              onChange={(e) => {
                setPeriod(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-3 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-550/20 focus:border-amber-550 transition-all text-right font-medium appearance-none cursor-pointer"
            >
              <option value="all">جميع الفترات</option>
              <option value="today">اليوم</option>
              <option value="yesterday">أمس</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">هذا الشهر</option>
              <option value="custom">مخصص</option>
            </select>
          </div>
        </div>

        {/* Applied Filters Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-2">
            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold">
              تصفية حية: {filteredReports.length} تقارير منتقاة
            </span>
            {searchQuery && (
              <span className="bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded-md">
                كلمة البحث: {searchQuery}
              </span>
            )}
          </div>
          <div>
            <span>
              تاريخ تدقيق موازين المراجعة الأخير:{" "}
              <strong className="text-slate-800 font-bold font-mono">
                22/06/2026
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* FIVE INTERACTIVE TOP REPORT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {reportCards.map((card) => (
          <motion.div
            key={card.id}
            whileHover={{ y: -2, scale: 1.01 }}
            className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-mini flex flex-col justify-between text-right group relative overflow-hidden"
          >
            {/* Top Row with icon and english subtitle */}
            <div className="flex items-start justify-between">
              <div
                className={`p-1.5 rounded-lg ${card.bgColor} shadow-inner transition-colors shrink-0`}
              >
                <card.icon className="w-4 h-4" />
              </div>
              <span className="text-[9px] text-slate-300 font-mono tracking-widest uppercase">
                {card.color}
              </span>
            </div>

            {/* Middle Section Body */}
            <div className="mt-2.5 space-y-1 flex-1">
              <h3 className="font-extrabold text-slate-850 text-xs group-hover:text-slate-900 transition-colors">
                {card.title}
              </h3>
              <p className="text-[9px] text-slate-400 font-semibold font-mono leading-none">
                {card.englishTitle}
              </p>
              <p className="text-[10px] text-slate-500 mt-1 leading-normal">
                {card.description}
              </p>
            </div>

            {/* Action Trigger Button */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => onNavigate(card.tabId)}
                className="text-[9px] font-black text-rose-600 hover:text-rose-700 transition-colors"
              >
                تحديث واستدعاء البيانات
              </button>

              <button
                onClick={() => onNavigate(card.tabId)}
                className="inline-flex items-center gap-1 bg-slate-100 hover:bg-amber-600 hover:text-white px-2.5 py-1 rounded-lg text-slate-600 transition-all font-extrabold text-[10px]"
              >
                <span>عرض التقرير</span>
                <ChevronLeft className="w-2.5 h-2.5" />
              </button>
            </div>

            {/* Background design glow */}
            <div className="absolute -bottom-10 -left-10 w-20 h-20 bg-slate-50 rounded-full mix-blend-multiply opacity-20 group-hover:scale-125 transition-transform duration-300" />
          </motion.div>
        ))}
      </div>

      {/* THE ACCOUNTING REPORTS LIST TABLE CONTAINER */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Table Title Bar */}
        <div className="px-6 py-4 border-b border-slate-150 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
              تكامل آمن للقيود والقرارات
            </span>
            <h2 className="text-sm font-black text-slate-800">
              قائمة التقارير المحاسبية المعتمدة
            </h2>
          </div>

          <div className="text-xs text-slate-650 flex items-center gap-2 font-medium">
            <span>
              ترتيب حسب: <strong>التاريخ الأحدث</strong>
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
            <span>
              الحالة:{" "}
              <strong className="text-emerald-600">
                متطابقة ومرحلة بالكامل
              </strong>
            </span>
          </div>
        </div>

        {/* Table Body wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-max">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 text-xs font-bold leading-normal">
                <th className="py-4 px-6">اسم التقرير</th>
                <th className="py-4 px-6">الوصف</th>
                <th className="py-4 px-6 text-center">تاريخ الإنشاء</th>
                <th className="py-4 px-6 text-center">نوع التقرير</th>
                <th className="py-4 px-6 text-center">الفترة</th>
                <th className="py-4 px-6 text-center">المستخدم</th>
                <th className="py-4 px-6 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-650 font-medium">
              <AnimatePresence>
                {paginatedReports.length > 0 ? (
                  paginatedReports.map((report) => (
                    <motion.tr
                      key={report.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      whileHover={{ backgroundColor: "#f8fafc" }}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      {/* Name with navigation and english version */}
                      <td className="py-4 px-6">
                        <div
                          className="font-extrabold text-slate-900 hover:text-amber-600 transition-colors cursor-pointer"
                          onClick={() => onNavigate(report.tabId)}
                        >
                          {report.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {report.englishName}
                        </div>
                      </td>

                      {/* Description word wrapper */}
                      <td className="py-4 px-6 max-w-xs truncate text-[11px] text-slate-500">
                        {report.description}
                      </td>

                      {/* Creation Date */}
                      <td className="py-4 px-6 text-center font-mono text-slate-500">
                        {report.creationDate}
                      </td>

                      {/* Type Badge */}
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            report.type === "تفصيلي"
                              ? "bg-purple-100 text-purple-850"
                              : "bg-emerald-100 text-emerald-850"
                          }`}
                        >
                          {report.type}
                        </span>
                      </td>

                      {/* Period Badge */}
                      <td className="py-4 px-6 text-center text-slate-500">
                        {report.periodText}
                      </td>

                      {/* UserName creator */}
                      <td className="py-4 px-6 text-center font-bold text-slate-800">
                        {report.username}
                      </td>

                      {/* Control Actions */}
                      <td className="py-4 px-6 text-center relative">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print Shortcut */}
                          <button
                            onClick={() => handleExport("print", report.name)}
                            title="طباعة التقرير الفورية"
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {/* Excels Shortcut */}
                          <button
                            onClick={() => handleExport("excel", report.name)}
                            title="حفظ بيانات Excel"
                            className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>

                          {/* PDF Document Shortcut */}
                          <button
                            onClick={() => handleExport("pdf", report.name)}
                            title="تصدير كملف PDF"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>

                          {/* Divider line */}
                          <span className="w-px h-3 bg-slate-200 mx-1" />

                          {/* Advanced Popover Menu Button */}
                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveActionMenuId(
                                  activeActionMenuId === report.id
                                    ? null
                                    : report.id,
                                )
                              }
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-all"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeActionMenuId === report.id && (
                              <>
                                <div
                                  className="fixed inset-0 z-10"
                                  onClick={() => setActiveActionMenuId(null)}
                                />
                                <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 w-40 z-20 text-right text-xs">
                                  <button
                                    onClick={() => {
                                      onNavigate(report.tabId);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-slate-700 font-bold transition-all flex items-center justify-between text-right"
                                  >
                                    <span>عرض التعديلات</span>
                                    <ChevronLeft className="w-3 h-3 text-slate-400" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleExport("word", report.name);
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-slate-700 font-bold transition-all text-right"
                                  >
                                    تصدير كـ Word
                                  </button>
                                  <button
                                    onClick={() => {
                                      triggerToast(
                                        `تمت مطابقة قيد ${report.name} مع الحساب المقابل ونظام الإغلاق المالي.`,
                                        "success",
                                      );
                                      setActiveActionMenuId(null);
                                    }}
                                    className="w-full px-4 py-2 hover:bg-slate-50 text-emerald-600 font-bold transition-all text-right border-t border-slate-100"
                                  >
                                    مصادقة تطابق القيد
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-12 text-center text-slate-400 italic font-bold"
                    >
                      لا توجد تقارير مطابقة لمعايير البحث والتصفية المحددة.
                    </td>
                  </tr>
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Bar matching the Arabic footer of screenshot */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
          {/* Page records size config */}
          <div className="flex items-center gap-2 order-2 sm:order-1">
            <span>الصفوف لكل صفحة:</span>
            <select
              value={recordsPerPage ?? ""}
              onChange={(e) => {
                setRecordsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-250 py-1 px-1.5 rounded-lg text-slate-800 font-bold font-mono focus:ring-1 focus:ring-amber-500/30 text-center"
            >
              {[5, 10, 15, 20, 25].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <span className="mr-3">
              عرض <strong>{(currentPage - 1) * recordsPerPage + 1}</strong> إلى{" "}
              <strong>
                {Math.min(currentPage * recordsPerPage, filteredReports.length)}
              </strong>{" "}
              من أصل{" "}
              <strong className="font-mono text-slate-800">
                {filteredReports.length}
              </strong>{" "}
              سجلات متاحة
            </span>
          </div>

          {/* Actual page numbers navigator */}
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg bg-white border border-slate-205 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-extrabold flex items-center justify-center border transition-all ${
                  currentPage === p
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg bg-white border border-slate-205 text-slate-500 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* EXPORT OPTIONS CONSOLIDATION TOOLBAR (As in screenshot bottom footer) */}
      <div className="bg-slate-100 border border-slate-200 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Call to print or export entire general accounting statements */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-550/10 text-amber-650 flex items-center justify-center font-bold">
            <Info className="w-5 h-5 animate-pulse" />
          </div>
          <div className="text-right">
            <h4 className="font-black text-slate-850 text-sm">
              تنزيل وتصدير مجمّع لكشوف الحسابات
            </h4>
            <p className="text-[10px] text-slate-500">
              حزم وتصدير ملفات الشهور والأرباع بصيغ معتمدة دولياً ومحمية
              بالتشفير.
            </p>
          </div>
        </div>

        {/* Four primary actions: PDF, Excel, Word, Print */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 w-full md:w-auto">
          <span className="text-xs text-slate-500 font-extrabold ml-1.5">
            تصدير التقرير:
          </span>

          {/* Print entire page */}
          <button
            onClick={() => handleExport("print")}
            className="flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>طباعة</span>
          </button>

          {/* Word entire page */}
          <button
            onClick={() => handleExport("word")}
            className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>تحميل Word</span>
          </button>

          {/* Excel entire page */}
          <button
            onClick={() => handleExport("excel")}
            className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تحميل Excel</span>
          </button>

          {/* PDF entire page */}
          <button
            onClick={() => handleExport("pdf")}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>تحميل PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
};
