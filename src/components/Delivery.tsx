import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChevronLeft,
  Truck,
  Phone,
  MapPin,
  Clock,
  Printer,
  CheckCircle2,
  Package,
  Search,
  X,
  User,
} from "lucide-react";
import { io } from "socket.io-client";
import { api, getBaseUrl } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

interface DeliveryOrder {
  id: number;
  customer_name: string;
  customer_phone: string;
  customer_phone_2?: string;
  customer_address: string;
  delivery_time: string;
  notes: string;
  total: number;
  delivery_fee?: number;
  delivery_driver_id?: number;
  driver_name?: string;
  status: string;
  timestamp: string;
  branch_name: string;
  items: {
    product_name: string;
    quantity: number;
    price: number;
  }[];
}

interface DeliveryProps {
  onBack: () => void;
  selectedBranch: any | null;
  subView?: string;
}

export const Delivery: React.FC<DeliveryProps> = ({
  onBack,
  selectedBranch,
  subView,
}) => {
  if (subView === "delivery") {
    return (
      <DeliveryReportView selectedBranch={selectedBranch} onBack={onBack} />
    );
  }

  const { user } = useAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [drivers, setDrivers] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(
    null,
  );
  const [selectedDriverId, setSelectedDriverId] = useState<number | "">("");

  const selectedBranchRef = useRef(selectedBranch);
  const userRef = useRef(user);
  const selectedOrderRef = useRef(selectedOrder);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
  }, [selectedBranch]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    selectedOrderRef.current = selectedOrder;
  }, [selectedOrder]);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();

    const token = localStorage.getItem("token") || "";
    const socket = io(getBaseUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socket.on("new_order", (order) => {
      const targetBranchId = selectedBranchRef.current?.id || userRef.current?.branch_id;
      if (
        order.order_type === "delivery" &&
        (targetBranchId === "all" ||
          !targetBranchId ||
          order.branch_id == targetBranchId)
      ) {
        setOrders((prev) => [order, ...prev]);
        // Optional: Play sound
        new Audio(
          "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
        )
          .play()
          .catch(() => {});
      }
    });

    socket.on(
      "order_status_updated",
      ({ id, status, driver_name, delivery_driver_id }) => {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === parseInt(id)
              ? { ...o, status, driver_name, delivery_driver_id }
              : o,
          ),
        );
        if (selectedOrderRef.current?.id === parseInt(id)) {
          setSelectedOrder((prev) =>
            prev ? { ...prev, status, driver_name, delivery_driver_id } : null,
          );
        }
      },
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchOrders = async () => {
    try {
      const branchId = selectedBranch?.id || user?.branch_id || "all";
      const res = await api.get(`/api/delivery/orders?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } else {
        console.error(
          "Failed to fetch delivery orders: Server returned",
          res.status,
        );
        setOrders([]);
      }
    } catch (error) {
      console.error("Failed to fetch delivery orders", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const branchId = selectedBranch?.id || user?.branch_id || "all";
      const res = await api.get(`/api/delivery/drivers?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setDrivers(data);
      }
    } catch (error) {
      console.error("Failed to fetch drivers", error);
    }
  };

  const updateStatus = async (
    id: number,
    status: string,
    driverId?: number,
  ) => {
    try {
      const res = await api.post(`/api/kitchen/orders/${id}/status`, {
        status,
        delivery_driver_id: driverId,
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status,
                  delivery_driver_id: driverId || o.delivery_driver_id,
                }
              : o,
          ),
        );
        if (selectedOrder?.id === id) {
          setSelectedOrder((prev) =>
            prev
              ? {
                  ...prev,
                  status,
                  delivery_driver_id: driverId || prev.delivery_driver_id,
                }
              : null,
          );
        }
      }
    } catch (error) {
      console.error("Failed to update status");
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      (o.customer_name || "")
        .toLowerCase()
        .includes((searchQuery || "").toLowerCase()) ||
      (o.customer_phone || "").includes(searchQuery) ||
      (o.id && o.id.toString().includes(searchQuery));

    const matchesStatus = statusFilter === "all" || o.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const printOrder = (order: DeliveryOrder) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = order.items
      .map(
        (item) => `
      <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px;">
        <span>${item.product_name} x${item.quantity}</span>
        <span>${item.price * item.quantity} ج.م</span>
      </div>
    `,
      )
      .join("");

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>فاتورة توصيل #${order.id}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #000; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
            .info { margin-bottom: 10px; font-size: 14px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .items { margin-bottom: 10px; }
            .total { border-top: 2px dashed #000; padding-top: 10px; font-weight: bold; font-size: 18px; display: flex; justify-content: space-between; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${order.branch_name}</h2>
            <p>فاتورة طلب توصيل #${order.id}</p>
            <p>${new Date((order.timestamp) || 0).toLocaleString("ar-EG")}</p>
          </div>
          <div class="info">
            <p><strong>العميل:</strong> ${order.customer_name}</p>
            <p><strong>الهاتف:</strong> ${order.customer_phone}</p>
            ${order.customer_phone_2 ? `<p><strong>هاتف 2:</strong> ${order.customer_phone_2}</p>` : ""}
            <p><strong>العنوان:</strong> ${order.customer_address}</p>
            ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ""}
          </div>
          <div class="items">
            ${itemsHtml}
            ${
              (order.delivery_fee || 0) > 0
                ? `
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; border-top: 1px dashed #000; pt-5px;">
                <span>خدمة التوصيل</span>
                <span>${(order.delivery_fee || 0)} ج.م</span>
              </div>
            `
                : ""
            }
          </div>
          <div class="total">
            <span>الإجمالي</span>
            <span>${order.total} ج.م</span>
          </div>
          <div class="footer">
            <p>شكراً لطلبكم!</p>
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900">
              <Truck className="w-6 h-6 text-pink-600" />
              خدمة التوصيل
            </h1>
            <p className="text-sm text-slate-500">
              متابعة طلبات الدليفري وحالة التوصيل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {[
              { id: "all", label: "الكل" },
              { id: "pending", label: "انتظار" },
              { id: "preparing", label: "تحضير" },
              { id: "ready", label: "جاهز" },
              { id: "out_for_delivery", label: "خارج" },
              { id: "delivered", label: "تم" },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  statusFilter === filter.id
                    ? "bg-white text-pink-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="بحث برقم الطلب أو اسم العميل..."
              value={searchQuery ?? ""}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl py-2 pr-10 pl-4 w-80 focus:outline-none focus:border-pink-500 transition-colors text-slate-900"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Orders List */}
        <div className="w-1/3 border-l border-slate-200 overflow-y-auto p-6 space-y-4 bg-white">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
              <Package className="w-12 h-12 opacity-20" />
              <p>لا توجد طلبات توصيل حالية</p>
            </div>
          ) : (
            filteredOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className={`w-full text-right p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedOrder?.id === order.id
                    ? "bg-pink-50 border-pink-500 shadow-lg shadow-pink-500/10"
                    : "bg-white border-slate-100 hover:border-slate-300"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-pink-600">
                    #{order.id}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      order.status === "delivered"
                        ? "bg-emerald-100 text-emerald-600"
                        : order.status === "out_for_delivery"
                          ? "bg-pink-100 text-pink-600"
                          : order.status === "ready"
                            ? "bg-blue-100 text-blue-600"
                            : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    {order.status === "pending"
                      ? "قيد الانتظار"
                      : order.status === "preparing"
                        ? "جاري التحضير"
                        : order.status === "ready"
                          ? "جاهز للتوصيل"
                          : order.status === "out_for_delivery"
                            ? "خارج للتوصيل"
                            : order.status === "delivered"
                              ? "تم التوصيل"
                              : order.status}
                  </span>
                </div>
                <h3 className="font-bold mb-1 text-slate-900">
                  {order.customer_name}
                </h3>
                {order.driver_name && (
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold mb-1">
                    <Truck className="w-3 h-3" />
                    <span>{order.driver_name}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone className="w-3 h-3" />
                  <span>{order.customer_phone}</span>
                </div>
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-900">
                    {order.total} ج.م
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(order.timestamp).toLocaleTimeString("ar-EG")}
                  </span>
                </div>
                {order.status === "ready" && (
                  <div
                    className="mt-3 pt-3 border-t border-slate-100 flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <select
                      value={selectedDriverId && selectedOrder?.id === order.id
                          ? selectedDriverId
                          : ""}
                      onChange={(e) => {
                        setSelectedOrder(order);
                        setSelectedDriverId(Number(e.target.value));
                      }}
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold focus:outline-none focus:border-pink-500"
                    >
                      <option value="">اختر طيار...</option>
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        if (
                          selectedOrder?.id === order.id &&
                          selectedDriverId
                        ) {
                          updateStatus(
                            order.id,
                            "out_for_delivery",
                            Number(selectedDriverId),
                          );
                        } else {
                          alert("يرجى اختيار الطيار أولاً");
                        }
                      }}
                      className="bg-pink-600 text-white p-1.5 rounded-lg hover:bg-pink-700 transition-colors"
                    >
                      <Truck className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Order Details */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div
                key={selectedOrder.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-8 w-full"
              >
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h2 className="text-3xl font-bold mb-2 text-slate-900">
                      تفاصيل الطلب #{selectedOrder.id}
                    </h2>
                    <p className="text-slate-500">
                      فرع: {selectedOrder.branch_name}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => printOrder(selectedOrder)}
                      className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors font-bold text-slate-700 shadow-sm"
                    >
                      <Printer className="w-5 h-5" />
                      طباعة الفاتورة
                    </button>
                    {selectedOrder.status === "ready" && (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedDriverId ?? ""}
                          onChange={(e) =>
                            setSelectedDriverId(Number(e.target.value))
                          }
                          className="bg-white border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:border-pink-500 font-bold text-slate-700 shadow-sm"
                        >
                          <option value="">اختر الطيار...</option>
                          {drivers.map((driver) => (
                            <option key={driver.id} value={driver.id}>
                              {driver.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            if (!selectedDriverId) {
                              alert("يرجى اختيار الطيار أولاً");
                              return;
                            }
                            updateStatus(
                              selectedOrder.id,
                              "out_for_delivery",
                              Number(selectedDriverId),
                            );
                          }}
                          className="flex items-center gap-2 px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl transition-colors font-bold shadow-lg shadow-pink-600/20"
                        >
                          <Truck className="w-5 h-5" />
                          خروج للتوصيل
                        </button>
                      </div>
                    )}
                    {selectedOrder.status === "out_for_delivery" && (
                      <button
                        onClick={() =>
                          updateStatus(selectedOrder.id, "delivered")
                        }
                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-bold shadow-lg shadow-emerald-600/20"
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        تم التوصيل
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      بيانات العميل
                    </h3>
                    <div className="space-y-3">
                      <p className="font-bold text-lg text-slate-900">
                        {selectedOrder.customer_name}
                      </p>
                      <div className="flex items-center gap-2 text-pink-600 font-bold">
                        <Phone className="w-4 h-4" />
                        <span>{selectedOrder.customer_phone}</span>
                      </div>
                      {selectedOrder.customer_phone_2 && (
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                          <Phone className="w-4 h-4" />
                          <span>{selectedOrder.customer_phone_2}</span>
                        </div>
                      )}
                      {selectedOrder.driver_name && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-xs text-slate-400 mb-1">
                            الطيار المسؤول:
                          </p>
                          <p className="font-bold text-emerald-600 flex items-center gap-2">
                            <Truck className="w-4 h-4" />
                            {selectedOrder.driver_name}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      عنوان التوصيل
                    </h3>
                    <p className="text-lg leading-relaxed text-slate-700">
                      {selectedOrder.customer_address}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      موعد التوصيل المطلوب
                    </h3>
                    <p className="text-lg font-bold text-slate-900">
                      {selectedOrder.delivery_time
                        ? new Date((selectedOrder.delivery_time) || 0).toLocaleString(
                            "ar-EG",
                          )
                        : "في أسرع وقت"}
                    </p>
                  </div>
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm text-slate-400 mb-4 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      ملاحظات الطلب
                    </h3>
                    <p className="text-slate-600 italic">
                      {selectedOrder.notes || "لا توجد ملاحظات"}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900">
                      الأصناف المطلوبة
                    </h3>
                  </div>
                  <div className="p-6 space-y-4">
                    {(selectedOrder?.items || []).map((item, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-700">
                            x{item.quantity}
                          </div>
                          <span className="font-bold text-slate-800">
                            {item.product_name}
                          </span>
                        </div>
                        <span className="text-slate-500">
                          {item.price * item.quantity} ج.م
                        </span>
                      </div>
                    ))}
                    {(selectedOrder.delivery_fee || 0) > 0 && (
                      <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-100">
                        <span className="text-slate-500 font-bold">
                          خدمة التوصيل
                        </span>
                        <span className="text-slate-500">
                          {(selectedOrder.delivery_fee || 0)} ج.م
                        </span>
                      </div>
                    )}
                    <div className="pt-6 border-t border-slate-100 flex justify-between items-center text-xl font-bold">
                      <span className="text-slate-900">الإجمالي</span>
                      <span className="text-pink-600">
                        {selectedOrder.total} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                <Truck className="w-16 h-16 opacity-10" />
                <p>اختر طلباً لعرض تفاصيله</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const DeliveryReportView: React.FC<{
  selectedBranch: any | null;
  onBack: () => void;
}> = ({ selectedBranch, onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/reports/branch/delivery");
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
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          تقارير خدمات التوصيل
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
