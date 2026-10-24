import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShoppingCart, Check, X, Clock, Table2, Info } from "lucide-react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { Branch } from "../types";

interface WebOrder {
  id: number;
  branch_id: number;
  branch_name: string;
  table_number: number;
  status: string;
  notes: string;
  total: number;
  timestamp: string;
  items: Array<{
    id: number;
    product_name: string;
    size_name: string | null;
    quantity: number;
    price: number;
    notes: string;
  }>;
}

export function WebOrders({
  onBack,
  selectedBranch,
  subView,
}: {
  onBack: () => void;
  selectedBranch?: Branch | null;
  subView?: string;
}) {
  if (subView === "web_orders") {
    return (
      <WebOrdersReportView selectedBranch={selectedBranch} onBack={onBack} />
    );
  }

  const { user } = useAuth();
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Polling as fallback for sockets
    return () => clearInterval(interval);
  }, [selectedBranch]);

  const fetchOrders = async () => {
    try {
      const branchId = selectedBranch?.id || user?.branch_id || "";
      const res = await api.get(`/api/web-orders?branch_id=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      } else {
        setError("فشل في جلب طلبات الأون لاين");
      }
    } catch (err) {
      setError("حدث خطأ أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (orderId: number) => {
    if (
      !confirm(
        "هل أنت متأكد من تأكيد هذا الطلب؟ سيتم تحويله إلى طلب فعلي في المطبخ.",
      )
    )
      return;
    try {
      const res = await api.post(`/api/web-orders/${orderId}/confirm`, {
        userId: user?.id,
      });
      if (res.ok) {
        setOrders(orders.filter((o) => o.id !== orderId));
        alert("تم تأكيد الطلب بنجاح");
      } else {
        alert("فشل في تأكيد الطلب");
      }
    } catch (err) {
      alert("حدث خطأ أثناء تأكيد الطلب");
    }
  };

  const handleReject = async (orderId: number) => {
    if (!confirm("هل أنت متأكد من رفض هذا الطلب؟")) return;
    try {
      const res = await api.post(`/api/web-orders/${orderId}/reject`, {});
      if (res.ok) {
        setOrders(orders.filter((o) => o.id !== orderId));
      } else {
        alert("فشل في رفض الطلب");
      }
    } catch (err) {
      alert("حدث خطأ أثناء رفض الطلب");
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              طلبات الأون لاين
            </h1>
            <p className="text-slate-500 text-sm">
              طلبات العملاء عبر الباركود (تحت المراجعة)
            </p>
          </div>
        </div>
        <button
          onClick={onBack}
          className="bg-slate-200 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-300 transition-colors font-bold"
        >
          رجوع
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <X className="w-5 h-5" />
          <span>{error}</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">
            لا توجد طلبات معلقة
          </h3>
          <p className="text-slate-500">
            سيظهر هنا أي طلب جديد يتم إرساله عبر الباركود من قبل العملاء
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {orders.map((order) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col"
                id={`order-${order.id}`}
              >
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Table2 className="w-5 h-5 text-blue-600" />
                    <span className="font-bold text-lg text-slate-800">
                      طاولة {order.table_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>
                      {new Date(order.timestamp).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-grow">
                  <div className="space-y-3 mb-4">
                    {order.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-start text-sm"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-800">
                            {item.product_name}{" "}
                            {item.size_name ? `(${item.size_name})` : ""}
                          </span>
                          {item.notes && (
                            <span className="text-xs text-orange-600 italic">
                              ملاحظة: {item.notes}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">
                            ×{item.quantity}
                          </span>
                          <span className="font-bold text-blue-600">
                            {(item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {order.notes && (
                    <div className="bg-orange-50 p-3 rounded-lg flex items-start gap-2 mb-4">
                      <Info className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-orange-700">
                        ملاحظات عامة: {order.notes}
                      </p>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-4 flex justify-between items-center">
                    <span className="text-slate-500 font-medium">
                      الإجمالي:
                    </span>
                    <span className="text-xl font-black text-slate-900">
                      {Number(order.total).toFixed(2)} ج.م
                    </span>
                  </div>
                </div>

                <div className="p-4 flex gap-3 border-t border-slate-100">
                  <button
                    onClick={() => handleConfirm(order.id)}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl hover:bg-emerald-700 transition-colors font-bold flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5" />
                    تأكيد الأوردر
                  </button>
                  <button
                    onClick={() => handleReject(order.id)}
                    className="bg-red-50 text-red-600 px-4 py-3 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

const WebOrdersReportView: React.FC<{
  selectedBranch?: Branch | null;
  onBack: () => void;
}> = ({ selectedBranch, onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const startDate = start.toISOString().split("T")[0];
        const endDate = now.toISOString().split("T")[0];
        const branchId = selectedBranch?.id || "all";
        const res = await api.get(`/api/reports/branch/web-orders?startDate=${startDate}&endDate=${endDate}&branchId=${branchId}`);
        if (res.ok) {
          const result = await res.json();
          setData(Array.isArray(result) ? result : []);
        }
      } catch (error) {
        console.error("Failed to fetch report", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedBranch]);

  return (
    <div
      className="flex flex-col h-screen bg-slate-50 p-6 overflow-y-auto"
      dir="rtl"
    >
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 hover:bg-slate-50"
        >
          <X className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          تقارير طلبات الأون لاين
        </h1>
      </div>
      {loading ? (
        <div className="text-center py-10 text-slate-500">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-50 text-slate-600 font-medium">
                <tr>
                  {data.length > 0 &&
                    Object.keys(data[0]).map((key, i) => (
                      <th key={i} className="p-4 border-b border-slate-200">
                        {key}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    {Object.values(row).map((val: any, j) => (
                      <td key={j} className="p-4">
                        {typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val || "-")}
                      </td>
                    ))}
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-500">
                      لا توجد بيانات
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
