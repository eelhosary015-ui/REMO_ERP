import React from "react";
import {
  Search, Filter, RefreshCw, Plus, Download, Printer,
  Calendar, Building2, Truck, ShieldCheck, CheckCircle2,
  SlidersHorizontal, X, ArrowUpDown
} from "lucide-react";

interface GRNFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  warehouses: any[];
  suppliers: any[];
  selectedWh: string;
  onWhChange: (val: string) => void;
  selectedSupplier: string;
  onSupplierChange: (val: string) => void;
  qcFilter: string;
  onQcFilterChange: (val: string) => void;
  postingFilter: string;
  onPostingFilterChange: (val: string) => void;
  dateRange: string;
  onDateRangeChange: (val: string) => void;
  loading: boolean;
  onRefresh: () => void;
  onOpenCreate: () => void;
  onExportCsv: () => void;
  activeQuickTab: string;
  onSelectQuickTab: (tab: string) => void;
}

export const GRNFilterBar: React.FC<GRNFilterBarProps> = ({
  search,
  onSearchChange,
  warehouses,
  suppliers,
  selectedWh,
  onWhChange,
  selectedSupplier,
  onSupplierChange,
  qcFilter,
  onQcFilterChange,
  postingFilter,
  onPostingFilterChange,
  dateRange,
  onDateRangeChange,
  loading,
  onRefresh,
  onOpenCreate,
  onExportCsv,
  activeQuickTab,
  onSelectQuickTab
}) => {
  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Action Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600 border border-emerald-100">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900">سندات الاستلام وفحص الجودة (GRN & QC)</h1>
                <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                  Enterprise Workflow
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                دورة استلام الشحنات المتكاملة: أوامر الشراء → فحص الجودة والحجر الصحي → تسكين المواقع → الترحيل والتكاليف المحملة (Landed Costs)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={onExportCsv}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>تصدير Excel / CSV</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition-all shadow-sm"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            onClick={onOpenCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>سند استلام وارد جديد (GRN)</span>
          </button>
        </div>
      </div>

      {/* Quick Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold border-b border-slate-200">
        {[
          { id: "all", label: "جميع السندات" },
          { id: "pending_qc", label: "قيد فحص الجودة (QC Pending)" },
          { id: "quarantine", label: "في الحجر الصحي (Quarantine)" },
          { id: "ready_to_post", label: "مقبول وجاهز للترحيل" },
          { id: "posted", label: "مرحل للمخزن والمحاسبة" },
          { id: "returns", label: "مرتجعات ومرفوضات الموردين" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => onSelectQuickTab(tab.id)}
            className={`px-4 py-2.5 rounded-t-xl transition-all whitespace-nowrap border-b-2 ${
              activeQuickTab === tab.id
                ? "bg-white text-emerald-700 border-emerald-600 shadow-sm"
                : "text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Deep Filter Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search Box */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="بحث برقم السند، المورد، رقم أمر الشراء، الفاتورة، الباركود..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all font-medium"
            />
            {search && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute left-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Warehouse Selector */}
          <div>
            <select
              value={selectedWh}
              onChange={(e) => onWhChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🏢 جميع المخازن المستلمة</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>

          {/* Supplier Selector */}
          <div>
            <select
              value={selectedSupplier}
              onChange={(e) => onSupplierChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🤝 جميع الموردين</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* QC Status Filter */}
          <div>
            <select
              value={qcFilter}
              onChange={(e) => onQcFilterChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">🛡️ جميع حالات الجودة</option>
              <option value="pending">⏳ بانتظار الفحص (Pending)</option>
              <option value="passed">✅ مطابق ومعتمد (Passed)</option>
              <option value="quarantine">⚠️ حجر صحي (Quarantine)</option>
              <option value="partial">⚖️ فحص جزئي (Partial)</option>
              <option value="failed">❌ غير مطابق / مرفوض (Failed)</option>
            </select>
          </div>

          {/* Posting Status Filter */}
          <div>
            <select
              value={postingFilter}
              onChange={(e) => onPostingFilterChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">📑 جميع حالات الترحيل</option>
              <option value="draft">📝 مسودة (Draft)</option>
              <option value="submitted">📨 تم التقديم (Submitted)</option>
              <option value="qc_approved">🛡️ معتمد جودة</option>
              <option value="posted">🔒 مرحل للمخزن والمحاسبة (Posted)</option>
              <option value="reversed">↩️ معكوس (Reversed)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
