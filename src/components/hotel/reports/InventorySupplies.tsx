import React, { useState, useMemo } from "react";
import { Search, Package, AlertTriangle, ArrowDownRight, Download, Plus } from "lucide-react";
import { InventorySupplyItem } from "../types";
import { HotelPagination } from "../HotelPagination";

interface InventorySuppliesProps {
  inventoryItems: InventorySupplyItem[];
  onRequestPO?: (item: InventorySupplyItem) => void;
  onExport: () => void;
}

// تمت الاضافة: تقرير مستلزمات الفندق والمخزون مع بحث مستقل وترقيم وزر طلب شراء مباشر
export const InventorySupplies: React.FC<InventorySuppliesProps> = ({
  inventoryItems,
  onRequestPO,
  onExport
}) => {
  // تمت الاضافة: بحث مستقل
  const [supplySearch, setSupplySearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  const categories = useMemo(() => {
    const set = new Set<string>();
    inventoryItems.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set);
  }, [inventoryItems]);

  const filteredItems = useMemo(() => {
    const q = supplySearch.trim().toLowerCase();
    return inventoryItems.filter((item) => {
      const matchCat = categoryFilter === "all" || item.category === categoryFilter;
      if (!matchCat) return false;
      if (!q) return true;
      const name = (item.name || "").toLowerCase();
      const code = (item.code || "").toLowerCase();
      const cat = (item.category || "").toLowerCase();
      return name.includes(q) || code.includes(q) || cat.includes(q);
    });
  }, [inventoryItems, supplySearch, categoryFilter]);

  const pageCount = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = currentPage * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث في مستلزمات الفندق بالاسم، الكود، أو التصنيف..."
            value={supplySearch}
            onChange={(e) => {
              setSupplySearch(e.target.value);
              setCurrentPage(0);
            }}
            className="w-full pr-10 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-teal-500 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(0);
            }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-teal-500"
          >
            <option value="all">كل التصنيفات ({inventoryItems.length})</option>
            {categories.map((cat, catIdx) => (
              <option key={`inv-cat-${cat || catIdx}-${catIdx}`} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> تصدير
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
              <tr>
                <th className="p-3">#</th>
                <th className="p-3">كود الصنف</th>
                <th className="p-3">اسم المستلزم الفندقي</th>
                <th className="p-3">التصنيف</th>
                <th className="p-3">الرصيد الفعلي</th>
                <th className="p-3">حد إعادة الطلب</th>
                <th className="p-3">متوسط التكلفة</th>
                <th className="p-3">حالة الرصيد</th>
                <th className="p-3 text-center">أمر شراء (PO)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    لا توجد مستلزمات فندقية مطابقة
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const stock = Number(item.total_stock || 0);
                  const min = Number(item.min_stock || 0);
                  const isLow = stock <= min;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-400 font-mono">
                        {currentPage * itemsPerPage + idx + 1}
                      </td>
                      <td className="p-3 font-mono text-slate-600">{item.code}</td>
                      <td className="p-3 font-bold text-slate-800">{item.name}</td>
                      <td className="p-3 text-slate-600">{item.category || "عام"}</td>
                      <td className="p-3 font-bold">
                        <span className={isLow ? "text-rose-600 font-black" : "text-slate-800"}>
                          {stock} {item.unit || "قطعة"}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 font-mono">
                        {min} {item.unit || "قطعة"}
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {Number(item.avg_cost || 0 || 0).toLocaleString()} ج.م
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isLow
                              ? "bg-rose-100 text-rose-800 flex items-center gap-1 w-fit"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isLow ? (
                            <>
                              <AlertTriangle className="w-3 h-3" /> رصيد حرج
                            </>
                          ) : (
                            "متوفر وكافي"
                          )}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {isLow && onRequestPO ? (
                          <button
                            onClick={() => onRequestPO(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-bold transition shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" /> إنشاء PO
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <HotelPagination
          pageCount={pageCount}
          onPageChange={({ selected }) => setCurrentPage(selected)}
          currentPage={currentPage}
          totalItems={filteredItems.length}
          itemsPerPage={itemsPerPage}
        />
      </div>
    </div>
  );
};
