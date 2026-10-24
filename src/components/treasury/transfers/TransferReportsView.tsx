import React, { useState, useEffect } from "react";
import { 
  TrendingUp, 
  ArrowRightLeft, 
  Download, 
  FileSpreadsheet, 
  Printer, 
  Calendar, 
  PieChart as PieIcon, 
  BarChart3, 
  Wallet, 
  Landmark, 
  ArrowUpRight, 
  ArrowDownLeft,
  Filter,
  RotateCcw
} from "lucide-react";
import { TreasuryTransfer, TreasuryAccount, TreasuryTransferKPI } from "../../../types";
import { formatCurrency, formatDate, getTransferTypeLabel } from "./transferUtils";

interface TransferReportsViewProps {
  transfers: TreasuryTransfer[];
  accounts: TreasuryAccount[];
  kpi: TreasuryTransferKPI | null;
  onBackToTransfers: () => void;
}

export const TransferReportsView: React.FC<TransferReportsViewProps> = ({
  transfers,
  accounts,
  kpi,
  onBackToTransfers
}) => {
  const [dateRange, setDateRange] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");

  // Filter transfers based on selection
  const filteredTransfers = transfers.filter(t => {
    if (selectedAccount !== "all") {
      const accId = Number(selectedAccount);
      if (t.source_account_id !== accId && t.destination_account_id !== accId) {
        return false;
      }
    }
    return true;
  });

  // Calculate Aggregations
  const totalVolume = filteredTransfers.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalFees = filteredTransfers.reduce((acc, t) => acc + (Number(t.transfer_fee) || 0), 0);
  const completedTransfers = filteredTransfers.filter(t => ["completed", "posted", "received"].includes(t.status));
  const completedVolume = completedTransfers.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

  // Group by Type
  const typeMap: Record<string, { count: number; volume: number }> = {};
  filteredTransfers.forEach(t => {
    const type = t.transfer_type || "safe_to_safe";
    if (!typeMap[type]) {
      typeMap[type] = { count: 0, volume: 0 };
    }
    typeMap[type].count += 1;
    typeMap[type].volume += Number(t.amount) || 0;
  });

  // Group by Source Account (Outflows)
  const sourceMap: Record<string, { name: string; count: number; volume: number }> = {};
  filteredTransfers.forEach(t => {
    const key = t.source_account_id ? t.source_account_id.toString() : "unknown";
    const name = t.source_account_name || `حساب #${t.source_account_id}`;
    if (!sourceMap[key]) {
      sourceMap[key] = { name, count: 0, volume: 0 };
    }
    sourceMap[key].count += 1;
    sourceMap[key].volume += Number(t.amount) || 0;
  });

  // Group by Destination Account (Inflows)
  const destMap: Record<string, { name: string; count: number; volume: number }> = {};
  filteredTransfers.forEach(t => {
    const key = t.destination_account_id ? t.destination_account_id.toString() : "unknown";
    const name = t.destination_account_name || `حساب #${t.destination_account_id}`;
    if (!destMap[key]) {
      destMap[key] = { name, count: 0, volume: 0 };
    }
    destMap[key].count += 1;
    destMap[key].volume += Number(t.destination_amount || t.amount) || 0;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">تقارير وتحليلات التحويلات والسيولة</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              تحليل حركة نقل الأموال بين الخزائن والبنوك، التدفقات النقدية الداخلة والخارجة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
          >
            <option value="all">جميع الحسابات والخزائن</option>
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
          <button
            onClick={onBackToTransfers}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
          >
            العودة لجدول التحويلات
          </button>
        </div>
      </div>

      {/* Summary KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-semibold">إجمالي حجم التحويلات المطلوبة</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white">{formatCurrency(totalVolume)}</div>
          <div className="text-[11px] text-slate-400">{filteredTransfers.length} عملية تحويل</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-sm space-y-1">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">التحويلات المكتملة والمرحلة</div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{formatCurrency(completedVolume)}</div>
          <div className="text-[11px] text-slate-400">{completedTransfers.length} عملية منجزة</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 shadow-sm space-y-1">
          <div className="text-xs text-purple-600 dark:text-purple-400 font-semibold">إجمالي رسوم وعمولات التحويل</div>
          <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400">{formatCurrency(totalFees)}</div>
          <div className="text-[11px] text-slate-400">عمولات مصرفية وإدارية</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 shadow-sm space-y-1">
          <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">متوسط قيمة العملية الواحدة</div>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
            {formatCurrency(filteredTransfers.length > 0 ? totalVolume / filteredTransfers.length : 0)}
          </div>
          <div className="text-[11px] text-slate-400">لكل تحويل مالي</div>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Type Distribution */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-600" />
              توزيع التحويلات حسب نوع العملية
            </h3>
            <span className="text-xs text-slate-400">{Object.keys(typeMap).length} أنواع</span>
          </div>

          <div className="space-y-3">
            {Object.entries(typeMap).map(([type, data]) => {
              const pct = totalVolume > 0 ? Math.round((data.volume / totalVolume) * 100) : 0;
              return (
                <div key={type} className="space-y-1.5 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">{getTransferTypeLabel(type)}</span>
                    <span className="text-slate-900 dark:text-white font-mono">{formatCurrency(data.volume)} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Source Accounts Outflows */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-rose-500" />
              أعلى الخزائن والحسابات تصديراً للأموال (Outflows)
            </h3>
            <span className="text-xs text-slate-400">{Object.keys(sourceMap).length} حساب</span>
          </div>

          <div className="space-y-2.5">
            {Object.entries(sourceMap).map(([id, data]) => (
              <div key={id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-bold text-slate-800 dark:text-white">{data.name}</span>
                </div>
                <div className="text-left font-mono">
                  <div className="font-extrabold text-rose-600 dark:text-rose-400">-{formatCurrency(data.volume)}</div>
                  <div className="text-[10px] text-slate-400">{data.count} تحويل صادر</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
