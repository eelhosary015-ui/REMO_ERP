import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  Package,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Scale,
  Edit3,
  ChevronDown,
  Check,
  UserPlus,
  Receipt,
  Clock,
  ArrowRight,
  Printer,
  X,
  CreditCard,
  CheckCircle2,
  DollarSign,
  Heart,
  Grid,
  List,
  Coffee,
  Utensils,
  Apple,
  Milk,
  Drumstick,
  Droplet,
  Sparkles,
  MoreHorizontal,
  FolderOpen,
  Flame,
  Pause,
  RotateCcw,
  Percent,
  LayoutGrid,
  Settings2,
  Store,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Tag,
  Layers,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  User,
  UserCheck,
  Building2,
  Star,
  ArrowUpDown,
  Save
} from "lucide-react";
import { Product, Category, CartItem, Branch, POSMode } from "../types";
import { api } from "../utils/api";
import { VoiceInputButton } from "./VoiceInputButton";
import { POSReceiptModal } from "./POSReceiptModal";
import { POSShiftManagement } from "./POSShiftManagement";
import { POSVoidManagement } from "./POSVoidManagement";
import { CallCenterDashboard } from "./CallCenterDashboard";
import { CallCenterVoip } from "./CallCenterVoip";
import { OrderEditorModal } from "./OrderEditorModal";
import {
  DEFAULT_POS_CONFIGURATION,
  parsePOSConfiguration,
  POS_BUILT_IN_SCREEN_DESIGNS,
  POS_BUSINESS_PROFILES,
  POS_SETTINGS_KEY,
  type POSConfiguration,
  type POSOrderType,
  type POSPaymentMethod,
  type POSScreenDesignPreset,
  type POSScreenDesignStyle
} from "../utils/posSettings";

// Sound effect helper (shared singleton to prevent AudioContext exhaustion)
let sharedAudioContext: AudioContext | null = null;
const getSharedAudioContext = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioContext || sharedAudioContext.state === "closed") {
      sharedAudioContext = new AudioCtx();
    }
    if (sharedAudioContext.state === "suspended") {
      sharedAudioContext.resume().catch(() => {});
    }
    return sharedAudioContext;
  } catch (_) {
    return null;
  }
};

const playBeep = () => {
  try {
    const context = getSharedAudioContext();
    if (!context) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);
    osc.frequency.setValueAtTime(800, context.currentTime);
    gain.gain.setValueAtTime(0.04, context.currentTime);
    osc.start();
    osc.stop(context.currentTime + 0.08);
  } catch (e) {
    // Ignore audio errors
  }
};

const playSuccessSound = () => {
  try {
    const context = getSharedAudioContext();
    if (!context) return;
    const now = context.currentTime;
    
    // Low-to-high double beep for success
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    osc1.connect(gain1);
    gain1.connect(context.destination);
    osc1.frequency.setValueAtTime(600, now);
    gain1.gain.setValueAtTime(0.04, now);
    osc1.start(now);
    osc1.stop(now + 0.1);

    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    osc2.connect(gain2);
    gain2.connect(context.destination);
    osc2.frequency.setValueAtTime(900, now + 0.12);
    gain2.gain.setValueAtTime(0.04, now + 0.12);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.25);
  } catch (e) {
    // Ignore
  }
};

interface POSProps {
  selectedBranch: Branch | null;
  branches: Branch[];
  posMode: POSMode;
  initialCategories?: Category[];
  initialProducts?: Product[];
  onBack: () => void;
  onOrderSuccess: () => void;
  subView?: string;
  onOpenShifts?: () => void;
  onExitShifts?: () => void;
  onOpenVoid?: () => void;
  onExitVoid?: () => void;
}

// Beautiful static fallback categories to match the user's requested layout exactly

// Beautiful static fallback products matching the screenshot exactly

// Map Category ID to beautiful Lucide icons
const getCategoryIcon = (catId: number, catName: string) => {
  const name = catName.toLowerCase();
  if (name.includes("مشروب") || name.includes("عصير") || name.includes("drink") || name.includes("beverage")) {
    return <Coffee className="w-5 h-5" />;
  }
  if (name.includes("غذاء") || name.includes("طعام") || name.includes("أرز") || name.includes("مكرونة") || name.includes("food") || name.includes("grocery")) {
    return <Utensils className="w-5 h-5" />;
  }
  if (name.includes("خضار") || name.includes("فواكه") || name.includes("veg")) {
    return <Apple className="w-5 h-5" />;
  }
  if (name.includes("ألبان") || name.includes("حليب") || name.includes("جبن") || name.includes("dairy")) {
    return <Milk className="w-5 h-5" />;
  }
  if (name.includes("لحوم") || name.includes("دواجن") || name.includes("جزارة") || name.includes("meat")) {
    return <Drumstick className="w-5 h-5" />;
  }
  if (name.includes("منظف") || name.includes("صابون") || name.includes("clean")) {
    return <Droplet className="w-5 h-5" />;
  }
  if (name.includes("عناية") || name.includes("شامبو") || name.includes("care")) {
    return <Sparkles className="w-5 h-5" />;
  }
  return <MoreHorizontal className="w-5 h-5" />;
};


const orderTypeLabels: Record<POSOrderType, string> = {
  "WALK-IN": "بيع مباشر",
  "DELIVERY": "دليفري",
  "PICK UP": "استلام",
  "MEMBERSHIP": "عضوية",
  "DINE-IN": "صالة",
  "TAKEAWAY": "تيك أواي",
  "EXCHANGE": "استبدال"
};

const orderTypeApiMap: Record<POSOrderType, string> = {
  "WALK-IN": "dine_in",
  "DELIVERY": "delivery",
  "PICK UP": "takeaway",
  "MEMBERSHIP": "membership",
  "DINE-IN": "dine_in",
  "TAKEAWAY": "takeaway",
  "EXCHANGE": "exchange"
};

const paymentMethodLabels: Record<POSPaymentMethod, { ar: string; en: string }> = {
  cash: { ar: "كاش", en: "Cash" },
  visa: { ar: "فيزا", en: "Visa" },
  mastercard: { ar: "ماستر", en: "Master" },
  instapay: { ar: "إنستا", en: "Instapay" },
  wallet: { ar: "محفظة", en: "Wallet" },
  credit: { ar: "آجل", en: "Credit" },
  mixed: { ar: "مختلط", en: "Mixed" }
};

const getProductGridClass = (productsPerRow: number) => {
  const cols = Math.min(Math.max(productsPerRow || 5, 2), 8);
  const largeCols: Record<number, string> = {
    2: "xl:grid-cols-2 2xl:grid-cols-2",
    3: "xl:grid-cols-3 2xl:grid-cols-3",
    4: "xl:grid-cols-4 2xl:grid-cols-4",
    5: "xl:grid-cols-4 2xl:grid-cols-5",
    6: "xl:grid-cols-5 2xl:grid-cols-6",
    7: "xl:grid-cols-6 2xl:grid-cols-7",
    8: "xl:grid-cols-6 2xl:grid-cols-8"
  };
  return `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${largeCols[cols] || largeCols[5]} gap-4`;
};

// Isolate live clock to avoid re-rendering entire POS tree every second
const POSLiveClock: React.FC<{ theme: POSScreenDesignStyle }> = React.memo(({ theme }) => {
  const [timeStr, setTimeStr] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeStr(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <span className={`hidden sm:inline-block text-xs font-mono font-bold ${
      theme === "neobrutalist"
        ? "text-black"
        : theme === "dark-emerald"
          ? "text-emerald-300"
          : "text-slate-500"
    }`}>
      {timeStr}
    </span>
  );
});

export const POS: React.FC<POSProps> = ({
  selectedBranch,
  branches,
  posMode,
  initialCategories = [],
  initialProducts = [],
  onBack,
  onOrderSuccess,
  subView,
  onOpenShifts,
  onExitShifts,
  onOpenVoid,
  onExitVoid
}) => {
  // Get cashier name from localStorage
  const [cashierName, setCashierName] = useState("كاشير");
  const [posTheme, setPosTheme] = useState<POSScreenDesignStyle>(() => {
    return (localStorage.getItem("pos_theme") as POSScreenDesignStyle) || "standard";
  });
  const [activeDesignId, setActiveDesignId] = useState<string>(() => {
    return localStorage.getItem("pos_design_id") || "standard";
  });

  // Lifecycle guards & memory cleanup
  const isMountedRef = useRef(true);
  const activeTimersRef = useRef<NodeJS.Timeout[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // إزالة الشريط الأبيض أسفل الشاشة: خلفية الصفحة بلون شريط الحالة.
  // يجب أن يبقى قبل أي return مبكر (شاشات الورديات/Void) وإلا اختلف عدد الـhooks بين الرندرات.
  useEffect(() => {
    document.body.classList.add("pos-page");
    window.scrollTo(0, 0);
    return () => document.body.classList.remove("pos-page");
  }, []);

  const safeSetTimeout = (callback: () => void, delayMs: number) => {
    const timerId = setTimeout(() => {
      activeTimersRef.current = activeTimersRef.current.filter((id) => id !== timerId);
      if (isMountedRef.current) {
        callback();
      }
    }, delayMs);
    activeTimersRef.current.push(timerId);
    return timerId;
  };

  useEffect(() => {
    isMountedRef.current = true;
    abortControllerRef.current = new AbortController();

    return () => {
      isMountedRef.current = false;
      // Clear all active timers on unmount
      activeTimersRef.current.forEach(clearTimeout);
      activeTimersRef.current = [];
      // Abort any ongoing network requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSafeBack = () => {
    try {
      activeTimersRef.current.forEach(clearTimeout);
      activeTimersRef.current = [];
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      onBack();
    } catch (err) {
      console.error("Error navigating back from POS:", err);
      onBack();
    }
  };

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.username) setCashierName(user.username);
        else if (user.name) setCashierName(user.name);
      }
    } catch {}
  }, []);
  // Core states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");
  const [orderType, setOrderType] = useState<POSOrderType>(DEFAULT_POS_CONFIGURATION.salesFlow.defaultOrderType);
    const [posConfig, setPosConfig] = useState<POSConfiguration>(DEFAULT_POS_CONFIGURATION);
    const [posConfigLoaded, setPosConfigLoaded] = useState(false);
    const [currentTerminalId, setCurrentTerminalId] = useState("POS-01");
    const [activePOSShift, setActivePOSShift] = useState<any>(null);
    const [shiftLoading, setShiftLoading] = useState(false);
  
  // Custom screen display features matching screenshot
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [workspaceTab, setWorkspaceTab] = useState<"categories" | "favorites" | "most_selling" | "recent">("categories");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedUnit, setSelectedUnit] = useState<string>("all");
  const [posMobileTab, setPosMobileTab] = useState<"products" | "cart">("products");

  // Dynamic invoice number
  const [invoiceNumber, setInvoiceNumber] = useState("INV-100254");

  useEffect(() => {
    // Generate a fresh invoice number on load
    const rand = Math.floor(100000 + Math.random() * 900000);
    setInvoiceNumber(`INV-${rand}`);
  }, []);

  // Cash drawer status simulation
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState(false);
  
  // Modals and selections
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "", email: "", address: "" });
  // ─── شاشة اختيار عميل الفاتورة (تصميم المرجع) ───
  const [customerModalTab, setCustomerModalTab] = useState<"new" | "list">("new");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState<"all" | "individual" | "company" | "vip">("all");
  const [customerSort, setCustomerSort] = useState<"newest" | "oldest" | "name" | "spent">("newest");
  const [customerPage, setCustomerPage] = useState(1);

  const customerKindOf = (c: any): "company" | "individual" => {
    const name = String(c?.name || "");
    const looksLikeCompany =
      Boolean(c?.company_id) ||
      /(شركة|مؤسسة|مكتب|مطعم|مركز|مجموعة|مصنع|فندق|محل|كافيه|كوفي)/.test(name);
    return looksLikeCompany ? "company" : "individual";
  };
  const isVipCustomer = (c: any) =>
    Number(c?.total_spent || 0) >= 5000 || Number(c?.total_orders || 0) >= 20;

  const filteredCustomerList = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    let list: any[] = Array.isArray(customers) ? [...customers] : [];
    if (q) {
      list = list.filter((c: any) =>
        [c?.name, c?.phone, c?.phone_2, c?.email, c?.address]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
    }
    if (customerFilter === "individual") list = list.filter((c: any) => customerKindOf(c) === "individual");
    if (customerFilter === "company") list = list.filter((c: any) => customerKindOf(c) === "company");
    if (customerFilter === "vip") list = list.filter((c: any) => isVipCustomer(c));
    list.sort((a: any, b: any) => {
      if (customerSort === "name") return String(a?.name || "").localeCompare(String(b?.name || ""), "ar");
      if (customerSort === "spent") return Number(b?.total_spent || 0) - Number(a?.total_spent || 0);
      const aTime = new Date(a?.created_at || a?.last_order_date || 0).getTime() || Number(a?.id) || 0;
      const bTime = new Date(b?.created_at || b?.last_order_date || 0).getTime() || Number(b?.id) || 0;
      return customerSort === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return list;
  }, [customers, customerSearch, customerFilter, customerSort]);

  const CUSTOMER_PAGE_SIZE = 6;
  const customerPageCount = Math.max(1, Math.ceil(filteredCustomerList.length / CUSTOMER_PAGE_SIZE));
  const customerPageSafe = Math.min(customerPage, customerPageCount);
  const pagedCustomerList = filteredCustomerList.slice(
    (customerPageSafe - 1) * CUSTOMER_PAGE_SIZE,
    customerPageSafe * CUSTOMER_PAGE_SIZE
  );
  const customerAvatarClass = (c: any) => {
    const palette = [
      "bg-[#e7eefc] text-[#1d4ed8]",
      "bg-[#e6f7ef] text-[#0f7b57]",
      "bg-[#f3ecff] text-[#7c3aed]",
      "bg-[#fff0e6] text-[#c2410c]",
      "bg-[#e6f6fb] text-[#0e7490]",
      "bg-[#fdecf1] text-[#be123c]",
    ];
    return palette[Math.abs(Number(c?.id) || 0) % palette.length];
  };
  const customerInitial = (c: any) => String(c?.name || "").trim().charAt(0) || "؟";

  useEffect(() => {
    setCustomerPage(1);
  }, [customerSearch, customerFilter, customerSort]);
  
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [appliedDiscount, setAppliedDiscount] = useState<{ type: "percent" | "amount"; value: number } | null>(null);

  const [showHoldInvoicesModal, setShowHoldInvoicesModal] = useState(false);
  const [holdInvoices, setHoldInvoices] = useState<{ id: string; timestamp: Date; items: CartItem[]; customer: any | null }[]>([]);

  // Barcode Lookup Simulator
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // Cart item notes & general invoice note
  const [selectedCartItemIndex, setSelectedCartItemIndex] = useState<number | null>(null);
  const [itemNotes, setItemNotes] = useState<{ [key: number]: string }>({});
  const [showInvoiceNoteModal, setShowInvoiceNoteModal] = useState(false);
  const [invoiceNote, setInvoiceNote] = useState("");

  // Numpad Buffer and Mode
  const [numpadMode, setNumpadMode] = useState<"qty" | "amount">("qty");
  const [amountPaidBuffer, setAmountPaidBuffer] = useState<string>("");
  const [quantityBuffer, setQuantityBuffer] = useState<string>("");

  const [checkoutStatus, setCheckoutStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message?: string; orderId?: number; warnings?: string[] }>({ type: "idle" });
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);

  // Receipt preview/print modal — always renders the template chosen in POS settings
  const [receiptPreview, setReceiptPreview] = useState<{ orderId: number; autoPrint: boolean } | null>(null);

  // POS Void (استرجاع / تعديل / إلغاء أوردر) states
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidOrders, setVoidOrders] = useState<any[]>([]);
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidSearch, setVoidSearch] = useState("");
  const [voidDate, setVoidDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [voidEditingOrderId, setVoidEditingOrderId] = useState<number | null>(null);
  const [voidCancelConfirmOrder, setVoidCancelConfirmOrder] = useState<any | null>(null);
  const [voidCancelReason, setVoidCancelReason] = useState("");
  const [voidActionLoading, setVoidActionLoading] = useState(false);
  const [voidFeedback, setVoidFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // قناة نقطة البيع: كاشير مباشر أو كول سنتر — تُستخدم لتحديد مصدر الأوردر
  // (source) ولفلترة شاشات الفود والتقارير حسب القناة.
  const isCallCenter = posMode?.type === "call_center";

  const fetchVoidOrders = async (searchVal = voidSearch, dateVal = voidDate) => {
    setVoidLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch?.id) params.append("branchId", String(selectedBranch.id));
      if (searchVal.trim()) params.append("search", searchVal.trim());
      if (dateVal) params.append("date", dateVal);
      // كول سنتر: يعرض أوردرات الكول سنتر فقط، والكاشير المباشر: أوردرات نقطة البيع فقط
      params.append("source", isCallCenter ? "call_center" : "pos");
      const res = await api.get(`/api/pos/orders-for-void?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setVoidOrders(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Failed to fetch void orders:", error);
    } finally {
      setVoidLoading(false);
    }
  };

  const handleOpenVoidModal = () => {
    playBeep();
    setVoidFeedback(null);
    setShowVoidModal(true);
    fetchVoidOrders(voidSearch, voidDate);
  };

  const handleConfirmVoidCancel = async () => {
    if (!voidCancelConfirmOrder) return;
    if (!voidCancelReason.trim()) {
      setVoidFeedback({ type: "error", message: "يرجى كتابة سبب استرجاع / إلغاء الأوردر (Void)" });
      return;
    }
    setVoidActionLoading(true);
    setVoidFeedback(null);
    try {
      const res = await api.post(`/api/orders/${voidCancelConfirmOrder.id}/cancel`, {
        notes: voidCancelReason.trim(),
        scope: isCallCenter ? "call_center" : "pos"
      });
      if (res.ok) {
        playSuccessSound();
        setVoidFeedback({
          type: "success",
          message: `تم استرجاع وإلغاء الأوردر #${voidCancelConfirmOrder.id} بنجاح، وتم إرجاع المنتجات للمخزن وتسجيل حركة الصرف بالخزينة وإصدار قيد الإلغاء العكسي بالحسابات العامة وحفظه في تقارير الأوردرات الملغاة.`
        });
        setVoidCancelConfirmOrder(null);
        setVoidCancelReason("");
        fetchVoidOrders(voidSearch, voidDate);
        onOrderSuccess();
      } else {
        const err = await res.json().catch(() => ({}));
        setVoidFeedback({ type: "error", message: err?.error || "فشل استرجاع / إلغاء الأوردر" });
      }
    } catch (error: any) {
      setVoidFeedback({ type: "error", message: error?.message || "حدث خطأ أثناء إلغاء الأوردر" });
    } finally {
      setVoidActionLoading(false);
    }
  };

  useEffect(() => {
    const pendingSource = sessionStorage.getItem("erp.pending-sale-source");
    if (!pendingSource) return;
    try {
      const source = JSON.parse(pendingSource);
      const orderId = Number(source.sourceId);
      if (String(source.sourceType || "").toLowerCase().includes("pos") && Number.isInteger(orderId) && orderId > 0) {
        setReceiptPreview({ orderId, autoPrint: false });
      }
      sessionStorage.removeItem("erp.pending-sale-source");
    } catch (error) {
      console.warn("تعذر فتح مصدر قيد نقطة البيع:", error);
      sessionStorage.removeItem("erp.pending-sale-source");
    }
  }, []);

  const [selectedSubcategoryFilter, setSelectedSubcategoryFilter] = useState<string>("all");

  useEffect(() => {
    setSelectedSubcategoryFilter("all");
  }, [selectedCategoryFilter]);

  const allScreenDesigns = useMemo(() => [
    ...POS_BUILT_IN_SCREEN_DESIGNS,
    ...(posConfig.screen.customDesigns || [])
  ], [posConfig.screen.customDesigns]);

  const activeScreenDesign: POSScreenDesignPreset = useMemo(() => {
    const found = allScreenDesigns.find((d) => d.id === activeDesignId)
      || allScreenDesigns.find((d) => d.id === posConfig.screen.activeDesignId)
      || allScreenDesigns.find((d) => d.style === posTheme)
      || POS_BUILT_IN_SCREEN_DESIGNS[0];
    return found;
  }, [allScreenDesigns, activeDesignId, posConfig.screen.activeDesignId, posTheme]);

  useEffect(() => {
    const applyPOSConfiguration = (incoming: POSConfiguration) => {
      setPosConfig(incoming);
      setPosConfigLoaded(true);
      setCurrentTerminalId(localStorage.getItem("pos.terminal-id") || incoming.shiftManagement.terminalId || "POS-01");
      const designs = [...POS_BUILT_IN_SCREEN_DESIGNS, ...(incoming.screen.customDesigns || [])];
      const designId = incoming.screen.activeDesignId || localStorage.getItem("pos_design_id") || "standard";
      const chosen = designs.find((d) => d.id === designId) || designs[0];
      if (chosen) {
        setActiveDesignId(chosen.id);
        setPosTheme(chosen.style);
        localStorage.setItem("pos_design_id", chosen.id);
        localStorage.setItem("pos_theme", chosen.style);
      }
      setViewMode(incoming.screen.defaultView);
      setOrderType(payloadOrderTypeForMode(incoming));
      if (!incoming.screen.showBrandFilter) setSelectedBrand("all");
      if (!incoming.screen.showUnitFilter) setSelectedUnit("all");
      if (!incoming.screen.showSubcategories) setSelectedSubcategoryFilter("all");
    };

    const payloadOrderTypeForMode = (cfg: POSConfiguration): POSOrderType => {
      if (posMode?.type === "call_center" && cfg.salesFlow.enabledOrderTypes.includes("DELIVERY")) {
        return "DELIVERY";
      }
      return cfg.salesFlow.defaultOrderType;
    };

    api.get(`/api/settings/${POS_SETTINGS_KEY}`)
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        const parsed = parsePOSConfiguration(data?.value);
        localStorage.setItem(POS_SETTINGS_KEY, JSON.stringify(parsed));
        applyPOSConfiguration(parsed);
      })
      .catch(() => {
        const cached = localStorage.getItem(POS_SETTINGS_KEY);
        applyPOSConfiguration(parsePOSConfiguration(cached));
      });

    const handleLiveUpdate = (event: Event) => {
      const custom = event as CustomEvent<POSConfiguration>;
      applyPOSConfiguration(parsePOSConfiguration(custom.detail));
    };

    window.addEventListener("pos-settings-updated", handleLiveUpdate);
    return () => window.removeEventListener("pos-settings-updated", handleLiveUpdate);
  }, []);

  useEffect(() => {
    if (!posConfigLoaded || !posConfig.shiftManagement.enabled) {
      setActivePOSShift(null);
      setShiftLoading(false);
      return;
    }
    let cancelled = false;
    setShiftLoading(true);
    const query = new URLSearchParams({
      branchId: String(selectedBranch?.id || branches[0]?.id || ""),
      terminalId: currentTerminalId,
    });
    api.get(`/api/pos/shifts/options?${query}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "تعذر التحقق من الوردية الحالية");
        if (!cancelled) setActivePOSShift(data.activeShift || null);
      })
      .catch((error) => {
        console.error("Load active POS shift failed:", error);
        if (!cancelled) setActivePOSShift(null);
      })
      .finally(() => {
        if (!cancelled) setShiftLoading(false);
      });
    return () => { cancelled = true; };
  }, [posConfigLoaded, posConfig.shiftManagement.enabled, currentTerminalId, selectedBranch?.id, branches[0]?.id, subView]);

  // Use actual database items
  const [dbCategories, setDbCategories] = useState<Category[]>(initialCategories || []);
  const [dbProducts, setDbProducts] = useState<Product[]>(initialProducts || []);

  useEffect(() => {
    if (initialCategories && initialCategories.length > 0) {
      setDbCategories(initialCategories);
    }
    if (initialProducts && initialProducts.length > 0) {
      setDbProducts(initialProducts);
    }
  }, [initialCategories, initialProducts]);

  useEffect(() => {
    // If no initial products/categories are present or to ensure freshest data
    if (dbCategories.length === 0 || dbProducts.length === 0) {
      api.get("/api/pos/data")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((data) => {
          if (data && Array.isArray(data.categories) && data.categories.length > 0) {
            setDbCategories(data.categories);
          }
          if (data && Array.isArray(data.products) && data.products.length > 0) {
            setDbProducts(data.products);
          }
        })
        .catch((err) => console.warn("POS direct master data fetch fallback:", err));
    }
  }, []);

  const mergedCategories = useMemo(() => {
    return dbCategories.length > 0 ? dbCategories : initialCategories || [];
  }, [dbCategories, initialCategories]);

  const mergedProducts = useMemo(() => {
    return dbProducts.length > 0 ? dbProducts : initialProducts || [];
  }, [dbProducts, initialProducts]);

  // Unique list of Brands & Units for filters
  const uniqueBrands = useMemo(() => {
    const brandsSet = new Set<string>();
    mergedProducts.forEach((p) => {
      if (p.brand) brandsSet.add(p.brand);
    });
    return Array.from(brandsSet);
  }, [mergedProducts]);

  const uniqueUnits = useMemo(() => {
    const unitsSet = new Set<string>();
    mergedProducts.forEach((p) => {
      if (p.unit) unitsSet.add(p.unit);
    });
    return Array.from(unitsSet);
  }, [mergedProducts]);

  // Active Category Filter mapping
  const activeCategoryId = useMemo(() => {
    if (selectedCategoryFilter === "all") return "all";
    const found = mergedCategories.find((c) => c.id.toString() === selectedCategoryFilter || c.name === selectedCategoryFilter);
    return found ? found.id : "all";
  }, [selectedCategoryFilter, mergedCategories]);

  const mainCategories = useMemo(() => {
    return mergedCategories.filter((c) => !c.parent_id);
  }, [mergedCategories]);

  const activeSubcategories = useMemo(() => {
    if (activeCategoryId === "all" || !posConfig.screen.showSubcategories) return [];
    return mergedCategories.filter((c) => c.parent_id === activeCategoryId);
  }, [activeCategoryId, mergedCategories, posConfig.screen.showSubcategories]);

  const activeCategoryTreeIds = useMemo(() => {
    if (activeCategoryId === "all") return [];

    const collectDescendants = (categoryId: number): number[] => {
      const children = mergedCategories.filter((category) => Number(category.parent_id) === categoryId);
      return children.reduce<number[]>((acc, child) => {
        const childId = Number(child.id);
        return [...acc, childId, ...collectDescendants(childId)];
      }, []);
    };

    const rootId = Number(activeCategoryId);
    return [rootId, ...collectDescendants(rootId)];
  }, [activeCategoryId, mergedCategories]);

  const enabledPaymentMethods = useMemo(
    () => posConfig.payments.enabledMethods.length ? posConfig.payments.enabledMethods : DEFAULT_POS_CONFIGURATION.payments.enabledMethods,
    [posConfig.payments.enabledMethods]
  );

  const enabledOrderTypes = useMemo(
    () => posConfig.salesFlow.enabledOrderTypes.length ? posConfig.salesFlow.enabledOrderTypes : DEFAULT_POS_CONFIGURATION.salesFlow.enabledOrderTypes,
    [posConfig.salesFlow.enabledOrderTypes]
  );

  const currency = posConfig.pricing.currency || "EGP";
  const activeProfile = POS_BUSINESS_PROFILES[posConfig.profile] || POS_BUSINESS_PROFILES.restaurant;

  // Filtered product listing
  const filteredProducts = useMemo(() => {
    return mergedProducts.filter((product) => {
      // 1. Search Query Match
      const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (product.barcode && product.barcode.includes(searchQuery));
      
      // 2. Category Match
      let matchCategory = false;
      if (activeCategoryId === "all") {
        matchCategory = true;
      } else {
        if (selectedSubcategoryFilter !== "all") {
          matchCategory = product.category_id.toString() === selectedSubcategoryFilter;
        } else {
          // Match main category and all nested subcategories, not only direct children.
          matchCategory = activeCategoryTreeIds.includes(Number(product.category_id));
        }
      }

      // 3. Brand Match
      const matchBrand = !posConfig.screen.showBrandFilter || selectedBrand === "all" || product.brand === selectedBrand;

      // 4. Unit Match
      const matchUnit = !posConfig.screen.showUnitFilter || selectedUnit === "all" || product.unit === selectedUnit;

      // 5. Tabs Filter (Favorites, Most Selling, Recent)
      let matchTab = true;
      if (workspaceTab === "favorites") {
        matchTab = !!product.is_favorite;
      } else if (workspaceTab === "most_selling") {
        // Mocking most selling by checking ID parity or standard mock
        matchTab = product.id % 2 === 0;
      } else if (workspaceTab === "recent") {
        matchTab = product.id % 3 === 0;
      }

      return matchSearch && matchCategory && matchBrand && matchUnit && matchTab;
    });
  }, [mergedProducts, searchQuery, activeCategoryId, selectedSubcategoryFilter, activeCategoryTreeIds, selectedBrand, selectedUnit, workspaceTab, posConfig.screen.showBrandFilter, posConfig.screen.showUnitFilter]);

  // Fetch customers
  useEffect(() => {
    api.get("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setCustomers(data);
      })
      .catch((err) => console.error("Failed to load customers", err));
  }, []);

  // Handle Scan barcode lookup
  const handleBarcodeSubmit = (codeToSearch?: string) => {
    const code = codeToSearch || barcodeInput;
    if (!code) return;

    const matched = mergedProducts.find((p) => p.barcode === code || p.code === code);
    if (matched) {
      addToCart(matched);
      playBeep();
      setBarcodeInput("");
      setShowBarcodeModal(false);
    } else {
      alert(`عذراً، لم يتم العثور على منتج بالباركود: ${code}`);
    }
  };

  // Add Item to Cart
  const addToCart = (product: Product) => {
    playBeep();
    setCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.id === product.id);
      if (existingIdx !== -1) {
        // Set selected item index to existing
        setSelectedCartItemIndex(existingIdx);
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      const newIdx = prev.length;
      setSelectedCartItemIndex(newIdx);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  // Remove / Decrement Item
  const decrementCartItem = (index: number) => {
    playBeep();
    setCart((prev) => {
      const target = prev[index];
      if (target.quantity > 1) {
        return prev.map((item, idx) =>
          idx === index ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      if (selectedCartItemIndex === index) {
        setSelectedCartItemIndex(null);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const removeFromCart = (index: number) => {
    playBeep();
    setCart((prev) => {
      if (selectedCartItemIndex === index) {
        setSelectedCartItemIndex(null);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  // Calculations
  const totals = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const totalItems = cart.length;
    const totalPieces = cart.reduce((acc, item) => acc + item.quantity, 0);

    let discountAmount = 0;
    if (appliedDiscount && posConfig.pricing.enableDiscount) {
      if (appliedDiscount.type === "percent") {
        const safePercent = Math.min(Math.max(appliedDiscount.value, 0), posConfig.pricing.maxDiscountPercent ?? 100);
        discountAmount = (subtotal * safePercent) / 100;
      } else {
        discountAmount = Math.min(Math.max(appliedDiscount.value, 0), subtotal);
      }
    }

    const netAmount = Math.max(subtotal - discountAmount, 0);
    const serviceChargeAmount = posConfig.pricing.enableServiceCharge
      ? (netAmount * (posConfig.pricing.serviceChargePercent || 0)) / 100
      : 0;
    const taxableAmount = netAmount + serviceChargeAmount;

    // الضريبة تُحسب لكل بند بنسبة الصنف نفسه (products.tax_rate) وليس بنسبة واحدة
    // على الفاتورة كلها؛ نسبة إعدادات نقطة البيع تبقى مرجعًا للبنود التي لا تحمل نسبة.
    // الوعاء الضريبي هو صافي الفاتورة بعد الخصم ورسوم الخدمة، ويوزَّع على البنود
    // بنسبة قيمة كل بند حتى يبقى مجموع الضريبة مطابقًا للصافي.
    const defaultTaxRate = posConfig.pricing.enableTax
      ? Math.min(Math.max(Number(posConfig.pricing.taxPercent) || 0, 0), 100)
      : 0;
    const lineTaxRates = cart.map((item) => {
      if (!posConfig.pricing.enableTax) return 0;
      const parsed = item.tax_rate === null || item.tax_rate === undefined ? NaN : Number(item.tax_rate);
      return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 100) : defaultTaxRate;
    });
    const taxAmount = cart.reduce((sum, item, index) => {
      const rate = lineTaxRates[index] / 100;
      if (!rate) return sum;
      const share = subtotal > 0 ? (item.price * item.quantity) / subtotal : 0;
      const lineBase = taxableAmount * share;
      // وضع «الأسعار تشمل الضريبة» يستخرج الضريبة من السعر بدل إضافتها فوقه.
      return sum + (posConfig.pricing.taxIncluded ? lineBase - lineBase / (1 + rate) : lineBase * rate);
    }, 0);
    const finalTotal = posConfig.pricing.taxIncluded ? taxableAmount : taxableAmount + taxAmount;
    const distinctTaxRates = Array.from(new Set(lineTaxRates));
    const taxRateLabel = distinctTaxRates.length === 1 ? distinctTaxRates[0] : null;

    return {
      subtotal,
      discountAmount,
      serviceChargeAmount,
      taxAmount,
      finalTotal,
      taxRateLabel,
      totalItems,
      totalPieces
    };
  }, [cart, appliedDiscount, posConfig.pricing]);

  // Amount paid & Change calculations
  const changeAmount = useMemo(() => {
    const paid = parseFloat(amountPaidBuffer) || 0;
    const diff = paid - totals.finalTotal;
    return diff > 0 ? diff : 0;
  }, [amountPaidBuffer, totals.finalTotal]);

  // Hold current invoice
  const handleHoldInvoice = () => {
    if (cart.length === 0) {
      alert("السلة فارغة، لا يمكن تعليق الطلب.");
      return;
    }
    const newHold = {
      id: Math.random().toString(36).substr(2, 6).toUpperCase(),
      timestamp: new Date(),
      items: [...cart],
      customer: selectedCustomer
    };
    setHoldInvoices((prev) => [newHold, ...prev]);
    setCart([]);
    setSelectedCustomer(null);
    setAppliedDiscount(null);
    setItemNotes({});
    setInvoiceNote("");
    alert(`تم تعليق الطلب بنجاح برمز التعليق: ${newHold.id}`);
    playBeep();
  };

  const handleRestoreHoldInvoice = (holdId: string) => {
    const target = holdInvoices.find((h) => h.id === holdId);
    if (target) {
      setCart(target.items);
      setSelectedCustomer(target.customer);
      setHoldInvoices((prev) => prev.filter((h) => h.id !== holdId));
      setShowHoldInvoicesModal(false);
      playBeep();
    }
  };

  // Add new customer via quick popup
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustomerForm.name.trim();
    const phone = newCustomerForm.phone.trim();
    if (!name || !phone) {
      alert("الرجاء ملء الاسم ورقم الهاتف.");
      return;
    }

    const payload = {
      name,
      phone,
      email: newCustomerForm.email.trim() || null,
      address: newCustomerForm.address.trim() || null,
    };

    try {
      const res = await api.post("/api/customers", payload);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.error || "تعذر إضافة العميل، حاول مرة أخرى.");
        return;
      }
      const added = await res.json();
      const fullCustomer = { ...payload, ...added };
      setCustomers((prev) => [fullCustomer, ...prev.filter((c) => c.id !== fullCustomer.id)]);
      setSelectedCustomer(fullCustomer);
      setNewCustomerForm({ name: "", phone: "", email: "", address: "" });
      setShowCustomerModal(false);
      playBeep();
    } catch (err) {
      console.error("Failed to add customer", err);
      alert("تعذر الاتصال بالخادم لإضافة العميل.");
    }
  };

  // Call Center confirmation modal states
  const [showCallCenterConfirmModal, setShowCallCenterConfirmModal] = useState(false);
  const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string>("cash");
  const [callCenterCustomerSearch, setCallCenterCustomerSearch] = useState("");
  const [callCenterFormError, setCallCenterFormError] = useState<string | null>(null);
  const [callCenterForm, setCallCenterForm] = useState({
    name: "",
    phone: "",
    address: "",
    notes: ""
  });

  // Settle/Order Complete payment
  const handleCheckout = async (
    paymentMethod: string = "cash",
    callCenterOverrideCustomer?: { id?: number; name: string; phone: string; address?: string; notes?: string }
  ) => {
    if (posConfig.shiftManagement.enabled && (!posConfigLoaded || shiftLoading || !activePOSShift)) {
      alert(!posConfigLoaded || shiftLoading
        ? "جارٍ التحقق من الوردية. حاول مرة أخرى بعد اكتمال التحميل."
        : "يجب فتح وردية قبل تنفيذ عمليات البيع.");
      return;
    }
    if (cart.length === 0) {
      alert("السلة فارغة. الرجاء إضافة منتجات أولاً.");
      return;
    }

    if (!posConfig.salesFlow.allowNegativeStock) {
      const insufficientItems = cart.filter((item) =>
        item.track_inventory !== false &&
        typeof item.stock === "number" &&
        item.stock < item.quantity
      );

      if (insufficientItems.length) {
        alert(`لا يمكن إتمام البيع لأن المخزون غير كافٍ: ${insufficientItems.map((item) => item.name).join("، ")}`);
        return;
      }
    }

    // In Call Center POS mode, always open customer details & order confirmation screen first
    if (posMode?.type === "call_center" && !callCenterOverrideCustomer) {
      setPendingPaymentMethod(paymentMethod);
      setCallCenterFormError(null);
      setCallCenterForm({
        name: selectedCustomer?.name || newCustomerForm.name || "",
        phone: selectedCustomer?.phone || newCustomerForm.phone || "",
        address: selectedCustomer?.address || newCustomerForm.address || "",
        notes: invoiceNote || ""
      });
      setShowCallCenterConfirmModal(true);
      playBeep();
      return;
    }

    const effectiveCustomer = callCenterOverrideCustomer || selectedCustomer;

    if (posConfig.salesFlow.requireCustomer && !effectiveCustomer) {
      alert("إعدادات نقطة البيع تتطلب اختيار عميل قبل إتمام البيع.");
      return;
    }

    if (posConfig.salesFlow.requireCustomerForDelivery && orderType === "DELIVERY" && !effectiveCustomer) {
      alert("طلبات الدليفري تتطلب اختيار عميل يحتوي على رقم هاتف وعنوان.");
      return;
    }

    if (!callCenterOverrideCustomer && posConfig.salesFlow.askBeforeCheckout && !confirm("تأكيد إتمام الفاتورة؟")) {
      return;
    }

    setCheckoutStatus({ type: "loading" });
    const idempotencyKey = checkoutIdempotencyKeyRef.current
      || sessionStorage.getItem("pos.pending-checkout-key")
      || crypto.randomUUID();
    checkoutIdempotencyKeyRef.current = idempotencyKey;
    sessionStorage.setItem("pos.pending-checkout-key", idempotencyKey);

    const finalInvoiceNote = callCenterOverrideCustomer?.notes !== undefined
      ? (callCenterOverrideCustomer.notes || null)
      : (invoiceNote || null);

    // Build standard payload for POS server route
    const payload = {
      idempotency_key: idempotencyKey,
      items: cart.map((item, index) => ({
        id: item.id,
        quantity: item.quantity,
        price: item.price,
        selectedSize: item.selectedSize || null,
        notes: itemNotes[index] || null
      })),
      total: totals.finalTotal,
      branch_id: selectedBranch?.id || branches[0]?.id || 1,
      order_type: orderTypeApiMap[orderType] || "dine_in",
      is_paid: 1,
      customer_name: effectiveCustomer?.name || "عميل نقدي",
      customer_phone: effectiveCustomer?.phone || null,
      customer_address: effectiveCustomer?.address || null,
      payment_method: paymentMethod,
      tax_amount: totals.taxAmount,
      service_charge: totals.serviceChargeAmount,
      discount: totals.discountAmount,
      notes: finalInvoiceNote,
      invoice_note: finalInvoiceNote,
      // قناة الأوردر: ضرورية لدقة تقارير نقطة البيع مقابل تقارير الكول سنتر
      source: isCallCenter ? "call_center" : "pos",
      status: "pending",
      pos_terminal_id: currentTerminalId
    };

    try {
      const res = await Promise.race([
        api.post("/api/pos/order", payload),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("انتهت مهلة استجابة الخادم")), 7000)
        )
      ]);
      if (!isMountedRef.current) return;
      if (res && res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!isMountedRef.current) return;
        if (!data?.orderId) {
          // Server answered 2xx but without a real order id — the sale was not stored.
          setCheckoutStatus({
            type: "error",
            message: "الخادم لم يؤكد حفظ الأوردر. لم يتم تسجيل الفاتورة، حاول إتمام البيع مرة أخرى."
          });
          return;
        }
        setCheckoutStatus({
          type: "success",
          orderId: data.orderId,
          warnings: Array.isArray(data.warnings) ? data.warnings : []
        });
        sessionStorage.removeItem("pos.pending-checkout-key");
        checkoutIdempotencyKeyRef.current = null;
        if (posConfig.salesFlow.autoPrintReceipt) {
          safeSetTimeout(() => {
            if (isMountedRef.current) setReceiptPreview({ orderId: data.orderId, autoPrint: true });
          }, 300);
        }
        playSuccessSound();
      } else {
        const errData = await res.json().catch(() => ({}));
        console.warn("Server checkout issue:", errData);
        const details = [errData?.error, errData?.detail || errData?.details].filter(Boolean).join(" — ");
        setCheckoutStatus({
          type: "error",
          message: details || `تعذر حفظ الأوردر على الخادم (كود ${res?.status ?? "غير معروف"}).`
        });
      }
    } catch (err: any) {
      console.warn("Server save failed or timed out:", err);
      if (!isMountedRef.current) return;
      const timedOut = String(err?.message || "").includes("مهلة");
      setCheckoutStatus({
        type: "error",
        message: timedOut
          ? "انتهت مهلة الاتصال بالخادم ولم يتم تسجيل الفاتورة. تحقق من الاتصال ثم أعد إتمام البيع."
          : `لم يتم تسجيل الفاتورة: ${err?.message || err}`
      });
    }
  };

  const resetAfterSuccess = () => {
    setCart([]);
    setSelectedCustomer(null);
    setAppliedDiscount(null);
    setItemNotes({});
    setInvoiceNote("");
    setAmountPaidBuffer("");
    setQuantityBuffer("");
    setCheckoutStatus({ type: "idle" });

    // الكول سنتر: "فاتورة جديدة" تعني بدء أوردر جديد على نفس الشاشة،
    // فنفرّغ بيانات البحث عن العميل ونموذج تأكيد الأوردر بدل الخروج للداشبورد.
    setShowCallCenterConfirmModal(false);
    setCallCenterCustomerSearch("");
    setCallCenterFormError(null);
    setCallCenterForm({ name: "", phone: "", address: "", notes: "" });

    // Regenerate invoice number
    const rand = Math.floor(100000 + Math.random() * 900000);
    setInvoiceNumber(`INV-${rand}`);

    onOrderSuccess();
  };

  // Numpad key triggers
  const handleNumpadPress = (key: string) => {
    playBeep();
    if (numpadMode === "qty") {
      if (selectedCartItemIndex === null || cart.length === 0) {
        alert("الرجاء اختيار صنف من السلة لتعديل كميته.");
        return;
      }
      
      let newBuffer = quantityBuffer;
      if (key === "backspace") {
        newBuffer = newBuffer.slice(0, -1);
      } else {
        // Prevent multiple dots
        if (key === "." && newBuffer.includes(".")) return;
        newBuffer += key;
      }
      setQuantityBuffer(newBuffer);

      // Apply quantity directly to selected item
      const val = parseFloat(newBuffer);
      if (!isNaN(val) && val >= 0) {
        setCart((prev) =>
          prev.map((item, idx) =>
            idx === selectedCartItemIndex ? { ...item, quantity: val } : item
          )
        );
      } else if (newBuffer === "") {
        setCart((prev) =>
          prev.map((item, idx) =>
            idx === selectedCartItemIndex ? { ...item, quantity: 1 } : item
          )
        );
      }
    } else {
      // Amount paid mode
      let newBuffer = amountPaidBuffer;
      if (key === "backspace") {
        newBuffer = newBuffer.slice(0, -1);
      } else {
        if (key === "." && newBuffer.includes(".")) return;
        newBuffer += key;
      }
      setAmountPaidBuffer(newBuffer);
    }
  };

  // Helper for quick payment method colors
  const getPaymentButtonClass = (method: string) => {
    const base = "py-2 px-3 rounded-xl text-[11px] font-black tracking-wide border transition-all text-center flex flex-col justify-center items-center h-12 shadow-sm";
    switch (method) {
      case "cash":
        return `${base} bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600`;
      case "visa":
        return `${base} bg-[#1b3a8a] border-blue-900 text-white hover:bg-blue-950`;
      case "mastercard":
        return `${base} bg-slate-900 border-black text-white hover:bg-slate-800`;
      case "instapay":
        return `${base} bg-purple-600 border-purple-700 text-white hover:bg-purple-700`;
      default:
        return `${base} bg-white border-slate-200 text-slate-700 hover:bg-slate-50`;
    }
  };

  // Build combined payment labels (default + custom)
  const allPaymentLabels = useMemo(() => {
    const labels: Record<string, { ar: string; en: string }> = { ...paymentMethodLabels };
    (posConfig.payments.customMethods || []).forEach(cm => {
      labels[cm.key] = { ar: cm.label, en: cm.en || cm.key };
    });
    return labels;
  }, [posConfig.payments.customMethods]);

  if (subView === "shifts") {
    return (
      <POSShiftManagement
        branch={selectedBranch || branches[0] || null}
        config={posConfig}
        terminalId={currentTerminalId}
        onTerminalIdChange={(nextTerminalId) => {
          setCurrentTerminalId(nextTerminalId);
          localStorage.setItem("pos.terminal-id", nextTerminalId);
        }}
        onBack={onExitShifts || onBack}
      />
    );
  }

  if (subView === "dashboard" && isCallCenter) {
    return (
      <CallCenterDashboard
        branch={selectedBranch || branches[0] || null}
        branches={branches}
        config={posConfig}
        onBack={onBack}
      />
    );
  }

  if (subView === "voip" && isCallCenter) {
    return (
      <CallCenterVoip
        branch={selectedBranch || branches[0] || null}
        cashierName={cashierName}
        onBack={onBack}
      />
    );
  }

  if (subView === "void") {
    return (
      <POSVoidManagement
        branch={selectedBranch || branches[0] || null}
        branches={branches}
        config={posConfig}
        cashierName={cashierName}
        scope={isCallCenter ? "call_center" : "pos"}
        onBack={onExitVoid || onBack}
        onOrderUpdated={onOrderSuccess}
      />
    );
  }

  const isNeo = posTheme === "neobrutalist";
  const isDark = posTheme === "dark-emerald";
  const isRoyal = posTheme === "royal-luxury";
  const isCafe = posTheme === "cafe-warm";

  const handleCycleDesign = (nextDesignId: string) => {
    playBeep();
    const chosen = allScreenDesigns.find((d) => d.id === nextDesignId) || allScreenDesigns[0];
    if (!chosen) return;
    setActiveDesignId(chosen.id);
    setPosTheme(chosen.style);
    setViewMode(chosen.defaultView);
    localStorage.setItem("pos_design_id", chosen.id);
    localStorage.setItem("pos_theme", chosen.style);
    const updatedCfg: POSConfiguration = {
      ...posConfig,
      screen: {
        ...posConfig.screen,
        activeDesignId: chosen.id,
        defaultView: chosen.defaultView,
        showImages: chosen.showImages,
        productsPerRow: chosen.productsPerRow,
        compactCart: chosen.compactCart,
        showCategorySidebar: chosen.categoriesPosition === "sidebar"
      }
    };
    setPosConfig(updatedCfg);
    localStorage.setItem(POS_SETTINGS_KEY, JSON.stringify(updatedCfg));
  };

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden text-right select-none ${
      isNeo
        ? "bg-white text-black font-sans"
        : isDark
          ? "bg-slate-950 text-slate-100 font-sans"
          : isCafe
            ? "bg-[#fcf8f2] text-stone-800 font-sans"
            : isRoyal
              ? "bg-[#f8f5fb] text-slate-900 font-sans"
              : "bg-[#f4f7fa] text-slate-800 font-sans"
    }`} dir="rtl">
      
      {/* 1. TOP BAR */}
      <div className={`h-14 flex items-center justify-between px-5 shrink-0 z-40 ${
        isNeo
          ? "bg-white border-b-4 border-black shadow-[4px_4px_0px_#000]"
          : isDark
            ? "bg-slate-900 border-b border-emerald-900/60 text-white"
            : "bg-white border-b border-slate-200/80"
      }`}>
        
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          {isNeo ? (
            <div className="bg-black text-[#ffeb3b] px-4 py-1.5 border-2 border-black font-extrabold text-sm tracking-tight flex items-center gap-2 shadow-[2px_2px_0px_#000]">
              <Flame className="w-4 h-4 text-[#ffeb3b] shrink-0 animate-pulse" />
              <span className="hidden sm:inline-block font-mono tracking-widest font-black">
                {isCallCenter ? "نقطة البيع الكول سنتر" : "REMO_PRO // POS"}
              </span>
            </div>
          ) : (
            <div
              className="px-3 py-1.5 rounded-lg text-white font-bold text-sm tracking-tight flex items-center gap-2 shadow-xs"
              style={{ backgroundColor: activeScreenDesign.primaryColor || "#1a3a8a" }}
            >
              <Flame className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{isCallCenter ? "نقطة البيع الكول سنتر" : "POS"}</span>
            </div>
          )}
          <span className={`hidden sm:inline-block text-xs font-mono font-bold ${isNeo ? "bg-black text-white px-2 py-0.5 border border-black" : isDark ? "text-emerald-400" : "text-slate-400"}`}>{invoiceNumber}</span>
          <span className="hidden sm:inline-block text-[10px] text-slate-300">|</span>
          <span className={`hidden sm:inline-block text-xs font-bold ${isNeo ? "text-black underline decoration-2 decoration-[#ffeb3b]" : isDark ? "text-slate-300" : "text-slate-500"}`}>{selectedBranch?.name || "فرع القاهرة"}</span>
          {posConfig.shiftManagement.enabled && (
            <button onClick={onOpenShifts} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${activePOSShift ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {activePOSShift ? `وردية ${activePOSShift.shift_number || `#${activePOSShift.id}`}` : "فتح وردية"} · {currentTerminalId}
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenVoidModal}
            className={`px-3 py-1.5 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
              isNeo
                ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-red-700"
                : "bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm shadow-rose-600/20"
            }`}
            title="استرجاع أو تعديل أو إلغاء أوردر (Void)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>VOID (استرجاع / تعديل)</span>
          </button>
          {isCallCenter && onOpenVoid && (
            <button
              type="button"
              onClick={() => { playBeep(); onOpenVoid(); }}
              className={`px-3 py-1.5 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                isNeo
                  ? "bg-slate-900 text-white border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-black"
                  : "bg-white hover:bg-slate-100 text-rose-700 border border-rose-200 rounded-lg shadow-xs"
              }`}
              title="فتح شاشة الفود الكاملة لأوردرات الكول سنتر"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>شاشة الفود (Void)</span>
            </button>
          )}
        </div>

        {/* Right: Cashier Name + Time + Actions */}
        <div className="flex items-center gap-2">
          {/* Screen Design Selector Dropdown */}
          <select
            value={activeScreenDesign.id}
            onChange={(e) => handleCycleDesign(e.target.value)}
            className={`px-2.5 py-1.5 text-xs font-black transition-all cursor-pointer focus:outline-none ${
              isNeo
                ? "bg-[#ffeb3b] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                : isDark
                  ? "bg-slate-800 text-emerald-300 border border-emerald-700/60 rounded-lg"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-200/70"
            }`}
            title="اختيار ديزاين شاشة نقطة البيع"
          >
            {allScreenDesigns.map((d) => (
              <option key={d.id} value={d.id} className="bg-white text-slate-800 font-bold">
                🎨 {d.name}
              </option>
            ))}
          </select>

          <div className={`flex items-center gap-1.5 px-2.5 py-1 ${
            isNeo
              ? "bg-[#ffeb3b] border-2 border-black text-black font-black"
              : isDark
                ? "bg-slate-800 text-slate-200 rounded-lg"
                : "bg-slate-100 rounded-lg"
          }`}>
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ backgroundColor: isNeo ? "#000000" : (activeScreenDesign.primaryColor || "#1a3a8a") }}
            >
              {cashierName.charAt(0)}
            </div>
            <span className="hidden sm:inline-block text-[11px] font-bold">{cashierName}</span>
          </div>
          <span className="hidden sm:inline-block text-[10px] text-slate-300">|</span>
          <POSLiveClock theme={posTheme} />
          <div className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold ${
            isNeo
              ? "bg-[#4caf50] text-white border-2 border-black shadow-[1.5px_1.5px_0px_#000]"
              : "bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-md"
          }`}>
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
            <span>متصل</span>
          </div>
          <div
            onClick={() => { playBeep(); window.print(); }}
            className={`w-8 h-8 flex items-center justify-center cursor-pointer transition-all ${
              isNeo
                ? "bg-white border-2 border-black hover:bg-slate-100 shadow-[1.5px_1.5px_0px_#000]"
                : isDark
                  ? "hover:bg-slate-800 rounded-lg text-slate-300"
                  : "hover:bg-slate-100 rounded-lg text-slate-400"
            }`}
            title="طباعة"
          >
            <Printer className={`w-4 h-4 ${isDark ? "text-slate-200" : "text-black"}`} />
          </div>
          <button
            onClick={handleSafeBack}
            className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
              isNeo
                ? "bg-black text-white hover:bg-neutral-800 border-2 border-black shadow-[2px_2px_0px_#000] font-bold text-xs"
                : isDark
                  ? "hover:bg-slate-800 rounded-lg text-xs font-medium text-slate-300"
                  : "hover:bg-slate-100 rounded-lg text-xs font-medium text-slate-500"
            }`}
          >
            <span>رجوع</span>
          </button>
        </div>
      </div>

      {/* MOBILE SEGMENTED TAB SWITCHER (< lg) */}
      <div className="lg:hidden flex items-center bg-slate-100 p-1 border-b border-slate-200 shrink-0 select-none">
        <button
          type="button"
          onClick={() => setPosMobileTab("products")}
          className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 ${
            posMobileTab === "products"
              ? isNeo
                ? "bg-[#ffeb3b] text-black border-2 border-black shadow-sm"
                : "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>المنتجات والقائمة</span>
        </button>
        <button
          type="button"
          onClick={() => setPosMobileTab("cart")}
          className={`flex-1 py-2 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-2 relative ${
            posMobileTab === "cart"
              ? isNeo
                ? "bg-[#ffeb3b] text-black border-2 border-black shadow-sm"
                : "bg-white text-blue-700 shadow-sm border border-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>سلة الطلبات</span>
          {totals.totalPieces > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
              {totals.totalPieces}
            </span>
          )}
        </button>
      </div>

      <div className={`flex-1 min-h-0 flex flex-col ${activeScreenDesign.layoutPosition === "cart-left" ? "lg:flex-row-reverse" : "lg:flex-row"} overflow-hidden relative`}>
        
        {/* 2. LEFT SIDEBAR - CART */}
        <div className={`w-full lg:w-[380px] flex flex-col shrink-0 z-20 overflow-hidden border-b lg:border-b-0 ${
          posMobileTab === "cart" ? "flex-1 flex" : "hidden lg:flex"
        } ${
          isNeo
            ? "bg-white border-l-4 border-black text-black"
            : isDark
              ? "bg-slate-900 border-l border-emerald-900/50 text-slate-100"
              : "bg-white border-l border-slate-200/80"
        }`}>
          
          {posConfig.screen.showCustomer && (
          <div className={`px-3 py-2 border-b flex items-center gap-2 shrink-0 ${
            posTheme === "neobrutalist" ? "border-black bg-slate-50" : "border-slate-100"
          }`}>
            <button
              onClick={() => setShowCustomerModal(true)}
              className={`flex-1 py-1.5 px-3 text-[11px] flex items-center justify-center gap-1.5 transition-all ${
                posTheme === "neobrutalist"
                  ? "bg-white text-black border-2 border-black font-extrabold shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  : "bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg border border-slate-200/80 transition-colors"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5 text-black shrink-0" />
              <span className="truncate">{selectedCustomer ? selectedCustomer.name : "اختر عميل..."}</span>
            </button>
            {selectedCustomer && (
              <button
                onClick={() => setSelectedCustomer(null)}
                className={`p-1.5 transition-colors ${posTheme === "neobrutalist" ? "text-black hover:text-red-600" : "text-slate-400 hover:text-red-500"}`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          )}

          {/* Quick Action Buttons */}
          <div className={`px-3 py-2 border-b flex items-center gap-1.5 shrink-0 ${
            posTheme === "neobrutalist" ? "border-black" : "border-slate-100"
          }`}>
            {posConfig.pricing.enableDiscount && (
              <button
                onClick={() => {
                  if (cart.length === 0) { playBeep(); return; }
                  // نفتح النافذة بقيمة الخصم المطبَّق حاليًا حتى لا يفقد الكاشير ما أدخله
                  setDiscountType(appliedDiscount?.type || "percent");
                  setDiscountValue(appliedDiscount?.value ?? 0);
                  setShowDiscountModal(true);
                  playBeep();
                }}
                disabled={cart.length === 0}
                className={`flex-1 py-2 px-2 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  posTheme === "neobrutalist"
                    ? appliedDiscount && appliedDiscount.value > 0
                      ? "bg-[#ffeb3b] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-black ring-2 ring-amber-500"
                      : "bg-[#ffeb3b] text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-black"
                    : appliedDiscount && appliedDiscount.value > 0
                      ? "bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg border border-amber-400"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg border border-amber-200/80"
                }`}
                title={
                  appliedDiscount && appliedDiscount.value > 0
                    ? `خصم مطبَّق: ${appliedDiscount.type === "percent" ? `${appliedDiscount.value}%` : appliedDiscount.value} — اضغط للتعديل`
                    : "خصم يدوي على الأوردر"
                }
              >
                <Percent className="w-3.5 h-3.5" />
                <span>خصم</span>
                {appliedDiscount && appliedDiscount.value > 0 && (
                  <span className="font-mono text-[9px] font-black">
                    {appliedDiscount.type === "percent" ? `${appliedDiscount.value}%` : appliedDiscount.value.toFixed(2)}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => {
                handleHoldInvoice();
              }}
              disabled={cart.length === 0}
              className={`flex-1 py-2 px-2 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                posTheme === "neobrutalist"
                  ? "bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-black"
                  : "bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200/80"
              }`}
              title="تعليق الأوردر الحالي"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>تعليق</span>
            </button>
            <button
              onClick={() => setShowHoldInvoicesModal(true)}
              className={`flex-1 py-2 px-2 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                posTheme === "neobrutalist"
                  ? "bg-black text-white border-2 border-black shadow-[2px_2px_0px_#ffeb3b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none font-black"
                  : "bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg border border-violet-200/80"
              }`}
              title="استرجاع أوردر معلق"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>المعلق</span>
              {holdInvoices.length > 0 && (
                <span className={`text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center ${
                  posTheme === "neobrutalist" ? "bg-[#ffeb3b] text-black font-black border border-black" : "bg-violet-600 text-white"
                }`}>{holdInvoices.length}</span>
              )}
            </button>
            <button
              onClick={handleOpenVoidModal}
              className={`flex-1 py-2 px-2 text-[10px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer ${
                posTheme === "neobrutalist"
                  ? "bg-red-600 text-white border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  : "bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg border border-rose-200"
              }`}
              title="استرجاع أو تعديل أو إلغاء أوردر (Void)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Void</span>
            </button>
          </div>

          {/* Cart column headers */}
          <div className={`px-4 py-2 flex text-[10px] font-bold shrink-0 select-none border-b ${
            posTheme === "neobrutalist"
              ? "bg-black text-white border-black font-mono tracking-widest"
              : "text-slate-400 border-slate-50"
          }`}>
            <div className="flex-1">الصنف</div>
            <div className="w-20 text-center">الكمية</div>
            <div className="w-16 text-center">السعر</div>
            <div className="w-16 text-left">الإجمالي</div>
          </div>

          {/* Scrollable list of items */}
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 gap-2 py-16">
                <ShoppingCart className="w-10 h-10 text-slate-300 stroke-[1.2]" />
                <p className="text-[11px] text-slate-400">السلة فارغة</p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const isSelected = selectedCartItemIndex === idx;
                const note = itemNotes[idx];
                return (
                  <div 
                    key={item.id} 
                    onClick={() => {
                      setSelectedCartItemIndex(idx);
                      setQuantityBuffer(item.quantity.toString());
                      playBeep();
                    }}
                    className={`p-2 flex items-center gap-2.5 transition-all cursor-pointer ${
                      posTheme === "neobrutalist"
                        ? isSelected
                          ? "bg-[#ffeb3b]/20 border-2 border-black shadow-[2px_2px_0px_#000]"
                          : "bg-white border-2 border-black hover:bg-slate-50"
                        : isSelected 
                          ? "bg-blue-50/60 border-blue-300 border rounded-lg" 
                          : "bg-white border-slate-100 hover:bg-slate-50 border rounded-lg"
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${
                      posTheme === "neobrutalist" ? "bg-white border border-black" : "bg-slate-50 rounded-lg"
                    }`}>
                      {posConfig.screen.showImages && item.image ? (
                        <img src={item.image} className="w-full h-full object-contain rounded-sm" referrerPolicy="no-referrer" />
                      ) : (
                        <Package className="w-4 h-4 text-slate-300" />
                      )}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-black text-[11px] truncate leading-tight ${posTheme === "neobrutalist" ? "text-black" : "text-slate-700"}`}>
                        {item.name}
                      </h4>
                      {note && (
                        <span className={`text-[9px] truncate block ${posTheme === "neobrutalist" ? "text-red-600 font-extrabold" : "text-amber-600"}`}>{note}</span>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); decrementCartItem(idx); }}
                        className={`w-5 h-5 flex items-center justify-center transition-all ${
                          posTheme === "neobrutalist"
                            ? "bg-white text-black border border-black hover:bg-slate-100"
                            : "border border-slate-200 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className={`text-[11px] w-5 text-center ${posTheme === "neobrutalist" ? "font-black text-black" : "font-bold text-slate-700"}`}>{item.quantity}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                        className={`w-5 h-5 flex items-center justify-center transition-all ${
                          posTheme === "neobrutalist"
                            ? "bg-white text-black border border-black hover:bg-slate-100"
                            : "border border-slate-200 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Price & Total */}
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400 font-mono font-bold">{item.price.toFixed(2)}</div>
                      <div className={`text-[11px] font-black ${posTheme === "neobrutalist" ? "text-black font-mono" : "text-slate-800"}`}>{(item.price * item.quantity).toFixed(2)}</div>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFromCart(idx); }}
                      className={`p-1 transition-colors shrink-0 ${posTheme === "neobrutalist" ? "text-black hover:text-red-600" : "text-slate-300 hover:text-red-500"}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary & Payment */}
          <div className={`p-3 border-t space-y-2.5 shrink-0 bg-white ${
            posTheme === "neobrutalist" ? "border-black border-t-4" : "border-slate-200/80"
          }`}>
            {invoiceNote && (
              <div className={`p-1.5 flex items-center justify-between text-[10px] ${
                posTheme === "neobrutalist"
                  ? "bg-[#ffeb3b]/20 border-2 border-black text-black font-bold"
                  : "bg-blue-50 border border-blue-100 rounded-lg text-blue-700"
              }`}>
                <span className="truncate">{invoiceNote}</span>
                <button onClick={() => setInvoiceNote("")} className={`shrink-0 mr-2 ${posTheme === "neobrutalist" ? "text-black hover:text-red-600" : "text-blue-400 hover:text-blue-600"}`}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            <button
              onClick={() => setShowInvoiceNoteModal(true)}
              className={`w-full py-1 text-[10px] flex items-center justify-center gap-1 transition-colors ${
                posTheme === "neobrutalist"
                  ? "bg-white text-black border-2 border-black border-dashed hover:bg-slate-50 font-black"
                  : "border border-dashed border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-600 bg-transparent rounded-lg"
              }`}
            >
              <Plus className="w-3 h-3" />
              <span>ملاحظة للفاتورة</span>
            </button>

            {/* Totals */}
            <div className={`space-y-1 text-[11px] ${posTheme === "neobrutalist" ? "text-black font-extrabold" : ""}`}>
              <div className="flex justify-between text-slate-500">
                <span className={posTheme === "neobrutalist" ? "text-black font-black" : ""}>المجموع</span>
                <span className="font-mono">{totals.subtotal.toFixed(2)} {currency}</span>
              </div>
              {totals.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span className={posTheme === "neobrutalist" ? "text-emerald-700 font-black" : ""}>
                    الخصم
                    {appliedDiscount?.type === "percent" && appliedDiscount.value > 0
                      ? ` (${appliedDiscount.value}%)`
                      : ""}
                  </span>
                  <span className="font-mono">-{totals.discountAmount.toFixed(2)} {currency}</span>
                </div>
              )}
              {totals.serviceChargeAmount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span className={posTheme === "neobrutalist" ? "text-black font-black" : ""}>خدمة</span>
                  <span className="font-mono">{totals.serviceChargeAmount.toFixed(2)} {currency}</span>
                </div>
              )}
              {totals.taxAmount > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span className={posTheme === "neobrutalist" ? "text-black font-black" : ""}>
                    ضريبة{totals.taxRateLabel !== null ? ` ${totals.taxRateLabel}%` : ""}
                    {posConfig.pricing.taxIncluded ? " (مشمولة في السعر)" : ""}
                  </span>
                  <span className="font-mono">{totals.taxAmount.toFixed(2)} {currency}</span>
                </div>
              )}
              <div className={`flex justify-between pt-1 border-t ${
                posTheme === "neobrutalist"
                  ? "text-black font-black text-base border-black border-t-2"
                  : "text-[#1a3a8a] font-black text-sm border-slate-100"
              }`}>
                <span>الإجمالي</span>
                <span className="font-mono">{totals.finalTotal.toFixed(2)} {currency}</span>
              </div>
            </div>

            {/* Paid / Change */}
            <div className="flex gap-2">
              <div 
                onClick={() => { setNumpadMode("amount"); setAmountPaidBuffer(""); playBeep(); }}
                className={`flex-1 p-2 border text-right cursor-pointer transition-all text-[11px] ${
                  posTheme === "neobrutalist"
                    ? numpadMode === "amount"
                      ? "border-2 border-black bg-[#ffeb3b]/20 font-black"
                      : "border-2 border-black bg-white"
                    : numpadMode === "amount"
                      ? "border-blue-400 bg-blue-50/50 rounded-lg"
                      : "border-slate-200 bg-slate-50/30 rounded-lg"
                }`}
              >
                <span className={`text-[9px] block ${posTheme === "neobrutalist" ? "text-black font-black" : "text-slate-400"}`}>المدفوع</span>
                <span className="font-mono font-bold">{amountPaidBuffer || "0"}</span>
              </div>
              <div className={`flex-1 p-2 text-right ${
                posTheme === "neobrutalist"
                  ? "border-2 border-black bg-[#4caf50]/20 text-black font-black"
                  : "border border-slate-100 bg-slate-50/20 rounded-lg"
              }`}>
                <span className={`text-[9px] block ${posTheme === "neobrutalist" ? "text-black font-black" : "text-slate-400"}`}>المتبقي</span>
                <span className="font-mono font-bold text-emerald-600">{changeAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Order type */}
            <div className="flex flex-wrap gap-1.5 my-1">
              {enabledOrderTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => { setOrderType(type); playBeep(); }}
                  className={`px-3 py-1.5 text-xs font-black border-2 border-black transition-all cursor-pointer ${
                    orderType === type
                      ? posTheme === "neobrutalist"
                        ? "bg-black text-white shadow-[3px_3px_0px_#000] -translate-x-0.5 -translate-y-0.5"
                        : "bg-[#1a3a8a] text-white border-[#1a3a8a] rounded-md"
                      : posTheme === "neobrutalist"
                        ? "bg-white text-black hover:bg-[#ffeb3b] hover:shadow-[2px_2px_0px_#000]"
                        : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 rounded-md"
                  }`}
                >
                  {orderTypeLabels[type] || type}
                </button>
              ))}
            </div>

            {/* Payment methods */}
            <div className="grid grid-cols-4 gap-1.5">
              {enabledPaymentMethods.map((method) => {
                if (posTheme === "neobrutalist") {
                  return (
                    <button
                      key={method}
                      onClick={() => { handleCheckout(method); }}
                      className="py-2 px-1 border-2 border-black bg-[#ffeb3b] text-black font-black text-xs tracking-wide transition-all text-center flex flex-col justify-center items-center h-12 shadow-[3px_3px_0px_#000] hover:bg-amber-300 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                    >
                      <span className="leading-tight">{allPaymentLabels[method]?.ar || method}</span>
                      <span className="text-[9px] opacity-80 font-mono font-bold">{allPaymentLabels[method]?.en || method}</span>
                    </button>
                  );
                }
                return (
                  <button
                    key={method}
                    onClick={() => { handleCheckout(method); }}
                    className={getPaymentButtonClass(method)}
                  >
                    <span>{allPaymentLabels[method]?.ar || method}</span>
                    <span className="text-[8px] opacity-70 font-mono">{allPaymentLabels[method]?.en || method}</span>
                  </button>
                );
              })}
            </div>

            {/* Pay button */}
            <button
              onClick={() => handleCheckout("cash")}
              disabled={cart.length === 0}
              className={`w-full py-3 font-extrabold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${
                posTheme === "neobrutalist"
                  ? "bg-[#ffeb3b] text-black border-4 border-black shadow-[4px_4px_0px_#000] hover:bg-amber-300 disabled:opacity-30 disabled:shadow-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  : "bg-[#1a3a8a] text-white rounded-lg hover:bg-blue-950 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>دفع {totals.finalTotal.toFixed(2)} {currency}</span>
            </button>
          </div>
        </div>

        {/* 3. MAIN WORKSPACE */}
        <div className={`flex-1 flex flex-col overflow-hidden p-3 sm:p-4 ${
          posMobileTab === "products" ? "flex" : "hidden lg:flex"
        } ${
          posTheme === "neobrutalist"
            ? "bg-white text-black"
            : "bg-[#f1f5f9] text-slate-800"
        }`}>
          
          {/* Search & filters */}
          <div className={`p-3.5 shrink-0 mb-3 ${
            posTheme === "neobrutalist"
              ? "bg-white border-4 border-black shadow-[4px_4px_0px_#000]"
              : "bg-white rounded-2xl border border-slate-200/60 shadow-sm"
          }`}>
            
            <div className="flex gap-2.5">
              <div className="relative flex-1 group">
                <Search className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${posTheme === "neobrutalist" ? "text-black" : "text-slate-300 group-focus-within:text-blue-500"}`} />
                <input
                  type="text"
                  placeholder="ابحث عن منتج بالاسم أو الباركود..."
                  className={`w-full text-xs text-right placeholder:text-slate-400 ${
                    posTheme === "neobrutalist"
                      ? "bg-white border-2 border-black py-2.5 pr-10 pl-10 font-black focus:outline-none focus:bg-[#ffeb3b]/10"
                      : "bg-slate-50/80 border border-slate-200/80 rounded-xl py-2.5 pr-10 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 focus:bg-white transition-all"
                  }`}
                  value={searchQuery ?? ""}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center transition-all ${
                      posTheme === "neobrutalist"
                        ? "bg-black text-white hover:bg-neutral-800"
                        : "bg-slate-200/80 hover:bg-slate-300 rounded-full text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <VoiceInputButton
                onTranscript={(text) => setSearchQuery(text)}
                className={posTheme === "neobrutalist" 
                  ? "h-11 bg-white border-2 border-black text-black font-extrabold shadow-[2px_2px_0px_#000]" 
                  : "h-11 bg-slate-50 hover:bg-teal-50 text-teal-600 border border-slate-200 rounded-xl"}
              />

              {posConfig.screen.showBarcode && (
              <button
                onClick={() => { playBeep(); setShowBarcodeModal(true); }}
                className={`h-11 flex items-center justify-center shrink-0 transition-all ${
                  posTheme === "neobrutalist"
                    ? "w-16 bg-[#ffeb3b] border-2 border-black text-black font-extrabold shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                    : "w-11 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-500 rounded-xl border border-slate-200 hover:border-blue-200"
                }`}
                title="مسح باركود"
              >
                {posTheme === "neobrutalist" ? (
                  <span className="font-mono text-xs font-black">SCAN_BAR</span>
                ) : (
                  <Scale className="w-4.5 h-4.5" />
                )}
              </button>
              )}
            </div>

            {/* Filters row */}
            <div className="flex items-center justify-between mt-2.5">
              <div className="flex items-center gap-1.5">
                {posConfig.screen.showBrandFilter && uniqueBrands.length > 0 && (
                  <select
                    value={selectedBrand ?? ""}
                    onChange={(e) => { setSelectedBrand(e.target.value); playBeep(); }}
                    className={`text-[10px] px-2 py-1 focus:outline-none text-right font-bold ${
                      posTheme === "neobrutalist"
                        ? "bg-white border-2 border-black text-black"
                        : "bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:border-blue-500"
                    }`}
                  >
                    <option value="all">كل الماركات</option>
                    {uniqueBrands.map((b, bIdx) => <option key={`pos-brand-${b || bIdx}-${bIdx}`} value={b}>{b}</option>)}
                  </select>
                )}
                {posConfig.screen.showUnitFilter && uniqueUnits.length > 0 && (
                  <select
                    value={selectedUnit ?? ""}
                    onChange={(e) => { setSelectedUnit(e.target.value); playBeep(); }}
                    className={`text-[10px] px-2 py-1 focus:outline-none text-right font-bold ${
                      posTheme === "neobrutalist"
                        ? "bg-white border-2 border-black text-black"
                        : "bg-slate-50 border border-slate-200 rounded-lg text-slate-600 focus:border-blue-500"
                    }`}
                  >
                    <option value="all">كل الوحدات</option>
                    {uniqueUnits.map((u, uIdx) => <option key={`pos-unit-${u || uIdx}-${uIdx}`} value={u}>{u}</option>)}
                  </select>
                )}
              </div>

              <div className="flex items-center gap-3">
                {/* Active category indicator */}
                {selectedCategoryFilter !== "all" && (() => {
                  const activeCat = mergedCategories.find((c) => c.id.toString() === selectedCategoryFilter || c.name === selectedCategoryFilter);
                  if (!activeCat) return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`flex items-center gap-2 px-3 py-1 ${
                        posTheme === "neobrutalist"
                          ? "bg-[#ffeb3b]/20 border-2 border-black text-black font-extrabold"
                          : "bg-blue-50 border border-blue-100 rounded-full"
                      }`}
                    >
                      <span style={{ fontSize: 14 }}>{getCategoryIcon(activeCat.id, activeCat.name)}</span>
                      <span className={`text-[11px] font-bold ${posTheme === "neobrutalist" ? "text-black font-black" : "text-blue-700"}`}>{activeCat.name}</span>
                      <button
                        onClick={() => { setSelectedCategoryFilter("all"); playBeep(); }}
                        className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                          posTheme === "neobrutalist" ? "bg-black text-[#ffeb3b]" : "bg-blue-200/60 hover:bg-blue-300/80"
                        }`}
                      >
                        <X className="w-2.5 h-2.5 text-current" />
                      </button>
                    </motion.div>
                  );
                })()}
                <div className={`flex gap-0.5 p-0.5 ${
                  posTheme === "neobrutalist"
                    ? "bg-white border-2 border-black"
                    : "bg-slate-100 rounded-xl border border-slate-200/80"
                }`}>
                  <button
                    onClick={() => { setWorkspaceTab("categories"); playBeep(); }}
                    className={`px-3 py-1.5 text-[10px] font-extrabold transition-all ${
                      workspaceTab === "categories"
                        ? posTheme === "neobrutalist" ? "bg-black text-white" : "bg-white text-slate-800 shadow-sm rounded-lg"
                        : posTheme === "neobrutalist" ? "text-black hover:bg-slate-100" : "text-slate-500 hover:text-slate-700 rounded-lg"
                    }`}
                  >الكل</button>
                  <button
                    onClick={() => { setWorkspaceTab("favorites"); playBeep(); }}
                    className={`px-3 py-1.5 text-[10px] font-extrabold transition-all ${
                      workspaceTab === "favorites"
                        ? posTheme === "neobrutalist" ? "bg-black text-white" : "bg-white text-slate-800 shadow-sm rounded-lg"
                        : posTheme === "neobrutalist" ? "text-black hover:bg-slate-100" : "text-slate-500 hover:text-slate-700 rounded-lg"
                    }`}
                  >المفضلة</button>
                  <button
                    onClick={() => { setWorkspaceTab("most_selling"); playBeep(); }}
                    className={`px-3 py-1.5 text-[10px] font-extrabold transition-all ${
                      workspaceTab === "most_selling"
                        ? posTheme === "neobrutalist" ? "bg-black text-white" : "bg-white text-slate-800 shadow-sm rounded-lg"
                        : posTheme === "neobrutalist" ? "text-black hover:bg-slate-100" : "text-slate-500 hover:text-slate-700 rounded-lg"
                    }`}
                  >الأكثر مبيعاً</button>
                </div>
                <div className={`flex gap-0.5 p-0.5 ${
                  posTheme === "neobrutalist"
                    ? "bg-white border-2 border-black"
                    : "bg-slate-100 rounded-xl border border-slate-200/80"
                }`}>
                  <button
                    onClick={() => { setViewMode("grid"); playBeep(); }}
                    className={`p-1.5 transition-all ${
                      viewMode === "grid"
                        ? posTheme === "neobrutalist" ? "bg-black text-white" : "bg-white text-slate-800 shadow-sm rounded-lg"
                        : "text-slate-400 hover:text-slate-600 rounded-lg"
                    }`}
                  ><Grid className="w-3.5 h-3.5" /></button>
                  <button
                    onClick={() => { setViewMode("list"); playBeep(); }}
                    className={`p-1.5 transition-all ${
                      viewMode === "list"
                        ? posTheme === "neobrutalist" ? "bg-black text-white" : "bg-white text-slate-800 shadow-sm rounded-lg"
                        : "text-slate-400 hover:text-slate-600 rounded-lg"
                    }`}
                  ><List className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          </div>

          {/* Top-bar Main Categories when selected in Screen Design */}
          {activeScreenDesign.categoriesPosition === "top-bar" && (
            <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none shrink-0 items-center py-1 px-0.5">
              <button
                type="button"
                onClick={() => { setSelectedCategoryFilter("all"); playBeep(); }}
                className={`px-3.5 py-2 text-xs font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  selectedCategoryFilter === "all"
                    ? isNeo
                      ? "bg-[#ffeb3b] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                      : "text-white shadow-sm rounded-xl"
                    : isNeo
                      ? "bg-white text-black border-2 border-black"
                      : isDark
                        ? "bg-slate-900 border border-slate-800 text-slate-300 rounded-xl"
                        : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
                }`}
                style={selectedCategoryFilter === "all" && !isNeo ? { backgroundColor: activeScreenDesign.primaryColor } : undefined}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>جميع الأقسام ({mergedProducts.length})</span>
              </button>
              {mainCategories.map((cat) => {
                const isSelected = selectedCategoryFilter === cat.id.toString() || selectedCategoryFilter === cat.name;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => { setSelectedCategoryFilter(cat.id.toString()); playBeep(); }}
                    className={`px-3.5 py-2 text-xs font-black transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? isNeo
                          ? "bg-[#ffeb3b] text-black border-2 border-black shadow-[2px_2px_0px_#000]"
                          : "text-white shadow-sm rounded-xl"
                        : isNeo
                          ? "bg-white text-black border-2 border-black"
                          : isDark
                            ? "bg-slate-900 border border-slate-800 text-slate-300 rounded-xl"
                            : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
                    }`}
                    style={isSelected && !isNeo ? { backgroundColor: activeScreenDesign.primaryColor } : undefined}
                  >
                    <span>{getCategoryIcon(cat.id, cat.name)}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Subcategories — Modern pills */}
          {activeSubcategories.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none shrink-0 items-center py-1.5 px-1">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => { setSelectedSubcategoryFilter("all"); playBeep(); }}
                className={`px-3.5 py-1.5 text-[11px] font-extrabold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  selectedSubcategoryFilter === "all"
                    ? posTheme === "neobrutalist"
                      ? "bg-black text-[#ffeb3b] border-2 border-black shadow-[2px_2px_0px_#000] -translate-x-0.5 -translate-y-0.5"
                      : "bg-[#1a3a8a] text-white shadow-md shadow-blue-600/20 rounded-full"
                    : posTheme === "neobrutalist"
                      ? "bg-white text-black border-2 border-black"
                      : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 rounded-full"
                }`}
              >
                <LayoutGrid className="w-3 h-3" />
                الكل
              </motion.button>
              {activeSubcategories.map((subcat) => {
                const count = mergedProducts.filter((p) => p.category_id === subcat.id).length;
                const isActive = selectedSubcategoryFilter === subcat.id.toString();
                return (
                  <motion.button
                    key={subcat.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { setSelectedSubcategoryFilter(subcat.id.toString()); playBeep(); }}
                    className={`px-3.5 py-1.5 text-[11px] font-extrabold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                      isActive
                        ? posTheme === "neobrutalist"
                          ? "bg-[#ffeb3b] text-black border-2 border-black shadow-[2px_2px_0px_#000] -translate-x-0.5 -translate-y-0.5"
                          : "bg-[#1a3a8a] text-white shadow-md shadow-blue-600/20 rounded-full"
                        : posTheme === "neobrutalist"
                          ? "bg-white text-black border-2 border-black"
                          : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-700 rounded-full"
                    }`}
                  >
                    <Tag className="w-3 h-3" />
                    {subcat.name}
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 ${
                      isActive
                        ? posTheme === "neobrutalist" ? "bg-black text-white" : "bg-white/20 rounded-full"
                        : posTheme === "neobrutalist" ? "bg-black text-[#ffeb3b]" : "bg-slate-100 rounded-full"
                    }`}>{count}</span>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* Product grid/list */}
          <div className="flex-1 overflow-y-auto pr-0.5 pl-0.5">
            {filteredProducts.length === 0 ? (
              posTheme === "neobrutalist" ? (
                <div className="h-full flex flex-col items-center justify-center py-16">
                  <div className="transform -rotate-3 bg-black text-white p-8 border-4 border-black shadow-[6px_6px_0px_#ffeb3b] text-center max-w-sm">
                    <h2 className="font-black text-2xl tracking-tight mb-2">NULL_DATA</h2>
                    <p className="text-sm font-bold text-amber-300">لا توجد منتجات مطابقة في هذا القسم</p>
                    <p className="text-xs text-slate-400 mt-2">يرجى اختيار قسم آخر أو تجربة البحث باسم مختلف</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 py-16">
                  <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center">
                    <Package className="w-10 h-10 stroke-[1]" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-400">لا توجد منتجات مطابقة</p>
                    <p className="text-[11px] text-slate-300 mt-1">جرّب تغيير القسم أو البحث</p>
                  </div>
                </div>
              )
            ) : viewMode === "grid" ? (
              <div className={getProductGridClass(posConfig.screen.productsPerRow)}>
                {filteredProducts.map((product) => {
                  const isInCart = cart.some((item) => item.id === product.id);
                  return (
                    <motion.div
                      key={product.id}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => addToCart(product)}
                      className={`overflow-hidden transition-all duration-200 cursor-pointer flex flex-col relative group ${
                        posTheme === "neobrutalist"
                          ? isInCart
                            ? "bg-white border-4 border-black shadow-[4px_4px_0px_#ffeb3b] -translate-x-0.5 -translate-y-0.5"
                            : "bg-white border-4 border-black shadow-[4px_4px_0px_#000] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[6px_6px_0px_#000]"
                          : isInCart
                            ? "bg-white rounded-2xl border-blue-400 ring-2 ring-blue-400/15 border shadow-sm hover:shadow-lg"
                            : "bg-white rounded-2xl border-slate-200/50 hover:border-slate-300 border shadow-sm hover:shadow-lg"
                      }`}
                    >
                      {/* Favorite */}
                      <button
                        onClick={(e) => { e.stopPropagation(); playBeep(); product.is_favorite = !product.is_favorite; setWorkspaceTab(workspaceTab); }}
                        className={`absolute top-2 right-2 z-10 p-1 transition-all shadow-sm ${
                          product.is_favorite
                            ? posTheme === "neobrutalist" ? "text-red-600 bg-[#ffeb3b] border border-black" : "text-amber-500 bg-white rounded-full"
                            : posTheme === "neobrutalist" ? "text-black bg-white border border-black" : "text-slate-300 hover:text-amber-400 bg-white/80 rounded-full"
                        }`}
                      >
                        <Heart className="w-3.5 h-3.5 fill-current" />
                      </button>

                      {/* Cart indicator */}
                      {isInCart && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className={`absolute top-2 left-2 z-10 w-6 h-6 flex items-center justify-center shadow-md ${
                            posTheme === "neobrutalist"
                              ? "bg-black border border-white text-white text-xs font-black"
                              : "bg-[#1a3a8a] text-white text-[9px] font-bold rounded-full shadow-blue-600/30"
                          }`}
                        >
                          <span>
                            {cart.find((item) => item.id === product.id)?.quantity || 0}
                          </span>
                        </motion.div>
                      )}

                      {/* Image */}
                      <div className={`aspect-[4/3] relative flex items-center justify-center shrink-0 ${
                        posTheme === "neobrutalist"
                          ? "bg-white border-b-2 border-black"
                          : "bg-gradient-to-br from-slate-50 to-slate-100/50"
                      }`}>
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300" referrerPolicy="no-referrer" />
                        ) : (
                          <div className={`w-12 h-12 flex items-center justify-center ${posTheme === "neobrutalist" ? "bg-white border border-black" : "bg-slate-100 rounded-2xl"}`}>
                            <Package className="w-6 h-6 text-slate-200" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-3 flex items-end justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h3 className={`font-black text-[11px] leading-snug line-clamp-1 truncate ${posTheme === "neobrutalist" ? "text-black" : "text-slate-700"}`}>{product.name}</h3>
                          <span className="text-[9px] text-slate-400 font-mono mt-0.5 block">SKU: {product.barcode || product.id}</span>
                        </div>
                        <span className={`text-xs font-extrabold shrink-0 shadow-sm ${
                          posTheme === "neobrutalist"
                            ? "bg-[#ffeb3b] border-2 border-black text-black px-2 py-0.5 shadow-[1px_1px_0px_#000]"
                            : "bg-gradient-to-b from-blue-50 to-blue-100/80 px-2.5 py-1 rounded-xl text-[#1a3a8a]"
                        }`}>
                          {product.price.toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className={`overflow-hidden shadow-sm ${
                posTheme === "neobrutalist"
                  ? "bg-white border-4 border-black shadow-[4px_4px_0px_#000]"
                  : "bg-white rounded-2xl border border-slate-200/60"
              }`}>
                <table className="w-full text-right text-xs">
                  <thead className={`text-[10px] font-semibold border-b ${
                    posTheme === "neobrutalist"
                      ? "bg-black text-white border-black"
                      : "bg-gradient-to-l from-slate-50 to-slate-100/80 text-slate-500 border-slate-100"
                  }`}>
                    <tr>
                      <th className="p-3">المنتج</th>
                      <th className="p-3">باركود</th>
                      <th className="p-3 text-left">السعر</th>
                    </tr>
                  </thead>
                  <tbody className={posTheme === "neobrutalist" ? "divide-y divide-black" : "divide-y divide-slate-50"}>
                    {filteredProducts.map((product) => (
                      <motion.tr
                        key={product.id}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => addToCart(product)}
                        className={`cursor-pointer transition-colors group ${
                          posTheme === "neobrutalist"
                            ? "hover:bg-[#ffeb3b]/10 text-black font-extrabold"
                            : "hover:bg-blue-50/50 text-slate-700"
                        }`}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 flex items-center justify-center shrink-0 transition-colors ${
                              posTheme === "neobrutalist" ? "bg-white border border-black text-black" : "bg-slate-50 rounded-lg group-hover:bg-blue-100/60"
                            }`}>
                              <Package className="w-4 h-4 text-slate-300 group-hover:text-blue-400 transition-colors" />
                            </div>
                            <span className="font-bold">{product.name}</span>
                          </div>
                        </td>
                        <td className="p-3 font-mono text-slate-400 text-[10px]">{product.barcode || product.id}</td>
                        <td className={`p-3 font-extrabold text-left ${posTheme === "neobrutalist" ? "text-black" : "text-[#1a3a8a]"}`}>{product.price.toFixed(2)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sticky Mobile Cart Floating Bar */}
          {cart.length > 0 && posMobileTab === "products" && (
            <div className="lg:hidden shrink-0 mt-2 p-2 bg-white border-t border-slate-200 z-30 shadow-lg rounded-2xl">
              <button
                type="button"
                onClick={() => setPosMobileTab("cart")}
                className={`w-full py-3 px-4 flex items-center justify-between font-black text-xs sm:text-sm rounded-xl transition-all ${
                  posTheme === "neobrutalist"
                    ? "bg-[#ffeb3b] text-black border-2 border-black shadow-[3px_3px_0px_#000]"
                    : "bg-blue-600 text-white shadow-md hover:bg-blue-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4.5 h-4.5" />
                  <span>عرض السلة ({totals.totalPieces} قطعة)</span>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <span>{totals.finalTotal.toFixed(2)} {currency}</span>
                  <ChevronLeft className="w-4 h-4" />
                </div>
              </button>
            </div>
          )}

        </div>

        {posConfig.screen.showCategorySidebar && (
          <>
        {/* 4. CATEGORIES SIDEBAR — Modern */}
        <div className="hidden lg:flex w-64 bg-gradient-to-b from-[#0f1b3d] via-[#132c63] to-[#0d1a38] flex-col shrink-0 z-10 text-right">
          
          {/* Header */}
          <div className="p-4 pb-3 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Layers className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-sm tracking-tight">الأقسام</h2>
                  <p className="text-blue-300/50 text-[10px] font-medium">{mainCategories.length} قسم</p>
                </div>
              </div>
            </div>
          </div>

          {/* Categories list */}
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-1 scrollbar-thin">
            
            {/* "All" button */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => { setSelectedCategoryFilter("all"); playBeep(); }}
              className={`w-full py-2.5 px-3 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-between gap-2 relative overflow-hidden ${
                selectedCategoryFilter === "all"
                  ? "bg-gradient-to-l from-blue-500/90 to-blue-600/90 text-white shadow-lg shadow-blue-600/30"
                  : "text-blue-200/70 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {selectedCategoryFilter === "all" && (
                <motion.div
                  layoutId="catActiveIndicator"
                  className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400 rounded-r-full"
                />
              )}
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedCategoryFilter === "all"
                    ? "bg-white/20"
                    : "bg-white/[0.06]"
                }`}>
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <span>جميع المنتجات</span>
              </div>
              <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full ${
                selectedCategoryFilter === "all"
                  ? "bg-white/20"
                  : "bg-white/[0.08]"
              }`}>{mergedProducts.length}</span>
            </motion.button>

            {/* Category items */}
            {mainCategories.map((cat, idx) => {
              const subcatIds = mergedCategories.filter((sc) => sc.parent_id === cat.id).map((sc) => sc.id);
              const count = mergedProducts.filter((p) => p.category_id === cat.id || subcatIds.includes(p.category_id)).length;
              const isSelected = selectedCategoryFilter === cat.id.toString() || selectedCategoryFilter === cat.name;
              const catColor = cat.color || "#3b82f6";
              return (
                <motion.button
                  key={cat.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { setSelectedCategoryFilter(cat.id.toString()); playBeep(); }}
                  className={`w-full py-2.5 px-3 rounded-xl text-[12px] font-medium transition-all flex items-center justify-between gap-2 relative overflow-hidden group ${
                    isSelected
                      ? "bg-gradient-to-l from-blue-500/90 to-blue-600/90 text-white shadow-lg shadow-blue-600/30"
                      : "text-blue-200/70 hover:bg-white/[0.06] hover:text-white"
                  }`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.2 }}
                >
                  {isSelected && (
                    <motion.div
                      layoutId="catActiveIndicator"
                      className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400 rounded-r-full"
                    />
                  )}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                      style={{
                        backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : `${catColor}20`,
                        color: isSelected ? "#fff" : catColor
                      }}
                    >
                      <span className="text-[16px]">{getCategoryIcon(cat.id, cat.name)}</span>
                    </div>
                    <span className="truncate">{cat.name}</span>
                  </div>
                  {count > 0 && (
                    <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full shrink-0 ${
                      isSelected
                        ? "bg-white/20"
                        : "bg-white/[0.08] group-hover:bg-white/[0.12]"
                    } transition-colors`}>{count}</span>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Numpad — Modern */}
          {posConfig.screen.showNumpad && (
          <div className="p-3 bg-black/20 border-t border-white/[0.06] shrink-0">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <span className="text-[10px] text-blue-300/60 font-semibold">الكمية / الدفع</span>
              <button
                onClick={() => { playBeep(); setNumpadMode(numpadMode === "qty" ? "amount" : "qty"); setQuantityBuffer(""); }}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20 hover:bg-amber-400/20 transition-colors"
              >
                <ArrowRight className="w-3 h-3" />
                {numpadMode === "qty" ? "كمية" : "مدفوع"}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              <button onClick={() => handleNumpadPress("7")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">7</button>
              <button onClick={() => handleNumpadPress("8")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">8</button>
              <button onClick={() => handleNumpadPress("9")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">9</button>
              <button onClick={() => handleNumpadPress("backspace")} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/10 rounded-xl h-9 flex items-center justify-center transition-colors"><X className="w-3.5 h-3.5" /></button>
              <button onClick={() => handleNumpadPress("4")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">4</button>
              <button onClick={() => handleNumpadPress("5")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">5</button>
              <button onClick={() => handleNumpadPress("6")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">6</button>
              <button onClick={() => { playBeep(); if (cart.length === 0) { alert("السلة فارغة."); return; } if (numpadMode === "qty") { setQuantityBuffer(""); } else { handleCheckout("cash"); } }} className="bg-emerald-500/80 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-xl h-[78px] row-span-2 flex flex-col items-center justify-center gap-1 transition-colors shadow-lg shadow-emerald-600/20 border border-emerald-400/20">
                <span className="text-[11px]">Enter</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleNumpadPress("1")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">1</button>
              <button onClick={() => handleNumpadPress("2")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">2</button>
              <button onClick={() => handleNumpadPress("3")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">3</button>
              <button onClick={() => handleNumpadPress("0")} className="col-span-2 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">0</button>
              <button onClick={() => handleNumpadPress(".")} className="bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium rounded-xl h-9 flex items-center justify-center transition-colors border border-white/[0.04]">.</button>
            </div>
          </div>
          )}

          {/* Manage button */}
          <div className="p-3 bg-black/20 border-t border-white/[0.06]">
            <button
              onClick={handleSafeBack}
              className="w-full py-2.5 bg-gradient-to-l from-white/[0.08] to-white/[0.04] text-blue-200/80 hover:text-white hover:from-white/[0.14] hover:to-white/[0.08] rounded-xl text-[11px] font-semibold text-center flex items-center justify-center gap-2 transition-all border border-white/[0.06] hover:border-white/[0.12]"
            >
              <Settings2 className="w-4 h-4" />
              <span>إدارة الأقسام</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

          </>
        )}
      </div>

      {/* FOOTER */}
      <div className="h-7 bg-slate-800 text-slate-500 flex items-center justify-between px-5 shrink-0 text-[10px]">
        <div className="flex items-center gap-4">
          {posConfig.reports.showTodaySales && (
            <span>مبيعات اليوم: <span className="text-emerald-400 font-mono">5,650.00 {currency}</span></span>
          )}
          {posConfig.reports.showInvoiceCount && (
            <span>فواتير: <span className="text-blue-400 font-mono">45</span></span>
          )}
          {posConfig.reports.showTopProducts && (
            <span>أصناف: <span className="text-amber-400 font-mono">{mergedProducts.length}</span></span>
          )}
        </div>
        <span className="text-slate-600 font-mono">{activeProfile.label}</span>
      </div>

      {/* MODALS */}

      {/* A. BARCODE SCAN SIMULATOR */}
      <AnimatePresence>
        {showBarcodeModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl text-right"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-sans font-black text-slate-800 text-base">محاكاة قارئ الباركود</h3>
                <button onClick={() => setShowBarcodeModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                في بيئة الإنتاج، يتم تمرير قارئ الباركود العادي فيقوم بإدخال الرمز مباشرة. يمكنك هنا اختيار أحد الباركودات التجريبية أو كتابة باركود مخصص للبحث والإضافة الفورية للطلب:
              </p>

              <div className="space-y-2 mb-4">
                <span className="text-[10px] font-black text-slate-400 block mb-1">رموز سريعة للتجربة:</span>
                <div className="grid grid-cols-2 gap-2">
                  {mergedProducts.filter(p => p.barcode).slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleBarcodeSubmit(p.barcode)}
                      className="p-2 bg-slate-50 hover:bg-blue-50 border border-slate-200/60 rounded-xl text-right text-xs text-slate-700 font-medium transition-all"
                    >
                      <span className="block font-bold truncate">{p.name}</span>
                      <span className="block text-[9px] font-mono text-slate-400 mt-0.5">{p.barcode}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="أدخل رمز الباركود يدوياً..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl py-2 px-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={barcodeInput ?? ""}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleBarcodeSubmit();
                  }}
                  autoFocus
                />
                <button
                  onClick={() => handleBarcodeSubmit()}
                  className="px-4 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-all"
                >
                  إضافة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B. CHOOSE CUSTOMER — اختيار عميل الفاتورة (تصميم المرجع) */}
      <AnimatePresence>
        {showCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-5" dir="rtl">
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="relative grid h-[88vh] max-h-[720px] w-full max-w-[1180px] grid-cols-1 overflow-hidden rounded-[28px] bg-white text-right shadow-[0_40px_90px_-25px_rgba(15,23,42,0.55)] lg:grid-cols-2"
            >
              <button
                type="button"
                onClick={() => setShowCustomerModal(false)}
                className="absolute left-4 top-4 z-30 hidden h-9 w-9 place-items-center rounded-full bg-white/70 text-slate-400 backdrop-blur transition hover:bg-slate-100 hover:text-slate-700 lg:grid"
                aria-label="إغلاق"
              >
                <X className="h-5 w-5" />
              </button>

              {/* اللوحة اليمنى: تسجيل عميل جديد / عميل مسجل */}
              <div
                className={`relative min-h-0 flex-col overflow-hidden bg-gradient-to-br from-[#173a93] via-[#1f4ecb] to-[#2f66e8] text-white ${
                  customerModalTab === "list" ? "hidden lg:flex" : "flex"
                }`}
              >
                <div className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full bg-white/10" />
                <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/5" />

                <div className="relative flex items-start justify-between gap-3 px-7 pb-1 pt-7">
                  <button
                    type="button"
                    onClick={() => setShowCustomerModal(false)}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 lg:hidden"
                    aria-label="إغلاق"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex-1">
                    <h3 className="text-[22px] font-black leading-tight">اختيار عميل الفاتورة</h3>
                    <p className="mt-1.5 text-[11.5px] font-medium text-blue-100/90">اختر عميل مسجل من القائمة أو قم بتسجيل عميل جديد</p>
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/25">
                    <UserPlus className="h-6 w-6" />
                  </div>
                </div>

                <div className="relative mt-4 flex-1 overflow-y-auto px-5 pb-5">
                  <div className="rounded-[22px] bg-white p-5 text-slate-800 shadow-xl">
                    <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-xl bg-slate-50 p-1.5">
                      <button
                        type="button"
                        onClick={() => setCustomerModalTab("new")}
                        className={`flex h-10 items-center justify-center gap-2 rounded-lg text-[12px] font-black transition-all ${
                          customerModalTab === "new"
                            ? "bg-[#1d4ed8] text-white shadow-md shadow-blue-600/25"
                            : "text-slate-500 hover:bg-white"
                        }`}
                      >
                        <UserPlus className="h-4 w-4" />
                        تسجيل عميل جديد
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomerModalTab("list")}
                        className={`flex h-10 items-center justify-center gap-2 rounded-lg text-[12px] font-black transition-all ${
                          customerModalTab === "list"
                            ? "bg-[#1d4ed8] text-white shadow-md shadow-blue-600/25"
                            : "text-slate-500 hover:bg-white"
                        }`}
                      >
                        <List className="h-4 w-4" />
                        عميل مسجل
                      </button>
                    </div>

                    {customerModalTab === "new" ? (
                      <form onSubmit={handleAddCustomer} className="space-y-3.5">
                        <div className="flex items-center gap-2 text-[13px] font-black text-slate-700">
                          <User className="h-4 w-4 text-[#1d4ed8]" />
                          بيانات العميل
                        </div>

                        <label className="block">
                          <span className="mb-1.5 flex items-center gap-1 text-[11px] font-black text-slate-600">
                            الاسم الكامل
                            <span className="text-rose-500">*</span>
                          </span>
                          <span className="relative block">
                            <input
                              type="text"
                              required
                              value={newCustomerForm.name}
                              onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                              placeholder="ادخل اسم العميل بالكامل"
                              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-[12.5px] font-semibold text-slate-700 outline-none transition placeholder:font-medium placeholder:text-slate-300 focus:border-[#1d4ed8] focus:ring-4 focus:ring-blue-500/10"
                            />
                            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                          </span>
                        </label>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-1.5 flex items-center gap-1 text-[11px] font-black text-slate-600">
                              رقم الهاتف
                              <span className="text-rose-500">*</span>
                            </span>
                            <span className="relative block">
                              <input
                                type="tel"
                                required
                                dir="ltr"
                                value={newCustomerForm.phone}
                                onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, phone: e.target.value }))}
                                placeholder="05xxxxxxxx"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-right text-[12.5px] font-semibold text-slate-700 outline-none transition placeholder:font-medium placeholder:text-slate-300 focus:border-[#1d4ed8] focus:ring-4 focus:ring-blue-500/10"
                              />
                              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                            </span>
                          </label>

                          <label className="block">
                            <span className="mb-1.5 flex items-center gap-1 text-[11px] font-black text-slate-600">
                              البريد الإلكتروني
                            </span>
                            <span className="relative block">
                              <input
                                type="email"
                                dir="ltr"
                                value={newCustomerForm.email}
                                onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, email: e.target.value }))}
                                placeholder="example@domain.com"
                                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-left text-[12.5px] font-semibold text-slate-700 outline-none transition placeholder:font-medium placeholder:text-slate-300 focus:border-[#1d4ed8] focus:ring-4 focus:ring-blue-500/10"
                              />
                              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                            </span>
                          </label>
                        </div>

                        <label className="block">
                          <span className="mb-1.5 flex items-center gap-1 text-[11px] font-black text-slate-600">
                            العنوان بالتفصيل
                          </span>
                          <span className="relative block">
                            <textarea
                              rows={2}
                              value={newCustomerForm.address}
                              onChange={(e) => setNewCustomerForm((prev) => ({ ...prev, address: e.target.value }))}
                              placeholder="أدخل العنوان بالتفصيل"
                              className="w-full resize-none rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3.5 text-[12.5px] font-semibold text-slate-700 outline-none transition placeholder:font-medium placeholder:text-slate-300 focus:border-[#1d4ed8] focus:ring-4 focus:ring-blue-500/10"
                            />
                            <MapPin className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-300" />
                          </span>
                        </label>

                        <button
                          type="submit"
                          className="mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] text-[13px] font-black text-white shadow-lg shadow-blue-600/25 transition hover:bg-[#1a43bb] active:scale-[0.99]"
                        >
                          <Save className="h-4 w-4" />
                          إضافة العميل وحفظه
                        </button>
                      </form>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[13px] font-black text-slate-700">
                          <UserCheck className="h-4 w-4 text-[#1d4ed8]" />
                          بيانات العميل
                        </div>

                        {selectedCustomer ? (
                          <div className="rounded-2xl border border-blue-100 bg-[#f3f7ff] p-4">
                            <div className="flex items-center gap-3">
                              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-base font-black ${customerAvatarClass(selectedCustomer)}`}>
                                {customerInitial(selectedCustomer)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-black text-slate-800">{selectedCustomer.name}</p>
                                <p className="mt-0.5 text-[11px] font-bold text-slate-500" dir="ltr">{selectedCustomer.phone}</p>
                              </div>
                              <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1d4ed8]" />
                            </div>
                            {selectedCustomer.address && (
                              <p className="mt-3 flex items-start gap-1.5 text-[11px] font-semibold leading-relaxed text-slate-500">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                {selectedCustomer.address}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setShowCustomerModal(false);
                                playBeep();
                              }}
                              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#1d4ed8] text-[12px] font-black text-white transition hover:bg-[#1a43bb]"
                            >
                              <Check className="h-4 w-4" />
                              تأكيد اختيار العميل
                            </button>
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center">
                            <User className="mx-auto h-7 w-7 text-slate-300" />
                            <p className="mt-2 text-[12px] font-bold text-slate-500">لم يتم اختيار عميل بعد</p>
                            <p className="mt-1 text-[11px] text-slate-400">اختر عميلاً من القائمة أو سجّل عميلاً جديداً.</p>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(null);
                            setShowCustomerModal(false);
                            playBeep();
                          }}
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white text-[12px] font-black text-slate-600 transition hover:bg-slate-50"
                        >
                          عميل نقدي (بدون عميل)
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* اللوحة اليسرى: العملاء المسجلون */}
              <div className={`min-h-0 flex-col bg-white ${customerModalTab === "list" ? "flex" : "hidden lg:flex"}`}>
                <div className="px-6 pb-3 pt-6 lg:pt-14">
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="ابحث عن عميل بالاسم أو رقم الهاتف أو البريد..."
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-11 pr-4 text-[12.5px] font-semibold text-slate-700 outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-[#1d4ed8] focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                    />
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {[
                      { id: "all", label: "الكل", icon: List },
                      { id: "individual", label: "أفراد", icon: User },
                      { id: "company", label: "شركات", icon: Building2 },
                      { id: "vip", label: "مميزين", icon: Star },
                    ].map((chip) => {
                      const ChipIcon = chip.icon;
                      const isActive = customerFilter === chip.id;
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => setCustomerFilter(chip.id as any)}
                          className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-[11.5px] font-black transition ${
                            isActive
                              ? "bg-[#1d4ed8] text-white shadow-md shadow-blue-600/25"
                              : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          <ChipIcon className="h-3.5 w-3.5" />
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[12px] font-black text-slate-700">
                      العملاء المسجلين
                      <span className="mr-1 text-[11px] font-bold text-slate-400">({filteredCustomerList.length} عميل)</span>
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-500">
                      <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-400">ترتيب حسب:</span>
                      <select
                        value={customerSort}
                        onChange={(e) => setCustomerSort(e.target.value as any)}
                        className="cursor-pointer appearance-none bg-transparent text-[11.5px] font-black text-slate-700 outline-none"
                      >
                        <option value="newest">الأحدث</option>
                        <option value="oldest">الأقدم</option>
                        <option value="name">الاسم</option>
                        <option value="spent">الأكثر شراءً</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-4">
                  {pagedCustomerList.length === 0 ? (
                    <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-10 text-center">
                      <Search className="mx-auto h-7 w-7 text-slate-300" />
                      <p className="mt-2 text-[12px] font-bold text-slate-500">لا يوجد عملاء مطابقون للبحث</p>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerSearch("");
                          setCustomerFilter("all");
                        }}
                        className="mt-3 rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-[#1d4ed8] ring-1 ring-slate-200"
                      >
                        مسح البحث
                      </button>
                    </div>
                  ) : (
                    pagedCustomerList.map((c: any) => {
                      const isSelected = selectedCustomer?.id === c.id;
                      const isVip = isVipCustomer(c);
                      const kind = customerKindOf(c);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShowCustomerModal(false);
                            playBeep();
                          }}
                          className={`group mb-2 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-right transition-all ${
                            isSelected
                              ? "border-blue-200 bg-[#eaf1ff]"
                              : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-black ${customerAvatarClass(c)}`}>
                            {customerInitial(c)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-[13px] font-black text-slate-800">{c.name}</span>
                              {isVip ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-100 bg-violet-50 px-1.5 py-0.5 text-[9.5px] font-black text-violet-600">
                                  <Star className="h-2.5 w-2.5" />
                                  مميز
                                </span>
                              ) : kind === "company" ? (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-black text-blue-600">
                                  <Building2 className="h-2.5 w-2.5" />
                                  شركة
                                </span>
                              ) : (
                                <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-black text-emerald-600">
                                  <User className="h-2.5 w-2.5" />
                                  فرد
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-slate-400">
                              <Phone className="h-3 w-3" />
                              <span dir="ltr">{c.phone || "—"}</span>
                            </span>
                          </span>
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#1d4ed8]" />
                          ) : (
                            <ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:text-slate-500" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={customerPageSafe <= 1}
                      onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: Math.min(customerPageCount, 5) }).map((_, idx) => {
                      const windowStart = Math.min(
                        Math.max(customerPageSafe - 2, 1),
                        Math.max(customerPageCount - 4, 1)
                      );
                      const pageNumber = windowStart + idx;
                      return (
                        <button
                          key={pageNumber}
                          type="button"
                          onClick={() => setCustomerPage(pageNumber)}
                          className={`h-7 min-w-7 rounded-lg px-2 text-[11px] font-black transition ${
                            pageNumber === customerPageSafe
                              ? "bg-[#1d4ed8] text-white shadow-sm shadow-blue-600/30"
                              : "text-slate-500 hover:bg-slate-100"
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={customerPageSafe >= customerPageCount}
                      onClick={() => setCustomerPage((p) => Math.min(customerPageCount, p + 1))}
                      className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-[10.5px] font-bold text-slate-400">
                    عرض {pagedCustomerList.length} من {filteredCustomerList.length} عميل
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* B2. CALL CENTER CUSTOMER DETAILS & ORDER CONFIRMATION MODAL */}
      <AnimatePresence>
        {showCallCenterConfirmModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-3xl w-full shadow-2xl flex flex-col max-h-[92vh] text-right border border-slate-100"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-cyan-600 text-white flex items-center justify-center shadow-sm">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-slate-900 text-lg">
                      بيانات العميل وتأكيد أوردر الكول سنتر
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      يرجى إدخال أو مراجعة بيانات العميل والعنوان قبل اعتماد الطلب وإرساله للتجهيز
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCallCenterConfirmModal(false)}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {callCenterFormError && (
                <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 shrink-0">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{callCenterFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-y-auto pr-1">
                {/* Customer Form & Quick Search */}
                <div className="lg:col-span-7 space-y-4">
                  {/* Search existing customers by phone or name */}
                  <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70">
                    <label className="text-[11px] font-black text-slate-600 block mb-2">
                      بحث سريع عن عميل مسجل (برقم الهاتف أو الاسم):
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="اكتب رقم موبايل العميل أو اسمه للبحث التلقائي..."
                        value={callCenterCustomerSearch}
                        onChange={(e) => setCallCenterCustomerSearch(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs font-bold focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    {customers.length > 0 && (
                      <div className="mt-2 max-h-28 overflow-y-auto space-y-1">
                        {customers
                          .filter((c) => {
                            const q = callCenterCustomerSearch.trim().toLowerCase();
                            if (!q) return true;
                            return (
                              String(c.name || "").toLowerCase().includes(q) ||
                              String(c.phone || "").toLowerCase().includes(q)
                            );
                          })
                          .slice(0, 6)
                          .map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setCallCenterForm((prev) => ({
                                  ...prev,
                                  name: c.name || "",
                                  phone: c.phone || "",
                                  address: c.address || prev.address || ""
                                }));
                                setCallCenterFormError(null);
                                playBeep();
                              }}
                              className={`w-full p-2 rounded-xl text-right text-xs flex items-center justify-between transition-all border ${
                                callCenterForm.phone === c.phone && callCenterForm.name === c.name
                                  ? "bg-cyan-50 border-cyan-300 text-cyan-900 font-black"
                                  : "bg-white hover:bg-slate-100 border-slate-100 text-slate-700"
                              }`}
                            >
                              <span className="font-bold truncate">{c.name}</span>
                              <span className="font-mono text-[11px] text-slate-500">{c.phone}</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Customer Entry Fields */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                    <h4 className="font-black text-xs text-slate-800 border-b border-slate-100 pb-2">
                      بيانات العميل والتوصيل
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-black text-slate-700 block mb-1">
                          اسم العميل <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="الاسم بالكامل..."
                          value={callCenterForm.name}
                          onChange={(e) => {
                            setCallCenterForm((prev) => ({ ...prev, name: e.target.value }));
                            setCallCenterFormError(null);
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-bold focus:bg-white focus:border-cyan-600 focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-black text-slate-700 block mb-1">
                          رقم الهاتف <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="01xxxxxxxxx"
                          value={callCenterForm.phone}
                          onChange={(e) => {
                            const phoneVal = e.target.value;
                            setCallCenterForm((prev) => ({ ...prev, phone: phoneVal }));
                            setCallCenterFormError(null);
                            const matched = customers.find((c) => String(c.phone || "").trim() === phoneVal.trim());
                            if (matched) {
                              setSelectedCustomer(matched);
                              setCallCenterForm((prev) => ({
                                ...prev,
                                name: prev.name || matched.name || "",
                                address: prev.address || matched.address || ""
                              }));
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-xs font-mono font-bold focus:bg-white focus:border-cyan-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-slate-700 block mb-1">
                        عنوان التوصيل بالتفصيل {orderType === "DELIVERY" && <span className="text-red-500">*</span>}
                      </label>
                      <textarea
                        placeholder="المنطقة، الشارع، رقم العقار، الدور، الشقة، علامة مميزة..."
                        value={callCenterForm.address}
                        onChange={(e) => {
                          setCallCenterForm((prev) => ({ ...prev, address: e.target.value }));
                          setCallCenterFormError(null);
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold h-16 resize-none focus:bg-white focus:border-cyan-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-black text-slate-700 block mb-1">
                        ملاحظات الأوردر / تعليمات للمطبخ أو الطيار
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: الاتصال قبل الوصول، بدون شطة..."
                        value={callCenterForm.notes}
                        onChange={(e) => setCallCenterForm((prev) => ({ ...prev, notes: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs font-bold focus:bg-white focus:border-cyan-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Order Confirmation Summary */}
                <div className="lg:col-span-5 flex flex-col justify-between bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
                      <span className="font-black text-xs text-slate-800">ملخص تأكيد الأوردر</span>
                      <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-800">
                        {orderTypeLabels[orderType] || orderType}
                      </span>
                    </div>

                    <div className="max-h-44 overflow-y-auto space-y-1.5 mb-3 pr-1">
                      {cart.map((item, i) => (
                        <div key={`${item.id}-${i}`} className="flex items-center justify-between text-xs bg-white p-2 rounded-xl border border-slate-100">
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-slate-800 block truncate">{item.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.quantity} × {item.price.toFixed(2)}
                            </span>
                          </div>
                          <span className="font-mono font-black text-slate-900">
                            {(item.price * item.quantity).toFixed(2)} {currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3 space-y-2">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>الفرع المنفذ:</span>
                      <span className="font-bold text-slate-800">{selectedBranch?.name || branches[0]?.name || "الفرع الرئيسي"}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>طريقة الدفع:</span>
                      <span className="font-bold text-emerald-700">{allPaymentLabels[pendingPaymentMethod]?.ar || pendingPaymentMethod}</span>
                    </div>
                    {totals.discountAmount > 0 && (
                      <div className="flex justify-between text-xs text-emerald-600 font-bold">
                        <span>الخصم:</span>
                        <span className="font-mono">-{totals.discountAmount.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    {totals.taxAmount > 0 && (
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>الضريبة:</span>
                        <span className="font-mono">{totals.taxAmount.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-base font-black text-slate-900 pt-2 border-t border-slate-200">
                      <span>الإجمالي النهائي:</span>
                      <span className="font-mono text-cyan-700">{totals.finalTotal.toFixed(2)} {currency}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCallCenterConfirmModal(false)}
                  className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors"
                >
                  رجوع لتعديل السلة
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const name = callCenterForm.name.trim();
                    const phone = callCenterForm.phone.trim();
                    const address = callCenterForm.address.trim();
                    const notes = callCenterForm.notes.trim();

                    if (!name || !phone) {
                      setCallCenterFormError("يرجى إدخال اسم العميل ورقم الهاتف لتأكيد أوردر الكول سنتر.");
                      return;
                    }
                    if (orderType === "DELIVERY" && !address) {
                      setCallCenterFormError("يرجى إدخال عنوان العميل بالتفصيل لطلبات الدليفري.");
                      return;
                    }

                    let customerRecord = selectedCustomer;
                    const existingMatch = customers.find((c) => String(c.phone || "").trim() === phone);

                    if (!existingMatch) {
                      try {
                        const res = await api.post("/api/customers", { name, phone, address });
                        if (res.ok) {
                          const added = await res.json();
                          customerRecord = { id: added.id, name, phone, address };
                          setCustomers((prev) => [customerRecord, ...prev]);
                        } else {
                          customerRecord = { id: Date.now(), name, phone, address };
                          setCustomers((prev) => [customerRecord, ...prev]);
                        }
                      } catch {
                        customerRecord = { id: Date.now(), name, phone, address };
                        setCustomers((prev) => [customerRecord, ...prev]);
                      }
                    } else {
                      customerRecord = { ...existingMatch, name, phone, address: address || existingMatch.address };
                    }

                    setSelectedCustomer(customerRecord);
                    if (notes) setInvoiceNote(notes);
                    setShowCallCenterConfirmModal(false);

                    await handleCheckout(pendingPaymentMethod, {
                      id: customerRecord?.id,
                      name,
                      phone,
                      address,
                      notes
                    });
                  }}
                  className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>تأكيد الأوردر وإتمام الدفع ({totals.finalTotal.toFixed(2)} {currency})</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* C. HOLD INVOICES LIST */}
      <AnimatePresence>
        {showHoldInvoicesModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-xl flex flex-col max-h-[80vh] text-right"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-4 shrink-0">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <h3 className="font-sans font-black text-slate-800 text-base">استرجاع الفواتير المعلقة</h3>
                </div>
                <button onClick={() => setShowHoldInvoicesModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2">
                {holdInvoices.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 opacity-60 flex flex-col items-center gap-3">
                    <Clock className="w-12 h-12 text-slate-300 stroke-[1.2]" />
                    <p className="text-xs font-bold">لا يوجد أي فواتير معلقة حالياً</p>
                  </div>
                ) : (
                  holdInvoices.map((hold) => (
                    <div key={hold.id} className="p-3 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">
                            {hold.id}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {hold.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 font-bold">
                          العميل: {hold.customer ? hold.customer.name : "عميل نقدي"}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          عدد الأصناف: {hold.items.reduce((acc, i) => acc + i.quantity, 0)} | الإجمالي: {hold.items.reduce((acc, i) => acc + i.price * i.quantity, 0).toFixed(2)}
                        </p>
                      </div>

                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleRestoreHoldInvoice(hold.id)}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all"
                        >
                          استرجاع
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("هل تود حذف هذه الفاتورة المعلقة؟")) {
                              setHoldInvoices((prev) => prev.filter((h) => h.id !== hold.id));
                              playBeep();
                            }
                          }}
                          className="p-1.5 bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* D. GENERAL INVOICE NOTE */}
      <AnimatePresence>
        {showInvoiceNoteModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl text-right"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-sans font-black text-slate-800 text-base">إضافة ملاحظة عامة للفاتورة</h3>
                <button onClick={() => setShowInvoiceNoteModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <textarea
                  placeholder="أدخل ملاحظات عامة للطلب بالكامل (مثال: توصيل سريع، الاتصال قبل الدخول...)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-xs h-28 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-right"
                  value={invoiceNote ?? ""}
                  onChange={(e) => setInvoiceNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    playBeep();
                    setShowInvoiceNoteModal(false);
                  }}
                  className="flex-1 py-2.5 bg-[#1a3a8a] hover:bg-blue-950 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  حفظ الملاحظة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* D2. ORDER DISCOUNT (نسبة % أو مبلغ) */}
      <AnimatePresence>
        {showDiscountModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-xl text-right"
              dir="rtl"
            >
              {(() => {
                const maxPercent = posConfig.pricing.maxDiscountPercent ?? 100;
                const safeValue = Number.isFinite(discountValue) ? Math.max(discountValue, 0) : 0;
                const percentTooHigh = discountType === "percent" && safeValue > maxPercent;
                const amountTooHigh = discountType === "amount" && safeValue > totals.subtotal;
                const invalid = safeValue <= 0 || percentTooHigh || amountTooHigh;
                const previewAmount = discountType === "percent"
                  ? (totals.subtotal * Math.min(safeValue, maxPercent)) / 100
                  : Math.min(safeValue, totals.subtotal);
                const previewNet = Math.max(totals.subtotal - previewAmount, 0);

                const applyDiscount = () => {
                  if (invalid) return;
                  setAppliedDiscount({ type: discountType, value: safeValue });
                  setShowDiscountModal(false);
                  playBeep();
                };

                return (
                  <>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-2">
                        <Percent className="w-5 h-5 text-amber-500" />
                        <h3 className="font-sans font-black text-slate-800 text-base">خصم على الفاتورة</h3>
                      </div>
                      <button onClick={() => setShowDiscountModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-4">
                      {([
                        { key: "percent" as const, label: "نسبة %" },
                        { key: "amount" as const, label: `مبلغ (${currency})` },
                      ]).map((mode) => (
                        <button
                          key={mode.key}
                          type="button"
                          onClick={() => {
                            setDiscountType(mode.key);
                            setDiscountValue(0);
                          }}
                          className={`py-2 text-xs rounded-lg font-black transition-all ${
                            discountType === mode.key
                              ? "bg-white text-[#1a3a8a] shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3 mb-4">
                      <label className="block text-[11px] font-black text-slate-500">
                        {discountType === "percent" ? `نسبة الخصم (الحد الأقصى ${maxPercent}%)` : "قيمة الخصم"}
                      </label>
                      <input
                        autoFocus
                        type="number"
                        min={0}
                        step={discountType === "percent" ? 1 : 0.01}
                        inputMode="decimal"
                        value={Number.isFinite(discountValue) && discountValue !== 0 ? discountValue : ""}
                        onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            applyDiscount();
                          }
                        }}
                        placeholder={discountType === "percent" ? "0" : "0.00"}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-lg font-mono font-black text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />

                      {discountType === "percent" && (
                        <div className="flex gap-1.5">
                          {[5, 10, 15, 20].filter((p) => p <= maxPercent).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setDiscountValue(p)}
                              className={`flex-1 py-1.5 text-[11px] font-black rounded-lg border transition-all ${
                                safeValue === p
                                  ? "bg-amber-100 border-amber-400 text-amber-800"
                                  : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                              }`}
                            >
                              {p}%
                            </button>
                          ))}
                        </div>
                      )}

                      {(percentTooHigh || amountTooHigh) && (
                        <p className="text-[11px] font-bold text-rose-600">
                          {percentTooHigh
                            ? `أقصى نسبة خصم مسموحة ${maxPercent}% — عدّل القيمة ثم أعد المحاولة`
                            : "قيمة الخصم أكبر من إجمالي الفاتورة"}
                        </p>
                      )}

                      <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3 space-y-1.5 text-[11px] font-bold">
                        <div className="flex justify-between text-slate-500">
                          <span>مجموع الأصناف</span>
                          <span className="font-mono">{totals.subtotal.toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between text-emerald-600">
                          <span>قيمة الخصم</span>
                          <span className="font-mono">-{previewAmount.toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between text-slate-800 border-t border-slate-200 border-dashed pt-1.5">
                          <span>الصافي بعد الخصم</span>
                          <span className="font-mono font-black">{previewNet.toFixed(2)} {currency}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {appliedDiscount && appliedDiscount.value > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setAppliedDiscount(null);
                            setDiscountValue(0);
                            setShowDiscountModal(false);
                            playBeep();
                          }}
                          className="px-3 py-2.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs rounded-xl transition-all"
                        >
                          إزالة الخصم
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={applyDiscount}
                        disabled={invalid}
                        className="flex-1 py-2.5 bg-[#1a3a8a] hover:bg-blue-950 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                      >
                        تطبيق الخصم
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* E. CHECKOUT COMPLETED SCREEN */}
      <AnimatePresence>
        {checkoutStatus.type === "success" && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center"
              dir="rtl"
            >
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-5 text-green-500">
                <CheckCircle2 className="w-12 h-12 stroke-[1.5] animate-bounce" />
              </div>

              <h3 className="font-sans font-black text-slate-800 text-xl mb-2">
                تم حفظ الفاتورة بنجاح!
              </h3>
              
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                تم تسجيل الفاتورة بنجاح في قاعدة البيانات وتحديث المخزون والوردية الحالية.
              </p>

              {!!checkoutStatus.warnings?.length && (
                <div className="w-full mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-right">
                  <p className="text-[11px] font-black text-amber-800 mb-1">تنبيهات من الخادم:</p>
                  {checkoutStatus.warnings.map((warning, index) => (
                    <p key={index} className="text-[11px] text-amber-700 leading-relaxed">
                      • {warning}
                    </p>
                  ))}
                </div>
              )}

              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 w-full mb-6 space-y-2 text-right">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">رقم الفاتورة:</span>
                  <span className="font-mono font-black text-slate-700">#{checkoutStatus.orderId}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">طريقة الدفع:</span>
                  <span className="font-bold text-slate-700">نقدي (كاش)</span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-200 border-dashed pt-2 mt-2">
                  <span className="font-bold text-slate-700">المبلغ الإجمالي:</span>
                  <span className="font-black text-slate-900 text-base">{totals.finalTotal.toFixed(2)} EGP</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400">المبلغ المدفوع:</span>
                  <span className="font-bold text-slate-700 font-mono">{parseFloat(amountPaidBuffer || "0").toFixed(2)} EGP</span>
                </div>
                <div className="flex justify-between items-center text-xs text-teal-600 font-bold">
                  <span>المبلغ المتبقي:</span>
                  <span className="font-black font-mono text-base">{changeAmount.toFixed(2)} EGP</span>
                </div>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={resetAfterSuccess}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/10"
                >
                  فاتورة جديدة
                </button>
                <button
                  onClick={() => setReceiptPreview({ orderId: checkoutStatus.orderId!, autoPrint: false })}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CHECKOUT ERROR SCREEN — the sale was NOT stored */}
      <AnimatePresence>
        {checkoutStatus.type === "error" && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center flex flex-col items-center"
              dir="rtl"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-5 text-red-500">
                <AlertTriangle className="w-10 h-10 stroke-[1.5]" />
              </div>

              <h3 className="font-sans font-black text-slate-800 text-xl mb-2">
                لم يتم تسجيل الفاتورة
              </h3>

              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                السلة محفوظة كما هي، يمكنك إعادة المحاولة أو تسجيل الفاتورة يدوياً.
              </p>

              <div className="bg-red-50 border border-red-150 rounded-2xl p-4 w-full mb-6 text-right">
                <p className="text-[11px] font-bold text-red-700 leading-relaxed break-words">
                  {checkoutStatus.message || "خطأ غير معروف"}
                </p>
              </div>

              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setCheckoutStatus({ type: "idle" })}
                  className="flex-1 py-3 bg-[#1a3a8a] hover:bg-blue-950 text-white rounded-xl text-xs font-bold transition-all shadow-md"
                >
                  إعادة المحاولة
                </button>
                <button
                  onClick={() => setCheckoutStatus({ type: "idle" })}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  رجوع
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LOADING OVERLAY */}
      <AnimatePresence>
        {checkoutStatus.type === "loading" && (
          <div className="fixed inset-0 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center z-50 p-4">
            <div className="w-12 h-12 border-4 border-[#1a3a8a] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="font-bold text-xs text-slate-700 mb-3">جاري تسجيل طلبك ومعالجة الفاتورة...</p>
            <button
              onClick={() => setCheckoutStatus({ type: "idle" })}
              className="text-xs text-slate-500 hover:text-red-600 underline font-medium cursor-pointer transition-colors"
            >
              إلغاء الانتظار
            </button>
          </div>
        )}
      </AnimatePresence>

      {/* RECEIPT PREVIEW — uses the template selected in POS settings */}
      {receiptPreview && (
        <POSReceiptModal
          orderId={receiptPreview.orderId}
          config={posConfig}
          cashierName={cashierName}
          autoPrint={receiptPreview.autoPrint}
          onClose={() => setReceiptPreview(null)}
        />
      )}

      {/* POS VOID MODAL (استرجاع / تعديل / إلغاء الأوردر) */}
      <AnimatePresence>
        {showVoidModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-4xl w-full shadow-2xl flex flex-col max-h-[90vh] text-right border border-slate-100"
              dir="rtl"
            >
              {/* Header */}
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-sm">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-sans font-black text-slate-900 text-lg">
                      نافذة استرجاع وتعديل وإلغاء الأوردرات (POS VOID)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      ابحث عن الأوردر لتعديل أصنافه أو إلغائه واسترجاعه بالكامل من الخزينة والحسابات العامة مع حفظه في تقارير الأوردرات الملغاة وسجل حركات المستخدم
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowVoidModal(false);
                    setVoidCancelConfirmOrder(null);
                    setVoidFeedback(null);
                  }}
                  className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Feedback Banner */}
              {voidFeedback && (
                <div
                  className={`mb-4 p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-2 shrink-0 border ${
                    voidFeedback.type === "success"
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : "bg-red-50 border-red-200 text-red-700"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {voidFeedback.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    )}
                    <span>{voidFeedback.message}</span>
                  </div>
                  <button
                    onClick={() => setVoidFeedback(null)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Search & Date Filter Bar */}
              <div className="flex flex-wrap items-center gap-3 mb-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/70 shrink-0">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="ابحث برقم الأوردر، الرقم اليومي، اسم العميل أو رقم الهاتف..."
                    value={voidSearch}
                    onChange={(e) => setVoidSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") fetchVoidOrders(voidSearch, voidDate);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">التاريخ:</label>
                  <input
                    type="date"
                    value={voidDate}
                    onChange={(e) => {
                      setVoidDate(e.target.value);
                      fetchVoidOrders(voidSearch, e.target.value);
                    }}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-rose-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchVoidOrders(voidSearch, voidDate)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black transition-all shadow-sm"
                >
                  بحث وتحديث
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVoidSearch("");
                    setVoidDate("");
                    fetchVoidOrders("", "");
                  }}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition-all"
                >
                  عرض الكل
                </button>
              </div>

              {/* Cancel Confirmation Sub-panel */}
              {voidCancelConfirmOrder && (
                <div className="mb-4 p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 space-y-3 shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      <h4 className="font-black text-sm text-rose-900">
                        تأكيد استرجاع وإلغاء الأوردر #{voidCancelConfirmOrder.id} (اليومي: #{voidCancelConfirmOrder.daily_number || voidCancelConfirmOrder.id})
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setVoidCancelConfirmOrder(null);
                        setVoidCancelReason("");
                      }}
                      className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                    >
                      تراجع
                    </button>
                  </div>
                  <p className="text-xs text-rose-700 leading-relaxed">
                    سيتم استرجاع هذا الأوردر بقيمة{" "}
                    <span className="font-black font-mono">{Number(voidCancelConfirmOrder.total || 0).toFixed(2)} {currency}</span>{" "}
                    وحذف حركته المالية من الخزينة والحسابات العامة وإرجاع المقادير للمخزن، مع بقائه في تقارير الأوردرات الملغاة وتسجيل العملية في حركات المستخدمين.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="اكتب سبب الإلغاء / الاسترجاع (إجباري)..."
                      value={voidCancelReason}
                      onChange={(e) => setVoidCancelReason(e.target.value)}
                      className="flex-1 bg-white border border-rose-300 rounded-xl py-2.5 px-3 text-xs font-bold focus:outline-none focus:border-rose-600"
                      autoFocus
                    />
                    <button
                      type="button"
                      disabled={voidActionLoading}
                      onClick={handleConfirmVoidCancel}
                      className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>{voidActionLoading ? "جاري التنفيذ..." : "تأكيد الاسترجاع وحذف القيمة من الخزينة والحسابات"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Orders List */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                {voidLoading ? (
                  <div className="py-16 text-center text-slate-400">
                    <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs font-bold">جاري تحميل الأوردرات...</p>
                  </div>
                ) : voidOrders.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
                    <Receipt className="w-12 h-12 text-slate-300 stroke-[1.2]" />
                    <p className="text-xs font-bold">لا توجد أوردرات مطابقة للبحث في هذا التاريخ</p>
                  </div>
                ) : (
                  voidOrders.map((ord) => {
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
                        className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isCancelled
                            ? "bg-red-50/40 border-red-200/80 opacity-80"
                            : "bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-xs"
                        }`}
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-xs font-mono font-black">
                              #{ord.id}
                            </span>
                            {ord.daily_number && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold">
                                يومي: #{ord.daily_number}
                              </span>
                            )}
                            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold">
                              {orderTypeAr}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black ${
                                isCancelled
                                  ? "bg-red-100 text-red-700 border border-red-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              {isCancelled ? "ملغي (Void)" : "نشط / مكتمل"}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {ord.timestamp ? new Date(ord.timestamp).toLocaleString("ar-EG") : ""}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span>
                              العميل: <strong className="text-slate-800">{ord.customer_name || "عميل نقدي"}</strong>
                              {ord.customer_phone ? ` (${ord.customer_phone})` : ""}
                            </span>
                            <span>
                              الدفع: <strong className="text-slate-800">{allPaymentLabels[ord.payment_method]?.ar || ord.payment_method || "كاش"}</strong>
                            </span>
                            {ord.cashier_name && (
                              <span>
                                الكاشير: <strong className="text-slate-800">{ord.cashier_name}</strong>
                              </span>
                            )}
                          </div>

                          {Array.isArray(ord.items) && ord.items.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {ord.items.map((it: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold"
                                >
                                  {it.product_name || it.name} × {it.quantity}
                                </span>
                              ))}
                            </div>
                          )}

                          {ord.notes && (
                            <p className="text-[11px] text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-100 inline-block">
                              ملاحظات: {ord.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-row md:flex-col items-center md:items-end justify-between gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
                          <div className="text-left">
                            <span className="text-[10px] text-slate-400 block">الإجمالي</span>
                            <span className={`font-mono font-black text-base ${isCancelled ? "line-through text-red-500" : "text-slate-900"}`}>
                              {Number(ord.total || 0).toFixed(2)} {currency}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setReceiptPreview({ orderId: ord.id, autoPrint: false })}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all"
                              title="معاينة وطباعة الفاتورة"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>الفاتورة</span>
                            </button>

                            {!isCancelled && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBeep();
                                    setVoidEditingOrderId(ord.id);
                                  }}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>تعديل الأوردر</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    playBeep();
                                    setVoidCancelConfirmOrder(ord);
                                    setVoidCancelReason("");
                                  }}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ORDER EDITOR MODAL FOR POS VOID EDIT */}
      {voidEditingOrderId && (
        <OrderEditorModal
          orderId={voidEditingOrderId}
          onClose={() => setVoidEditingOrderId(null)}
          onSave={() => {
            playSuccessSound();
            setVoidEditingOrderId(null);
            setVoidFeedback({
              type: "success",
              message: `تم تعديل الأوردر #${voidEditingOrderId} بنجاح وتحديث الخزينة والحسابات العامة والمخزون وتسجيل العملية في حركات المستخدم وتقارير التعديلات.`
            });
            fetchVoidOrders(voidSearch, voidDate);
            onOrderSuccess();
          }}
        />
      )}

    </div>
  );
};
