import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Factory,
  ArrowRight,
  Package,
  Layers,
  Cpu,
  ClipboardList,
  ShieldCheck,
  Activity,
  Calendar,
  Zap,
  Wrench,
  DollarSign,
  FileText,
} from "lucide-react";
import { Branch } from "../types";

import { ProductionDashboard } from "./production/ProductionDashboard";
import { ProductsManagement } from "./production/ProductsManagement";
import { BOMManagement } from "./production/BOMManagement";
import { WorkCentersManagement } from "./production/WorkCentersManagement";
import { ProductionOrdersManagement } from "./production/ProductionOrdersManagement";
import { QualityControlManagement } from "./production/QualityControlManagement";
import { ProductionPlanningMRP } from "./production/ProductionPlanningMRP";
import { ShopFloorControl } from "./production/ShopFloorControl";
import { MaintenanceManagement } from "./production/MaintenanceManagement";
import { CostManagement } from "./production/CostManagement";
import { ProductionReports } from "./production/ProductionReports";

interface ProductionProps {
  selectedBranch: Branch | null;
  onBack: () => void;
  initialTab?: string;
}

type TabType =
  | "dashboard"
  | "products"
  | "bom"
  | "ecn"
  | "work_centers"
  | "planning"
  | "orders"
  | "shop_floor"
  | "quality"
  | "maintenance"
  | "costing"
  | "reports";

export function Production({
  selectedBranch,
  onBack,
  initialTab,
}: ProductionProps) {
  // Mapping from constant subItem id to Production TabType
  const getTabFromSubView = (subView?: string): TabType => {
    if (!subView) return "dashboard";
    if (
      subView.startsWith("report_") ||
      subView.endsWith("_report") ||
      subView.includes("report") ||
      subView === "production_report" ||
      subView === "products_report" ||
      subView === "orders_report" ||
      subView === "quality_report" ||
      subView === "transferred_report"
    ) {
      return "reports";
    }
    switch (subView) {
      case "indicators":
      case "dashboard":
        return "dashboard";
      case "products":
        return "products";
      case "bom":
        return "bom";
      case "ecn":
        return "ecn";
      case "work_centers":
        return "work_centers";
      case "mrp":
        return "planning";
      case "production_orders":
        return "orders";
      case "shop_floor":
        return "shop_floor";
      case "quality":
        return "quality";
      case "maintenance":
        return "maintenance";
      case "costs":
        return "costing";
      default:
        return "dashboard";
    }
  };

  const [activeTab, setActiveTab] = useState<TabType>(() =>
    getTabFromSubView(initialTab),
  );

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(getTabFromSubView(initialTab));
    }
  }, [initialTab]);

  const tabs = [
    {
      id: "dashboard",
      label: "لوحة المؤشرات",
      icon: Activity,
      desc: "لوحة مؤشرات الأداء الرقمية والإحصائيات الخاصة بالمصنع والإنتاج",
    },
    {
      id: "products",
      label: "إدارة المنتجات",
      icon: Package,
      desc: "إدارة كاملة لبيانات المنتجات والمواصفات الفنية وبطاقات قياس الجودة",
    },
    {
      id: "bom",
      label: "وصفات التصنيع (BOM)",
      icon: Layers,
      desc: "إدارة وتحديد قوائم المواد الخام والمكونات المستخدمة ونسب الهدر لكل منتج",
    },
    {
      id: "ecn",
      label: "أوامر التغيير الهندسي (ECN)",
      icon: FileText,
      desc: "إدارة طلبات التغيير في مواصفات المنتج والوصفات الصناعية وتتبع سجل التعديلات",
    },
    {
      id: "work_centers",
      label: "مراكز العمل والتوجيه",
      icon: Cpu,
      desc: "إدارة الماكينات ومراكز التشغيل والتوجيه لخطوط الإنتاج المختلفة",
    },
    {
      id: "planning",
      label: "تخطيط الاحتياجات (MRP)",
      icon: Calendar,
      desc: "تخطيط متمتطلبات المواد والإنتاج لضمان توفر الخامات وسير العمل",
    },
    {
      id: "orders",
      label: "أوامر الإنتاج",
      icon: ClipboardList,
      desc: "إصدار وتتبع ومراقبة أوامر التشغيل والإنتاج الفعلي بالمصنع",
    },
    {
      id: "shop_floor",
      label: "التحكم أرض المصنع",
      icon: Zap,
      desc: "مراقبة صالة الإنتاج والتحكم بالورديات والماكينات بشكل مباشر",
    },
    {
      id: "quality",
      label: "مراقبة الجودة",
      icon: ShieldCheck,
      desc: "إدارة فحوصات الجودة العينية والفنية للمعايير والصفات المظهرية للأواني والأغطية",
    },
    {
      id: "maintenance",
      label: "إدارة الصيانة",
      icon: Wrench,
      desc: "جدولة ومتابعة صيانة الآلات والمعدات بشكل دوري وقائي أو طارئ",
    },
    {
      id: "costing",
      label: "حساب التكاليف",
      icon: DollarSign,
      desc: "احتساب تكاليف الإنتاج الإجمالية والمواد الخام الفعالة والاستهلاك والتشغيل",
    },
    {
      id: "reports",
      label: "تقارير الإنتاج والصناعة",
      icon: FileText,
      desc: "توليد وسحب ملفات وورد وإكسيل لإنتاج التقارير المدققة وإثبات الجودة والأصناف",
    },
  ] as const;

  const activeTabInfo = tabs.find((t) => t.id === activeTab) || tabs[0];
  const ActiveIcon = activeTabInfo.icon;

  const renderActiveTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <ProductionDashboard />;
      case "products":
        return (
          <ProductsManagement onTabChange={(tab: any) => setActiveTab(tab)} />
        );
      case "bom":
        return <BOMManagement initialInnerTab="boms" />;
      case "ecn":
        return <BOMManagement initialInnerTab="ecns" />;
      case "work_centers":
        return <WorkCentersManagement />;
      case "planning":
        return <ProductionPlanningMRP />;
      case "orders":
        return <ProductionOrdersManagement />;
      case "shop_floor":
        return <ShopFloorControl />;
      case "quality":
        return <QualityControlManagement />;
      case "maintenance":
        return <MaintenanceManagement />;
      case "costing":
        return <CostManagement />;
      case "reports": {
        return <ProductionReports initialTab={initialTab} />;
      }
      default:
        return <ProductionDashboard onNavigate={(tab) => setActiveTab(tab as any)} />;
    }
  };

  return (
    <div
      className="min-h-[85vh] bg-transparent p-6 flex flex-col font-cairo"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 text-slate-600 transition-colors"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
              <ActiveIcon className="w-6 h-6" />
            </div>
            {activeTabInfo.label}
          </h1>
          <p className="text-slate-500 mt-1 font-medium text-sm">
            {activeTabInfo.desc}
          </p>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-8 flex-1">
        {/* Sidebar Navigation - hidden when we jump directly from dashboard subitem for clean targeted look */}
        {!initialTab && (
          <div className="w-full lg:w-64 shrink-0">
            <div className="bg-white border flex flex-row lg:flex-col border-slate-200 rounded-2xl p-3 shadow-sm w-full overflow-x-auto lg:overflow-visible gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all whitespace-nowrap lg:whitespace-normal ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-md"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content Engine */}
        <div className="flex-1 w-full bg-transparent overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {renderActiveTab()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
