import React from "react";
import {
  Wallet,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  Layers,
  ArrowUpRight,
  UserCheck,
  Building2,
  Calendar
} from "lucide-react";
import { TreasuryCustody } from "../../../types";

interface DashboardProps {
  summary: {
    total_custodies: number;
    active_custodies: number;
    total_active_amount: number;
    total_spent_amount: number;
    total_remaining_amount: number;
    pending_approval_count: number;
    overdue_count: number;
    closed_this_month_count: number;
    closed_this_month_amount: number;
  } | null;
  byCategory: any[];
  overdueList: any[];
  pendingList: any[];
  onViewCustody: (custody: TreasuryCustody) => void;
  onNewCustody: () => void;
  onFilterOverdue: () => void;
  onFilterPending: () => void;
}

export const CustodyDashboardView: React.FC<DashboardProps> = ({
  summary,
  byCategory,
  overdueList,
  pendingList,
  onViewCustody,
  onNewCustody,
  onFilterOverdue,
  onFilterPending
}) => {
  const sum = summary || {
    total_custodies: 0,
    active_custodies: 0,
    total_active_amount: 0,
    total_spent_amount: 0,
    total_remaining_amount: 0,
    pending_approval_count: 0,
    overdue_count: 0,
    closed_this_month_count: 0,
    closed_this_month_amount: 0
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'cash': return 'عهدة نقدية / مشتريات';
      case 'asset': return 'أصول ومعدات ثابتة';
      case 'equipment': return 'أدوات ومعدات تشغيل';
      case 'inventory': return 'بضاعة وأمانات مخزنية';
      case 'vehicle': return 'سيارات ومركبات';
      case 'temporary': return 'عهدة مؤقتة (مشروع)';
      case 'permanent': return 'عهدة مستديمة (فرع)';
      default: return cat || 'أخرى';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Overdue Alert Banner if any */}
      {sum.overdue_count > 0 && (
        <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/10 border border-rose-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-rose-900">
                يوجد {sum.overdue_count} عهدة متأخرة عن موعد التصفية والاستحقاق!
              </h4>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                يرجى مراجعة الموظفين المسندة إليهم العهد لتسريع تقديم فواتير المصروفات أو إرجاع المبالغ والأصول.
              </p>
            </div>
          </div>
          <button
            onClick={onFilterOverdue}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all shadow-sm shrink-0"
          >
            عرض العهد المتأخرة فوراً
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Cash In Custody */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">إجمالي النقدية بالعهد النشطة</span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-900">
              {Number(sum.total_active_amount || 0).toLocaleString()} <span className="text-xs text-slate-500 font-bold">ج.م</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{sum.active_custodies} عهدة نشطة قيد التداول</span>
            </div>
          </div>
        </div>

        {/* Total Spent vs Remaining */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">المصروفات المثبتة بالفواتير</span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600">
              {Number(sum.total_spent_amount || 0).toLocaleString()} <span className="text-xs text-slate-500 font-bold">ج.م</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1">
              <span>المتبقي للرد:</span>
              <strong className="text-slate-800 font-black">{Number(sum.total_remaining_amount || 0).toLocaleString()} ج.م</strong>
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div 
          onClick={onFilterPending}
          className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-amber-300 transition-all cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">طلبات عهد بانتظار الاعتماد</span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">
              {sum.pending_approval_count} <span className="text-xs text-slate-500 font-bold">طلب معلق</span>
            </div>
            <div className="text-xs font-bold text-amber-700/80 mt-1 flex items-center gap-1">
              <span>انقر للمراجعة واتخاذ القرار</span>
            </div>
          </div>
        </div>

        {/* Settled this Month */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">تمت تصفيتها هذا الشهر</span>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-slate-800">
              {sum.closed_this_month_count} <span className="text-xs text-slate-500 font-bold">عهدة مصفاة</span>
            </div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              إجمالي مصفى: <strong className="text-slate-800 font-black">{Number(sum.closed_this_month_amount || 0).toLocaleString()} ج.م</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Split: Category Breakdown & Urgent Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Categories Distribution */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              توزيع العهد حسب التصنيف والنوع
            </h3>
            <span className="text-xs text-slate-400 font-bold">{byCategory.length} تصنيف</span>
          </div>

          <div className="space-y-3">
            {byCategory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">
                لا توجد عهد نشطة حالياً
              </div>
            ) : (
              byCategory.map((cat, idx) => {
                const totalActive = sum.total_active_amount || 1;
                const percentage = Math.min(100, Math.round(((parseFloat(cat.total_amount) || 0) / totalActive) * 100));
                return (
                  <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-black text-slate-800">{getCategoryLabel(cat.category)}</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {Number(cat.total_amount || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>{cat.count} عهدة</span>
                      <span>{percentage}% من الإجمالي</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Urgent Overdue List */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-rose-800 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              أعلى العهد المتأخرة عن موعدها
            </h3>
            <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full font-bold">
              {overdueList.length} متأخرة
            </span>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
            {overdueList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                <span>جميع العهد منتظمة ولا توجد عهد متأخرة</span>
              </div>
            ) : (
              overdueList.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => onViewCustody(item)}
                  className="p-3 bg-rose-50/50 hover:bg-rose-50 border border-rose-100 rounded-2xl cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                      <span>{item.employee_name}</span>
                      <span className="text-[10px] text-rose-600 bg-rose-100 px-1.5 py-0.2 rounded font-mono">
                        تأخير {item.overdue_days} يوم
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {item.custody_number || `CUS-${item.id}`} • {item.purpose || "عهدة نقدية"}
                    </div>
                  </div>
                  <div className="text-left font-mono font-black text-rose-700 text-xs">
                    {Number(item.remaining_balance || item.remaining_amount || item.amount || 0).toLocaleString()} ج.م
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Pending Approvals */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-amber-800 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              طلبات العهد بانتظار الاعتماد
            </h3>
            <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              {pendingList.length} طلب
            </span>
          </div>

          <div className="space-y-2.5 max-h-[320px] overflow-y-auto">
            {pendingList.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs font-medium">
                لا توجد طلبات معلقة بانتظار الموافقة
              </div>
            ) : (
              pendingList.map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => onViewCustody(item)}
                  className="p-3 bg-amber-50/50 hover:bg-amber-50 border border-amber-100 rounded-2xl cursor-pointer transition-all flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-black text-slate-900">{item.employee_name}</div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {item.purpose || "طلب صرف عهدة"}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="font-mono font-black text-amber-700 text-xs">
                      {Number(item.amount || 0).toLocaleString()} ج.م
                    </div>
                    <span className="text-[10px] text-amber-600 font-bold">معلق للموافقة</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
