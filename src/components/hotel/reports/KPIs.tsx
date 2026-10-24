import React from "react";
import { 
  Building2, Users, DollarSign, BedDouble, AlertTriangle, 
  TrendingUp, ShieldAlert, PackageX, FileClock, Sparkles
} from "lucide-react";
import { DashboardMetrics, InventorySupplyItem } from "../types";

interface KPIsReportProps {
  metrics: DashboardMetrics | null;
  dirtyRoomsCount?: number;
  overdueInvoicesCount?: number;
  inventoryItems?: InventorySupplyItem[];
}

// تمت الاضافة: تقرير مؤشرات الأداء KPIs مع كارت تحذيرات ذكي خامس
export const KPIsReport: React.FC<KPIsReportProps> = ({
  metrics,
  dirtyRoomsCount = 0,
  overdueInvoicesCount = 0,
  inventoryItems = []
}) => {
  // حساب عدد أصناف المخزون الناقصة
  const criticalSuppliesCount = inventoryItems.filter(
    (i) => Number(i.total_stock || 0) <= Number(i.min_stock || 0)
  ).length;

  const totalRooms = metrics?.totalRooms || 0;
  const occupiedRooms = metrics?.occupiedRooms || 0;
  const availableRooms = metrics?.availableRooms || 0;
  const occupancyRate = metrics?.occupancyRate || (totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0);
  const dailyRevenue = metrics?.dailyRevenue || 0;
  const adr = metrics?.adr || 0;
  const revpar = metrics?.revpar || 0;

  return (
    <div className="space-y-6">
      {/* 5 KPI Metric Cards - including the 5th Warnings Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 1. Occupancy Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-500">نسبة الإشغال الحالية</span>
            <div className="p-2.5 bg-teal-50 text-teal-600 rounded-xl">
              <BedDouble className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mb-1">{occupancyRate}%</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="font-bold text-teal-600">{occupiedRooms}</span> مشغولة من أصل {totalRooms} غرفة
          </div>
        </div>

        {/* 2. Daily Revenue */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-500">إيراد اليوم التقديري</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700 mb-1">
            {Number(dailyRevenue || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
            <TrendingUp className="w-3.5 h-3.5" /> شامل الإقامة والخدمات
          </div>
        </div>

        {/* 3. ADR (Average Daily Rate) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-500">متوسط سعر الغرفة (ADR)</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-700 mb-1">
            {Number(adr || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="text-xs text-slate-500">متوسط السعر المحقق للغرفة المباعة</div>
        </div>

        {/* 4. RevPAR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold text-slate-500">العائد لكل غرفة (RevPAR)</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 mb-1">
            {Number(revpar || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="text-xs text-slate-500">الإيراد مقسوماً على إجمالي غرف الفندق</div>
        </div>

        {/* 5. كارت التحذيرات (Warnings Card) - تمت الاضافة */}
        <div className="bg-gradient-to-br from-amber-500/10 via-rose-500/10 to-amber-500/5 p-5 rounded-2xl border border-amber-300 shadow-sm hover:shadow-md transition relative overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 animate-pulse" />
              تنبيهات وتحذيرات تشغيلية
            </span>
          </div>
          <div className="space-y-1.5 text-xs text-slate-700">
            <div className="flex justify-between items-center bg-white/80 px-2.5 py-1 rounded-lg border border-amber-200">
              <span className="flex items-center gap-1 text-slate-600">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" /> غرف غير نظيفة (Dirty):
              </span>
              <span className="font-black text-amber-700">{dirtyRoomsCount}</span>
            </div>
            <div className="flex justify-between items-center bg-white/80 px-2.5 py-1 rounded-lg border border-rose-200">
              <span className="flex items-center gap-1 text-slate-600">
                <FileClock className="w-3.5 h-3.5 text-rose-600" /> فواتير متأخرة {">"} 7 أيام:
              </span>
              <span className="font-black text-rose-700">{overdueInvoicesCount}</span>
            </div>
            <div className="flex justify-between items-center bg-white/80 px-2.5 py-1 rounded-lg border border-red-200">
              <span className="flex items-center gap-1 text-slate-600">
                <PackageX className="w-3.5 h-3.5 text-red-600" /> أصناف ناقصة حرجة:
              </span>
              <span className="font-black text-red-700">{criticalSuppliesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Highlights Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-teal-600" />
          ملخص حركة التشغيل اليومية
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 font-bold mb-1">الغرف المتاحة للبيع</div>
            <div className="text-xl font-extrabold text-teal-700">{availableRooms}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 font-bold mb-1">الوصول المتوقع اليوم</div>
            <div className="text-xl font-extrabold text-blue-700">{metrics?.todayArrivals || 0}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 font-bold mb-1">المغادرة المتوقعة اليوم</div>
            <div className="text-xl font-extrabold text-amber-700">{metrics?.todayDepartures || 0}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-xs text-slate-500 font-bold mb-1">إجمالي النزلاء المقيمين</div>
            <div className="text-xl font-extrabold text-indigo-700">{metrics?.totalGuests || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
