import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Plus, Minus, Trash2, Printer, Save, Search } from "lucide-react";
import { api } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

interface OrderEditorModalProps {
  orderId: number;
  onClose: () => void;
  onSave: () => void;
}

export const OrderEditorModal: React.FC<OrderEditorModalProps> = ({
  orderId,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [notes, setNotes] = useState("");

  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [categoryDiscounts, setCategoryDiscounts] = useState<
    Record<number, number>
  >({});

  const [showSizeModal, setShowSizeModal] = useState(false);
  const [selectedProductForSize, setSelectedProductForSize] =
    useState<any>(null);

  const [receiptTemplate, setReceiptTemplate] = useState("standard");
  const [receiptFontSize, setReceiptFontSize] = useState(12);
  const [receiptFontWeight, setReceiptFontWeight] = useState(400);
  const [receiptLogo, setReceiptLogo] = useState("");
  const [receiptHotline, setReceiptHotline] = useState("");
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    const fetchReceiptSettings = async () => {
      try {
        const [
          templateRes,
          sizeRes,
          weightRes,
          logoRes,
          hotlineRes,
          branchesRes,
        ] = await Promise.all([
          api.get("/api/settings/receipt_template"),
          api.get("/api/settings/receipt_font_size"),
          api.get("/api/settings/receipt_font_weight"),
          api.get("/api/settings/receipt_logo"),
          api.get("/api/settings/receipt_hotline"),
          api.get("/api/branches"),
        ]);

        if (templateRes.ok) {
          const data = await templateRes.json();
          if (data.value) setReceiptTemplate(data.value);
        }
        if (sizeRes.ok) {
          const data = await sizeRes.json();
          if (data.value) setReceiptFontSize(parseInt(data.value));
        }
        if (weightRes.ok) {
          const data = await weightRes.json();
          if (data.value) setReceiptFontWeight(parseInt(data.value));
        }
        if (logoRes && logoRes.ok) {
          const data = await logoRes.json();
          if (data.value) setReceiptLogo(data.value);
        }
        if (hotlineRes && hotlineRes.ok) {
          const data = await hotlineRes.json();
          if (data.value) setReceiptHotline(data.value);
        }
        if (branchesRes && branchesRes.ok) {
          const data = await branchesRes.json();
          if (data) setBranches(data);
        }
      } catch (error) {
        console.error("Failed to fetch receipt settings", error);
      }
    };
    fetchReceiptSettings();
    fetchDiscounts();
  }, []);

  const fetchDiscounts = async () => {
    try {
      const globalRes = await api.get("/api/settings/pos_global_discount");
      if (globalRes.ok) {
        const data = await globalRes.json();
        if (data.value) setGlobalDiscount(Number(data.value) || 0);
      }

      const catRes = await api.get("/api/settings/pos_category_discounts");
      if (catRes.ok) {
        const data = await catRes.json();
        if (data.value) {
          try {
            setCategoryDiscounts(JSON.parse(data.value) || {});
          } catch (e) {
            console.error("Error parsing category discounts", e);
          }
        }
      }
    } catch (error) {
      console.error("Error loading discounts", error);
    }
  };

  const getProductDiscount = (product: any) => {
    const catDiscount = categoryDiscounts[product.category_id] || 0;
    if (catDiscount > 0) return catDiscount;
    return globalDiscount || 0;
  };

  const getBranchName = () => {
    if (!order || !order.branch_id) return "الفرع الرئيسي";
    const branch = branches.find((b) => b.id === order.branch_id);
    return branch ? branch.name : "الفرع الرئيسي";
  };

  useEffect(() => {
    fetchOrderDetails();
    fetchProducts();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const [orderRes, itemsRes] = await Promise.all([
        api.get(`/api/orders/${orderId}`),
        api.get(`/api/orders/${orderId}/items`),
      ]);

      if (orderRes.ok && itemsRes.ok) {
        const orderData = await orderRes.json();
        const itemsData = await itemsRes.json();
        setOrder(orderData);
        setNotes(orderData.notes || "");
        setItems(
          (Array.isArray(itemsData) ? itemsData : []).map((item: any) => ({
            ...item,
            id: item.product_id, // Map product_id to id for consistency with POS
            selectedSize: item.size_name ? { name: item.size_name } : null,
          })),
        );
      }
    } catch (error) {
      console.error("Failed to fetch order details", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get("/api/pos/data");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        const cats = data.categories || [];
        setCategories(cats);
        if (cats.length > 0 && !selectedCategory) {
          setSelectedCategory(cats[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch products", error);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newItems = [...items];
    const newQuantity = newItems[index].quantity + delta;

    if (newQuantity <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index].quantity = newQuantity;
    }

    setItems(newItems);
  };

  const addItem = (product: any, size?: any) => {
    // If product has sizes and no size is selected yet, show modal
    if (product.sizes && product.sizes.length > 0 && !size) {
      setSelectedProductForSize(product);
      setShowSizeModal(true);
      return;
    }

    const sizeName = size?.name || null;
    const existingIndex = items.findIndex(
      (item) =>
        item.id === product.id &&
        (item.selectedSize?.name || null) === sizeName,
    );

    if (existingIndex >= 0) {
      updateQuantity(existingIndex, 1);
    } else {
      const originalPrice = size ? size.price : product.price;
      const discount = getProductDiscount(product);
      const price =
        discount > 0
          ? Math.round(originalPrice * (1 - discount / 100))
          : originalPrice;

      setItems([
        ...items,
        {
          ...product,
          price,
          originalPrice,
          quantity: 1,
          selectedSize: size,
        },
      ]);
    }
    setShowSizeModal(false);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory
        ? p.category_id === selectedCategory
        : true;
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchTerm]);

  const calculateTotal = () => {
    const itemsTotal = items.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0,
    );
    const deliveryFee = Number(order?.delivery_fee) || 0;
    const discount = Number(order?.discount) || 0;
    return Math.max(0, itemsTotal + deliveryFee - discount);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.put(`/api/orders/${orderId}`, {
        items: items,
        total: calculateTotal(),
        notes: notes,
      });

      if (response.ok) {
        onSave();
        onClose();
      } else {
        const errorData = await response.json();
        alert("فشل حفظ التعديلات: " + (errorData.error || "خطأ غير معروف"));
      }
    } catch (error) {
      console.error("Failed to save order", error);
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const printReceipt = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white p-8 rounded-2xl shadow-xl">
          <p className="text-lg font-bold text-slate-700">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50 no-print">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">
              تعديل الطلب #{orderId}
            </h2>
            <p className="text-sm text-slate-500">
              {order?.order_type === "dine_in"
                ? "صالة"
                : order?.order_type === "takeaway"
                  ? "تيك أواي"
                  : "توصيل"}
              {order?.table_number ? ` - طاولة ${order.table_number}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowReceipt(true)}
              className="p-2 bg-slate-200 hover:bg-slate-300 rounded-xl transition-colors text-slate-700"
              title="طباعة الإيصال"
            >
              <Printer className="w-6 h-6" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 rounded-xl transition-colors text-slate-500"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row no-print">
          {/* Items List */}
          <div className="flex-1 p-6 overflow-y-auto border-l border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              محتويات الطلب
            </h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200"
                >
                  <div className="flex-1 text-right">
                    <h4 className="font-bold text-slate-800">
                      {item.name}
                      {item.selectedSize && ` - ${item.selectedSize.name}`}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-purple-600">
                        {item.price} ج.م
                      </span>
                      {item.originalPrice &&
                        item.originalPrice !== item.price && (
                          <span className="text-xs text-slate-400 line-through">
                            {item.originalPrice} ج.م
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updateQuantity(idx, -1)}
                      className="p-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600"
                    >
                      {item.quantity === 1 ? (
                        <Trash2 className="w-4 h-4 text-red-500" />
                      ) : (
                        <Minus className="w-4 h-4" />
                      )}
                    </button>
                    <span className="font-bold w-8 text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(idx, 1)}
                      className="p-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="w-24 text-left font-bold text-purple-600">
                    {item.price * item.quantity} ج.م
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center p-8 text-slate-500">
                  لا توجد أصناف في الطلب
                </div>
              )}
            </div>
          </div>

          {/* Add Products */}
          <div className="w-full md:w-96 bg-slate-50 flex flex-col no-print">
            <div className="p-4 border-b border-slate-200 space-y-3">
              <h3 className="text-lg font-bold text-slate-800">إضافة أصناف</h3>

              {/* Categories */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                        : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="بحث عن صنف..."
                  value={searchTerm ?? ""}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto grid grid-cols-2 gap-3 content-start">
              {filteredProducts.map((product) => {
                const discount = getProductDiscount(product);
                const showDiscount = discount > 0;
                const finalPrice = showDiscount
                  ? Math.round(product.price * (1 - discount / 100))
                  : product.price;

                return (
                  <button
                    key={product.id}
                    onClick={() => addItem(product)}
                    className="p-3 bg-white border border-slate-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all text-right flex flex-col justify-between min-h-[100px] relative overflow-hidden group"
                  >
                    {showDiscount && (
                      <div className="absolute top-0 left-0 bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-br-lg shadow-sm">
                        -{discount}%
                      </div>
                    )}
                    <span className="font-bold text-sm text-slate-800 line-clamp-2 mt-2 leading-tight">
                      {product.name}
                    </span>
                    <div className="flex flex-col items-end gap-0.5 transition-transform group-hover:scale-105 origin-right">
                      {showDiscount && (
                        <span className="text-[10px] text-slate-400 line-through font-normal leading-none">
                          {product.price} ج.م
                        </span>
                      )}
                      <span
                        className={`text-sm font-black ${showDiscount ? "text-rose-600" : "text-purple-600"}`}
                      >
                        {finalPrice} ج.م
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          className="p-6 border-t border-slate-200 bg-white flex justify-between items-center no-print"
        >
          <div className="flex-1 ml-4">
            <input
              type="text"
              value={notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات التعديل (إجباري)..."
              className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              required
            />
          </div>
          <div className="flex flex-col items-end gap-1 ml-4">
            <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
              <div className="flex items-center gap-2">
                <span>المجموع:</span>
                <span>
                  {items.reduce(
                    (sum, item) =>
                      sum + (item.originalPrice || item.price) * item.quantity,
                    0,
                  )}{" "}
                  ج.م
                </span>
              </div>
              {items.reduce(
                (sum, item) =>
                  sum +
                  ((item.originalPrice || item.price) - item.price) *
                    item.quantity,
                0,
              ) > 0 && (
                <div className="flex items-center gap-2 text-rose-600">
                  <span>الخصم:</span>
                  <span>
                    -
                    {items.reduce(
                      (sum, item) =>
                        sum +
                        ((item.originalPrice || item.price) - item.price) *
                          item.quantity,
                      0,
                    )}{" "}
                    ج.م
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm text-slate-500">الإجمالي الجديد</p>
                <p className="text-3xl font-black text-slate-900">
                  {calculateTotal()} ج.م
                </p>
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving || items.length === 0 || !notes.trim()}
            className="flex items-center gap-2 px-8 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? "جاري الحفظ..." : "حفظ التعديلات"}</span>
          </button>
        </form>

        {/* Size Selection Modal */}
        <AnimatePresence>
          {showSizeModal && selectedProductForSize && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black text-slate-800">
                    اختر الحجم
                  </h3>
                  <button
                    onClick={() => setShowSizeModal(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-400"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <p className="text-slate-500 mb-6 font-bold">
                  {selectedProductForSize.name}
                </p>
                <div className="space-y-3">
                  {selectedProductForSize.sizes.map(
                    (size: any, idx: number) => {
                      const discount = getProductDiscount(
                        selectedProductForSize,
                      );
                      const finalPrice =
                        discount > 0
                          ? Math.round(size.price * (1 - discount / 100))
                          : size.price;
                      return (
                        <button
                          key={idx}
                          onClick={() => addItem(selectedProductForSize, size)}
                          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-purple-600 hover:text-white border border-slate-200 rounded-2xl transition-all group font-bold"
                        >
                          <span className="text-lg">{size.name}</span>
                          <div className="flex flex-col items-end">
                            {discount > 0 && (
                              <span className="text-xs opacity-60 line-through group-hover:text-white">
                                {size.price} ج.م
                              </span>
                            )}
                            <span className="text-xl font-black">
                              {finalPrice} ج.م
                            </span>
                          </div>
                        </button>
                      );
                    },
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Receipt Modal */}
        <AnimatePresence>
          {showReceipt && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className={`bg-white text-black w-full max-w-sm shadow-2xl font-mono relative receipt-content overflow-hidden ${
                  receiptTemplate === "modern"
                    ? "rounded-3xl p-0 border-4 border-slate-900"
                    : receiptTemplate === "classic"
                      ? "rounded-none p-8 border-double border-8 border-slate-200"
                      : receiptTemplate === "compact"
                        ? "rounded-none p-4 text-[10px]"
                        : receiptTemplate === "grid"
                          ? "rounded-none p-0"
                          : "rounded-none p-8"
                }`}
                style={{
                  fontSize: `${receiptFontSize}px`,
                  fontWeight: receiptFontWeight,
                }}
              >
                {receiptTemplate === "grid" ? (
                  <div className="w-full flex flex-col text-black font-sans">
                    <div className="text-center p-4">
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
                      <p className="font-bold">END</p>
                      <p className="text-4xl font-black my-1">{orderId}</p>
                      <p className="text-2xl font-black">
                        {order?.order_type === "dine_in"
                          ? "صالة"
                          : order?.order_type === "takeaway"
                            ? "تيك أواي"
                            : "توصيل"}
                      </p>
                    </div>

                    <table className="w-full border-collapse border-y border-black text-center">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="border-l border-black p-2 w-1/2">
                            {new Date().toLocaleDateString("ar-EG")}
                          </td>
                          <td className="p-2 w-1/2">
                            {new Date().toLocaleTimeString("ar-EG")}
                          </td>
                        </tr>
                        <tr className="border-b border-black text-right">
                          <td className="border-l border-black p-2 font-bold w-1/3">
                            الكاشير
                          </td>
                          <td className="p-2 w-2/3">
                            {user?.username || "كاشير"}
                          </td>
                        </tr>
                        {order?.table_number && (
                          <tr className="border-b border-black text-right">
                            <td className="border-l border-black p-2 font-bold w-1/3">
                              الطاولة
                            </td>
                            <td className="p-2 w-2/3">{order.table_number}</td>
                          </tr>
                        )}
                        {(order?.customer_name ||
                          order?.customer_phone ||
                          order?.customer_address) &&
                          (order?.order_type === "takeaway" ||
                            order?.order_type === "delivery") && (
                            <>
                              {order.customer_name && (
                                <tr className="border-b border-black text-right">
                                  <td className="border-l border-black p-2 font-bold text-xs w-1/3">
                                    العميل
                                  </td>
                                  <td className="p-2 font-bold w-2/3">
                                    {order.customer_name}
                                  </td>
                                </tr>
                              )}
                              {order.customer_phone && (
                                <tr className="border-b border-black text-right">
                                  <td className="border-l border-black p-2 font-bold text-xs w-1/3">
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
                                    <td className="border-l border-black p-2 font-bold text-xs w-1/3">
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

                    <table className="w-full border-collapse text-center">
                      <thead>
                        <tr className="bg-slate-50 border-b border-black font-bold">
                          <th className="border-l border-black p-2">الصنف</th>
                          <th className="border-l border-black p-2">سعر</th>
                          <th className="border-l border-black p-2">كمية</th>
                          <th className="p-2">إجمالي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-black">
                            <td className="border-l border-black p-2">
                              {item.name}
                              {item.selectedSize &&
                              item.selectedSize.name &&
                              item.selectedSize.name.trim() !== ""
                                ? ` - ${item.selectedSize.name}`
                                : ""}
                            </td>
                            <td className="border-l border-black p-2">
                              {item.price}
                            </td>
                            <td className="border-l border-black p-2">
                              {item.quantity}
                            </td>
                            <td className="p-2">
                              {item.price * item.quantity}
                            </td>
                          </tr>
                        ))}
                        {order?.order_type === "delivery" && (
                          <tr className="border-b border-black">
                            <td className="border-l border-black p-2">
                              خدمة التوصيل
                            </td>
                            <td className="border-l border-black p-2">
                              {order?.delivery_fee || 0}
                            </td>
                            <td className="border-l border-black p-2">1</td>
                            <td className="p-2">{order?.delivery_fee || 0}</td>
                          </tr>
                        )}
                        {order?.discount > 0 && (
                          <tr className="border-b border-black text-rose-600 font-bold bg-slate-50">
                            <td
                              colSpan={3}
                              className="border-l border-black p-2 text-right px-4"
                            >
                              قيمة الخصم
                            </td>
                            <td className="p-2">-{order.discount}</td>
                          </tr>
                        )}
                        <tr className="border-b border-black font-bold bg-slate-50">
                          <td
                            colSpan={3}
                            className="border-l border-black p-2 text-right px-4"
                          >
                            الإجمالي النهائي
                          </td>
                          <td className="p-2">{calculateTotal()}</td>
                        </tr>
                      </tbody>
                    </table>

                    {order?.notes && (
                      <div className="p-4 border-b border-black text-right text-sm">
                        <p className="font-bold mb-1">ملاحظات:</p>
                        <p>{order.notes}</p>
                      </div>
                    )}

                    <p className="text-center font-bold py-4 text-xl">نقدي</p>
                    <div className="p-4 border-t border-black text-center opacity-70 space-y-1">
                      {receiptHotline && (
                        <p className="font-bold">
                          لطلب الاوردرات الخط الساخن {receiptHotline}
                        </p>
                      )}
                      <p className="text-[10px]">Powered by : Backend</p>
                    </div>

                    <div className="mt-8 flex gap-4 no-print p-6">
                      <button
                        onClick={printReceipt}
                        className="flex-1 bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                      >
                        <Printer className="w-5 h-5" />
                        طباعة
                      </button>
                      <button
                        onClick={() => setShowReceipt(false)}
                        className="flex-1 border-2 border-black py-3 rounded-xl font-bold hover:bg-slate-50 transition-all"
                      >
                        إغلاق
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div
                      className={`${
                        receiptTemplate === "modern"
                          ? "bg-slate-900 text-white p-6 text-center"
                          : receiptTemplate === "classic"
                            ? "text-center border-b-4 border-double border-slate-900 pb-4 mb-4"
                            : receiptTemplate === "compact"
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
                          receiptTemplate === "modern"
                            ? "text-2xl"
                            : receiptTemplate === "classic"
                              ? "text-3xl font-serif"
                              : receiptTemplate === "compact"
                                ? "text-lg"
                                : "text-2xl"
                        }`}
                      >
                        {getBranchName()}
                      </h2>
                      <p className="text-xs opacity-80">فاتورة طلب طعام</p>
                      <p className="text-xs opacity-80">
                        {new Date().toLocaleString("ar-EG")}
                      </p>
                      <p
                        className={`font-bold mt-1 ${receiptTemplate === "modern" ? "bg-white/20 inline-block px-3 py-1 rounded-full" : ""}`}
                      >
                        رقم الطلب: #{orderId}
                      </p>
                      {order?.table_number && (
                        <p className="text-sm font-bold mt-1">
                          طاولة: {order.table_number}
                        </p>
                      )}
                      <p
                        className={`text-2xl font-black mt-2 ${receiptTemplate === "modern" ? "text-indigo-400" : ""}`}
                      >
                        {order?.order_type === "dine_in"
                          ? "صالة"
                          : order?.order_type === "takeaway"
                            ? "تيك أواي"
                            : "توصيل"}
                      </p>
                    </div>

                    <div
                      className={`${receiptTemplate === "modern" ? "p-6" : ""}`}
                    >
                      {(order?.customer_name || order?.customer_phone) && (
                        <div
                          className={`mb-4 text-xs border-b border-dashed border-black pb-2 ${receiptTemplate === "modern" ? "bg-slate-50 p-3 rounded-xl border-none" : ""}`}
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

                      {order?.notes && (
                        <div
                          className={`mb-4 text-xs border-b border-dashed border-black pb-2 ${receiptTemplate === "modern" ? "bg-slate-50 p-3 rounded-xl border-none" : ""}`}
                        >
                          <p>
                            <strong>ملاحظات الطلب:</strong> {order.notes}
                          </p>
                        </div>
                      )}

                      <div
                        className={`space-y-2 mb-4 ${receiptTemplate === "compact" ? "space-y-1" : ""}`}
                      >
                        <div
                          className={`flex justify-between font-bold border-b pb-1 mb-2 ${receiptTemplate === "modern" ? "text-slate-400 border-slate-100" : "border-black"}`}
                        >
                          <span>الصنف</span>
                          <span>السعر</span>
                        </div>
                        {items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between text-sm"
                          >
                            <span
                              className={
                                receiptTemplate === "compact"
                                  ? "text-[10px]"
                                  : ""
                              }
                            >
                              {item.name} x{item.quantity}
                            </span>
                            <span
                              className={
                                receiptTemplate === "compact"
                                  ? "text-[10px]"
                                  : ""
                              }
                            >
                              {item.price * item.quantity} ج.م
                            </span>
                          </div>
                        ))}
                        {order?.order_type === "delivery" && (
                          <div className="flex justify-between text-sm border-t border-dashed border-slate-200 pt-2">
                            <span
                              className={
                                receiptTemplate === "compact"
                                  ? "text-[10px]"
                                  : ""
                              }
                            >
                              خدمة التوصيل
                            </span>
                            <span
                              className={
                                receiptTemplate === "compact"
                                  ? "text-[10px]"
                                  : ""
                              }
                            >
                              {order?.delivery_fee || 0} ج.م
                            </span>
                          </div>
                        )}
                      </div>

                      <div
                        className={`border-t-2 border-dashed border-black pt-4 flex justify-between font-bold text-lg ${
                          receiptTemplate === "modern"
                            ? "border-slate-100 pt-6 mt-6"
                            : receiptTemplate === "classic"
                              ? "border-double border-t-4 border-slate-900"
                              : receiptTemplate === "compact"
                                ? "text-sm pt-2 mt-2"
                                : ""
                        }`}
                      >
                        <span>الإجمالي</span>
                        <span
                          className={
                            receiptTemplate === "modern"
                              ? "text-indigo-600"
                              : ""
                          }
                        >
                          {calculateTotal()} ج.م
                        </span>
                      </div>

                      <div
                        className={`mt-8 text-center text-xs italic opacity-60 ${receiptTemplate === "modern" ? "text-slate-400" : ""}`}
                      >
                        <p>شكراً لزيارتكم!</p>
                        {receiptHotline && (
                          <p className="mt-1 font-bold not-italic">
                            الخط الساخن: {receiptHotline}
                          </p>
                        )}
                      </div>

                      <div className="mt-8 flex gap-4 no-print">
                        <button
                          onClick={printReceipt}
                          className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                            receiptTemplate === "modern"
                              ? "bg-slate-900 text-white hover:bg-slate-800"
                              : "bg-black text-white hover:bg-slate-800"
                          }`}
                        >
                          <Printer className="w-5 h-5" />
                          طباعة
                        </button>
                        <button
                          onClick={() => setShowReceipt(false)}
                          className={`flex-1 border-2 py-3 rounded-xl font-bold transition-all ${
                            receiptTemplate === "modern"
                              ? "border-slate-200 text-slate-500 hover:bg-slate-50"
                              : "border-black text-black hover:bg-slate-50"
                          }`}
                        >
                          إغلاق
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
