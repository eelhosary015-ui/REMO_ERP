import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, Loader2, Package, Layers, Barcode, AlertCircle, Check, Tag, Store } from "lucide-react";
import { api } from "../../utils/api";

export interface SearchedItem {
  itemId: number;
  productId?: number;
  salesProductId?: number;
  ingredientId?: number;
  masterItemId?: number;
  posProductId?: number;
  posPrice?: number;
  priceDifference?: number;
  priceDifferencePct?: number;
  isPosLinked?: boolean;
  itemType: "product" | "inventory_item" | "sales_product" | "pos_product";
  typeLabel: string;
  name: string;
  code: string;
  barcode?: string;
  sku?: string;
  unit: string;
  category?: string;
  price: number;
  cost?: number;
  taxRate?: number;
  stock: number;
  availableStock: number;
  warehouse?: string;
  warehouseId?: number | null;
  source?: string;
}

interface SalesOrderItemSearchProps {
  warehouse?: string;
  priceListId?: number | string;
  onSelectItem: (item: SearchedItem) => void;
  existingItems?: any[];
  autoFocus?: boolean;
}

export const SalesOrderItemSearch: React.FC<SalesOrderItemSearchProps> = ({
  warehouse = "المخزن الرئيسي",
  priceListId,
  onSelectItem,
  existingItems = [],
  autoFocus = false,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);

  // Real-time synchronization: listen for any sales product creations or updates
  useEffect(() => {
    const handleSync = () => {
      setRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener("sales_products_updated", handleSync);
    window.addEventListener("sales_pricing_updated", handleSync);
    return () => {
      window.removeEventListener("sales_products_updated", handleSync);
      window.removeEventListener("sales_pricing_updated", handleSync);
    };
  }, []);

  // Debounced server-side search
  useEffect(() => {
    if (!isOpen && !query) {
      setIsLoading(false);
      return;
    }

    let isCurrentRequest = true;
    const timer = setTimeout(async () => {
      setIsLoading(true);
      setSearchError("");
      try {
        const queryParam = encodeURIComponent(query.trim());
        const whParam = encodeURIComponent((warehouse || "").trim());
        const plParam = priceListId ? `&priceListId=${encodeURIComponent(priceListId)}` : "";
        const res = await api.get(
          `/api/v2/sales/items/search?q=${queryParam}&warehouse=${whParam}${plParam}&limit=30`
        );
        if (res.ok) {
          const data = await res.json();
          if (!Array.isArray(data)) {
            throw new Error("Unexpected sales item search response");
          }
          if (isCurrentRequest) {
            setResults(data);
            setSelectedIndex(-1);
          }
        } else {
          const payload = await res.json().catch(() => ({}));
          if (isCurrentRequest) {
            setResults([]);
            setSearchError(payload.error || "تعذر تحميل نتائج البحث.");
          }
        }
      } catch (err) {
        console.error("Failed to search sales items:", err);
        if (isCurrentRequest) {
          setResults([]);
          setSearchError("تعذر الاتصال بالخادم لإجراء البحث.");
        }
      } finally {
        if (isCurrentRequest) setIsLoading(false);
      }
    }, 120);

    return () => {
      isCurrentRequest = false;
      clearTimeout(timer);
    };
  }, [query, warehouse, priceListId, isOpen, refreshTrigger]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ensure selected item is scrolled into view in dropdown
  useEffect(() => {
    if (selectedIndex >= 0 && resultsListRef.current) {
      const activeEl = resultsListRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  // Check if an item already exists in the current sales order items
  const getItemExistingQty = useCallback(
    (item: SearchedItem) => {
      const found = existingItems.find((existing) => {
        const matchId =
          item.itemId &&
          (existing.itemId || existing.productId || existing.ingredientId) &&
          (Number(existing.itemId) === Number(item.itemId) ||
            Number(existing.productId) === Number(item.productId || item.itemId) ||
            Number(existing.ingredientId) === Number(item.ingredientId || item.itemId));
        const matchCode =
          item.code &&
          (existing.itemCode || existing.code) &&
          String(existing.itemCode || existing.code).trim().toLowerCase() ===
            String(item.code).trim().toLowerCase();
        return matchId || matchCode;
      });
      return found ? Number(found.qtyRequired ?? found.qty ?? 0) : 0;
    },
    [existingItems]
  );

  // Trigger selection of an item
  const handleSelect = useCallback(
    (item: SearchedItem) => {
      onSelectItem(item);
      setQuery("");
      setIsOpen(false);
      setSelectedIndex(-1);
      // Keep focus on input for fast multi-item entry / barcode scanning
      inputRef.current?.focus();
    },
    [onSelectItem]
  );

  // Keyboard navigation & instant barcode/code matching
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      if (results.length > 0) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Check for exact barcode / code match if entered
      const trimmedQuery = query.trim().toLowerCase();
      if (trimmedQuery) {
        const exactMatch = results.find(
          (r) =>
            (r.barcode && r.barcode.toLowerCase() === trimmedQuery) ||
            (r.code && r.code.toLowerCase() === trimmedQuery) ||
            (r.sku && r.sku.toLowerCase() === trimmedQuery)
        );
        if (exactMatch) {
          handleSelect(exactMatch);
          return;
        }
      }

      // If user highlighted an item via arrows
      if (selectedIndex >= 0 && selectedIndex < results.length) {
        handleSelect(results[selectedIndex]);
      } else if (results.length > 0) {
        // Default to first item
        handleSelect(results[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-xl text-right">
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
          <Search className="w-4 h-4 text-indigo-500" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="🔍 ابحث بالاسم أو الكود أو الباركود أو SKU أو الصنف..."
          className="w-full py-2.5 pr-9 pl-9 bg-white border border-slate-200 hover:border-indigo-400 focus:border-indigo-600 rounded-xl font-bold text-xs shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/15 transition-all text-right placeholder:text-slate-400"
        />

        {/* Action icons on left (Lollipop / Spinner / Clear) */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-100 transition-colors"
              title="مسح البحث"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-[10px] font-mono text-slate-300 font-bold hidden sm:inline px-1 bg-slate-50 border border-slate-200 rounded">
              Enter ↵
            </span>
          )}
        </div>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 left-0 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden max-h-[380px] flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Header Bar */}
          <div className="px-3.5 py-2 bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
              <span>
                {isLoading
                  ? "جاري البحث في قاعدة البيانات والمخازن..."
                  : results.length > 0
                  ? `نتائج البحث (${results.length})`
                  : query
                  ? "نتائج البحث"
                  : "أصناف النظام المتاحة"}
              </span>
              {warehouse && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200/60 font-semibold">
                  المخزن: {warehouse}
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 font-medium hidden sm:flex items-center gap-2">
              <span>[↓ / ↑] للتنقل</span>
              <span>•</span>
              <span>[Enter] للإضافة الفورية</span>
              <span>•</span>
              <span>[Esc] للإغلاق</span>
            </div>
          </div>

          {/* Results List */}
          <div
            ref={resultsListRef}
            className="overflow-y-auto divide-y divide-slate-100/80 p-1"
            style={{ maxHeight: "320px" }}
          >
            {searchError ? (
              <div className="p-6 text-center text-rose-600 font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs">{searchError}</span>
              </div>
            ) : isLoading && results.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-bold flex flex-col items-center justify-center gap-2.5">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-xs text-slate-600">جاري تحميل وتحديث أرصدة الأصناف بالمخزن...</span>
              </div>
            ) : results.length > 0 ? (
              results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const existingQty = getItemExistingQty(item);
                const isAvailable = (item.availableStock ?? item.stock ?? 0) > 0;

                return (
                  <div
                    key={`${item.itemType}-${item.itemId}-${item.code}-${idx}`}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => handleSelect(item)}
                    className={`w-full p-3 rounded-xl cursor-pointer text-right flex items-center justify-between gap-3 transition-all ${
                      isSelected
                        ? "bg-indigo-50/90 border-indigo-200 shadow-sm"
                        : "hover:bg-slate-50 border border-transparent"
                    }`}
                  >
                    {/* Item Icon & Basic Details */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          item.itemType === "pos_product"
                            ? "bg-purple-100/90 text-purple-700 border border-purple-200/60"
                            : item.itemType === "product"
                            ? "bg-emerald-100/80 text-emerald-700 border border-emerald-200/50"
                            : "bg-blue-100/80 text-blue-700 border border-blue-200/50"
                        }`}
                      >
                        {item.itemType === "pos_product" ? (
                          <Store className="w-4 h-4" />
                        ) : item.itemType === "product" ? (
                          <Layers className="w-4 h-4" />
                        ) : (
                          <Package className="w-4 h-4" />
                        )}
                      </div>

                      <div className="truncate flex-1">
                        {/* Title Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-slate-800 text-xs truncate">
                            {item.name}
                          </span>

                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                              item.itemType === "pos_product"
                                ? "bg-purple-50 text-purple-700 border border-purple-200/70"
                                : item.itemType === "product"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                                : "bg-blue-50 text-blue-700 border border-blue-200/60"
                            }`}
                          >
                            {item.typeLabel}
                          </span>

                          {/* Existing In Order Indicator */}
                          {existingQty > 0 && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-amber-50 text-amber-800 border border-amber-200/70 flex items-center gap-1">
                              <Check className="w-2.5 h-2.5 text-amber-600" />
                              في الأمر ({existingQty}) +1
                            </span>
                          )}
                        </div>

                        {/* Metadata Tags: Code, Barcode, SKU, Unit */}
                        <div className="flex items-center gap-2.5 mt-1 text-[11px] text-slate-500 font-medium flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <span className="text-slate-400">الكود:</span>
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1 rounded text-[10px]">
                              {item.code}
                            </span>
                          </span>

                          {item.barcode && (
                            <span className="inline-flex items-center gap-1">
                              <Barcode className="w-3 h-3 text-slate-400" />
                              <span className="font-mono text-slate-600 text-[10px]">
                                {item.barcode}
                              </span>
                            </span>
                          )}

                          {item.sku && item.sku !== item.code && (
                            <span className="inline-flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-slate-400" />
                              <span className="text-[10px] text-slate-500">
                                SKU: {item.sku}
                              </span>
                            </span>
                          )}

                          <span className="text-[10px] text-slate-400">
                            الوحدة: <strong className="text-slate-600 font-bold">{item.unit || "قطعة"}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Left: Price & Available Stock */}
                    <div className="text-left shrink-0 pl-1 flex flex-col items-end gap-1">
                      <div className={`text-xs font-black px-2 py-0.5 rounded-lg border ${
                        item.itemType === "pos_product"
                          ? "text-purple-800 bg-purple-50 border-purple-200"
                          : "text-indigo-700 bg-indigo-50 border-indigo-100"
                      }`}>
                        {Number(item.price || 0).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        ج.م
                      </div>

                      {item.posPrice !== undefined && item.posPrice !== item.price && (
                        <div className="text-[9px] font-mono font-bold text-slate-400">
                          الكاشير: {Number(item.posPrice).toFixed(2)} ج.م
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400 font-medium">المتاح بالمخزن:</span>
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${
                            isAvailable
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-600 border-rose-200"
                          }`}
                        >
                          {isAvailable
                            ? `${item.availableStock} ${item.unit || ""}`
                            : "غير متوفر (0)"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              /* Empty state */
              <div className="p-8 text-center text-slate-500 font-bold flex flex-col items-center justify-center gap-2">
                <AlertCircle className="w-8 h-8 text-amber-500/80" />
                <p className="text-xs font-black text-slate-800">
                  لا توجد أصناف مطابقة لبحثك
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  لم يتم العثور على أي صنف أو منتج يطابق البحث &quot;{query}&quot;. يرجى التحقق من صحة الاسم أو الكود أو الباركود.
                </p>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 px-3">
            <span>
              نظام بحث أوامر البيع الذكي • ربط فوري بالمخزن المختار
            </span>
            <span className="font-semibold text-slate-500">
              الضغط يضيف صنفاً أو يزيد كميته تلقائياً
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
