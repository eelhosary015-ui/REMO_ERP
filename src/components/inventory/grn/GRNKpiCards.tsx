import React from "react";
import {
  FileCheck, ShieldCheck, AlertTriangle, XCircle,
  Truck, DollarSign, Clock, Layers, ArrowUpRight
} from "lucide-react";

interface GRNKpiCardsProps {
  kpis: {
    total_receipts?: number;
    total_inbound_value?: number;
    qc_passed_count?: number;
    qc_quarantine_count?: number;
    qc_failed_count?: number;
    pending_posting_count?: number;
    posted_count?: number;
    this_month_count?: number;
  };
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export const GRNKpiCards: React.FC<GRNKpiCardsProps> = ({
  kpis,
  activeTab,
  onSelectTab
}) => {
  const totalReceipts = Number(kpis.total_receipts || 0);
  const totalValue = Number(kpis.total_inbound_value || 0);
  const passedCount = Number(kpis.qc_passed_count || 0);
  const quarantineCount = Number(kpis.qc_quarantine_count || 0);
  const failedCount = Number(kpis.qc_failed_count || 0);
  const pendingPosting = Number(kpis.pending_posting_count || 0);
  const postedCount = Number(kpis.posted_count || 0);

  const passedPercent = totalReceipts > 0 ? Math.round((passedCount / totalReceipts) * 100) : 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" dir="rtl">
      {/* Total Inbound Value */}
      <div 
        onClick={() => onSelectTab("all")}
        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeTab === "all" 
            ? "bg-slate-900 text-white border-slate-900 shadow-md" 
            : "bg-white text-slate-900 border-slate-200 hover:border-slate-300 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold ${activeTab === "all" ? "text-slate-300" : "text-slate-500"}`}>
            إجمالي السندات الواردة
          </span>
          <div className={`p-2 rounded-xl ${activeTab === "all" ? "bg-slate-800 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
            <Truck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black font-mono">{totalReceipts}</span>
          <span className={`text-xs ${activeTab === "all" ? "text-slate-400" : "text-slate-500"}`}>سند استلام</span>
        </div>
        <div className={`mt-2 pt-2 border-t text-xs flex items-center justify-between font-mono ${
          activeTab === "all" ? "border-slate-800 text-emerald-300" : "border-slate-100 text-emerald-600 font-bold"
        }`}>
          <span>القيمة الإجمالية:</span>
          <span>{totalValue.toLocaleString()} ج.م</span>
        </div>
      </div>

      {/* QC Passed */}
      <div 
        onClick={() => onSelectTab("qc_passed")}
        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeTab === "qc_passed" 
            ? "bg-emerald-700 text-white border-emerald-700 shadow-md" 
            : "bg-white text-slate-900 border-slate-200 hover:border-emerald-200 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold ${activeTab === "qc_passed" ? "text-emerald-100" : "text-slate-500"}`}>
            فحص الجودة: مطابق ومقبول
          </span>
          <div className={`p-2 rounded-xl ${activeTab === "qc_passed" ? "bg-emerald-800 text-white" : "bg-emerald-50 text-emerald-600"}`}>
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black font-mono">{passedCount}</span>
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
            activeTab === "qc_passed" ? "bg-emerald-800 text-emerald-100" : "bg-emerald-100 text-emerald-800"
          }`}>
            {passedPercent}%
          </span>
        </div>
        <div className={`mt-2 pt-2 border-t text-xs flex items-center justify-between ${
          activeTab === "qc_passed" ? "border-emerald-600 text-emerald-100" : "border-slate-100 text-slate-500"
        }`}>
          <span>اجتازت المعايير القياسية</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Quarantine */}
      <div 
        onClick={() => onSelectTab("quarantine")}
        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeTab === "quarantine" 
            ? "bg-amber-600 text-white border-amber-600 shadow-md" 
            : "bg-white text-slate-900 border-slate-200 hover:border-amber-200 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold ${activeTab === "quarantine" ? "text-amber-100" : "text-slate-500"}`}>
            في الحجر الصحي (Quarantine)
          </span>
          <div className={`p-2 rounded-xl ${activeTab === "quarantine" ? "bg-amber-700 text-white" : "bg-amber-50 text-amber-600"}`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black font-mono">{quarantineCount}</span>
          <span className={`text-xs ${activeTab === "quarantine" ? "text-amber-100" : "text-amber-600"}`}>سند / تشغيلة</span>
        </div>
        <div className={`mt-2 pt-2 border-t text-xs flex items-center justify-between ${
          activeTab === "quarantine" ? "border-amber-500 text-amber-100" : "border-slate-100 text-amber-700 font-bold"
        }`}>
          <span>بانتظار نتائج التحليل المخبري</span>
          <Clock className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Rejected / Quality Defect */}
      <div 
        onClick={() => onSelectTab("rejected")}
        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeTab === "rejected" 
            ? "bg-rose-700 text-white border-rose-700 shadow-md" 
            : "bg-white text-slate-900 border-slate-200 hover:border-rose-200 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold ${activeTab === "rejected" ? "text-rose-100" : "text-slate-500"}`}>
            مرفوضات الجودة ومردودات
          </span>
          <div className={`p-2 rounded-xl ${activeTab === "rejected" ? "bg-rose-800 text-white" : "bg-rose-50 text-rose-600"}`}>
            <XCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black font-mono">{failedCount}</span>
          <span className={`text-xs ${activeTab === "rejected" ? "text-rose-100" : "text-rose-600"}`}>سند مرفوض</span>
        </div>
        <div className={`mt-2 pt-2 border-t text-xs flex items-center justify-between ${
          activeTab === "rejected" ? "border-rose-600 text-rose-100" : "border-slate-100 text-rose-600 font-bold"
        }`}>
          <span>تتطلب إشعار خصم أو إرجاع</span>
          <FileCheck className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Ready to Post / Pending */}
      <div 
        onClick={() => onSelectTab("ready_to_post")}
        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
          activeTab === "ready_to_post" 
            ? "bg-blue-700 text-white border-blue-700 shadow-md" 
            : "bg-white text-slate-900 border-slate-200 hover:border-blue-200 shadow-sm"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-bold ${activeTab === "ready_to_post" ? "text-blue-100" : "text-slate-500"}`}>
            جاهز للترحيل المحاسبي والمخزني
          </span>
          <div className={`p-2 rounded-xl ${activeTab === "ready_to_post" ? "bg-blue-800 text-white" : "bg-blue-50 text-blue-600"}`}>
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black font-mono">{pendingPosting}</span>
          <span className={`text-xs ${activeTab === "ready_to_post" ? "text-blue-100" : "text-blue-600"}`}>بانتظار الاعتماد</span>
        </div>
        <div className={`mt-2 pt-2 border-t text-xs flex items-center justify-between ${
          activeTab === "ready_to_post" ? "border-blue-600 text-blue-100" : "border-slate-100 text-slate-500"
        }`}>
          <span>المرحل: {postedCount} سند</span>
          <DollarSign className="w-3.5 h-3.5" />
        </div>
      </div>
    </div>
  );
};
