import React from "react";
import { 
  Search, 
  RotateCcw, 
  Plus, 
  FileSpreadsheet, 
  Filter,
  X
} from "lucide-react";
import { TransferType, TransferPriority } from "./TransferTypes";
import { VoiceInputButton } from "../../VoiceInputButton";

interface WarehouseOption {
  id: number;
  name: string;
  code: string;
  is_transit?: boolean;
}

interface TransferFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  fromWarehouseId: string;
  onFromWarehouseChange: (val: string) => void;
  toWarehouseId: string;
  onToWarehouseChange: (val: string) => void;
  type: string;
  onTypeChange: (val: string) => void;
  priority: string;
  onPriorityChange: (val: string) => void;
  dateFrom: string;
  onDateFromChange: (val: string) => void;
  dateTo: string;
  onDateToChange: (val: string) => void;
  warehouses: WarehouseOption[];
  onResetFilters: () => void;
  onRefresh: () => void;
  onNewTransfer: () => void;
  onExportExcel: () => void;
  isLoading?: boolean;
}

export const TransferFilterBar: React.FC<TransferFilterBarProps> = ({
  search,
  onSearchChange,
  fromWarehouseId,
  onFromWarehouseChange,
  toWarehouseId,
  onToWarehouseChange,
  type,
  onTypeChange,
  priority,
  onPriorityChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  warehouses,
  onResetFilters,
  onRefresh,
  onNewTransfer,
  onExportExcel,
  isLoading,
}) => {
  const hasActiveFilters = 
    Boolean(search) || 
    fromWarehouseId !== "all" || 
    toWarehouseId !== "all" || 
    type !== "all" || 
    priority !== "all" || 
    Boolean(dateFrom) || 
    Boolean(dateTo);

  return (
    <div className="bg-card border border-border rounded-2xl p-4 mb-6 shadow-sm space-y-4" id="transfer-filter-bar">
      {/* Search and Main Tools Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Input with Voice & Typing Enhancements */}
        <div className="relative flex-1 w-full flex items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary pointer-events-none" />
            <input
              type="text"
              id="transfer-search-input"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="ابحث برقم التحويل، اسم المخزن، السائق، رقم البوليصة، أو الملاحظات..."
              className="w-full h-11 pr-10 pl-10 bg-background border-2 border-border/80 rounded-xl text-xs sm:text-sm text-foreground focus:outline-none focus:ring-4 focus:ring-primary/15 focus:border-primary transition-all placeholder:text-muted-foreground/70 font-medium text-right shadow-xs"
              autoComplete="off"
              dir="rtl"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors cursor-pointer"
                title="مسح نص البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <VoiceInputButton
            onTranscript={(text) => onSearchChange(text)}
          />
        </div>

        {/* Excel & Refresh Tools */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            id="btn-export-transfers"
            onClick={onExportExcel}
            className="flex items-center justify-center gap-2 h-10 px-4 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="تصدير إلى ملف إكسيل"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>تصدير إكسيل</span>
          </button>

          <button
            type="button"
            id="btn-refresh-transfers"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center justify-center h-10 w-10 bg-background border border-border hover:bg-muted text-foreground rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            title="تحديث البيانات"
          >
            <RotateCcw className={`w-4 h-4 text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filter Dropdowns Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 pt-3 border-t border-border/50">
        {/* Source Warehouse */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            من مخزن (المصدر)
          </label>
          <select
            id="filter-from-warehouse"
            value={fromWarehouseId}
            onChange={(e) => onFromWarehouseChange(e.target.value)}
            className="w-full h-9 px-3 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="all">كل مخازن الصرف</option>
            {warehouses.map((w, wIdx) => (
              <option key={`filter-from-wh-${w.id ?? wIdx}-${wIdx}`} value={String(w.id)}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>

        {/* Destination Warehouse */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            إلى مخزن (الهدف)
          </label>
          <select
            id="filter-to-warehouse"
            value={toWarehouseId}
            onChange={(e) => onToWarehouseChange(e.target.value)}
            className="w-full h-9 px-3 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="all">كل مخازن الاستلام</option>
            {warehouses.map((w, wIdx) => (
              <option key={`filter-to-wh-${w.id ?? wIdx}-${wIdx}`} value={String(w.id)}>
                {w.name} ({w.code})
              </option>
            ))}
          </select>
        </div>

        {/* Transfer Type */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            نوع التحويل
          </label>
          <select
            id="filter-transfer-type"
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="w-full h-9 px-3 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="all">كل الأنواع</option>
            <option value="standard">تحويل قياسي روتيني</option>
            <option value="urgent">تحويل طارئ</option>
            <option value="replenishment">إعادة تموين دوري</option>
            <option value="inter_branch">تحويل بين الفروع</option>
            <option value="department_issue">صرف لقسم تشغيلي</option>
            <option value="return_to_hub">إرجاع للمستودع الرئيسي</option>
            <option value="damaged_transfer">نقل أصناف تالفة / حجر</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            درجة الأولوية
          </label>
          <select
            id="filter-transfer-priority"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="w-full h-9 px-3 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
          >
            <option value="all">كل الأولويات</option>
            <option value="low">منخفضة</option>
            <option value="normal">عادية</option>
            <option value="high">عالية</option>
            <option value="urgent">طارئة وفورية</option>
          </select>
        </div>

        {/* Date From */}
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
            من تاريخ
          </label>
          <input
            type="date"
            id="filter-date-from"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full h-9 px-2.5 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
          />
        </div>

        {/* Date To & Clear Filters */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
              إلى تاريخ
            </label>
            <input
              type="date"
              id="filter-date-to"
              value={dateTo}
              onChange={(e) => onDateToChange(e.target.value)}
              className="w-full h-9 px-2.5 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono"
            />
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              id="btn-reset-filters"
              onClick={onResetFilters}
              className="h-9 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
              title="تفريغ كل الفلاتر"
            >
              إلغاء
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
