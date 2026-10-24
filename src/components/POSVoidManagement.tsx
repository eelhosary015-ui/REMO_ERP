import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  RotateCcw,
  Search,
  Calendar,
  Edit3,
  Trash2,
  Printer,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  RefreshCw,
  Building2,
  Filter,
  X,
} from "lucide-react";
import { api } from "../utils/api";
import type { Branch } from "../types";
import type { POSConfiguration } from "../utils/posSettings";
import { OrderEditorModal } from "./OrderEditorModal";
import { POSReceiptModal } from "./POSReceiptModal";
import { useAuth } from "../contexts/AuthContext";

interface POSVoidManagementProps {
  branch: Branch | null;
  branches: Branch[];
  config: POSConfiguration;
  cashierName: string;
  /**
   * نطاق شاشة الفود: "pos" للكاشير المباشر أو "call_center" لمركز الاتصال.
   * يحدد قناة الأوردرات المعروضة ويُرسل مع طلب الإلغاء حتى يتحقق السيرفر
   * من أن المستخدم لا يلغي أوردراً خارج نطاق شاشته.
   */
  scope?: "pos" | "call_center";
  onBack: () => void;
  onOrderUpdated?: () => void;
}

const paymentMethodAr: Record<string, string> = {
  cash: "كاش",
  visa: "فيزا",
  mastercard: "ماستر كارد",
  instapay: "إنستا باي",
  wallet: "محفظة إلكترونية",
  credit: "آجل",
  mixed: "مختلط",
};

export const POSVoidManagement: React.FC<POSVoidManagementProps> = ({
  branch,
  branches,
  config,
  cashierName,
  scope = "pos",
  onBack,
  onOrderUpdated,
}) => {
  const { user } = useAuth();
  const isCallCenterScope = scope === "call_center";
  const scopeLabel = isCallCenterScope ? "الكول سنتر" : "نقطة البيع";
  const currency = config.pricing?.currency || (config.pricing as any)?.currencySymbol || "EGP";

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    branch?.id ? String(branch.id) : "all"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled">("all");

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [cancelConfirmOrder, setCancelConfirmOrder] = useState<any | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [receiptPreviewOrderId, setReceiptPreviewOrderId] = useState<number | null>(null);

  const fetchOrders = useCallback(
    async (
      searchVal = searchQuery,
      dateVal = dateFilter,
      branchVal = selectedBranchId
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (branchVal && branchVal !== "all") {
          params.append("branchId", branchVal);
        }
        if (searchVal.trim()) {
          params.append("search", searchVal.trim());
        }
        if (dateVal) {
          params.append("date", dateVal);
        }
        // نطاق الشاشة يحدد قناة الأوردرات: كول سنتر أو كاشير مباشر
        params.append("source", scope);

        const res = await api.get(`/api/pos/orders-for-void?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed to fetch orders for void page:", err);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, dateFilter, selectedBranchId, scope]
  );
  useEffect(() => {
    fetchOrders(searchQuery, dateFilter, selectedBranchId);
  }, [dateFilter, selectedBranchId]);

  const handleConfirmCancel = async () => {
    if (!cancelConfirmOrder) return;
    if (!cancelReason.trim()) {
      setFeedback({
        type: "error",
        message: "يرجى إدخال سبب استرجاع أو إلغاء الأوردر (Void) قبل التأكيد.",
      });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.post(`/api/orders/${cancelConfirmOrder.id}/cancel`, {
        notes: cancelReason.trim(),
        scope,
      });
      if (res.ok) {
        setFeedback({
          type: "success",
          message: `تم استرجاع وإلغاء أوردر ${scopeLabel} #${cancelConfirmOrder.id} بنجاح، وتم إرجاع المنتجات للمخزن وتسجيل حركة الاسترداد بالخزينة وقيد الإلغاء العكسي في الحسابات العامة وحفظه في تقارير الأوردرات الملغاة.`,
        });
        setCancelConfirmOrder(null);
        setCancelReason("");
        fetchOrders(searchQuery, dateFilter, selectedBranchId);
        onOrderUpdated?.();
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback({
          type: "error",
          message: err?.error || "فشل استرجاع / إلغاء الأوردر",
        });
      }
    } catch (error: any) {
      setFeedback({
        type: "error",
        message: error?.message || "حدث خطأ أثناء إلغاء الأوردر",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const filteredOrders = orders.filter((ord) => {
    if (statusFilter === "active") return ord.status !== "cancelled";
    if (statusFilter === "cancelled") return ord.status === "cancelled";
    return true;
  });

  const stats = {
    totalCount: orders.length,
    activeCount: orders.filter((o) => o.status !== "cancelled").length,
    cancelledCount: orders.filter((o) => o.status === "cancelled").length,
    cancelledTotal: orders
      .filter((o) => o.status === "cancelled")
      .reduce((sum, o) => sum + Number(o.total || 0), 0),
  };

  return (
    <div
      className="min-h-screen h-full bg-slate-50 flex flex-col overflow-hidden text-right font-cairo"
      dir="rtl"
    >
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
            title="رجوع"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-600/20">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">
              {isCallCenterScope
                ? "شاشة الفود لأوردرات الكول سنتر (Call Center Void)"
                : "شاشة الفويد واسترجاع وتعديل الأوردرات (POS Void)"}
            </h1>
            <p className="text-xs text-slate-500 font-bold mt-0.5">
              {isCallCenterScope
                ? "استرجاع أي أوردر من أوردرات الكول سنتر فقط، مع إرجاع المنتجات للمخزن وتحديث الخزينة والحسابات العامة وتقارير الأوردرات الملغاة"
                : "استرجاع الأوردر أو التعديل فيه مع تحديث الخزينة والحسابات العامة والمخازن وتقارير الأوردرات الملغاة وحركات المستخدمين"}
            </p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-[11px] font-black border ${isCallCenterScope ? "bg-cyan-50 text-cyan-800 border-cyan-200" : "bg-slate-100 text-slate-700 border-slate-200"}`}>
            نطاق الشاشة: {scopeLabel} فقط
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchOrders(searchQuery, dateFilter, selectedBranchId)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <span className="text-xs font-bold text-slate-400 block mb-1">
              إجمالي أوردرات {scopeLabel} المعروضة
            </span>
            <span className="text-2xl font-black font-mono text-slate-900">
              {stats.totalCount}
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs">
            <span className="text-xs font-bold text-emerald-600 block mb-1">
              الأوردرات النشطة / المكتملة
            </span>
            <span className="text-2xl font-black font-mono text-emerald-700">
              {stats.activeCount}
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs">
            <span className="text-xs font-bold text-rose-600 block mb-1">
              الأوردرات الملغاة والمسترجعة (Void)
            </span>
            <span className="text-2xl font-black font-mono text-rose-700">
              {stats.cancelledCount}
            </span>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs">
            <span className="text-xs font-bold text-rose-600 block mb-1">
              إجمالي قيمة الأوردرات الملغاة (Void)
            </span>
            <span className="text-2xl font-black font-mono text-rose-700">
              {stats.cancelledTotal.toFixed(2)} {currency}
            </span>
          </div>
        </div>

        {/* Feedback Alert */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold ${
                feedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {feedback.type === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <span className="leading-relaxed">{feedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cancel / Return Confirmation Panel */}
        <AnimatePresence>
          {cancelConfirmOrder && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="p-5 rounded-2xl bg-rose-50 border-2 border-rose-300 shadow-md space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <h3 className="font-black text-sm text-rose-900">
                    تأكيد استرجاع وإلغاء الأوردر #{cancelConfirmOrder.id} (الرقم اليومي: #
                    {cancelConfirmOrder.daily_number || cancelConfirmOrder.id})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCancelConfirmOrder(null);
                    setCancelReason("");
                  }}
                  className="px-3 py-1 rounded-lg bg-white text-rose-600 hover:bg-rose-100 text-xs font-bold border border-rose-200"
                >
                  إلغاء التحديد
                </button>
              </div>

              <p className="text-xs text-rose-800 leading-relaxed">
                عند إتمام العملية سيتم استرجاع الأوردر بقيمة{" "}
                <strong className="font-mono">
                  {Number(cancelConfirmOrder.total || 0).toFixed(2)} {currency}
                </strong>{" "}
                وحذف قيمته من الخزينة ومن الحسابات العامة وإرجاع المقادير للمخزن، مع بقائه في تقارير الأوردرات الملغاة وظهوره في سجل حركات المستخدمين.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="اكتب سبب الاسترجاع / الإلغاء (إجباري)..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="flex-1 bg-white border border-rose-300 rounded-xl py-2.5 px-4 text-xs font-bold focus:outline-none focus:border-rose-600"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmCancel}
                  className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>
                    {actionLoading
                      ? "جاري تنفيذ الاسترجاع..."
                      : "تأكيد الاسترجاع وحذف الأوردر من الخزينة والحسابات"}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث برقم الأوردر، الرقم اليومي، اسم العميل، رقم الهاتف أو الملاحظات..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  fetchOrders(searchQuery, dateFilter, selectedBranchId);
                }
              }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <label className="text-xs font-bold text-slate-600">التاريخ:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
            />
          </div>

          {(user?.role === "admin" || !user?.branch_id) && branches.length > 0 && (
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <label className="text-xs font-bold text-slate-600">الفرع:</label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:bg-white focus:outline-none focus:border-rose-500"
              >
                <option value="all">كل الفروع</option>
                {branches.map((b) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                statusFilter === "all"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              الكل ({stats.totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                statusFilter === "active"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              النشطة ({stats.activeCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("cancelled")}
              className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                statusFilter === "cancelled"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              الملغاة Void ({stats.cancelledCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchOrders(searchQuery, dateFilter, selectedBranchId)}
            className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>بحث</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setDateFilter("");
              setStatusFilter("all");
              fetchOrders("", "", selectedBranchId);
            }}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            عرض كل التواريخ
          </button>
        </div>

        {/* Orders Table / Cards */}
        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center">
              <div className="w-9 h-9 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-500">
                جاري تحميل الأوردرات...
              </p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center flex flex-col items-center gap-3">
              <Receipt className="w-12 h-12 text-slate-300 stroke-[1.2]" />
              <p className="text-sm font-black text-slate-500">
                لا توجد أوردرات مطابقة للبحث في هذه الفترة
              </p>
              <p className="text-xs text-slate-400">
                يمكنك تغيير التاريخ أو الضغط على "عرض كل التواريخ" للوصول لجميع الأوردرات السابقة
              </p>
            </div>
          ) : (
            filteredOrders.map((ord) => {
              const isCancelled = ord.status === "cancelled";
              const orderTypeAr =
                ord.order_type === "dine_in"
                  ? "صالة"
                  : ord.order_type === "takeaway"
                    ? "تيك أواي"
                    : ord.order_type === "delivery"
                      ? "دليفري"
                      : ord.order_type || "بيع مباشر";

              return (
                <div
                  key={ord.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isCancelled
                      ? "bg-rose-50/40 border-rose-200"
                      : "bg-white hover:border-slate-300 border-slate-200/90 shadow-xs"
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-mono font-black">
                        أوردر #{ord.id}
                      </span>
                      {ord.daily_number && (
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold">
                          يومي: #{ord.daily_number}
                        </span>
                      )}
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold">
                        {orderTypeAr}
                      </span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${ord.source === "call_center" ? "bg-cyan-50 text-cyan-800 border-cyan-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                        {ord.source === "call_center" ? "كول سنتر" : ord.source === "web" ? "موقع" : "نقطة بيع"}
                      </span>
                      {ord.branch_name && (
                        <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold">
                          {ord.branch_name}
                        </span>
                      )}
                      <span
                        className={`px-3 py-1 rounded-lg text-xs font-black ${
                          isCancelled
                            ? "bg-rose-100 text-rose-700 border border-rose-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {isCancelled ? "ملغي / مسترجع (Void)" : "نشط / مكتمل"}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {ord.timestamp
                          ? new Date(ord.timestamp).toLocaleString("ar-EG")
                          : ""}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-600">
                      <span>
                        العميل:{" "}
                        <strong className="text-slate-900">
                          {ord.customer_name || "عميل نقدي"}
                        </strong>
                        {ord.customer_phone ? ` (${ord.customer_phone})` : ""}
                      </span>
                      <span>
                        طريقة الدفع:{" "}
                        <strong className="text-slate-900">
                          {paymentMethodAr[ord.payment_method] ||
                            ord.payment_method ||
                            "كاش"}
                        </strong>
                      </span>
                      {ord.cashier_name && (
                        <span>
                          الكاشير:{" "}
                          <strong className="text-slate-900">
                            {ord.cashier_name}
                          </strong>
                        </span>
                      )}
                    </div>

                    {Array.isArray(ord.items) && ord.items.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ord.items.map((it: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-xs bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg font-bold border border-slate-200/60"
                          >
                            {it.product_name || it.name} × {it.quantity} (
                            {Number(it.price || 0).toFixed(2)})
                          </span>
                        ))}
                      </div>
                    )}

                    {ord.notes && (
                      <div className="text-xs text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 inline-block">
                        <strong>ملاحظات / سبب العملية:</strong> {ord.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                    <div className="text-left">
                      <span className="text-[11px] text-slate-400 font-bold block">
                        إجمالي الأوردر
                      </span>
                      <span
                        className={`font-mono font-black text-lg ${
                          isCancelled
                            ? "line-through text-rose-500"
                            : "text-slate-900"
                        }`}
                      >
                        {Number(ord.total || 0).toFixed(2)} {currency}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setReceiptPreviewOrderId(ord.id)}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        <span>الفاتورة</span>
                      </button>

                      {!isCancelled && (
                        <>
                          {!isCallCenterScope && (
                            <button
                              type="button"
                              onClick={() => setEditingOrderId(ord.id)}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>تعديل الأوردر (Void Edit)</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setCancelConfirmOrder(ord);
                              setCancelReason("");
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>استرجاع / إلغاء (Void)</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Order Editor Modal */}
      {editingOrderId && (
        <OrderEditorModal
          orderId={editingOrderId}
          onClose={() => setEditingOrderId(null)}
          onSave={() => {
            const editedId = editingOrderId;
            setEditingOrderId(null);
            setFeedback({
              type: "success",
              message: `تم تعديل الأوردر #${editedId} بنجاح، وتم تحديث الخزينة والحسابات العامة والمخزون وتسجيل العملية في تقارير التعديلات وحركات المستخدمين.`,
            });
            fetchOrders(searchQuery, dateFilter, selectedBranchId);
            onOrderUpdated?.();
          }}
        />
      )}

      {/* Receipt Preview Modal */}
      {receiptPreviewOrderId && (
        <POSReceiptModal
          orderId={receiptPreviewOrderId}
          config={config}
          cashierName={cashierName}
          autoPrint={false}
          onClose={() => setReceiptPreviewOrderId(null)}
        />
      )}
    </div>
  );
};
