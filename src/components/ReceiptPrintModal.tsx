import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Printer, Loader2 } from "lucide-react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

interface ReceiptPrintModalProps {
  orderId: number;
  onClose: () => void;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  orderId,
  onClose,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [isInternalReceipt, setIsInternalReceipt] = useState(false);

  // Receipt Settings
  const [receiptTemplate, setReceiptTemplate] = useState("standard");
  const [receiptTemplateInternal, setReceiptTemplateInternal] =
    useState("grid");
  const [receiptFontSize, setReceiptFontSize] = useState(12);
  const [receiptFontSizeInternal, setReceiptFontSizeInternal] = useState(12);
  const [receiptFontWeight, setReceiptFontWeight] = useState(400);
  const [receiptFontWeightInternal, setReceiptFontWeightInternal] =
    useState(400);
  const [receiptHidePricesInternal, setReceiptHidePricesInternal] =
    useState(false);
  const [receiptHotline, setReceiptHotline] = useState("");
  const [receiptLogo, setReceiptLogo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch order details & items
        const [orderRes, itemsRes, branchesRes] = await Promise.all([
          api.get(`/api/orders/${orderId}`),
          api.get(`/api/orders/${orderId}/items`),
          api.get("/api/branches"),
        ]);

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          setOrder(orderData);
        }
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setItems(itemsData || []);
        }
        if (branchesRes.ok) {
          const branchesData = await branchesRes.json();
          setBranches(branchesData || []);
        }

        // Fetch receipt settings
        const [
          templateRes,
          sizeRes,
          weightRes,
          logoRes,
          hotlineRes,
          templateIntRes,
          sizeIntRes,
          weightIntRes,
          hidePricesIntRes,
        ] = await Promise.all([
          api.get("/api/settings/receipt_template"),
          api.get("/api/settings/receipt_font_size"),
          api.get("/api/settings/receipt_font_weight"),
          api.get("/api/settings/receipt_logo"),
          api.get("/api/settings/receipt_hotline"),
          api.get("/api/settings/receipt_template_internal"),
          api.get("/api/settings/receipt_font_size_internal"),
          api.get("/api/settings/receipt_font_weight_internal"),
          api.get("/api/settings/receipt_hide_prices_internal"),
        ]);

        if (templateRes.ok) {
          const data = await templateRes.json();
          if (data && data.value) setReceiptTemplate(data.value);
        }
        if (sizeRes.ok) {
          const data = await sizeRes.json();
          if (data && data.value) setReceiptFontSize(parseInt(data.value));
        }
        if (weightRes.ok) {
          const data = await weightRes.json();
          if (data && data.value) setReceiptFontWeight(parseInt(data.value));
        }
        if (logoRes.ok) {
          const data = await logoRes.json();
          if (data && data.value) setReceiptLogo(data.value);
        }
        if (hotlineRes.ok) {
          const data = await hotlineRes.json();
          if (data && data.value) setReceiptHotline(data.value);
        }

        // Internal Receipt Settings
        if (templateIntRes.ok) {
          const data = await templateIntRes.json();
          if (data && data.value) setReceiptTemplateInternal(data.value);
        }
        if (sizeIntRes.ok) {
          const data = await sizeIntRes.json();
          if (data && data.value)
            setReceiptFontSizeInternal(parseInt(data.value));
        }
        if (weightIntRes.ok) {
          const data = await weightIntRes.json();
          if (data && data.value)
            setReceiptFontWeightInternal(parseInt(data.value));
        }
        if (hidePricesIntRes.ok) {
          const data = await hidePricesIntRes.json();
          if (data)
            setReceiptHidePricesInternal(
              data.value === "true" || data.value === true,
            );
        }
      } catch (error) {
        console.error("Failed to load receipt printing details", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orderId]);

  const activeTemplate = isInternalReceipt
    ? receiptTemplateInternal
    : receiptTemplate;
  const activeFontSize = isInternalReceipt
    ? receiptFontSizeInternal
    : receiptFontSize;
  const activeFontWeight = isInternalReceipt
    ? receiptFontWeightInternal
    : receiptFontWeight;

  const getBranchName = () => {
    if (!order || !order.branch_id) return "الفرع الرئيسي";
    const branch = branches.find((b) => b.id === order.branch_id);
    return branch ? branch.name : "الفرع الرئيسي";
  };

  const calculateItemsTotal = () => {
    return items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    );
  };

  const itemsTotal = calculateItemsTotal();
  const deliveryFee = Number(order?.delivery_fee) || 0;
  const discountAmount = Number(order?.discount) || 0;
  // Total is either fetched from order total directly or calculated
  const grandTotal =
    order?.total !== undefined
      ? Number(order.total)
      : Math.max(0, itemsTotal + deliveryFee - discountAmount);

  const printReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      {loading ? (
        <div className="flex flex-col items-center justify-center text-white gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="font-bold text-sm">جاري تحميل تفاصيل الفاتورة...</p>
        </div>
      ) : !order ? (
        <div className="bg-white p-6 rounded-2xl max-w-sm w-full text-center">
          <p className="text-red-500 font-bold mb-4">
            عذراً، لم نتمكن من العثور على هذا الطلب.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition"
          >
            إغلاق
          </button>
        </div>
      ) : (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-transparent text-black w-full max-w-md relative flex flex-col gap-4 no-print-container py-8"
        >
          {/* Controls Bar for screen only */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 no-print shadow-xl">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-indigo-400" />
              <span className="font-bold">طباعة الفاتورة #{orderId}</span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="flex rounded-lg bg-slate-800 p-1 text-xs font-bold w-full sm:w-auto">
                <button
                  onClick={() => setIsInternalReceipt(false)}
                  className={`px-3 py-1.5 rounded-md transition-all flex-1 text-center whitespace-nowrap ${!isInternalReceipt ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  إيصال العميل
                </button>
                <button
                  onClick={() => setIsInternalReceipt(true)}
                  className={`px-3 py-1.5 rounded-md transition-all flex-1 text-center whitespace-nowrap ${isInternalReceipt ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                >
                  إيصال داخلي
                </button>
              </div>

              <button
                onClick={printReceipt}
                className="bg-indigo-600 hover:bg-indigo-500 p-2 text-white rounded-lg transition"
                title="طباعة"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 p-2 text-white rounded-lg transition"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Actual Print Content Card */}
          <div
            className={`bg-white text-black w-full shadow-2xl font-mono receipt-content overflow-hidden mx-auto ${
              activeTemplate === "modern"
                ? "rounded-3xl p-0 border-4 border-slate-900"
                : activeTemplate === "classic"
                  ? "rounded-none p-8 border-double border-8 border-slate-200"
                  : activeTemplate === "compact"
                    ? "rounded-none p-4 text-[10px]"
                    : activeTemplate === "grid"
                      ? "rounded-none p-0"
                      : "rounded-none p-8"
            }`}
            style={{
              fontSize: `${activeFontSize}px`,
              fontWeight: activeFontWeight,
            }}
          >
            {activeTemplate === "grid" ? (
              <div className="w-full flex flex-col text-black font-sans p-6">
                <div className="text-center pb-4">
                  <p className="font-bold text-lg">{getBranchName()}</p>
                  {receiptLogo ? (
                    <img
                      src={receiptLogo}
                      className="w-16 h-16 mx-auto my-2 object-contain"
                      alt="Logo"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-12 mx-auto my-2 border-2 border-black rounded-full flex items-center justify-center text-[8px]">
                      LOGO
                    </div>
                  )}
                  <p className="font-bold">رقم الطلب اليومي</p>
                  <p className="text-4xl font-black my-1">
                    {order.daily_number || order.id}
                  </p>
                  <p className="text-2xl font-black">
                    {order.order_type === "dine_in"
                      ? "صالة"
                      : order.order_type === "delivery"
                        ? "توصيل"
                        : "تيك أواي"}
                  </p>
                </div>

                <table className="w-full border-collapse border-y border-black text-center">
                  <tbody>
                    <tr className="border-b border-black">
                      <td className="border-l border-black p-2 w-1/2">
                        {new Date(
                          order.created_at || order.date || Date.now(),
                        ).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-2 w-1/2">
                        {new Date(
                          order.created_at || order.date || Date.now(),
                        ).toLocaleTimeString("ar-EG")}
                      </td>
                    </tr>
                    <tr className="border-b border-black text-right">
                      <td className="border-l border-black p-2 font-bold w-1/3">
                        الكاشير
                      </td>
                      <td className="p-2 w-2/3">{user?.username || "كاشير"}</td>
                    </tr>
                    {order.table_number && (
                      <tr className="border-b border-black text-right">
                        <td className="border-l border-black p-2 font-bold w-1/3">
                          الطاولة
                        </td>
                        <td className="p-2 w-2/3">{order.table_number}</td>
                      </tr>
                    )}
                    {!isInternalReceipt &&
                      (order.customer_name ||
                        order.customer_phone ||
                        order.customer_address) &&
                      (order.order_type === "takeaway" ||
                        order.order_type === "delivery") && (
                        <>
                          {order.customer_name && (
                            <tr className="border-b border-black text-right">
                              <td className="border-l border-black p-2 font-bold w-1/3">
                                العميل
                              </td>
                              <td className="p-2 font-bold w-2/3">
                                {order.customer_name}
                              </td>
                            </tr>
                          )}
                          {order.customer_phone && (
                            <tr className="border-b border-black text-right">
                              <td className="border-l border-black p-2 font-bold w-1/3">
                                رقم الهاتف
                              </td>
                              <td className="p-2 w-2/3">
                                {order.customer_phone}
                              </td>
                            </tr>
                          )}
                          {order.customer_address &&
                            order.order_type === "delivery" && (
                              <tr className="border-b border-black text-right">
                                <td className="border-l border-black p-2 font-bold w-1/3">
                                  العنوان
                                </td>
                                <td className="p-2 w-2/3">
                                  {order.customer_address}
                                </td>
                              </tr>
                            )}
                        </>
                      )}
                  </tbody>
                </table>

                <table className="w-full border-collapse text-center mt-4">
                  <thead>
                    <tr className="bg-slate-50 border-b border-black font-bold">
                      <th className="border-l border-black p-2">الصنف</th>
                      {!(isInternalReceipt && receiptHidePricesInternal) && (
                        <th className="border-l border-black p-2">سعر</th>
                      )}
                      <th
                        className={`${!(isInternalReceipt && receiptHidePricesInternal) ? "border-l border-black" : ""} p-2`}
                      >
                        كمية
                      </th>
                      {!(isInternalReceipt && receiptHidePricesInternal) && (
                        <th className="p-2">إجمالي</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-black">
                        <td className="border-l border-black p-2">
                          {item.name}
                          {item.size_name && item.size_name.trim() !== ""
                            ? ` - ${item.size_name}`
                            : ""}
                        </td>
                        {!(isInternalReceipt && receiptHidePricesInternal) && (
                          <td className="border-l border-black p-2">
                            {item.price}
                          </td>
                        )}
                        <td
                          className={`${!(isInternalReceipt && receiptHidePricesInternal) ? "border-l border-black" : ""} p-2`}
                        >
                          {item.quantity}
                        </td>
                        {!(isInternalReceipt && receiptHidePricesInternal) && (
                          <td className="p-2">{item.price * item.quantity}</td>
                        )}
                      </tr>
                    ))}
                    {deliveryFee ? (
                      <tr className="border-b border-black">
                        <td className="border-l border-black p-2">
                          خدمة التوصيل
                        </td>
                        {!(isInternalReceipt && receiptHidePricesInternal) && (
                          <td className="border-l border-black p-2">
                            {deliveryFee}
                          </td>
                        )}
                        <td
                          className={`${!(isInternalReceipt && receiptHidePricesInternal) ? "border-l border-black" : ""} p-2`}
                        >
                          1
                        </td>
                        {!(isInternalReceipt && receiptHidePricesInternal) && (
                          <td className="p-2">{deliveryFee}</td>
                        )}
                      </tr>
                    ) : null}
                    {discountAmount > 0 &&
                      !(isInternalReceipt && receiptHidePricesInternal) && (
                        <tr className="border-b border-black text-rose-600 font-bold">
                          <td
                            colSpan={3}
                            className="border-l border-black p-2 text-right px-4"
                          >
                            قيمة الخصم
                          </td>
                          <td className="p-2">-{discountAmount}</td>
                        </tr>
                      )}
                    {!(isInternalReceipt && receiptHidePricesInternal) && (
                      <tr className="border-b border-black font-bold bg-slate-50">
                        <td
                          colSpan={3}
                          className="border-l border-black p-2 text-right px-4"
                        >
                          الإجمالي النهائي
                        </td>
                        <td className="p-2">{grandTotal}</td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {order.notes && (
                  <div className="p-4 border-b border-black text-right text-sm">
                    <p className="font-bold mb-1">ملاحظات:</p>
                    <p>{order.notes}</p>
                  </div>
                )}

                <p className="text-center font-bold py-4 text-xl">
                  {order.payment_method === "cash" ? "نقدي" : "دفع إلكتروني"}
                </p>

                <div className="p-4 border-t border-black text-center opacity-70 space-y-1">
                  {receiptHotline && (
                    <p className="font-bold">
                      لطلب الاوردرات الخط الساخن {receiptHotline}
                    </p>
                  )}
                  <p className="text-[10px]">Powered by : Backend</p>
                </div>
              </div>
            ) : (
              <div className={`${activeTemplate === "modern" ? "p-6" : "p-4"}`}>
                <div
                  className={`${
                    activeTemplate === "modern"
                      ? "bg-slate-900 text-white p-6 text-center rounded-2xl mb-4"
                      : activeTemplate === "classic"
                        ? "text-center border-b-4 border-double border-slate-900 pb-4 mb-4"
                        : activeTemplate === "compact"
                          ? "text-center border-b border-slate-300 pb-2 mb-2"
                          : "text-center border-b-2 border-dashed border-black pb-4 mb-4"
                  } flex flex-col items-center justify-center`}
                >
                  {receiptLogo && (
                    <div className="flex justify-center mb-2">
                      <img
                        src={receiptLogo}
                        alt="Logo"
                        className="w-16 h-16 object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}
                  <h2
                    className={`font-bold uppercase tracking-tighter ${
                      activeTemplate === "modern"
                        ? "text-2xl"
                        : activeTemplate === "classic"
                          ? "text-3xl font-serif"
                          : activeTemplate === "compact"
                            ? "text-lg"
                            : "text-2xl"
                    }`}
                  >
                    {getBranchName()}
                  </h2>
                  <p className="text-xs opacity-80 font-bold">
                    فاتورة طلب طعام
                  </p>
                  <p className="text-xs opacity-80">
                    {new Date(
                      order.created_at || order.date || Date.now(),
                    ).toLocaleString("ar-EG")}
                  </p>
                  <p
                    className={`font-bold mt-1 ${activeTemplate === "modern" ? "bg-white/20 inline-block px-3 py-1 rounded-full" : ""}`}
                  >
                    رقم الطلب اليومي: {order.daily_number || order.id}
                  </p>
                  {order.table_number && (
                    <p className="text-sm font-bold mt-1">
                      طاولة: {order.table_number}
                    </p>
                  )}
                  {order.order_type && (
                    <p
                      className={`text-2xl font-black mt-2 ${order.order_type === "delivery" ? (activeTemplate === "modern" ? "text-orange-400" : "text-red-600") : activeTemplate === "modern" ? "text-blue-400" : "text-blue-600"}`}
                    >
                      {order.order_type === "delivery"
                        ? "توصيل"
                        : order.order_type === "takeaway"
                          ? "تيك أواي"
                          : "صالة"}
                    </p>
                  )}
                </div>

                <div>
                  {(order.customer_name || order.customer_phone) && (
                    <div
                      className={`mb-4 text-xs border-b border-dashed border-black pb-2 ${activeTemplate === "modern" ? "bg-slate-50 p-3 rounded-xl border-none" : ""}`}
                    >
                      {order.customer_name && (
                        <p>
                          <strong>العميل:</strong> {order.customer_name}
                        </p>
                      )}
                      {order.customer_phone && (
                        <p>
                          <strong>الهاتف:</strong> {order.customer_phone}
                        </p>
                      )}
                      {order.customer_address && (
                        <p>
                          <strong>العنوان:</strong> {order.customer_address}
                        </p>
                      )}
                    </div>
                  )}

                  {order.notes && (
                    <div
                      className={`mb-4 text-xs border-b border-dashed border-black pb-2 ${activeTemplate === "modern" ? "bg-slate-50 p-3 rounded-xl border-none" : ""}`}
                    >
                      <p>
                        <strong>ملاحظات الطلب:</strong> {order.notes}
                      </p>
                    </div>
                  )}

                  <div
                    className={`mb-4 text-xs border-b border-dashed border-black pb-2 ${activeTemplate === "modern" ? "bg-slate-50 p-3 rounded-xl border-none" : ""}`}
                  >
                    <p>
                      <strong>طريقة الدفع:</strong>{" "}
                      <span className="font-bold text-orange-600">
                        {order.payment_method === "cash"
                          ? "كاش (نقداً)"
                          : order.payment_method === "wallet"
                            ? "محفظة إلكترونية"
                            : order.payment_method === "instapay"
                              ? "إنستا باي"
                              : order.payment_method === "visa"
                                ? "فيزا / بطاقة"
                                : "كاش"}
                      </span>
                    </p>
                  </div>

                  <div
                    className={`space-y-2 mb-4 ${activeTemplate === "compact" ? "space-y-1" : ""}`}
                  >
                    <div
                      className={`flex justify-between font-bold border-b pb-1 mb-2 ${activeTemplate === "modern" ? "text-slate-400 border-slate-100" : "border-black"}`}
                    >
                      <span>الصنف</span>
                      {!(isInternalReceipt && receiptHidePricesInternal) && (
                        <span>السعر</span>
                      )}
                    </div>
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span
                          className={
                            activeTemplate === "compact" ? "text-[10px]" : ""
                          }
                        >
                          {item.name}
                          {item.size_name && item.size_name.trim() !== ""
                            ? ` - ${item.size_name}`
                            : ""}{" "}
                          x{item.quantity}
                        </span>
                        {!(isInternalReceipt && receiptHidePricesInternal) && (
                          <span
                            className={
                              activeTemplate === "compact" ? "text-[10px]" : ""
                            }
                          >
                            {item.price * item.quantity} ج.م
                          </span>
                        )}
                      </div>
                    ))}
                    {deliveryFee ? (
                      <div className="flex justify-between text-sm border-t border-dashed border-slate-200 pt-2">
                        <span
                          className={
                            activeTemplate === "compact" ? "text-[10px]" : ""
                          }
                        >
                          خدمة التوصيل
                        </span>
                        {!(isInternalReceipt && receiptHidePricesInternal) && (
                          <span
                            className={
                              activeTemplate === "compact" ? "text-[10px]" : ""
                            }
                          >
                            {deliveryFee} ج.م
                          </span>
                        )}
                      </div>
                    ) : null}
                    {discountAmount > 0 &&
                      !(isInternalReceipt && receiptHidePricesInternal) && (
                        <div className="flex justify-between text-sm border-t border-dashed border-slate-200 pt-2 text-rose-600 font-bold">
                          <span
                            className={
                              activeTemplate === "compact" ? "text-[10px]" : ""
                            }
                          >
                            قيمة الخصم
                          </span>
                          <span
                            className={
                              activeTemplate === "compact" ? "text-[10px]" : ""
                            }
                          >
                            -{discountAmount} ج.م
                          </span>
                        </div>
                      )}
                  </div>

                  {!(isInternalReceipt && receiptHidePricesInternal) && (
                    <div
                      className={`border-t-2 border-dashed border-black pt-4 flex justify-between font-bold text-lg ${
                        activeTemplate === "modern"
                          ? "border-slate-100 pt-6 mt-6 font-sans"
                          : activeTemplate === "classic"
                            ? "border-double border-t-4 border-slate-900"
                            : activeTemplate === "compact"
                              ? "text-sm pt-2 mt-2"
                              : ""
                      }`}
                    >
                      <span>الإجمالي النهائي</span>
                      <span
                        className={
                          activeTemplate === "modern" ? "text-indigo-600" : ""
                        }
                      >
                        {grandTotal} ج.م
                      </span>
                    </div>
                  )}

                  <div
                    className={`mt-4 text-center text-xs italic opacity-60 ${activeTemplate === "modern" ? "text-slate-400 border-t border-slate-100 pt-4" : ""}`}
                  >
                    <p>شكراً لزيارتكم!</p>
                    {receiptHotline && (
                      <p className="mt-1 font-bold not-italic">
                        الخط الساخن: {receiptHotline}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};
