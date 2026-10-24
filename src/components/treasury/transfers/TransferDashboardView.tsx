import React from "react";
import { 
  ArrowRightLeft, 
  Clock, 
  CheckCircle2, 
  Send, 
  Inbox, 
  RotateCcw, 
  AlertCircle, 
  Plus, 
  TrendingUp, 
  Building, 
  Landmark, 
  Wallet,
  Coins
} from "lucide-react";
import { TreasuryTransferKPI } from "../../../types";
import { formatCurrency } from "./transferUtils";

interface TransferDashboardViewProps {
  kpi: TreasuryTransferKPI | null;
  loading: boolean;
  onNewTransfer: () => void;
  onFilterStatus: (status: string) => void;
  onOpenReports: () => void;
}

export const TransferDashboardView: React.FC<TransferDashboardViewProps> = ({
  kpi,
  loading,
  onNewTransfer,
  onFilterStatus,
  onOpenReports
}) => {
  const cards = [
    {
      title: "تحويلات اليوم",
      count: kpi?.today_count ?? 0,
      amount: kpi?.today_amount ?? 0,
      statusKey: "all",
      icon: Clock,
      borderColor: "border-blue-200 dark:border-blue-800/60",
      bgGradient: "from-blue-50/80 to-indigo-50/20 dark:from-blue-950/20 dark:to-transparent",
      iconBg: "bg-blue-600 text-white",
      amountColor: "text-blue-700 dark:text-blue-400"
    },
    {
      title: "قيد الاعتماد والمراجعة",
      count: kpi?.pending_approval_count ?? 0,
      statusKey: "pending_approval",
      icon: AlertCircle,
      borderColor: "border-amber-200 dark:border-amber-800/60",
      bgGradient: "from-amber-50/80 to-yellow-50/20 dark:from-amber-950/20 dark:to-transparent",
      iconBg: "bg-amber-500 text-white",
      amountColor: "text-amber-700 dark:text-amber-400"
    },
    {
      title: "معتمد (جاهز للصرف)",
      count: kpi?.approved_count ?? 0,
      statusKey: "approved",
      icon: CheckCircle2,
      borderColor: "border-cyan-200 dark:border-cyan-800/60",
      bgGradient: "from-cyan-50/80 to-blue-50/20 dark:from-cyan-950/20 dark:to-transparent",
      iconBg: "bg-cyan-600 text-white",
      amountColor: "text-cyan-700 dark:text-cyan-400"
    },
    {
      title: "في انتظار الاستلام (نقل)",
      count: (kpi?.executed_in_transit_count ?? 0) + (kpi?.pending_receipt_count ?? 0),
      statusKey: "pending_receipt",
      icon: Inbox,
      borderColor: "border-purple-200 dark:border-purple-800/60",
      bgGradient: "from-purple-50/80 to-pink-50/20 dark:from-purple-950/20 dark:to-transparent",
      iconBg: "bg-purple-600 text-white",
      amountColor: "text-purple-700 dark:text-purple-400"
    },
    {
      title: "مكتمل ومرحل محاسبياً",
      count: kpi?.completed_posted_count ?? 0,
      statusKey: "completed",
      icon: CheckCircle2,
      borderColor: "border-emerald-200 dark:border-emerald-800/60",
      bgGradient: "from-emerald-50/80 to-teal-50/20 dark:from-emerald-950/20 dark:to-transparent",
      iconBg: "bg-emerald-600 text-white",
      amountColor: "text-emerald-700 dark:text-emerald-400"
    },
    {
      title: "معكوس / ملغي",
      count: (kpi?.reversed_count ?? 0) + (kpi?.cancelled_count ?? 0),
      statusKey: "reversed",
      icon: RotateCcw,
      borderColor: "border-rose-200 dark:border-rose-800/60",
      bgGradient: "from-rose-50/80 to-red-50/20 dark:from-rose-950/20 dark:to-transparent",
      iconBg: "bg-rose-600 text-white",
      amountColor: "text-rose-700 dark:text-rose-400"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner with Action Button */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/30 rounded-xl border border-indigo-400/20">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">نظام إدارة التحويلات المالية الذكية</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Enterprise GL
            </span>
          </div>
          <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
            إدارة دورة التحويل المالي المتكاملة بين الخزائن والحسابات البنكية والفروع مع التحقق الفوري من الرصيد والقيود المحاسبية التلقائية.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10 w-full md:w-auto">
          <button
            onClick={onOpenReports}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition font-medium text-sm"
          >
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            تقارير وتحليلات
          </button>
          <button
            onClick={onNewTransfer}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-indigo-500/25 transition active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            إنشاء تحويل مالي
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {cards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <button
              key={idx}
              onClick={() => onFilterStatus(card.statusKey)}
              className={`p-4 rounded-xl border ${card.borderColor} bg-gradient-to-b ${card.bgGradient} bg-white dark:bg-slate-900/60 shadow-sm hover:shadow-md transition text-right flex flex-col justify-between group`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {card.title}
                </span>
                <div className={`p-1.5 rounded-lg ${card.iconBg} shadow-sm group-hover:scale-110 transition-transform`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {loading ? (
                    <span className="inline-block w-8 h-6 bg-slate-200 dark:bg-slate-800 animate-pulse rounded" />
                  ) : (
                    card.count
                  )}
                </div>
                {card.amount !== undefined && (
                  <div className={`text-[11px] font-bold mt-1 ${card.amountColor}`}>
                    {loading ? "..." : formatCurrency(card.amount)}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Summary Financial Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي المبالغ المنقولة والمرحلة</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(kpi?.total_transferred_amount ?? 0)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي رسوم وعمولات التحويل</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {formatCurrency(kpi?.total_fees_amount ?? 0)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي العمليات المسجلة</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {kpi?.total_transfers_count ?? 0} عملية تحويل
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
