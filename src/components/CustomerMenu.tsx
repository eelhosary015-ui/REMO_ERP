import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShoppingBag,
  ChevronRight,
  Search,
  Plus,
  Minus,
  X,
  Check,
  Utensils,
  Bell,
  Star,
  MessageSquare,
  Clock,
  Sparkles,
  ChevronLeft,
  Info,
  Phone,
  User,
  AlertCircle,
  ThumbsUp,
} from "lucide-react";
import { Category, Product } from "../types";
import { VoiceInputButton } from "./VoiceInputButton";

interface CustomerMenuProps {
  branchId: number;
  tableId: number;
}

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

export function CustomerMenu({ branchId, tableId }: CustomerMenuProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(true);
  const [logo, setLogo] = useState<string | null>(null);
  const [systemName, setSystemName] = useState("REMO Pro");
  const [orderStatus, setOrderStatus] = useState<
    "idle" | "submitting" | "success"
  >("idle");
  const [search, setSearch] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [waiterCalledSuccess, setWaiterCalledSuccess] = useState(false);

  const [showComplaint, setShowComplaint] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);

  const [showRating, setShowRating] = useState(false);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Custom Toast System
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    fetchMenu();
  }, [branchId]);

  const fetchMenu = async () => {
    try {
      const res = await fetch(`/api/public/menu-data?branchId=${branchId}`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        setProducts(data.products);
        if (data.logo) setLogo(data.logo);
        if (data.systemName) setSystemName(data.systemName);
        if (data.categories.length > 0)
          setActiveCategory(data.categories[0].id);
      }
    } catch (err) {
      console.error(err);
      showToast("عذراً، فشل تحميل قائمة الطعام", "error");
    } finally {
      setLoading(false);
      setTimeout(() => setShowSplash(false), 1500); // Soft, professional transition
    }
  };

  const addToCart = (
    product: Product,
    sizeName: string | null = null,
    price: number | null = null,
  ) => {
    const itemPrice = price || product.price;
    const existing = cart.find(
      (item) => item.product_id === product.id && item.size_name === sizeName,
    );

    if (existing) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id && item.size_name === sizeName
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          price: itemPrice,
          quantity: 1,
          size_name: sizeName,
        },
      ]);
    }
    showToast(`تم إضافة ${product.name} إلى السلة`);
  };

  const removeFromCart = (
    productId: number,
    sizeName: string | null = null,
  ) => {
    const existing = cart.find(
      (item) => item.product_id === productId && item.size_name === sizeName,
    );
    if (existing && existing.quantity > 1) {
      setCart(
        cart.map((item) =>
          item.product_id === productId && item.size_name === sizeName
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        ),
      );
    } else {
      const itemToRemove = cart.find(item => item.product_id === productId && item.size_name === sizeName);
      setCart(
        cart.filter(
          (item) =>
            !(item.product_id === productId && item.size_name === sizeName),
        ),
      );
      if (itemToRemove) {
        showToast(`تم حذف ${itemToRemove.product_name} من السلة`, "info");
      }
    }
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setOrderStatus("submitting");
    try {
      const res = await fetch("/api/public/web-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          table_number: tableId,
          items: cart,
          total: cartTotal,
          notes: customerNotes,
        }),
      });

      if (res.ok) {
        setOrderStatus("success");
        setCart([]);
        setCustomerNotes("");
        setShowCart(false);
        showToast("تم إرسال طلبك إلى المطبخ بنجاح!", "success");
        setTimeout(() => setOrderStatus("idle"), 5000);
      } else {
        showToast("حدث خطأ أثناء إرسال الطلب، يرجى المحاولة مرة أخرى", "error");
        setOrderStatus("idle");
      }
    } catch (err) {
      showToast("تعذر الاتصال بالخادم، تحقق من الاتصال بالإنترنت", "error");
      setOrderStatus("idle");
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      (activeCategory === null || p.category_id === activeCategory) &&
      (search === "" || p.name.toLowerCase().includes(search.toLowerCase())),
  );

  const callWaiter = async () => {
    if (isCallingWaiter) return;
    setIsCallingWaiter(true);
    try {
      const res = await fetch(`/api/public/call-waiter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch_id: branchId, table_number: tableId }),
      });
      if (res.ok) {
        setWaiterCalledSuccess(true);
        showToast("تم نداء المضيف (الويتر)، سيصلك حالاً لمساعدتك.", "success");
        setTimeout(() => setWaiterCalledSuccess(false), 5000);
      } else {
        showToast("فشل في نداء الويتر، يرجى المحاولة مرة أخرى", "error");
      }
    } catch (err) {
      showToast("حدث خطأ في الاتصال بالخادم", "error");
    } finally {
      setIsCallingWaiter(false);
    }
  };

  const submitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText) return;
    setIsSubmittingComplaint(true);
    try {
      const res = await fetch(`/api/public/submit-complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          table_number: tableId,
          customer_name: customerName,
          customer_phone: customerPhone,
          details: complaintText
        }),
      });
      if (res.ok) {
        showToast("تم إرسال الشكوى أو المقترح بنجاح. شكراً لاهتمامك!", "success");
        setShowComplaint(false);
        setComplaintText("");
        setCustomerName("");
        setCustomerPhone("");
      } else {
        showToast("حدث خطأ أثناء إرسال الشكوى", "error");
      }
    } catch (err) {
      showToast("تعذر الاتصال بالخادم", "error");
    } finally {
      setIsSubmittingComplaint(false);
    }
  };

  const submitRating = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingRating(true);
    try {
      const res = await fetch(`/api/public/submit-rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: branchId,
          table_number: tableId,
          rating: ratingValue,
          feedback: ratingFeedback
        }),
      });
      if (res.ok) {
        showToast("شكراً جزيلاً لتقييمك ومساعدتنا على تحسين جودتنا!", "success");
        setShowRating(false);
        setRatingFeedback("");
        setRatingValue(5);
      } else {
        showToast("حدث خطأ أثناء إرسال التقييم", "error");
      }
    } catch (err) {
      showToast("تعذر الاتصال بالخادم", "error");
    } finally {
      setIsSubmittingRating(false);
    }
  };

  if (orderStatus === "success") {
    return (
      <div
        className="min-h-screen bg-emerald-50/60 flex flex-col items-center justify-center p-6 text-center font-cairo"
        dir="rtl"
      >
        <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-100">
          <motion.div
            initial={{ scale: 0.5, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <Check className="w-12 h-12" />
          </motion.div>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">
          تم استلام طلبك بنجاح!
        </h1>
        <p className="text-slate-600 mb-8 max-w-xs leading-relaxed text-sm">
          أوردرك الآن قيد التحضير في المطبخ. سيقوم فريق العمل بتقديمه لك ساخناً في أقرب وقت. استمتع بتجربتك!
        </p>
        <button
          onClick={() => setOrderStatus("idle")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 text-sm"
        >
          طلب المزيد من الأصناف
        </button>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-50 font-cairo text-slate-900 pb-28 relative overflow-x-hidden"
      dir="rtl"
    >
      {/* Toast Notifications */}
      <div className="fixed top-20 left-4 right-4 z-[99] pointer-events-none flex flex-col gap-2 max-w-sm mx-auto">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-4 rounded-2xl shadow-lg border pointer-events-auto flex items-center gap-3 text-xs font-bold leading-relaxed ${
                toast.type === "success"
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-900/10"
                  : toast.type === "error"
                  ? "bg-rose-600 text-white border-rose-500 shadow-rose-900/10"
                  : "bg-slate-800 text-white border-slate-700"
              }`}
            >
              {toast.type === "success" ? (
                <ThumbsUp className="w-4 h-4 shrink-0" />
              ) : toast.type === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0" />
              ) : (
                <Info className="w-4 h-4 shrink-0" />
              )}
              <span className="flex-1">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {(loading || showSplash) && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
          >
            {logo ? (
              <motion.img
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                src={logo}
                alt={systemName}
                className="w-36 max-w-full h-auto object-contain mb-6"
              />
            ) : (
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-black mb-6 shadow-lg shadow-blue-500/20">
                <Utensils className="w-8 h-8" />
              </div>
            )}
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <h2 className="text-base font-bold text-slate-800 tracking-wide animate-pulse">
                جاري إعداد قائمة الطعام...
              </h2>
              <p className="text-xs text-slate-400 mt-1">خدمة ذاتية ذكية وآمنة</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header & Brand Section */}
      <div className="bg-gradient-to-b from-blue-900 to-slate-900 text-white pb-24 pt-6 px-4 rounded-b-[40px] relative shadow-lg">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-800/20 via-transparent to-transparent pointer-events-none rounded-b-[40px]"></div>
        
        {/* Top actions & Brand identity */}
        <div className="flex justify-between items-center relative z-10 mb-4">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="Logo" className="w-10 h-10 rounded-full object-contain bg-white/10 p-1 border border-white/15" />
            ) : (
              <div className="w-10 h-10 bg-white/15 rounded-full flex items-center justify-center border border-white/20">
                <Utensils className="w-5 h-5 text-white" />
              </div>
            )}
            <div>
              <h1 className="font-black text-sm tracking-wide">{systemName}</h1>
              <div className="flex items-center gap-1 bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[10px] w-fit border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                مفتوح حالياً
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRating(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 text-amber-400 border border-white/10 transition-all active:scale-95"
              title="تقييم الطعام والخدمة"
            >
              <Star className="w-4 h-4 fill-current" />
            </button>
            <button
              onClick={() => setShowComplaint(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/15 text-rose-300 border border-white/10 transition-all active:scale-95"
              title="تقديم شكوى أو مقترح"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={callWaiter}
              disabled={isCallingWaiter || waiterCalledSuccess}
              className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all border active:scale-95 ${
                waiterCalledSuccess
                  ? "bg-emerald-500 text-white border-emerald-400"
                  : "bg-white/10 text-white border-white/10 hover:bg-white/15"
              }`}
              title="نداء الويتر"
            >
              <Bell className={`w-4 h-4 ${waiterCalledSuccess ? "animate-bounce" : ""}`} />
            </button>
          </div>
        </div>

        {/* Table indicator and fast stats */}
        <div className="flex justify-between items-end mt-4 relative z-10">
          <div>
            <span className="text-[10px] text-blue-200/80 font-bold block mb-1">أهلاً بك في طاولتك</span>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black tracking-tight text-white">طاولة {tableId}</span>
              <span className="bg-blue-600/50 border border-blue-500/50 text-blue-200 text-[10px] font-black px-2.5 py-0.5 rounded-lg">
                طلب ذاتي مباشر
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="bg-white text-slate-900 rounded-2xl px-4 py-2.5 flex items-center gap-2.5 font-extrabold shadow-lg shadow-black/10 text-xs hover:bg-slate-50 transition active:scale-95 border border-white/20"
          >
            <ShoppingBag className="w-4 h-4 text-blue-600" />
            <span>السلة</span>
            {cart.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Sticky Quick Actions Bar & Search (Overlaps the gradient curve) */}
      <div className="px-4 -mt-10 relative z-20">
        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/50 space-y-3">
          {/* Search Box */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
              <input
                type="text"
                placeholder="ابحث عن وجبتك المفضلة أو مشروبك..."
                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 pr-10 pl-10 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all placeholder-slate-400"
                value={search ?? ""}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <VoiceInputButton
              onTranscript={(text) => setSearch(text)}
              className="py-3 px-3.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Category Slider - Smooth Minimalist horizontal layout */}
      <div className="mt-6 px-4 overflow-x-auto no-scrollbar w-full" style={{ scrollbarWidth: "none" }}>
        <div className="flex gap-2 pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-xs transition-all ${
                activeCategory === cat.id
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/10 scale-102"
                  : "bg-white text-slate-600 border border-slate-100 hover:bg-slate-50 shadow-xs"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <main className="px-4 mt-4 w-full grid gap-4 grid-cols-1">
        <AnimatePresence mode="popLayout">
          {filteredProducts.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white py-12 px-6 rounded-3xl border border-slate-100 shadow-sm text-center"
            >
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Utensils className="w-6 h-6" />
              </div>
              <p className="text-slate-500 font-bold text-xs">لا توجد وجبات تطابق بحثك حالياً</p>
              <button
                onClick={() => { setSearch(""); setActiveCategory(categories[0]?.id || null); }}
                className="text-blue-600 text-xs font-black mt-2 underline"
              >
                إظهار جميع الأصناف
              </button>
            </motion.div>
          ) : (
            filteredProducts.map((product) => {
              const itemInCart = cart.filter(item => item.product_id === product.id);
              const totalQty = itemInCart.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <motion.div
                  key={product.id}
                  layoutId={`product-card-${product.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100/60 flex gap-3.5 items-center relative hover:shadow-md transition-all duration-300"
                >
                  {totalQty > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-black w-5.5 h-5.5 rounded-full flex items-center justify-center shadow border-2 border-white">
                      {totalQty}
                    </div>
                  )}

                  {/* Product Image with gradient overlay / fallback */}
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-50 border border-slate-100 flex items-center justify-center">
                    {product.image ? (
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-slate-300">
                        <Utensils className="w-7 h-7" />
                      </div>
                    )}
                    {product.preparation_time && (
                      <div className="absolute bottom-1 right-1 bg-black/65 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 backdrop-blur-xs">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{product.preparation_time} د</span>
                      </div>
                    )}
                  </div>

                  {/* Product Details & Actions */}
                  <div className="flex-grow min-w-0 flex flex-col justify-between h-20">
                    <div>
                      <h3 className="font-bold text-slate-800 text-xs truncate leading-snug">
                        {product.name}
                      </h3>
                      {product.properties?.description ? (
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 leading-relaxed font-semibold">
                          {product.properties.description}
                        </p>
                      ) : (
                        <span className="text-[9px] text-slate-400 mt-0.5 font-bold block">
                          طازج ويحضر يدوياً فور الطلب
                        </span>
                      )}
                    </div>

                    {/* Pricing / Sizes & Adding */}
                    {!product.sizes || product.sizes.length === 0 ? (
                      <div className="flex justify-between items-center gap-2 mt-1">
                        <span className="font-black text-sm text-slate-900 shrink-0">
                          {product.price} <span className="text-[10px] font-bold text-slate-500">ج.م</span>
                        </span>
                        
                        {/* Direct count modifiers if item is already in cart for easy UX */}
                        {totalQty > 0 ? (
                          <div className="flex items-center gap-2.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 shrink-0">
                            <button
                              onClick={() => removeFromCart(product.id)}
                              className="text-red-500 active:scale-90 transition p-0.5"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="font-black text-xs text-slate-800 min-w-[12px] text-center">
                              {totalQty}
                            </span>
                            <button
                              onClick={() => addToCart(product)}
                              className="text-emerald-500 active:scale-90 transition p-0.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 text-[10px] font-black px-3.5 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-xs border border-blue-100 active:scale-95"
                          >
                            <span>إضافة</span>
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-between items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-500 font-extrabold shrink-0">
                          أحجام متعددة
                        </span>
                        <div className="flex gap-1 overflow-x-auto max-w-[150px] no-scrollbar">
                          {product.sizes.map((size) => {
                            const sizeQtyInCart = cart.find(
                              (item) => item.product_id === product.id && item.size_name === size.name
                            )?.quantity || 0;

                            return (
                              <button
                                key={size.id}
                                onClick={() => addToCart(product, size.name, size.price)}
                                className={`px-2 py-1 rounded-md text-[9px] font-bold shrink-0 border transition-all active:scale-95 flex items-center gap-1 ${
                                  sizeQtyInCart > 0
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100"
                                }`}
                              >
                                <span>{size.name}</span>
                                <span className="font-black opacity-80">{size.price}ج</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </main>

      {/* Floating Order Summary Banner (Fixed Bottom) */}
      {cart.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40 max-w-sm mx-auto">
          <button
            onClick={() => setShowCart(true)}
            className="w-full bg-blue-600 text-white rounded-2xl p-4 flex justify-between items-center shadow-2xl shadow-blue-600/30 font-bold active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm">
                <ShoppingBag className="w-4 h-4 text-white" />
              </div>
              <div className="text-right">
                <span className="text-xs font-black block leading-none mb-0.5">سلتك الحالية</span>
                <span className="text-[10px] text-blue-200 block font-semibold">
                  {cart.reduce((s, i) => s + i.quantity, 0)} أصناف مضافة
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1.5 rounded-xl border border-white/10">
              <span className="text-sm font-black">{cartTotal.toFixed(2)} ج.م</span>
              <ChevronLeft className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Cart Modal (Slide-up iOS style sheet) */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-50 overflow-hidden font-cairo" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCart(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="absolute bottom-0 left-0 right-0 max-h-[88vh] bg-white rounded-t-[36px] overflow-hidden flex flex-col shadow-2xl"
            >
              {/* Slide sheet drag handle */}
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3.5 shrink-0"></div>

              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-lg font-black text-slate-900">سلة المشتريات</h2>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-bold">طاولة {tableId} • المطبخ مباشر</p>
                </div>
                <button
                  onClick={() => setShowCart(false)}
                  className="w-8 h-8 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-full flex items-center justify-center transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Cart Items List */}
              <div className="p-6 flex-grow overflow-y-auto space-y-4 custom-scrollbar">
                {cart.length === 0 ? (
                  <div className="text-center py-16 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3 text-slate-300">
                      <ShoppingBag className="w-8 h-8" />
                    </div>
                    <p className="text-slate-400 font-bold text-xs">سلتك فارغة، تصفح المنيو وأضف وجباتك</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {cart.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center bg-slate-50 border border-slate-100/50 p-3.5 rounded-2xl shadow-xs"
                        >
                          <div className="min-w-0 flex-1 pl-3">
                            <h4 className="font-bold text-slate-800 text-xs truncate leading-snug">
                              {item.product_name}
                            </h4>
                            <span className="text-[10px] text-slate-500 font-bold mt-0.5 block">
                              {item.size_name ? `حجم ${item.size_name}` : "سعر أساسي"} • {item.price} ج.م
                            </span>
                          </div>
                          <div className="flex items-center gap-3.5 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs shrink-0">
                            <button
                              onClick={() =>
                                removeFromCart(item.product_id, item.size_name)
                              }
                              className="text-red-500 p-0.5 active:scale-90 transition"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-black text-xs text-slate-800 min-w-[16px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                addToCart(
                                  {
                                    id: item.product_id,
                                    name: item.product_name,
                                    price: item.price,
                                  } as any,
                                  item.size_name,
                                  item.price,
                                )
                              }
                              className="text-emerald-500 p-0.5 active:scale-90 transition"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2">
                      <label className="block text-xs font-bold text-slate-700 mb-2">
                        ملاحظات أو تعديلات خاصة على الأطباق:
                      </label>
                      <textarea
                        value={customerNotes ?? ""}
                        onChange={(e) => setCustomerNotes(e.target.value)}
                        placeholder="مثلاً: بدون بصل، زيادة شطة، الصوص خارجي..."
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3.5 text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none resize-none h-20 transition-all font-semibold"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Bottom total and submit order buttons */}
              <div className="p-6 bg-slate-50 border-t border-slate-200/60 space-y-4 shrink-0">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-slate-500">
                    الحساب الإجمالي التقريبي:
                  </span>
                  <span className="text-xl font-black text-slate-900 tracking-tight">
                    {cartTotal.toFixed(2)} <span className="text-xs font-bold text-slate-600">ج.م</span>
                  </span>
                </div>
                <button
                  disabled={cart.length === 0 || orderStatus === "submitting"}
                  onClick={submitOrder}
                  className="w-full bg-blue-600 disabled:bg-slate-300 text-white rounded-2xl py-3.5 font-black text-xs shadow-lg shadow-blue-600/10 hover:bg-blue-700 transition active:scale-98 relative flex items-center justify-center gap-2"
                >
                  {orderStatus === "submitting" ? (
                    <>
                      <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>جاري إرسال الطلب للمطبخ...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>تأكيد وإرسال أوردر طاولة {tableId}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Service Rating Sheet */}
      <AnimatePresence>
        {showRating && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRating(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="absolute bottom-0 sm:bottom-auto sm:relative left-0 right-0 max-h-[88vh] bg-white rounded-t-[36px] sm:rounded-3xl overflow-hidden flex flex-col w-full sm:max-w-md sm:mx-auto shadow-2xl"
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3.5 shrink-0"></div>

              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                    <Star className="w-4 h-4 fill-current animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-amber-900">تقييم الوجبات والخدمة</h2>
                    <p className="text-[10px] text-amber-700 font-bold">ملاحظاتك تساعدنا على تقديم جودة أفضل</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRating(false)}
                  className="w-8 h-8 bg-white text-slate-500 rounded-full flex items-center justify-center shadow-sm border border-slate-100"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={submitRating} className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center justify-center space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-slate-600 text-xs font-bold mb-1">ما هو تقييمك لتجربتك اليوم؟</p>
                  <div className="flex gap-2 flex-row-reverse">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingValue(star)}
                        className="focus:outline-none transition-transform hover:scale-115 active:scale-90"
                      >
                        <Star className={`w-10 h-10 transition-colors ${ratingValue >= star ? "text-amber-400 fill-current" : "text-slate-200"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">اكتب تعليقك أو مقترحاتك (اختياري)</label>
                  <textarea
                    value={ratingFeedback ?? ""}
                    onChange={(e) => setRatingFeedback(e.target.value)}
                    placeholder="رأيك في جودة الأكل، النظافة، سرعة تقديم الطلبات..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none resize-none h-24 transition-all font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingRating}
                  className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-2xl py-3.5 font-black text-xs shadow-lg shadow-amber-500/10 active:scale-98 transition flex items-center justify-center gap-1.5"
                >
                  {isSubmittingRating ? (
                    <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <ThumbsUp className="w-4 h-4" />
                      <span>إرسال التقييم بأمان</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complaint or Suggestion Sheet */}
      <AnimatePresence>
        {showComplaint && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComplaint(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="absolute bottom-0 sm:bottom-auto sm:relative left-0 right-0 max-h-[88vh] bg-white rounded-t-[36px] sm:rounded-3xl overflow-hidden flex flex-col w-full sm:max-w-md sm:mx-auto shadow-2xl"
            >
              <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mt-3.5 shrink-0"></div>

              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-rose-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-rose-950">إرسال شكوى أو مقترح مباشر</h2>
                    <p className="text-[10px] text-rose-700 font-bold">تصل فوراً لمدير الفرع وبسرية تامة</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowComplaint(false)}
                  className="w-8 h-8 bg-white text-slate-500 rounded-full flex items-center justify-center shadow-sm border border-slate-100"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <form onSubmit={submitComplaint} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" /> الاسم (اختياري)
                    </label>
                    <input
                      type="text"
                      value={customerName ?? ""}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="اسمك الكريم"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> الجوال (اختياري)
                    </label>
                    <input
                      type="tel"
                      value={customerPhone ?? ""}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      dir="ltr"
                      placeholder="05xxxxxx"
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none text-right transition-all font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    تفاصيل الشكوى أو المقترح <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={complaintText ?? ""}
                    onChange={(e) => setComplaintText(e.target.value)}
                    required
                    placeholder="نعتذر بشدة عن أي تقصير. اكتب لنا المشكلة بالتفصيل لنقوم باتخاذ اللازم مع طاقم العمل فوراً..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none resize-none h-28 transition-all font-semibold"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingComplaint || !complaintText}
                  className="w-full bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-2xl py-3.5 font-black text-xs shadow-lg shadow-rose-600/10 active:scale-98 transition flex items-center justify-center gap-1.5"
                >
                  {isSubmittingComplaint ? (
                    <div className="w-4.5 h-4.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>إرسال للإدارة فوراً</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

