import React from "react";
import { Calendar, User, Warehouse, X } from "lucide-react";

export interface LogFilterValues {
  dateFrom: string;
  dateTo: string;
  customer: string;
  warehouse: string;
}

export const EMPTY_LOG_FILTERS: LogFilterValues = {
  dateFrom: "",
  dateTo: "",
  customer: "",
  warehouse: "",
};

interface LogTableFiltersProps {
  value: LogFilterValues;
  onChange: (next: LogFilterValues) => void;
  /** Warehouse options for the dropdown. If empty, warehouse select is hidden. */
  warehouseOptions?: string[];
  /** Label shown above the customer input / placeholder context. */
  customerLabel?: string;
  className?: string;
}

/**
 * Compact RTL filter bar for sales log tables.
 * Provides: date-from / date-to / customer-name text / warehouse dropdown.
 * Filtering itself stays in the parent (client-side over the already-loaded array).
 */
export const LogTableFilters: React.FC<LogTableFiltersProps> = ({
  value,
  onChange,
  warehouseOptions = [],
  customerLabel = "اسم العميل",
  className = "",
}) => {
  const hasActive =
    value.dateFrom || value.dateTo || value.customer.trim() || value.warehouse;

  const set = (patch: Partial<LogFilterValues>) =>
    onChange({ ...value, ...patch });

  const baseInput =
    "w-full bg-white border border-slate-200 rounded-xl py-2 px-3 text-[11px] font-bold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-transparent transition-all";

  return (
    <div
      dir="rtl"
      className={`flex flex-wrap items-end gap-2.5 bg-slate-50 border border-slate-200/70 rounded-2xl p-3 ${className}`}
    >
      {/* Date From */}
      <div className="flex flex-col gap-1 min-w-[150px]">
        <label className="text-[10px] font-black text-slate-500 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" /> من تاريخ
        </label>
        <input
          type="date"
          value={value.dateFrom}
          onChange={(e) => set({ dateFrom: e.target.value })}
          className={baseInput}
        />
      </div>

      {/* Date To */}
      <div className="flex flex-col gap-1 min-w-[150px]">
        <label className="text-[10px] font-black text-slate-500 flex items-center gap-1">
          <Calendar className="w-3 h-3 text-slate-400" /> إلى تاريخ
        </label>
        <input
          type="date"
          value={value.dateTo}
          onChange={(e) => set({ dateTo: e.target.value })}
          className={baseInput}
        />
      </div>

      {/* Customer name */}
      <div className="flex flex-col gap-1 min-w-[180px] flex-1">
        <label className="text-[10px] font-black text-slate-500 flex items-center gap-1">
          <User className="w-3 h-3 text-slate-400" /> {customerLabel}
        </label>
        <input
          type="text"
          value={value.customer}
          onChange={(e) => set({ customer: e.target.value })}
          placeholder={`بحث بجزء من ${customerLabel}...`}
          className={baseInput}
        />
      </div>

      {/* Warehouse dropdown (only when options exist) */}
      {warehouseOptions.length > 0 && (
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-black text-slate-500 flex items-center gap-1">
            <Warehouse className="w-3 h-3 text-slate-400" /> المخزن
          </label>
          <select
            value={value.warehouse}
            onChange={(e) => set({ warehouse: e.target.value })}
            className={baseInput}
          >
            <option value="">كل المخازن</option>
            {warehouseOptions.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Clear filters */}
      {hasActive ? (
        <button
          type="button"
          onClick={() => onChange(EMPTY_LOG_FILTERS)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-black bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all self-end"
          title="مسح كل الفلاتر المفعّلة"
        >
          <X className="w-3.5 h-3.5" />
          مسح الفلاتر
        </button>
      ) : (
        <div className="self-end py-2 text-[10px] font-bold text-slate-400">
          الفلاتر: التاريخ / العميل / المخزن
        </div>
      )}
    </div>
  );
};

/**
 * Apply the standard log filters to a row array.
 * - dateFrom/dateTo compare against `getDate(row)` as ISO strings (YYYY-MM-DD).
 * - customer does a case-insensitive substring match on `getCustomer(row)`.
 * - warehouse (when non-empty) matches `getWarehouse(row)` exactly.
 */
export function applyLogFilters<T>(
  rows: T[],
  filters: LogFilterValues,
  accessors: {
    getDate: (row: T) => string | undefined | null;
    getCustomer: (row: T) => string | undefined | null;
    getWarehouse?: (row: T) => string | undefined | null;
  }
): T[] {
  const cust = filters.customer.trim().toLowerCase();
  return rows.filter((row) => {
    const d = accessors.getDate(row) || "";
    if (filters.dateFrom && d && d < filters.dateFrom) return false;
    if (filters.dateTo && d && d > filters.dateTo) return false;
    if (cust) {
      const c = (accessors.getCustomer(row) || "").toLowerCase();
      if (!c.includes(cust)) return false;
    }
    if (filters.warehouse && accessors.getWarehouse) {
      if ((accessors.getWarehouse(row) || "") !== filters.warehouse) return false;
    }
    return true;
  });
}
