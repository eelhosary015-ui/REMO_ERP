import React, { useState } from "react";
import { 
  Users, 
  Calculator, 
  Clock, 
  ChevronRight, 
  ShieldCheck, 
  BarChart3, 
  Fingerprint, 
  Briefcase, 
  CreditCard,
  Building2,
  CalendarDays,
  Activity,
  Zap
} from "lucide-react";
import { motion } from "framer-motion";

export const HRSuitePresentation: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<"hr" | "payroll" | "attendance">("hr");

  const modules = {
    hr: {
      title: "إدارة الموارد البشرية (HR)",
      icon: Users,
      color: "bg-blue-600",
      lightColor: "bg-blue-50 text-blue-700 border-blue-200",
      description: "نظام متكامل لإدارة بيانات الموظفين، العقود، الهيكل التنظيمي، والتقييمات بأعلى معايير الأمان.",
      features: [
        { title: "ملفات الموظفين الشاملة", desc: "أرشفة إلكترونية كاملة للوثائق، المسوغات، والبيانات الشخصية." },
        { title: "إدارة العقود والتجديدات", desc: "تنبيهات مبكرة قبل انتهاء العقود وفترات الاختبار." },
        { title: "الهيكل التنظيمي", desc: "تقسيم الإدارات، الفروع، والمسميات الوظيفية بشكل هرمي مرن." },
        { title: "العهد والممتلكات", desc: "تتبع وتسجيل العهد المسلمة للموظفين وإخلاء الطرف." },
        { title: "تقييم الأداء (KPIs)", desc: "نماذج تقييم دورية وربطها بالمكافآت والترقيات." }
      ],
      stats: [
        { label: "كفاءة الإدارة", value: "98%" },
        { label: "توفير الوقت", value: "45%" },
        { label: "أرشفة ورقية", value: "0%" }
      ]
    },
    attendance: {
      title: "الحضور والانصراف",
      icon: Clock,
      color: "bg-emerald-600",
      lightColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      description: "ربط مباشر مع أجهزة البصمة (Biometric)، وتطبيق سياسات الحضور والغياب بمرونة فائقة.",
      features: [
        { title: "الربط مع أجهزة البصمة", desc: "تكامل سلس مع أجهزة ZKTeco وغيرها لسحب البصمات تلقائياً." },
        { title: "سياسات التأخير والإضافي", desc: "احتساب تلقائي لدقائق التأخير، الانصراف المبكر، والإضافي." },
        { title: "إدارة الورديات (Shifts)", desc: "جداول عمل مرنة، ورديات متغيرة، ودعم الورديات الليلية." },
        { title: "الإجازات والمأموريات", desc: "دورة عمل متكاملة لطلب واعتماد الإجازات (Workflow)." },
        { title: "تطبيق الموظف (Self-Service)", desc: "إمكانية تسجيل الحضور عبر GPS من تطبيق الهاتف المحمول." }
      ],
      stats: [
        { label: "دقة الاحتساب", value: "100%" },
        { label: "أجهزة مدعومة", value: "ZKTeco+" },
        { label: "تتبع جغرافي", value: "GPS" }
      ]
    },
    payroll: {
      title: "إدارة المرتبات والأجور",
      icon: Calculator,
      color: "bg-indigo-600",
      lightColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
      description: "احتساب دقيق وتلقائي للرواتب، الضرائب، التأمينات، والمستحقات بنقرة واحدة.",
      features: [
        { title: "التوليد التلقائي للرواتب", desc: "احتساب الرواتب بناءً على بيانات الحضور والغياب بشكل آلي." },
        { title: "الاستقطاعات والتأمينات", desc: "تطبيق قوانين التأمينات الاجتماعية والضرائب (كسب العمل)." },
        { title: "السلف والقروض", desc: "جدولة وتقسيط السلف العهد وخصمها تلقائياً كل شهر." },
        { title: "البدلات والمكافآت", desc: "إضافة بدلات ثابتة أو متغيرة (سكن، انتقال، غلاء معيشة)." },
        { title: "قسيمة الراتب (Payslip)", desc: "طباعة وإرسال مفردات المرتب للموظفين عبر البريد أو التطبيق." }
      ],
      stats: [
        { label: "سرعة الاحتساب", value: "ثواني" },
        { label: "توافق ضريبي", value: "100%" },
        { label: "أخطاء يدوية", value: "0%" }
      ]
    }
  };

  const currentModule = modules[activeTab];
  const CurrentIcon = currentModule.icon;

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-8 h-8 text-indigo-600" />
                المنظومة الشاملة للموارد البشرية
              </h1>
              <p className="text-sm font-medium text-slate-500">
                (HR, Attendance & Payroll System)
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold flex items-center gap-1.5">
              <Zap className="w-4 h-4" /> جاهز للعمل
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(modules) as Array<keyof typeof modules>).map((key) => {
            const module = modules[key];
            const Icon = module.icon;
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative overflow-hidden group flex flex-col items-center justify-center p-8 rounded-3xl border-2 transition-all duration-300 ${
                  isActive 
                    ? `border-transparent ${module.color} shadow-xl shadow-${module.color.split('-')[1]}-500/30 scale-105 z-10` 
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`p-5 rounded-2xl mb-4 transition-colors ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500 group-hover:text-slate-700'
                }`}>
                  <Icon className="w-10 h-10" />
                </div>
                <h3 className={`text-xl font-bold ${isActive ? 'text-white' : 'text-slate-900'}`}>
                  {module.title}
                </h3>
                
                {/* Active Indicator */}
                {isActive && (
                  <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content Section */}
        <motion.div 
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-100">
            {/* Left/Main Column */}
            <div className="lg:col-span-8 p-8 lg:p-12 space-y-10">
              <div>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-sm mb-6 ${currentModule.lightColor}`}>
                  <CurrentIcon className="w-5 h-5" />
                  {currentModule.title}
                </div>
                <h2 className="text-3xl lg:text-4xl font-black text-slate-900 leading-tight mb-4">
                  مستقبل إدارة الشركات يبدأ من هنا
                </h2>
                <p className="text-lg text-slate-600 leading-relaxed max-w-3xl font-medium">
                  {currentModule.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
                {currentModule.features.map((feature, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md ${currentModule.color}`}>
                      <span className="font-black text-lg">{idx + 1}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 mb-1.5">{feature.title}</h4>
                      <p className="text-sm text-slate-600 leading-relaxed font-medium">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right/Sidebar Column */}
            <div className="lg:col-span-4 bg-slate-50 p-8 lg:p-12 flex flex-col justify-center space-y-10">
              <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 border-b border-slate-200 pb-4">
                  مؤشرات الأداء (KPIs)
                </h3>
                <div className="space-y-4">
                  {currentModule.stats.map((stat, idx) => (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <span className="text-slate-600 font-bold">{stat.label}</span>
                      <span className={`text-2xl font-black ${currentModule.color.replace('bg-', 'text-')}`}>
                        {stat.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`p-8 rounded-3xl ${currentModule.lightColor} border space-y-4`}>
                <h4 className="font-bold text-lg">جاهز للبدء؟</h4>
                <p className="text-sm leading-relaxed opacity-90 font-medium">
                  قم بتجربة النظام الآن واكتشف كيف يمكنه تحويل إدارة مواردك البشرية إلى تجربة سلسة وآلية بالكامل.
                </p>
                <button 
                  onClick={onBack}
                  className={`w-full py-3.5 rounded-xl text-white font-bold shadow-md transition hover:-translate-y-0.5 ${currentModule.color}`}
                >
                  الدخول للنظام
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
};
