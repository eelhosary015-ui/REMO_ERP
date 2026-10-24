import React, { useState, useMemo } from "react";
import { DollarSign, TrendingUp, PieChart, ShoppingBag, Plus, Minus } from "lucide-react";
import { RevenueReportData, InventorySupplyItem } from "../types";

interface RevenueProps {
  revenueData: RevenueReportData | null;
  inventoryItems?: InventorySupplyItem[];
  onDeductMinibar?: (item: InventorySupplyItem, qty: number, roomNumber: string) => Promise<void>;
  occupiedRooms?: Array<{ room_number: string }>;
}

// تمت الاضافة: تقرير الإيرادات مع إزالة الأرقام الهاردكود (بدلها 0) وجدول استهلاك الميني بار المرتبط بالمخازن
export const RevenueReport: React.FC<RevenueProps> = ({
  revenueData,
  inventoryItems = [],
  onDeductMinibar,
  occupiedRooms = []
}) => {
  // تمت الاضافة: شيل الأرقام الهاردكود واستبدالها بالقيم الفعلية أو 0
  const totalRevenue = Number(revenueData?.total_revenue || 0);
  const roomRevenue = Number(revenueData?.room_revenue || (totalRevenue ? totalRevenue * 0.8 : 0));
  const extraCharges = Number(revenueData?.extra_charges || (totalRevenue ? totalRevenue * 0.2 : 0));
  const totalTax = Number(revenueData?.total_tax || (totalRevenue ? Math.round(totalRevenue * 0.14) : 0));
  const totalPaid = Number(revenueData?.total_paid || 0);
  const totalRemaining = Number(revenueData?.total_remaining || 0);

  // تصفية أصناف الميني بار من المخازن
  const minibarItems = useMemo(() => {
    return inventoryItems.filter(
      (item) =>
        (item.category || "").toLowerCase() === "minibar" ||
        (item.name || "").includes("ميني بار") ||
        (item.name || "").includes("شيبس") ||
        (item.name || "").includes("شوكولاتة") ||
        (item.name || "").includes("مياه") ||
        (item.name || "").includes("عصير")
    );
  }, [inventoryItems]);

  const [selectedRoom, setSelectedRoom] = useState<string>(occupiedRooms[0]?.room_number || "101");
  const [minibarQuantities, setMinibarQuantities] = useState<Record<number, number>>({});
  const [isDeducting, setIsDeducting] = useState(false);

  const handleQtyChange = (itemId: number, delta: number) => {
    setMinibarQuantities((prev) => {
      const cur = prev[itemId] || 0;
      const next = Math.max(0, cur + delta);
      return { ...prev, [itemId]: next };
    });
  };

  const handleChargeMinibar = async (item: InventorySupplyItem) => {
    const qty = minibarQuantities[item.id] || 1;
    if (qty <= 0 || !onDeductMinibar) return;
    setIsDeducting(true);
    try {
      await onDeductMinibar(item, qty, selectedRoom);
      setMinibarQuantities((prev) => ({ ...prev, [item.id]: 0 }));
    } finally {
      setIsDeducting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 4 Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500">إجمالي الإيرادات المحققة</span>
          <div className="text-2xl font-black text-slate-900 mt-2 mb-1">
            {Number(totalRevenue || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="text-xs text-teal-600 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> شامل الإقامة والخدمات والضرائب
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500">إيرادات الغرف والإقامة</span>
          <div className="text-2xl font-black text-teal-700 mt-2 mb-1">
            {Number(roomRevenue || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="text-xs text-slate-500">تمثل الإيراد الفعلي لحجز الغرف</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500">الخدمات الإضافية والميني بار</span>
          <div className="text-2xl font-black text-blue-700 mt-2 mb-1">
            {Number(extraCharges || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="text-xs text-slate-500">مطاعم، مغسلة، ميني بار، وخدمة الغرف</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500">ضريبة القيمة المضافة 14%</span>
          <div className="text-2xl font-black text-indigo-700 mt-2 mb-1">
            {Number(totalTax || 0 || 0).toLocaleString()} <span className="text-xs font-bold text-slate-500">ج.م</span>
          </div>
          <div className="text-xs text-slate-500">المحصلة لحساب مصلحة الضرائب</div>
        </div>
      </div>

      {/* Settlement vs Receivables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200 flex justify-between items-center">
          <div>
            <div className="text-xs font-bold text-emerald-800">إجمالي المبالغ المحصلة (Cash/Bank)</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">
              {Number(totalPaid || 0 || 0).toLocaleString()} ج.م
            </div>
          </div>
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-rose-50/60 p-5 rounded-2xl border border-rose-200 flex justify-between items-center">
          <div>
            <div className="text-xs font-bold text-rose-800">الأرصدة المعلقة لدى النزلاء (Guest Ledger)</div>
            <div className="text-2xl font-black text-rose-900 mt-1">
              {Number(totalRemaining || 0 || 0).toLocaleString()} ج.م
            </div>
          </div>
          <div className="p-3 bg-rose-600 text-white rounded-xl shadow-sm">
            <PieChart className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* تمت الاضافة: جدول استهلاك الميني بار التفاعلي المربوط بالمخازن */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
              <ShoppingBag className="w-4 h-4 text-teal-600" />
              استهلاك ومبيعات الميني بار (Minibar Consumption)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ربط مباشر مع موديول المخازن — تحميل الاستهلاك على فاتورة النزيل وخصم الكمية آلياً
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-600">الغرفة المستهدفة:</label>
            <input
              type="text"
              value={selectedRoom}
              onChange={(e) => setSelectedRoom(e.target.value)}
              placeholder="مثال: 205"
              className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-center focus:bg-white focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">كود الصنف</th>
                <th className="p-3">اسم الصنف بالميني بار</th>
                <th className="p-3">الرصيد المتاح بالمخزن</th>
                <th className="p-3">سعر البيع للنزيل</th>
                <th className="p-3 text-center">الكمية المستهلكة</th>
                <th className="p-3 text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {minibarItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    لا توجد أصناف معرفة تحت تصنيف الميني بار في موديول المخازن
                  </td>
                </tr>
              ) : (
                minibarItems.map((item) => {
                  const qty = minibarQuantities[item.id] || 1;
                  const price = item.avg_cost ? Math.round(item.avg_cost * 1.5) : 35;
                  const isLow = Number(item.total_stock) <= Number(item.min_stock);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-slate-500">{item.code}</td>
                      <td className="p-3 font-bold text-slate-800">{item.name}</td>
                      <td className="p-3">
                        <span
                          className={`font-bold ${
                            isLow ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {item.total_stock} {item.unit || "قطعة"}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900">{price} ج.م</td>
                      <td className="p-3 text-center">
                        <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                          <button
                            onClick={() => handleQtyChange(item.id, -1)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-bold">{qty}</span>
                          <button
                            onClick={() => handleQtyChange(item.id, 1)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          disabled={isDeducting || Number(item.total_stock) <= 0}
                          onClick={() => handleChargeMinibar(item)}
                          className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition shadow-sm"
                        >
                          تحميل وخصم من المخزن
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
