import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ChefHat,
  Clock,
  CheckCircle2,
  Timer,
  ChevronLeft,
  Utensils,
  Truck,
  User,
  Search,
  Printer,
  Volume2,
  VolumeX,
  RefreshCw,
  Building2,
  CheckCheck,
  PackageCheck,
  AlertCircle,
  Filter
} from "lucide-react";
import { io } from "socket.io-client";
import { api, getBaseUrl } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

interface KitchenOrder {
  id: number;
  daily_number?: number;
  branch_id: number;
  branch_name: string;
  table_number: number | null;
  customer_name: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  order_type: "dine_in" | "takeaway" | "delivery";
  status: "pending" | "preparing" | "ready" | "completed";
  timestamp: string;
  notes: string | null;
  total?: number;
  items: {
    id: number;
    product_name: string;
    quantity: number;
    notes?: string | null;
    size_name?: string | null;
  }[];
}

interface KitchenProps {
  onBack: () => void;
  selectedBranch: any | null;
  subView?: string;
}

// Built-in audio chime using Web Audio API (never fails or depends on external CDN)
const playKitchenChime = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Harmonic double ding (bell/chime effect)
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(587.33, now, 0.4);       // D5
    playTone(880.00, now + 0.12, 0.6); // A5
  } catch (_) {
    try {
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(() => {});
    } catch (_) {}
  }
};

export const Kitchen: React.FC<KitchenProps> = ({
  onBack,
  selectedBranch,
  subView,
}) => {
  if (subView === "kitchen_report") {
    return (
      <KitchenReportView selectedBranch={selectedBranch} onBack={onBack} />
    );
  }

  const { user } = useAuth();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | number>(
    selectedBranch?.id || user?.branch_id || "all"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kitchenWarningTime, setKitchenWarningTime] = useState<number>(30); // in minutes
  const [now, setNow] = useState<number>(Date.now());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "pending" | "preparing" | "ready" | "completed" | "all">("active");

  const activeBranchIdRef = useRef(activeBranchId);
  const userRef = useRef(user);
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    activeBranchIdRef.current = activeBranchId;
  }, [activeBranchId]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Sync prop changes
  useEffect(() => {
    if (selectedBranch?.id) {
      setActiveBranchId(selectedBranch.id);
    }
  }, [selectedBranch]);

  // Load branches list
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get("/api/branches");
        if (res.ok) {
          const data = await res.json();
          setBranches(Array.isArray(data) ? data : []);
        }
      } catch (_) {}
    };
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchKitchenWarningTime();

    // Regular interval for timer updating and periodic fallback sync
    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 10000); // 10 seconds

    // Periodic background sync every 15 seconds to ensure no order is missed
    const pollIntervalId = setInterval(() => {
      fetchOrders(true);
    }, 15000);

    const token = localStorage.getItem("token") || "";
    const socket = io(getBaseUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 8,
      reconnectionDelay: 2000,
    });

    socket.on("new_order", (newOrder: KitchenOrder) => {
      const curBranch = activeBranchIdRef.current;
      const isMatch = !curBranch || curBranch === "all" || String(newOrder.branch_id) === String(curBranch);
      
      if (isMatch) {
        setOrders((prev) => {
          const exists = prev.find((o) => o.id === newOrder.id);
          if (exists) {
            return prev.map((o) => (o.id === newOrder.id ? { ...o, ...newOrder } : o));
          }
          return [newOrder, ...prev];
        });

        if (soundEnabledRef.current) {
          playKitchenChime();
        }
      }
    });

    socket.on(
      "order_status_updated",
      ({ id, status }: { id: string | number; status: string }) => {
        const orderId = Number(id);
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: status as any } : o
          )
        );
      }
    );

    socket.on("order_updated", (updatedOrder: KitchenOrder) => {
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
      );
    });

    return () => {
      socket.disconnect();
      clearInterval(intervalId);
      clearInterval(pollIntervalId);
    };
  }, [activeBranchId]);

  const fetchKitchenWarningTime = async () => {
    try {
      const res = await api.get("/api/settings/kitchen_warning_time");
      if (res.ok) {
        const data = await res.json();
        if (data.value) setKitchenWarningTime(parseInt(data.value, 10));
      }
    } catch {}
  };

  const fetchOrders = async (isBackground = false) => {
    try {
      if (!isBackground) setError(null);
      const branchParam = activeBranchId || "all";
      const res = await api.get(`/api/kitchen/orders?branchId=${branchParam}&status=all`);
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "فشل تحميل الطلبات");
      }
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!isBackground) {
        console.error("Failed to fetch kitchen orders:", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    try {
      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: status as any } : o))
      );
      await api.post(`/api/kitchen/orders/${id}/status`, { status });
    } catch (err) {
      console.error("Failed to update status:", err);
      fetchOrders(true);
    }
  };

  const handlePrintKitchenTicket = (order: KitchenOrder) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const itemsHtml = order.items
      .map(
        (it) => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #ddd; padding: 6px 0; font-size: 14px;">
          <span><strong>${it.quantity}x</strong> ${it.product_name} ${it.size_name ? `(${it.size_name})` : ""}</span>
        </div>
        ${it.notes ? `<div style="font-size: 11px; color: #555; padding-right: 12px;">ملاحظة: ${it.notes}</div>` : ""}
      `
      )
      .join("");

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>بون تجهيز #${order.daily_number || order.id}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 12px; margin: 0; width: 80mm; }
            h2 { margin: 0 0 6px 0; font-size: 18px; text-align: center; }
            p { margin: 2px 0; font-size: 12px; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; background: #eee; font-size: 12px; }
          </style>
        </head>
        <body>
          <h2>بون المطبخ والتجهيز</h2>
          <p style="text-align: center; font-size: 13px;"><strong>الفرع:</strong> ${order.branch_name}</p>
          <hr style="border: 1px dashed #000;" />
          <p><strong>رقم البون:</strong> #${order.daily_number || order.id}</p>
          <p><strong>نوع الطلب:</strong> <span class="badge">${getOrderTypeLabel(order.order_type)} ${order.order_type === "dine_in" && order.table_number ? `(طاولة ${order.table_number})` : ""}</span></p>
          ${order.customer_name ? `<p><strong>العميل:</strong> ${order.customer_name}</p>` : ""}
          <p><strong>الوقت:</strong> ${new Date(order.timestamp).toLocaleTimeString("ar-EG")}</p>
          ${order.notes ? `<p style="background: #fff3cd; padding: 4px; border-radius: 4px;"><strong>ملاحظات:</strong> ${order.notes}</p>` : ""}
          <hr style="border: 1px dashed #000;" />
          <div style="margin: 8px 0;">
            ${itemsHtml}
          </div>
          <hr style="border: 1px dashed #000;" />
          <p style="text-align: center; font-size: 10px; color: #777;">تمت الطباعة تلقائياً</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case "dine_in":
        return <Utensils className="w-3.5 h-3.5" />;
      case "takeaway":
        return <User className="w-3.5 h-3.5" />;
      case "delivery":
        return <Truck className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  const getOrderTypeLabel = (type: string) => {
    switch (type) {
      case "dine_in":
        return "صالة";
      case "takeaway":
        return "سفري / استلام";
      case "delivery":
        return "توصيل";
      default:
        return type;
    }
  };

  // Counts for each tab
  const counts = useMemo(() => {
    const pending = orders.filter((o) => o.status === "pending").length;
    const preparing = orders.filter((o) => o.status === "preparing").length;
    const ready = orders.filter((o) => o.status === "ready").length;
    const completed = orders.filter((o) => o.status === "completed").length;
    const active = pending + preparing + ready;
    return { pending, preparing, ready, completed, active, all: orders.length };
  }, [orders]);

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Status filter
      if (statusFilter === "active") {
        if (order.status !== "pending" && order.status !== "preparing" && order.status !== "ready") return false;
      } else if (statusFilter !== "all") {
        if (order.status !== statusFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = String(order.id).includes(q) || String(order.daily_number || "").includes(q);
        const matchesCustomer = (order.customer_name || "").toLowerCase().includes(q);
        const matchesPhone = (order.customer_phone || "").includes(q);
        const matchesTable = String(order.table_number || "").includes(q);
        const matchesItem = order.items?.some((i) => (i.product_name || "").toLowerCase().includes(q));
        if (!matchesId && !matchesCustomer && !matchesPhone && !matchesTable && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  return (
    <div
      className="min-h-screen bg-slate-100 flex flex-col overflow-hidden text-slate-900"
      dir="rtl"
    >
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-white shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">العودة</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-teal-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-teal-600/20">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                شاشة التجهيز والتسليم
                <span className="text-xs bg-teal-100 text-teal-800 font-bold px-2.5 py-0.5 rounded-full">
                  KDS & Dispatch
                </span>
              </h1>
              <p className="text-slate-500 text-xs font-semibold">
                متابعة فورية للطلبات الواردة من نقاط البيع وإدارة خطوط التجهيز والتسليم
              </p>
            </div>
          </div>
        </div>

        {/* Branch Filter & Quick Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Branch Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Building2 className="w-4 h-4 text-slate-500" />
            <select
              value={activeBranchId}
              onChange={(e) => setActiveBranchId(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-800 outline-none cursor-pointer"
            >
              <option value="all">جميع الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) playKitchenChime();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              soundEnabled
                ? "bg-teal-50 border-teal-200 text-teal-700"
                : "bg-slate-50 border-slate-200 text-slate-400"
            }`}
            title={soundEnabled ? "كتم صوت التنبيه" : "تفعيل صوت التنبيه"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-teal-600" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? "الصوت مفعل" : "صامت"}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={() => fetchOrders(false)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </button>

          {/* Live Indicator */}
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
            <span className="text-xs font-black text-emerald-800">مباشر (Realtime)</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search Ribbon */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "active"
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>الطلبات النشطة</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "active" ? "bg-white/20 text-white" : "bg-teal-100 text-teal-800"
            }`}>
              {counts.active}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "pending"
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>قيد الانتظار</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "pending" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
            }`}>
              {counts.pending}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("preparing")}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "preparing"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>جاري التحضير</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "preparing" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-800"
            }`}>
              {counts.preparing}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("ready")}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "ready"
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>جاهز للتسليم</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "ready" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
            }`}>
              {counts.ready}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "completed"
                ? "bg-slate-800 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>المكتملة اليوم</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              statusFilter === "completed" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
            }`}>
              {counts.completed}
            </span>
          </button>

          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shrink-0 ${
              statusFilter === "all"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <span>الكل ({counts.all})</span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
          <input
            type="text"
            placeholder="بحث برقم الطلب، الطاولة، العميل..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-9 pl-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Orders Grid / Canvas */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 sm:p-8">
        {loading && orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent"></div>
            <p className="text-sm font-bold text-slate-600">جاري تحميل طلبات التجهيز...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-red-600 gap-4">
            <AlertCircle className="w-14 h-14 opacity-80" />
            <p className="text-lg font-black">{error}</p>
            <button
              onClick={() => fetchOrders(false)}
              className="px-6 py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 font-bold transition-all shadow-sm"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : (
          <div className="flex gap-6 h-full min-w-max pb-4">
            <AnimatePresence mode="popLayout">
              {filteredOrders.map((order) => {
                const orderTime = new Date(order.timestamp).getTime();
                const elapsedMinutes = Math.floor((now - orderTime) / 60000);
                const isLate = order.status !== "completed" && elapsedMinutes >= kitchenWarningTime;

                // Color schemes based on status
                const statusStyles = {
                  pending: {
                    border: isLate ? "border-red-400 shadow-red-500/10" : "border-amber-300 shadow-amber-500/10",
                    headerBg: isLate ? "bg-red-100" : "bg-amber-50",
                    badgeBg: "bg-amber-100 text-amber-800",
                    badgeText: "قيد الانتظار"
                  },
                  preparing: {
                    border: isLate ? "border-red-400 shadow-red-500/10" : "border-blue-300 shadow-blue-500/10",
                    headerBg: isLate ? "bg-red-100" : "bg-blue-50",
                    badgeBg: "bg-blue-100 text-blue-800",
                    badgeText: "جاري التحضير"
                  },
                  ready: {
                    border: "border-emerald-400 shadow-emerald-500/10",
                    headerBg: "bg-emerald-50",
                    badgeBg: "bg-emerald-100 text-emerald-800 font-black",
                    badgeText: "جاهز للتسليم"
                  },
                  completed: {
                    border: "border-slate-200 opacity-85",
                    headerBg: "bg-slate-100",
                    badgeBg: "bg-slate-200 text-slate-700 font-bold",
                    badgeText: "مكتمل"
                  }
                };

                const currentStyle = statusStyles[order.status] || statusStyles.pending;

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    className={`w-84 bg-white rounded-3xl border-2 flex flex-col overflow-hidden shadow-xl h-fit max-h-full transition-all ${currentStyle.border}`}
                  >
                    {/* Order Header */}
                    <div className={`p-4 border-b border-slate-200/60 ${currentStyle.headerBg}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-slate-900">
                            #{order.daily_number || order.id}
                          </span>
                          <span className="text-[10px] text-slate-500 font-bold">
                            (ID: {order.id})
                          </span>
                        </div>

                        {/* Timer */}
                        <div
                          className={`flex items-center gap-1 text-xs font-black ${
                            isLate ? "text-red-700 animate-pulse bg-red-200/80 px-2 py-0.5 rounded-md" : "text-slate-600"
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>{elapsedMinutes} دقيقة</span>
                          <span className="text-[10px] opacity-60">
                            ({new Date(order.timestamp).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })})
                          </span>
                        </div>
                      </div>

                      {/* Order Type & Target */}
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-xs">
                            {getOrderTypeIcon(order.order_type)}
                          </div>
                          <div>
                            <h3 className="font-black text-sm text-slate-900 leading-tight">
                              {order.order_type === "dine_in"
                                ? `طاولة ${order.table_number || "-"}`
                                : order.customer_name || "عميل نقدي"}
                            </h3>
                            <p className="text-[11px] font-bold text-slate-500">
                              {order.branch_name} • {getOrderTypeLabel(order.order_type)}
                            </p>
                          </div>
                        </div>

                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${currentStyle.badgeBg}`}>
                          {currentStyle.badgeText}
                        </span>
                      </div>

                      {/* Delivery address & phone if present */}
                      {(order.customer_phone || order.customer_address) && (
                        <div className="mt-2.5 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600 font-semibold space-y-0.5">
                          {order.customer_phone && <p>📞 {order.customer_phone}</p>}
                          {order.customer_address && <p className="truncate">📍 {order.customer_address}</p>}
                        </div>
                      )}
                    </div>

                    {/* Order Items List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5 max-h-[360px]">
                      {order.notes && (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-900">
                          <p className="text-[10px] text-amber-700 font-black mb-0.5">ملاحظات الفاتورة:</p>
                          <p className="whitespace-pre-wrap">{order.notes}</p>
                        </div>
                      )}

                      {order.items && order.items.length > 0 ? (
                        order.items.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1 hover:bg-slate-100/70 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-black text-slate-800">
                                {item.product_name}
                              </span>
                              <span className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-black">
                                {item.quantity}
                              </span>
                            </div>
                            {item.size_name && (
                              <span className="text-[11px] text-teal-700 font-bold">
                                الحجم: {item.size_name}
                              </span>
                            )}
                            {item.notes && (
                              <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">
                                ملاحظة: {item.notes}
                              </span>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 text-center py-4">لا توجد تفاصيل للأصناف</p>
                      )}
                    </div>

                    {/* Order Action Footer */}
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2">
                      <div className="flex gap-2">
                        {order.status === "pending" && (
                          <button
                            onClick={() => updateStatus(order.id, "preparing")}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-98 cursor-pointer"
                          >
                            <Timer className="w-4 h-4" />
                            بدء التحضير
                          </button>
                        )}

                        {order.status === "preparing" && (
                          <button
                            onClick={() => updateStatus(order.id, "ready")}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 active:scale-98 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            جاهز للتسليم
                          </button>
                        )}

                        {order.status === "ready" && (
                          <button
                            onClick={() => updateStatus(order.id, "completed")}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
                          >
                            <PackageCheck className="w-4 h-4" />
                            تسليم الطلب (مكتمل)
                          </button>
                        )}

                        {order.status === "completed" && (
                          <div className="flex-1 bg-slate-200 text-slate-700 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5">
                            <CheckCheck className="w-4 h-4 text-emerald-600" />
                            تم التسليم بنجاح
                          </div>
                        )}

                        {/* Print Ticket Button */}
                        <button
                          onClick={() => handlePrintKitchenTicket(order)}
                          className="px-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition-all cursor-pointer"
                          title="طباعة بون المطبخ"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {filteredOrders.length === 0 && (
              <div className="flex-1 min-w-[500px] flex flex-col items-center justify-center text-slate-400 gap-3 py-16">
                <ChefHat className="w-20 h-20 opacity-25" />
                <p className="text-lg font-black text-slate-600">لا توجد طلبات في هذا القسم حالياً</p>
                <p className="text-xs text-slate-400">
                  {statusFilter === "active"
                    ? "أي طلب يتم إدخاله من نقطة البيع (POS) يظهر هنا تلقائياً في ثوانٍ معدودة."
                    : "اختر قسماً آخر أو اختر (الطلبات النشطة) لمتابعة الأوردرات."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const KitchenReportView: React.FC<{
  selectedBranch: any | null;
  onBack: () => void;
}> = ({ selectedBranch, onBack }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/reports/branch/kitchen");
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
          تقارير طلبات المطبخ والتجهيز
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
