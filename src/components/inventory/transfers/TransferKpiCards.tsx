import React from "react";
import { 
  ArrowLeftRight, 
  Clock, 
  CheckCircle2, 
  Truck, 
  PackageCheck, 
  AlertCircle, 
  XCircle,
  TrendingUp,
  Boxes
} from "lucide-react";
import { TransferStats } from "./TransferTypes";

interface TransferKpiCardsProps {
  stats: TransferStats;
  activeTab: string;
  onTabSelect: (tab: string) => void;
}

export const TransferKpiCards: React.FC<TransferKpiCardsProps> = ({
  stats,
  activeTab,
  onTabSelect,
}) => {
  const cards = [
    {
      id: "all",
      title: "إجمالي التحويلات",
      count: stats.total || 0,
      icon: ArrowLeftRight,
      color: "blue",
      bgGradient: "from-blue-500/10 to-indigo-500/5",
      borderActive: "border-blue-500 ring-2 ring-blue-500/20",
      textColor: "text-blue-600 dark:text-blue-400",
      badge: "الكل",
    },
    {
      id: "pending",
      title: "قيد الاعتماد والمراجعة",
      count: stats.pending_count || 0,
      icon: Clock,
      color: "amber",
      bgGradient: "from-amber-500/10 to-orange-500/5",
      borderActive: "border-amber-500 ring-2 ring-amber-500/20",
      textColor: "text-amber-600 dark:text-amber-400",
      badge: "مسودة / طلب",
    },
    {
      id: "processing",
      title: "معتمد وقيد التجهيز",
      count: stats.approved_count || 0,
      icon: Boxes,
      color: "indigo",
      bgGradient: "from-indigo-500/10 to-violet-500/5",
      borderActive: "border-indigo-500 ring-2 ring-indigo-500/20",
      textColor: "text-indigo-600 dark:text-indigo-400",
      badge: "جاهز للصرف",
    },
    {
      id: "in_transit",
      title: "بضائع قيد النقل",
      count: stats.in_transit_count || 0,
      icon: Truck,
      color: "purple",
      bgGradient: "from-purple-500/10 to-pink-500/5",
      borderActive: "border-purple-500 ring-2 ring-purple-500/20",
      textColor: "text-purple-600 dark:text-purple-400",
      badge: "في الطريق",
    },
    {
      id: "receiving",
      title: "قيد الاستلام والفحص",
      count: stats.receiving_count || 0,
      icon: PackageCheck,
      color: "teal",
      bgGradient: "from-teal-500/10 to-cyan-500/5",
      borderActive: "border-teal-500 ring-2 ring-teal-500/20",
      textColor: "text-teal-600 dark:text-teal-400",
      badge: "QC & إيداع",
    },
    {
      id: "completed",
      title: "مكتمل ومودع بالمخزن",
      count: stats.completed_count || 0,
      icon: CheckCircle2,
      color: "emerald",
      bgGradient: "from-emerald-500/10 to-green-500/5",
      borderActive: "border-emerald-500 ring-2 ring-emerald-500/20",
      textColor: "text-emerald-600 dark:text-emerald-400",
      badge: "منفذ بالكامل",
    },
    {
      id: "cancelled",
      title: "ملغي / مرفوض",
      count: stats.cancelled_count || 0,
      icon: XCircle,
      color: "rose",
      bgGradient: "from-rose-500/10 to-red-500/5",
      borderActive: "border-rose-500 ring-2 ring-rose-500/20",
      textColor: "text-rose-600 dark:text-rose-400",
      badge: "معكوس",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6" id="transfer-kpi-cards-grid">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeTab === card.id;

        return (
          <button
            key={card.id}
            id={`kpi-card-${card.id}`}
            onClick={() => onTabSelect(card.id)}
            className={`flex flex-col text-right p-3.5 rounded-2xl border transition-all duration-200 bg-card hover:shadow-md cursor-pointer relative overflow-hidden ${
              isActive
                ? `${card.borderActive} bg-gradient-to-br ${card.bgGradient} shadow-sm`
                : "border-border/80 hover:border-border"
            }`}
          >
            <div className="flex items-center justify-between w-full mb-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground tracking-tight">
                {card.badge}
              </span>
              <div className={`p-1.5 rounded-xl bg-background/90 border border-border/40 shadow-2xs ${card.textColor}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <span className="text-[11px] text-muted-foreground font-semibold truncate mb-1" title={card.title}>
              {card.title}
            </span>

            <div className="flex items-baseline justify-between mt-auto pt-1">
              <span className={`text-lg font-black tracking-tight font-mono ${card.textColor}`}>
                {card.count.toLocaleString("ar-EG")}
              </span>
              {card.count > 0 && card.id === "in_transit" && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
