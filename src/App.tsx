import React, { useState, useEffect, useRef } from "react";
import { Branch, POSMode, Category, Product } from "./types";
import { TransferLog } from "./components/TransferLog";
import { Dashboard } from "./components/Dashboard";
import { HRSuitePresentation } from "./components/HRSuitePresentation";
import { POS } from "./components/POS";
import { Branches } from "./components/Branches";
import { Tables } from "./components/Tables";
import { Kitchen } from "./components/Kitchen";
import { Products, preloadProductsManageData } from "./components/Products";
import { Delivery } from "./components/Delivery";
import { HR } from "./components/HR";
import { Customers } from "./components/Customers";
import { Reservations } from "./components/Reservations";
import { CustomerAccounts } from "./components/CustomerAccounts";
import { GeneralAccounts } from "./components/GeneralAccounts";
import { Costs } from "./components/Costs";
import { DatabaseManager } from "./components/DatabaseManager";
import { TreasurySystem } from "./components/TreasurySystem";
import { BankManagement } from "./components/BankManagement";
import { RealEstateManagement } from "./components/RealEstateManagement";
import { TreasuryReports } from "./components/TreasuryReports";
import { Attendance } from "./components/Attendance";
import { Payroll } from "./components/Payroll";
import { BranchReports } from "./components/BranchReports";
import { WebOrders } from "./components/WebOrders";
import { CustomerMenu } from "./components/CustomerMenu";
import { CentralReports } from "./components/CentralReports";
import { Suppliers } from "./components/Suppliers";
import { SupplierReports } from "./components/SupplierReports";
import { Purchases } from "./components/Purchases";
import { Approvals } from "./components/Approvals";
import { Inventory } from "./components/Inventory";
import { Complaints } from "./components/Complaints";
import { Sales } from "./components/Sales";
import { HotelManagement } from "./components/HotelManagement";
import { ERPCore } from "./components/ERPCore";
import { AIDeveloperCenter } from "./components/AIDeveloperCenter";
import { BackupModal } from "./components/BackupModal";
import { useAuth } from "./contexts/AuthContext";
import { useLanguage } from "./contexts/LanguageContext";
import { setUiLanguage } from "./i18n/autoTranslate";
import { Login } from "./components/Login";
import { UserManagement } from "./components/UserManagement";
import { Printers } from "./components/Printers";
import { SystemHealthView } from "./components/SystemHealthView";
import { Production } from "./components/Production";
import { EmployeeMobilePortal } from "./components/EmployeeMobilePortal";
import { PublicCareersPortal } from "./components/recruitment/PublicCareersPortal";
import { OPERATIONAL_ITEMS, ADMIN_ITEMS } from "./constants";
import { AppearanceSettings } from "./components/AppearanceSettings";
import { SystemSettings } from "./components/SystemSettings";
import { DeliverySettings } from "./components/DeliverySettings";
import { ReceiptSettings } from "./components/ReceiptSettings";
import { MobileAppsSimulatorView } from "./components/MobileAppsSimulatorView";
import { SystemDateTimeWidget } from "./components/SystemDateTimeWidget";
import { SystemTranslator } from "./components/SystemTranslator";
import { POSSettings } from "./components/POSSettings";
import { UserLogs } from "./components/UserLogs";
import { MonthLockSettings } from "./components/MonthLockSettings";
import FingerprintSettings from "./components/FingerprintSettings";
import { ModificationsReport } from "./components/ModificationsReport";
import { ErrorBoundary } from "./components/ErrorBoundary";
import {
  Shield,
  Users,
  Database,
  Printer,
  Image as ImageIcon,
  Settings,
  FileText,
  History,
  Lock,
  Fingerprint,
  Truck,
  Wallet,
  ShoppingCart,
  X,
  Percent,
  Share2,
  Mail,
  Flag,
  Menu,
  Mic,
  MicOff,
  Languages,
  Volume2,
  AlertCircle,
  Info,
  MapPin,
  Building2,
  Check,
  CheckCircle,
  Smartphone,
  Download,
  Sparkles,
  Bot,
  RefreshCw,
  Activity,
} from "lucide-react";
import { motion } from "motion/react";
import { ChangePasswordModal } from "./components/ChangePasswordModal";
import { ChatModal } from "./components/ChatModal";
import { AIChatAssistantModal } from "./components/AIChatAssistantModal";
import { PublishSystemModal } from "./components/PublishSystemModal";
import { api, getAuthToken, getBaseUrl } from "./utils/api";
import { installProductionStorageSync, syncProductionStorageFromDatabase } from "./utils/productionStorageSync";

const getToastDetails = (text: string, setView: (v: any) => void) => {
  const tStr = text.toLowerCase();
  if (tStr.includes("باركود") || tStr.includes("أون لاين") || tStr.includes("web-orders") || tStr.includes("طلب جديد") || tStr.includes("اونلاين")) {
    return {
      icon: <ShoppingCart className="w-5 h-5 shrink-0 text-white animate-pulse" />,
      bg: "bg-blue-600 border border-blue-500",
      action: () => setView("web-orders")
    };
  }
  if (tStr.includes("ويتر") || tStr.includes("مساعدة") || tStr.includes("طاولة") || tStr.includes("تنادي")) {
    return {
      icon: <Volume2 className="w-5 h-5 shrink-0 text-amber-200 animate-bounce" />,
      bg: "bg-amber-600 border border-amber-500",
      action: () => setView("tables")
    };
  }
  if (tStr.includes("شكوى") || tStr.includes("اقتراح") || tStr.includes("complaint")) {
    return {
      icon: <AlertCircle className="w-5 h-5 shrink-0 text-rose-200 animate-pulse" />,
      bg: "bg-rose-600 border border-rose-500",
      action: () => setView("complaints")
    };
  }
  if (tStr.includes("صوتاً") || tStr.includes("صوت") || tStr.includes("🎤")) {
    return {
      icon: <Mic className="w-5 h-5 shrink-0 text-cyan-300 animate-pulse" />,
      bg: "bg-slate-900 border border-slate-700 shadow-cyan-500/10",
      action: null
    };
  }
  return {
    icon: <Info className="w-5 h-5 shrink-0 text-blue-200" />,
    bg: "bg-blue-600 border border-blue-500",
    action: null
  };
};

type ViewType =
  | "dashboard"
  | "pos"
  | "branches"
  | "tables"
  | "kitchen"
  | "products"
  | "delivery"
  | "hr-presentation"
  | "hr"
  | "customers"
  | "customer-accounts"
  | "general-accounts"
  | "safes"
  | "banks"
  | "treasury-reports"
  | "attendance"
  | "salaries"
  | "warehouses"
  | "suppliers"
  | "supplier-reports"
  | "purchases"
  | "approvals"
  | "sales"
  | "database"
  | "costs"
  | "branch-reports"
  | "reservations"
  | "central-reports"
  | "users"
  | "security-dashboard"
  | "printers"
  | "system-health"
  | "appearance"
  | "system-settings"
  | "delivery-settings"
  | "complaints"
  | "receipt-settings"
  | "user-logs"
  | "month-lock"
  | "fingerprint-settings"
  | "web-orders"
  | "production"
  | "pos-settings"
  | "pos-features-settings"
  | "erp_core"
  | "modifications_report"
  | "transfer-log"
  | "mobile_portal"
  | "mobile_app"
  | "ai_developer"
  | "real-estate"
  | "hotel";

interface NavigationHistoryState {
  _idx: number;
  view: ViewType;
  activeSubView?: string;
  activeTab?: "main" | "admin";
  posMode?: POSMode;
  deliverySettingsBackView?: "security-dashboard" | "dashboard";
}

function MainApp({ systemName, businessType }: { systemName: string; businessType: string }) {
  const { isAuthenticated, hasPermission, hasExplicitPermission, user, logout } = useAuth();
  const { t, language, toggleLanguage, isRtl } = useLanguage();

  // ترجمة واجهة الصفحات نفسها (أزرار/تسميات/رؤوس جداول) عند التحويل للإنجليزية
  useEffect(() => {
    setUiLanguage(language);
  }, [language]);
  const [activeTab, setActiveTab] = useState<"main" | "admin">(() => {
    try {
      const saved = localStorage.getItem("dashboard_active_tab");
      if (saved === "main" || saved === "admin") return saved;
    } catch (_) {}
    return "main";
  });

  useEffect(() => {
    try {
      localStorage.setItem("dashboard_active_tab", activeTab);
    } catch (_) {}
  }, [activeTab]);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [posMode, setPosMode] = useState<POSMode>({ type: "direct" });
  
  // Read initial view & subView from URL if present
  const getInitialNavigation = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get("view") as ViewType | null;
      const s = params.get("sub") || undefined;
      if (v) return { view: v, subView: s };
    } catch (_) {}
    return { view: "dashboard" as ViewType, subView: undefined };
  };

  const initialNav = getInitialNavigation();
  const [activeSubView, setActiveSubView] = useState<string | undefined>(initialNav.subView);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  const fetchPendingApprovals = async () => {
    try {
      const res = await api.get("/api/approvals/pending-count");
      if (res && res.ok) {
        const contentType = res.headers?.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          setPendingApprovalsCount(Number(data?.count) || 0);
        }
      }
    } catch (_e) {}
  };

  useEffect(() => {
    if (isAuthenticated && user) {
      fetchPendingApprovals();
      const interval = setInterval(fetchPendingApprovals, 15000); // Poll every 15 seconds
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, user]);

  // Reset all active views & modals on logout / unauthenticated state
  useEffect(() => {
    if (!isAuthenticated) {
      setView("dashboard");
      setActiveSubView(undefined);
      setActiveTab("admin");
      setShowBackupModal(false);
      setIsSafeManagement(false);
      setIsMobilePortal(false);
      setIsChatOpen(false);
      setIsAIChatOpen(false);
      setIsChangePasswordOpen(false);
      setIsPublishModalOpen(false);
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch (_) {}
    }
  }, [isAuthenticated]);

  const [view, setView] = useState<ViewType>(initialNav.view);
  const [isMobilePortal, setIsMobilePortal] = useState(false);
  const [deliverySettingsBackView, setDeliverySettingsBackView] = useState<
    "security-dashboard" | "dashboard"
  >("security-dashboard");
  const [isSafeManagement, setIsSafeManagement] = useState(false);
  const [forceMainWarehouse, setForceMainWarehouse] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<
    "connected" | "disconnected" | "loading"
  >("loading");

  // History and Back navigation refs
  const isPopstateRef = useRef(false);
  const historyIndexRef = useRef(0);
  const isInitialMountRef = useRef(true);
  const mainScrollRef = useRef<HTMLDivElement | null>(null);

  // Instant scroll-to-top whenever view changes to prevent content ghosting or offset
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
      mainScrollRef.current.scrollLeft = 0;
    }
  }, [view]);

  // Smart Universal Back Handler: navigates deterministically to the target view
  const handleBack = (fallbackView: ViewType = "dashboard", fallbackSubView?: string) => {
    setActiveSubView(fallbackSubView);
    setView(fallbackView);
  };

  // Sync state with browser history (pushState) on navigation
  useEffect(() => {
    if (view === "dashboard") {
      setActiveSubView(undefined);
    }

    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      const initialState: NavigationHistoryState = {
        _idx: 0,
        view,
        activeSubView,
        activeTab,
        posMode,
        deliverySettingsBackView,
      };
      const query = view === "dashboard" ? "" : `?view=${encodeURIComponent(view)}${activeSubView ? `&sub=${encodeURIComponent(activeSubView)}` : ""}`;
      window.history.replaceState(
        initialState,
        "",
        query ? `${window.location.pathname}${query}` : window.location.pathname
      );
      return;
    }

    if (isPopstateRef.current) {
      // Transition came from popstate (Back/Forward), don't push a duplicate history entry
      isPopstateRef.current = false;
      return;
    }

    // Normal forward navigation in the app
    historyIndexRef.current += 1;
    const nextState: NavigationHistoryState = {
      _idx: historyIndexRef.current,
      view,
      activeSubView,
      activeTab,
      posMode,
      deliverySettingsBackView,
    };

    const query = view === "dashboard" ? "" : `?view=${encodeURIComponent(view)}${activeSubView ? `&sub=${encodeURIComponent(activeSubView)}` : ""}`;
    window.history.pushState(
      nextState,
      "",
      query ? `${window.location.pathname}${query}` : window.location.pathname
    );

    // Save last subView for this view in localStorage
    if (activeSubView && view !== "dashboard") {
      try {
        localStorage.setItem(`last_subview_${view}`, activeSubView);
      } catch (_) {}
    }
  }, [view, activeSubView, activeTab, posMode, deliverySettingsBackView]);

  // Handle browser Back and Forward buttons (popstate event)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as NavigationHistoryState | null;
      isPopstateRef.current = true;

      if (state && state.view) {
        historyIndexRef.current = typeof state._idx === "number" ? state._idx : 0;
        setView(state.view);
        setActiveSubView(state.activeSubView);
        if (state.activeTab) setActiveTab(state.activeTab);
        if (state.posMode) setPosMode(state.posMode);
        if (state.deliverySettingsBackView) setDeliverySettingsBackView(state.deliverySettingsBackView);
      } else {
        const params = new URLSearchParams(window.location.search);
        const paramView = (params.get("view") as ViewType) || "dashboard";
        const paramSub = params.get("sub") || undefined;
        historyIndexRef.current = 0;
        setView(paramView);
        setActiveSubView(paramSub);
      }

      // Close transient modal overlays when navigating back
      setIsChatOpen(false);
      setIsAIChatOpen(false);
      setIsChangePasswordOpen(false);
      setShowBackupModal(false);
      setIsPublishModalOpen(false);

      setTimeout(() => {
        isPopstateRef.current = false;
      }, 50);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await api.get("/api/health");
        if (res.ok) {
          const data = await res.json();
          setDbStatus(data.database);
        }
      } catch (error) {
        setDbStatus("disconnected");
      }
    };
    checkHealth();
  }, []);

  // Shared State
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [posData, setPosData] = useState<{
    categories: Category[];
    products: Product[];
  }>({ categories: [], products: [] });
  const [newWebOrderCount, setNewWebOrderCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<string | null>(
    null,
  );

  // Global Voice Command and Voice Typing States
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceInterim, setVoiceInterim] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceLang, setVoiceLang] = useState<"ar-EG" | "en-US">("ar-EG");
  const voiceRecognitionRef = useRef<any>(null);

  const startVoiceListening = () => {
    setVoiceError(null);
    setVoiceInterim("");
    
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError("ميزة التعرف على الصوت غير مدعومة في هذا المتصفح.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = voiceLang;

      rec.onstart = () => {
        setIsVoiceListening(true);
      };

      rec.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (interim) {
          setVoiceInterim(interim);
        }
        if (final) {
          handleVoiceCommand(final);
          setVoiceInterim("");
        }
      };

      rec.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "not-allowed") {
          console.error("Global Speech recognition error", event.error);
        }
        if (event.error === "not-allowed") {
          const isInIframe = window.self !== window.top;
          if (isInIframe) {
            setVoiceError("المتصفح يحجب الميكروفون داخل الإطار. افتح النظام في نافذة جديدة لتفعيل الإدخال الصوتي!");
          } else {
            setVoiceError("تم رفض إذن الميكروفون. يرجى تفعيل الصلاحية.");
          }
        } else if (event.error === "no-speech") {
          // Ignore no-speech silently to avoid console spam when user is quiet
          setVoiceError("لم يتم الكشف عن صوت. يرجى المحاولة ثانية.");
        } else {
          setVoiceError("خطأ في قراءة الصوت: " + event.error);
        }
        setIsVoiceListening(false);
      };

      rec.onend = () => {
        setIsVoiceListening(false);
        setVoiceInterim("");
      };

      voiceRecognitionRef.current = rec;
      rec.start();
    } catch (e: any) {
      setVoiceError("فشل في بدء نظام التعرف على الصوت.");
      setIsVoiceListening(false);
    }
  };

  const stopVoiceListening = () => {
    if (voiceRecognitionRef.current) {
      voiceRecognitionRef.current.stop();
    }
    setIsVoiceListening(false);
  };

  const toggleVoiceListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isVoiceListening) {
      stopVoiceListening();
    } else {
      startVoiceListening();
    }
  };

  const handleVoiceCommand = (transcript: string) => {
    const text = transcript.trim().toLowerCase();
    
    // Check if the phrase has a keyword related to navigation/system commands
    const isNavCommand = 
      text.includes("افتح") || 
      text.includes("انتقل") || 
      text.includes("ذهاب") || 
      text.includes("شغل") || 
      text.includes("عرض") || 
      text.includes("بوابة") || 
      text.includes("بوابه") || 
      text.includes("لوحة") || 
      text.includes("لوحه") ||
      text.includes("مبيعات") || text.includes("sales") ||
      text.includes("حساب") || text.includes("accounts") ||
      text.includes("كاشير") || text.includes("pos") ||
      text.includes("مطبخ") || text.includes("kitchen") ||
      text.includes("مخازن") || text.includes("warehouses") ||
      text.includes("تقارير") || text.includes("reports") ||
      text.includes("حضور") || text.includes("attendance") ||
      text.includes("عملاء") || text.includes("customers") ||
      text.includes("مورد") || text.includes("suppliers") ||
      text.includes("مشتريات") || text.includes("purchases") ||
      text.includes("مصاريف") || text.includes("costs") ||
      text.includes("شات") || text.includes("chat") || text.includes("ai") ||
      text.includes("بصمة") || text.includes("بصمه") || text.includes("fingerprint") ||
      text.includes("مرتب") || text.includes("رواتب") || text.includes("salaries") ||
      text.includes("توصيل") || text.includes("delivery") ||
      text.includes("حجز") || text.includes("reservations") ||
      text.includes("شكاوى") || text.includes("complaints") ||
      text.includes("إنتاج") || text.includes("انتاج") || text.includes("production") ||
      text.includes("إعدادات") || text.includes("اعدادات") || text.includes("settings") ||
      text.includes("مستخدم") || text.includes("users") ||
      text.includes("مظهر") || text.includes("appearance") ||
      text.includes("بحث") || text.includes("ابحث") || text.includes("جيب") || text.includes("هات") ||
      text.includes("أوامر") || text.includes("اوامر") || text.includes("شراء") ||
      text.includes("لوحة") || text.includes("الرئيسية") || text.includes("dashboard") ||
      text.includes("الرئيسيه");

    // 1. Voice Typing: If an input or textarea is active AND it is NOT a navigation command, insert text there
    const activeEl = document.activeElement;
    if (!isNavCommand && activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      const inputEl = activeEl as HTMLInputElement | HTMLTextAreaElement;
      const start = inputEl.selectionStart || 0;
      const end = inputEl.selectionEnd || 0;
      const val = inputEl.value;
      inputEl.value = val.slice(0, start) + transcript + val.slice(end);
      
      // Trigger React change event so state updates
      const event = new Event("input", { bubbles: true });
      inputEl.dispatchEvent(event);
      
      setToastNotification(`تم الكتابة بالصوت: "${transcript}"`);
      setTimeout(() => setToastNotification(null), 4000);
      return;
    }

    // Extract search query if applicable
    let searchQuery = "";
    if (text.includes("عن")) {
      searchQuery = text.split("عن")[1].trim();
    } else if (text.includes("موظف") && !text.includes("شؤون")) {
      searchQuery = text.split("موظف")[1].trim();
    } else if (text.includes("عميل")) {
      searchQuery = text.split("عميل")[1].trim();
    } else if (text.includes("مورد")) {
      searchQuery = text.split("مورد")[1].trim();
    } else if (text.includes("فاتورة")) {
      searchQuery = text.split("فاتورة")[1].trim();
    }

    if (searchQuery) {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("voice_search", { detail: searchQuery }));
      }, 800);
    }

    // 2. Command Navigation and Actions
    let matched = true;
    
    if (text.includes("أوامر الشراء") || text.includes("اوامر الشراء") || text.includes("اوامر شراء")) {
      setView("purchases");
      setActiveSubView("orders");
      setToastNotification("جاري الانتقال إلى أوامر الشراء صوتاً 🎤");
    } else if (text.includes("تقارير الموظف") || text.includes("تقارير الموظفين") || text.includes("تقرير موظف")) {
      setView("central-reports");
      setActiveSubView("hr");
      setToastNotification(`جاري الانتقال إلى تقارير الموظفين${searchQuery ? ' والبحث عن ' + searchQuery : ''} 🎤`);
    } else if (text.includes("بصمات") || text.includes("سجل البصمة") || text.includes("بصمات الموظفين")) {
      setView("fingerprint-settings");
      setActiveSubView("fingerprint-logs");
      setToastNotification(`جاري الانتقال إلى سجل البصمات${searchQuery ? ' والبحث عن ' + searchQuery : ''} 🎤`);
    } else if (text.includes("مبيعات") || text.includes("المبيعات") || text.includes("sales")) {
      setView("sales");
      setToastNotification("جاري الانتقال إلى المبيعات صوتاً 🎤");
    } else if (text.includes("كاشير") || text.includes("الكاشير") || text.includes("كشير") || text.includes("نقطة البيع") || text.includes("نقطه البيع") || text.includes("pos")) {
      setView("pos");
      setToastNotification("جاري الانتقال إلى شاشة الكاشير صوتاً 🎤");
    } else if (text.includes("مطبخ") || text.includes("المطبخ") || text.includes("kitchen")) {
      setView("kitchen");
      setToastNotification("جاري الانتقال إلى شاشة المطبخ صوتاً 🎤");
    } else if (text.includes("طاولات") || text.includes("طاولة") || text.includes("الطاولات") || text.includes("tables")) {
      setView("tables");
      setToastNotification("جاري الانتقال إلى إدارة الطاولات صوتاً 🎤");
    } else if (text.includes("توصيل") || text.includes("دليفري") || text.includes("الدليفري") || text.includes("delivery")) {
      setView("delivery");
      setToastNotification("جاري الانتقال إلى التوصيل والطيارين صوتاً 🎤");
    } else if (text.includes("حساب") || text.includes("الحسابات") || text.includes("accounts") || text.includes("المالية") || text.includes("الماليه")) {
      setView("general-accounts");
      setToastNotification("جاري الانتقال إلى الحسابات العامة صوتاً 🎤");
    } else if (text.includes("مصاريف") || text.includes("المصاريف") || text.includes("مصروفات") || text.includes("costs")) {
      setView("costs");
      setToastNotification("جاري الانتقال إلى إدارة المصاريف صوتاً 🎤");
    } else if (text.includes("مخازن") || text.includes("مخزن") || text.includes("المخازن") || text.includes("warehouses") || text.includes("مستودع") || text.includes("المستودعات")) {
      setView("warehouses");
      setToastNotification("جاري الانتقال إلى المخازن والمستودعات صوتاً 🎤");
    } else if (text.includes("مشتريات") || text.includes("المشتريات") || text.includes("purchases")) {
      setView("purchases");
      setToastNotification("جاري الانتقال إلى المشتريات صوتاً 🎤");
    } else if (text.includes("مورد") || text.includes("الموردين") || text.includes("suppliers")) {
      setView("suppliers");
      setToastNotification("جاري الانتقال إلى الموردين صوتاً 🎤");
    } else if (text.includes("عملاء") || text.includes("العملاء") || text.includes("عميل") || text.includes("customers")) {
      setView("customers");
      setToastNotification("جاري الانتقال إلى إدارة العملاء صوتاً 🎤");
    } else if (text.includes("حضور") || text.includes("انصراف") || text.includes("الدوام") || text.includes("attendance")) {
      setView("attendance");
      setToastNotification("جاري الانتقال إلى شاشة الحضور والانصراف صوتاً 🎤");
    } else if (text.includes("مرتب") || text.includes("رواتب") || text.includes("المرتبات") || text.includes("الرواتب") || text.includes("salaries") || text.includes("payroll")) {
      setView("salaries");
      setToastNotification("جاري الانتقال إلى مسيرات الرواتب صوتاً 🎤");
    } else if (text.includes("الموارد") || text.includes("موارد") || text.includes("موظف") || text.includes("hr")) {
      setView("hr");
      setToastNotification("جاري الانتقال إلى الموارد البشرية صوتاً 🎤");
    } else if (text.includes("حجز") || text.includes("الحجوزات") || text.includes("reservations")) {
      setView("reservations");
      setToastNotification("جاري الانتقال إلى الحجوزات صوتاً 🎤");
    } else if (text.includes("طلبات") || text.includes("أون لاين") || text.includes("اونلاين") || text.includes("web-orders") || text.includes("متجر")) {
      setView("web-orders");
      setToastNotification("جاري الانتقال إلى طلبات الأون لاين صوتاً 🎤");
    } else if (text.includes("تقارير") || text.includes("تقرير") || text.includes("التقارير") || text.includes("reports")) {
      setView("central-reports");
      setToastNotification("جاري الانتقال إلى التقارير صوتاً 🎤");
    } else if (text.includes("خزنة") || text.includes("الخزنة") || text.includes("خزنه") || text.includes("الخزينه") || text.includes("safes")) {
      setView("safes");
      setToastNotification("جاري الانتقال إلى الخزائن والصناديق صوتاً 🎤");
    } else if (text.includes("شكاوى") || text.includes("شكوى") || text.includes("complaints")) {
      setView("complaints");
      setToastNotification("جاري الانتقال إلى الشكاوى والاقتراحات صوتاً 🎤");
    } else if (text.includes("الإنتاج") || text.includes("انتاج") || text.includes("إنتاج") || text.includes("production")) {
      setView("production");
      setToastNotification("جاري الانتقال إلى إدارة الإنتاج صوتاً 🎤");
    } else if (text.includes("اعدادات") || text.includes("إعدادات") || text.includes("settings")) {
      setView("system-settings");
      setToastNotification("جاري الانتقال إلى الإعدادات صوتاً 🎤");
    } else if (text.includes("بصمة") || text.includes("بصمه") || text.includes("fingerprint")) {
      setView("fingerprint-settings");
      setToastNotification("جاري الانتقال إلى إعدادات البصمة صوتاً 🎤");
    } else if (text.includes("مستخدم") || text.includes("المستخدمين") || text.includes("users")) {
      setView("users");
      setToastNotification("جاري الانتقال إلى إدارة المستخدمين صوتاً 🎤");
    } else if (text.includes("مظهر") || text.includes("ثيم") || text.includes("appearance") || text.includes("theme")) {
      setView("appearance");
      setToastNotification("جاري الانتقال إلى إعدادات المظهر صوتاً 🎤");
    } else if (text.includes("بوابة الموظف") || text.includes("بوابة الهاتف") || text.includes("بوابه الموظف") || text.includes("portal") || text.includes("بوابة")) {
      setIsMobilePortal(true);
      setToastNotification("جاري الانتقال إلى بوابة الموظف عبر الموبايل صوتاً 🎤");
    } else if (text.includes("مركز تطوير") || text.includes("مركز مطور") || text.includes("مطور ai") || text.includes("مركز ai") || text.includes("تحليل المشروع")) {
      setView("ai_developer");
      setToastNotification("جاري الانتقال إلى مركز تطوير AI صوتاً 🎤");
    } else if (text.includes("شات") || text.includes("مساعد") || text.includes("chat")) {
      setIsAIChatOpen(true);
      setToastNotification("جاري فتح مساعد الذكاء الاصطناعي صوتاً 🎤");
    } else if (text.includes("لوحة التحكم") || text.includes("الرئيسية") || text.includes("الرئيسيه") || text.includes("الرئيسى") || text.includes("dashboard")) {
      setView("dashboard");
      setToastNotification("جاري الانتقال إلى لوحة التحكم الرئيسية صوتاً 🎤");
    } else if (text.includes("بحث عن") || text.includes("ابحث عن") || text.includes("هاتلي") || text.includes("جيب")) {
      setToastNotification(`جاري البحث صوتاً عن: ${searchQuery} 🎤`);
    } else {
      matched = false;
    }

    if (!matched) {
      setToastNotification(`تم التعرف على الصوت: "${transcript}"`);
    }
    
    setTimeout(() => setToastNotification(null), 5000);
  };

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  useEffect(() => {
    const handleAiAction = (e: Event) => {
      const ce = e as CustomEvent;
      const { actionType, payload } = ce.detail;
      
      if (actionType === "NAVIGATE") {
        if (payload.view) setView(payload.view);
        if (payload.subView) setActiveSubView(payload.subView);
        setIsAIChatOpen(false); // Close chat if we navigate
      }
    };
    window.addEventListener("ai_action", handleAiAction);
    return () => window.removeEventListener("ai_action", handleAiAction);
  }, []);


  const userRef = useRef(user);
  const viewRef = useRef(view);
  const selectedBranchRef = useRef(selectedBranch);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
  }, [selectedBranch]);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let socket: any;
    let isMounted = true;
    import("socket.io-client").then(({ io }) => {
      if (!isMounted) return;
      const token = getAuthToken();
      if (!token) return;
      socket = io(getBaseUrl(), {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
      socket.on("new-web-order", (order: any) => {
        const targetBranchId = selectedBranchRef.current?.id || userRef.current?.branch_id;
        if (!targetBranchId || order.branch_id === targetBranchId) {
          setNewWebOrderCount((prev) => prev + 1);
          // Play notification sound
          const audio = new Audio(
            "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
          );
          audio.play().catch(() => {});

          if (viewRef.current !== "web-orders") {
            setToastNotification(
              `طلب جديد عبر الباركود - طاولة ${order.table_number}. يرجى التوجه لطلبات الأون لاين.`,
            );
            // Auto hide after 5 seconds
            setTimeout(() => setToastNotification(null), 5000);
          }
        }
      });
      socket.on("call_waiter", (data: any) => {
        const targetBranchId = selectedBranchRef.current?.id || userRef.current?.branch_id;
        if (!targetBranchId || data.branch_id === targetBranchId) {
          const audio = new Audio(
            "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
          );
          audio.play().catch(() => {});
          setToastNotification(
            `طلب مساعدة: طاولة ${data.table_number} تنادي الويتر!`,
          );
          setTimeout(() => setToastNotification(null), 8000);
        }
      });
      socket.on("new_complaint", (data: any) => {
        const targetBranchId = selectedBranchRef.current?.id || userRef.current?.branch_id;
        if (!targetBranchId || data.branch_id === targetBranchId) {
          const audio = new Audio(
            "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3",
          );
          audio.play().catch(() => {});
          setToastNotification(
            `شكوى جديدة من طاولة ${data.table_number}: ${data.details.substring(0, 30)}...`,
          );
          setTimeout(() => setToastNotification(null), 8000);
        }
      });
      socket.on("new_rating", (data: any) => {
        const targetBranchId = selectedBranchRef.current?.id || userRef.current?.branch_id;
        if (!targetBranchId || data.branch_id === targetBranchId) {
          setToastNotification(
            `تقييم جديد (${data.rating} نجوم) من طاولة ${data.table_number}`,
          );
          setTimeout(() => setToastNotification(null), 5000);
        }
      });
    });

    return () => {
      isMounted = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (user) {
      const hasAdmin = ADMIN_ITEMS.some((item) => hasPermission(item.id));
      const hasMain = OPERATIONAL_ITEMS.some((item) => hasPermission(item.id));

      if (hasAdmin) {
        setActiveTab("admin");
      } else if (hasMain) {
        setActiveTab("main");
      }
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      installProductionStorageSync();
      syncProductionStorageFromDatabase().catch((error) => {
        console.warn("Production database storage sync failed", error);
      });
      fetchBranches();
      fetchPOSData();
      preloadProductsManageData();
    }
  }, [isAuthenticated]);

  const fetchPOSData = async (retries = 3) => {
    try {
      const res = await api.get("/api/pos/data");
      if (res.ok) {
        const data = await res.json();
        setPosData(data);
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchPOSData(retries - 1), 1000);
      } else {
        console.warn("Could not pre-fetch POS data, using default fallback");
      }
    }
  };

  const fetchBranches = async (retries = 3) => {
    try {
      const res = await api.get("/api/branches");
      if (res.ok) {
        const data = await res.json();
        const branchList = Array.isArray(data) ? data : [];
        setBranches(branchList);

        if (branchList.length > 0) {
          if (user?.branch_id) {
            const userBranch = branchList.find((b) => b.id === user.branch_id);
            if (userBranch) {
              setSelectedBranch(userBranch);
            } else {
              setSelectedBranch(branchList[0]);
            }
          } else if (!selectedBranch) {
            setSelectedBranch(branchList[0]);
          }
        }
      } else {
        throw new Error("Failed to fetch");
      }
    } catch (error) {
      if (retries > 0) {
        setTimeout(() => fetchBranches(retries - 1), 1000);
      } else {
        setBranches([]);
      }
    }
  };

  const handleBackup = async () => {
    try {
      setStatus("جاري إنشاء النسخة الاحتياطية...");
      const response = await api.get("/api/backup");
      const data = await response.json();

      const blob = new Blob([JSON.stringify(data)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      setStatus("تم إنشاء النسخة الاحتياطية بنجاح");
    } catch (error) {
      setStatus("فشل إنشاء النسخة الاحتياطية");
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setStatus("جاري استعادة البيانات...");
        const data = JSON.parse(event.target?.result as string);
        if (!confirm("تأكيد نهائي: سيتم استبدال بيانات النظام الحالية ببيانات النسخة الاحتياطية. هل تريد الاستمرار؟")) {
          setStatus("تم إلغاء الاستعادة");
          return;
        }
        const response = await api.post("/api/restore", {
          tables: data.tables,
          targetBranchId: selectedBranch?.id,
          confirmRestore: true,
        });

        if (response.ok) {
          setStatus("تم استعادة البيانات بنجاح! سيتم إعادة تحميل الصفحة.");
          window.location.reload();
        } else {
          throw new Error();
        }
      } catch (error) {
        setStatus("فشل استعادة البيانات. تأكد من صحة الملف.");
      }
    };
    reader.readAsText(file);
  };

  const handleInstallPwa = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice: any) => {
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      });
    }
  };

  const handleItemClick = (id: string, subId?: string) => {
    if (!hasPermission(id)) {
      alert("ليس لديك صلاحية للوصول إلى هذا القسم");
      return;
    }

    const isItemSetting =
      (id === "pos" || id === "warehouses") &&
      ["products", "categories", "ingredients"].includes(subId || "");
    let permissionKey = isItemSetting ? `products.${subId}` : `${id}.${subId}`;
    if (id === "delivery" && subId === "delivery-settings") {
      permissionKey = "security.delivery-settings";
    }
    // Map attendance fingerprint-settings/logs to the actual permission key (hr.fingerprint)
    // used by the UserManagement permission editor
    if (id === "attendance" && (subId === "fingerprint-settings" || subId === "fingerprint-logs")) {
      permissionKey = "hr.fingerprint";
    }
    // قفل وإغلاق الشهور المالي ينفّذ نفس عملية الـ API المحمية بصلاحية
    // الفترات المالية (general-accounts.financial_periods)، فلو استخدمنا المفتاح
    // المشتق "salaries.month-lock" لأصبح غير قابل للمنح في محرر الصلاحيات
    // ومحجوبًا عن كل المستخدمين غير المديرين.
    if (id === "salaries" && subId === "month-lock") {
      permissionKey = "general-accounts.financial_periods";
    }

    if (subId) {
      // Determine if this sub-item belongs to settings or reports
      const allItems = [...OPERATIONAL_ITEMS, ...ADMIN_ITEMS];
      const moduleItem = allItems.find((m) => m.id === id);
      const isSettingsSub = moduleItem?.settings?.some((s) => s.id === subId) || false;
      const isReportsSub = moduleItem?.reports?.some((r) => r.id === subId) || false;
      const isStrictCheck = isSettingsSub || isReportsSub;

      // Every screen/sub-screen must have its own explicit permission.
      // A module permission alone does not grant visibility or direct access.
      const permCheck = hasExplicitPermission(permissionKey);
      if (!permCheck) {
        alert("ليس لديك صلاحية للوصول إلى هذا القسم الفرعي");
        return;
      }
    }

    setActiveSubView(subId);

    try {
      const allItems = [...OPERATIONAL_ITEMS, ...ADMIN_ITEMS];
      const moduleItem = allItems.find((m) => m.id === id);
      if (moduleItem) {
        const itemTab = OPERATIONAL_ITEMS.some((m) => m.id === id) ? "main" : "admin";
        setActiveTab(itemTab);
        localStorage.setItem("dashboard_active_tab", itemTab);
        localStorage.setItem(`dashboard_module_${itemTab}`, id);
        if (subId) {
          if (moduleItem.settings?.some((s) => s.id === subId)) {
            localStorage.setItem(`dashboard_subtab_${itemTab}`, "settings");
          } else if (moduleItem.reports?.some((r) => r.id === subId)) {
            localStorage.setItem(`dashboard_subtab_${itemTab}`, "reports");
          } else {
            localStorage.setItem(`dashboard_subtab_${itemTab}`, "features");
          }
        }
      }
    } catch (_) {}

    if (id === "security") {
      if (subId) {
        if (subId === "backup") {
          setView("security-dashboard");
          setShowBackupModal(true);
        } else if (subId === "system-health") {
          setView("system-health");
        } else if (subId === "fingerprint") {
          setView("fingerprint-settings");
        } else if (subId === "modifications_report") {
          setView("modifications_report" as any);
        } else {
          if (subId === "delivery-settings") {
            setDeliverySettingsBackView("security-dashboard");
          }
          setView(subId as any);
        }
      } else {
        setView("security-dashboard");
      }
    }
    if (id === "erp_core") setView("erp_core");
    if (id === "production") {
      setActiveSubView(subId || undefined);
      setView("production");
    }
    if (id === "pos") {
      if (subId === "pos_detailed_reports") {
        setActiveSubView("pos_detailed_reports");
        setView("branch-reports");
      } else if (
        subId === "pos_sales_report" ||
        subId === "pos_dashboard_report" ||
        subId === "pos_cancelled_report"
      ) {
        setActiveSubView(
          subId === "pos_dashboard_report"
            ? "pos_dashboard"
            : subId === "pos_cancelled_report"
              ? "cancelled_orders"
              : "sales"
        );
        setView("branch-reports");
      } else if (subId === "pos-settings" || subId === "pos-features-settings") {
        setActiveSubView(undefined);
        setView("pos-settings");
      } else if (
        subId === "products" ||
        subId === "categories" ||
        subId === "ingredients"
      ) {
        setActiveSubView(subId);
        setView("products");
      } else {
        setActiveSubView(
          subId === "shifts" ? "shifts" : subId === "void" ? "void" : undefined
        );
        setPosMode({ type: "direct" });
        setView("pos");
      }
    }
    if (id === "service") {
      if (subId === "call_center_report") {
        setActiveSubView("call_center");
        setView("branch-reports");
      } else if (subId === "dashboard" || subId === "shifts" || subId === "voip") {
        setPosMode({ type: "call_center" });
        setActiveSubView(subId);
        setView("pos");
      } else {
        setPosMode({ type: "call_center" });
        setActiveSubView(undefined);
        setView("pos");
      }
    }
    if (id === "branches") setView("branches");
    if (id === "tables") {
      if (subId === "tables_report") {
        setActiveSubView("tables_report");
      } else {
        setActiveSubView(undefined);
      }
      setView("tables");
    }
    if (id === "kitchen") {
      if (subId === "kitchen_report") {
        setActiveSubView("kitchen");
        setView("branch-reports");
      } else {
        setView("kitchen");
      }
    }
    if (id === "products") setView("products");
    if (id === "delivery") {
      if (subId === "delivery_report") {
        setActiveSubView("delivery");
        setView("branch-reports");
      } else if (subId === "delivery-settings") {
        setDeliverySettingsBackView("dashboard");
        setView("delivery-settings");
      } else {
        setView("delivery");
      }
    }
    if (id === "hr-presentation") setView("hr-presentation");
    if (id === "hr") {
      if (
        subId === "hr_report" ||
        subId === "hr_bonuses" ||
        subId === "hr_bonuses_report" ||
        subId === "hr_incentives" ||
        subId === "hr_incentives_report" ||
        subId === "hr_production_bonuses" ||
        subId === "hr_production_bonuses_report" ||
        subId === "hr_evaluations" ||
        subId === "hr_evaluations_report" ||
        subId === "hr_clearance" ||
        subId === "hr_clearance_report"
      ) {
        setActiveSubView(subId);
        setView("central-reports");
      } else {
        setActiveSubView(subId);
        setView("hr");
      }
    }
    if (id === "customers") {
      if (subId === "customers_report") {
        setActiveSubView("customers_report");
      } else {
        setActiveSubView(undefined);
      }
      setView("customers");
    }
    if (id === "reservations") {
      if (subId === "reservations_report") {
        setActiveSubView("reservations_report");
      } else {
        setActiveSubView(undefined);
      }
      setView("reservations");
    }
    if (id === "complaints") {
      if (subId === "complaints_report") {
        setActiveSubView("complaints_report");
      } else {
        setActiveSubView(undefined);
      }
      setView("complaints");
    }
    if (id === "customer-accounts") setView("customer-accounts");
    if (id === "general-accounts") {
      if (subId === "accounts_report") {
        setActiveSubView("general_accounts");
        setView("central-reports");
      } else {
        const normalizedSubId =
          subId === "erp_fiscal_years" ? "fiscal_years" :
          subId === "erp_account_config" ? "account_config" :
          subId === "erp_budgets" ? "budgets" :
          subId === "erp_audit_logs" ? "audit_logs" :
          subId || "accounts";
        setActiveSubView(normalizedSubId);
        setView("general-accounts");
      }
    }
    if (id === "database") setView("database");
    if (id === "banks") {
      setActiveSubView(subId || "dashboard");
      setView("banks");
    }
    if (id === "safes") {
      setIsSafeManagement(false);
      if (
        subId === "treasury_reports" ||
        subId === "treasury_detailed" ||
        subId === "treasury_transfers" ||
        subId === "treasury_closings" ||
        subId === "treasury_custodies" ||
        subId === "treasury_payroll_report"
      ) {
        setActiveSubView(subId);
        setView("treasury-reports");
      } else if (subId === "reports" || subId === "safe_reports") {
        setActiveSubView("safes");
        setView("central-reports");
      } else if (subId === "bank_accounts") {
        setActiveSubView("accounts");
        setView("safes");
      } else {
        setActiveSubView(subId);
        setView("safes");
      }
    }
    if (id === "attendance") {
      if (
        subId === "attendance_report" ||
        subId === "attendance_summary" ||
        subId === "fingerprint_logs_report" ||
        subId === "tardiness_report" ||
        subId === "absence_report" ||
        subId === "overtime_report" ||
        subId === "early_departure_report"
      ) {
        setActiveSubView(subId);
        setView("central-reports");
      } else if (subId === "fingerprint-settings" || subId === "fingerprint-logs") {
        setView("fingerprint-settings");
      } else {
        setActiveSubView(undefined);
        setView("attendance");
      }
    }
    if (id === "salaries") {
      if (subId === "salary_reports") {
        setActiveSubView("salaries");
        setView("central-reports");
      } else if (subId === "month-lock") {
        setView("month-lock");
      } else {
        setActiveSubView(subId || "approved");
        setView("salaries");
      }
    }
    if (id === "suppliers") {
      if (subId === "suppliers_report" || subId === "suppliers_detailed_report") {
        setActiveSubView(subId);
        setView("supplier-reports");
      } else {
        setActiveSubView(undefined);
        setView("suppliers");
      }
    }
    if (id === "purchases") {
      const purchaseReportIds = new Set([
        "purchase_summary", "purchase_orders_report", "purchase_requests_report",
        "purchase_quotations_report", "purchase_receipts_report", "purchase_invoices_report",
        "purchase_returns_report", "purchase_expenses_report", "purchase_suppliers_report",
        "purchase_items_report", "purchase_prices_report", "purchase_payments_report",
        "purchase_outstanding_report", "purchase_taxes_report", "purchase_matching_report",
        "purchase_warehouse_report", "purchase_cost_centers_report", "purchase_monthly_report",
        "purchase_workflow_report"
      ]);
      if (subId && purchaseReportIds.has(subId)) {
        setActiveSubView(subId);
        setView("purchases");
      } else {
        setActiveSubView(subId || undefined);
        setView("purchases");
      }
    }
    if (id === "hotel") {
      setActiveSubView(subId || "dashboard");
      setView("hotel");
    }
    if (id === "approvals") {
      setActiveSubView(subId || "pending");
      setView("approvals");
    }
    if (id === "sales") {
      setActiveSubView(subId || undefined);
      setView("sales");
    }
    if (id === "costs") {
      setActiveSubView(subId || "dashboard");
      setView("costs");
    }
    if (id === "central-reports") {
      if (subId === "hr_detailed_report" || subId === "detailed_report") {
        setActiveSubView("detailed_report");
        setView("hr");
      } else {
        setActiveSubView(subId || "branches");
        setView("central-reports");
      }
    }
    if (id === "branch-reports") setView("branch-reports");
    if (id === "web-orders") {
      if (subId === "web_orders_report") {
        setActiveSubView("web_orders");
        setView("branch-reports");
      } else {
        setView("web-orders");
        setNewWebOrderCount(0);
      }
    }
    if (id === "printers") setView("printers");
    if (id === "complaints") setView("complaints");
    if (id === "warehouses") {
      setForceMainWarehouse(activeTab === "admin");
      if (subId === "warehouse_transactions_report") {
        setActiveSubView("warehouse_transactions");
        setView("central-reports");
      } else if (subId === "branch_warehouse_report") {
        setActiveSubView("warehouse");
        setView("branch-reports");
      } else if (subId === "stock_entries_report") {
        setActiveSubView("stock_entries_report");
        setView("central-reports");
      } else if (subId === "all_warehouses_inventory_report") {
        setActiveSubView("main_warehouse");
        setView("central-reports");
      } else {
        setActiveSubView(subId || "items");
        setView("warehouses");
      }
    }
    if (id === "ai_developer") {
      setActiveSubView(subId);
      setView("ai_developer");
    }
  };

  if (isMobilePortal || view === "mobile_portal") {
    return (
      <EmployeeMobilePortal
        onBackToErp={() => {
          setIsMobilePortal(false);
          setView("dashboard");
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <Login
        systemName={systemName}
        onOpenMobilePortal={() => setIsMobilePortal(true)}
      />
    );
  }

  const adaptedOperationalItems = OPERATIONAL_ITEMS.map(item => {
    if (businessType === "general") {
      if (item.id === "tables") {
        return {
          ...item,
          label: "المعارض والأقسام",
          features: item.features?.map(f => f.id === "floor_plan" ? { ...f, label: "مخطط المعرض / المساحات" } : f.id === "reservations" ? { ...f, label: "حجوزات المساحات والمعاينات" } : f) || [],
          reports: item.reports?.map(r => r.id === "tables_report" ? { ...r, label: "تقارير الفروع والأقسام" } : r) || []
        };
      }
      if (item.id === "kitchen") {
        return {
          ...item,
          label: "تجهيز الطلبات والتشغيل",
          features: item.features?.map(f => f.id === "screen" ? { ...f, label: "شاشة التجهيز والتسليم" } : f.id === "recipes" ? { ...f, label: "مكونات وتجميع المنتجات" } : f) || [],
          reports: item.reports?.map(r => r.id === "kitchen_report" ? { ...r, label: "تقارير خطوط التشغيل والتسليم" } : r) || []
        };
      }
      if (item.id === "reservations") {
        return {
          ...item,
          label: "الحجوزات والمواعيد",
          features: item.features?.map(f => f.id === "book" ? { ...f, label: "حجز موعد/طلب جديد" } : f.id === "calendar" ? { ...f, label: "أجندة المواعيد" } : f) || [],
          reports: item.reports?.map(r => r.id === "reservations_report" ? { ...r, label: "تقارير الحجوزات والمواعيد" } : r) || []
        };
      }
      if (item.id === "ai-chef") {
        return {
          ...item,
          label: "المستشار الذكي للأعمال",
          features: item.features?.map(f => f.id === "generate" ? { ...f, label: "ابتكار المنتجات بالذكاء الاصطناعي" } : f.id === "assistant" ? { ...f, label: "مستشار الذكاء الاصطناعي للأعمال" } : f) || []
        };
      }
    }
    return item;
  });

  const adaptedAdminItems = ADMIN_ITEMS.map(item => {
    return item;
  });

  const filteredOperationalItems = adaptedOperationalItems.filter((item) =>
    hasPermission(item.id),
  );
  const filteredAdminItems = adaptedAdminItems.filter((item) =>
    hasPermission(item.id),
  );

  const filteredBranches = user?.branch_id
    ? branches.filter((b) => b.id === user.branch_id)
    : branches;

  return (
    <div
      className={`flex flex-col h-screen text-slate-800 font-cairo overflow-hidden ${view === "pos" ? "bg-slate-800" : "bg-[#f8fafc]"}`}
      dir="rtl"
    >
      {dbStatus === "disconnected" && (
        <div className="fixed top-0 left-0 right-0 bg-red-600 text-white p-2 text-center text-sm font-bold animate-pulse z-[200]">
          فشل الاتصال بقاعدة بيانات PostgreSQL. يرجى التحقق من إعدادات الاتصال.
        </div>
      )}

      {/* MAIN LAYOUT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* HEADER - hidden on POS so the POS header is not covered */}
        {view !== "pos" && (
        <header className="min-h-[56px] h-14 sm:h-18 flex items-center justify-between px-3 sm:px-6 border-b border-slate-200 bg-white z-50 select-none font-cairo shadow-sm text-slate-800 gap-2 shrink-0">
          {/* RIGHT SIDE: System Name & Live Status Badge (conforming to RTL) */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 border border-cyan-400/30 flex items-center justify-center shadow-md transform hover:scale-105 transition-transform duration-200 preserve-3d">
              <span className="text-xs sm:text-sm font-black text-cyan-300 tracking-tighter uppercase font-montserrat"
                    style={{
                      textShadow: "0 1px 0 #0284c7, 0 2px 0 #0369a1, 0 3px 6px rgba(0,0,0,0.5)"
                    }}>
                RP
              </span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-base sm:text-2xl font-black tracking-wider uppercase font-montserrat select-none"
                    style={{
                      fontFamily: "'Montserrat', 'Cairo', sans-serif",
                      color: "#0f172a",
                      textShadow: "0 1px 0 #cbd5e1, 0 2px 0 #94a3b8, 0 3px 0 #0284c7, 0 4px 8px rgba(2,132,199,0.25)"
                    }}>
                {!systemName ||
                systemName === "REMO Pro" ||
                systemName === "OPPO" ||
                systemName.includes("ترانس جلف")
                  ? "REMO PRO"
                  : systemName}
              </span>
              <div className="hidden sm:flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                  SUEZ_LIVE
                </span>
                <span className="text-[10px] text-slate-400 tracking-widest font-mono">
                  Version: 21.08.07
                </span>
              </div>
            </div>
          </div>

          {/* LEFT SIDE: Voice assist, User profile & action menu buttons */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Voice Command */}
            <div className="hidden md:flex relative items-center gap-1.5 shrink-0">
              {/* Voice Assist Indicator overlay */}
              {isVoiceListening && (
                <div className="absolute top-full mt-3 left-0 z-50 bg-slate-900 text-white rounded-2xl shadow-xl border border-slate-700/80 p-3 w-64 text-right animate-bounce">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                      جاري الاستماع للـمساعد الصوتي...
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-200 line-clamp-2">
                    {voiceInterim || "تحدث الآن.. وجهني كـ 'افتح المبيعات' أو 'اكتب بالصوت' في أي حقل!"}
                  </p>
                </div>
              )}

              {/* Language Switcher inside header button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setVoiceLang(prev => prev === "ar-EG" ? "en-US" : "ar-EG");
                  setToastNotification(voiceLang === "ar-EG" ? "تم تغيير لغة الإدخال الصوتي إلى الإنجليزية" : "تم تغيير لغة الإدخال الصوتي إلى العربية");
                  setTimeout(() => setToastNotification(null), 3000);
                }}
                className="p-1 px-2 text-[9px] font-bold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center gap-1 transition-colors"
                title="تغيير لغة التحدث للمساعد"
              >
                <Languages className="w-3 h-3 text-slate-500" />
                <span>{voiceLang === "ar-EG" ? "عربي" : "EN"}</span>
              </button>

              {/* Active Voice Input Pill */}
              <button
                type="button"
                onClick={toggleVoiceListening}
                className={`flex items-center rounded-full px-4 py-2 gap-2 transition-all cursor-pointer select-none ${
                  isVoiceListening
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse border border-red-400"
                    : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600"
                }`}
                title={isVoiceListening ? "إيقاف التسجيل الصوتي" : "البدء بالإدخال والتحكم الصوتي الذكي"}
              >
                <Mic className={`w-3.5 h-3.5 ${isVoiceListening ? "text-white animate-bounce" : "text-cyan-500"}`} />
                <span className={`hidden sm:inline-block text-[11px] font-bold font-mono ${isVoiceListening ? "text-white animate-pulse" : "text-slate-500"}`}>
                  {isVoiceListening ? "Listening..." : "Voice Command"}
                </span>
                <span className={`hidden sm:flex w-4 h-4 rounded-full items-center justify-center text-[9px] font-black ${
                  isVoiceListening ? "bg-red-400/50 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {isVoiceListening ? "●" : "i"}
                </span>
              </button>
            </div>

            {/* User Profile */}
            <div className="hidden md:flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 hover:bg-slate-100 cursor-pointer transition-all">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Users className="w-4 h-4" />
              </div>
              <span className="hidden sm:block text-xs font-extrabold text-slate-700 uppercase font-mono">
                {user?.username || "ELHOSARY"}
              </span>
            </div>

            <div className="hidden md:block w-[1px] h-6 bg-slate-200 mx-1"></div>

            {/* Utility icons row */}
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Branch Switcher Dropdown */}
              {branches.length > 1 && !user?.branch_id && (
                <div className="hidden md:block relative group/branch">
                  <button
                    className="w-10 h-8 rounded-lg flex items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all border border-emerald-100 shadow-sm"
                    title="تبديل الفرع"
                  >
                    <Building2 className="w-4 h-4" />
                  </button>

                  <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover/branch:opacity-100 group-hover/branch:visible transition-all z-[100] transform scale-95 group-hover/branch:scale-100 origin-top-left overflow-hidden">
                    <div className="bg-emerald-600 p-3 text-white">
                      <h3 className="text-xs font-black tracking-widest uppercase">
                        الفروع المتاحة
                      </h3>
                      <p className="text-[9px] opacity-80 mt-0.5">
                        اختر الفرع للتبديل السريع
                      </p>
                    </div>
                    <div className="p-1.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {branches.map((branch, idx) => (
                        <button
                          key={`app-hdr-branch-${branch.id ?? branch.name}-${idx}`}
                          onClick={() => setSelectedBranch(branch)}
                          className={`flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-xs font-bold mb-0.5 transition-all ${
                            selectedBranch?.id === branch.id
                              ? "bg-emerald-50 text-emerald-700 shadow-inner"
                              : "hover:bg-slate-50 text-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-2 h-2 rounded-full ${selectedBranch?.id === branch.id ? "bg-emerald-500 animate-pulse" : "bg-slate-200"}`}
                            ></div>
                            <span className="truncate">{branch.name}</span>
                          </div>
                          {selectedBranch?.id === branch.id && (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="bg-slate-50 px-3 py-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[9px] text-slate-400 font-bold">
                        الحالة: متصل
                      </span>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                        <span className="text-[9px] text-emerald-600 font-black">
                          نشط
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {deferredPrompt && (
                <button
                  onClick={handleInstallPwa}
                  title="تحميل التطبيق على الموبايل"
                  className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors border border-blue-200"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setView("mobile_portal")}
                title="تطبيق الموبايل للموظفين (بصمة السيلفي والمرتبات)"
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors border border-emerald-200"
              >
                <Smartphone className="w-4 h-4" />
              </button>

              {/* 1. NOTIFICATIONS / APPROVALS (الإشعارات) */}
              <button
                onClick={() => {
                  setView("approvals");
                  setActiveSubView("pending");
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center bg-violet-50 text-violet-700 hover:bg-violet-100 active:scale-95 transition-all border border-violet-200 relative group/approvals shadow-sm shrink-0"
                title="الإشعارات والموافقات"
              >
                <CheckCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                {pendingApprovalsCount > 0 ? (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center border-2 border-white animate-bounce shadow-sm">
                    {pendingApprovalsCount}
                  </span>
                ) : (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full border border-white"></span>
                )}
              </button>

              {/* 2. MESSAGES (الرسائل) */}
              <button
                onClick={() => setIsChatOpen(true)}
                className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors shadow-sm shrink-0"
                title={t("header.messages") || "الرسائل"}
              >
                <Mail className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
              </button>

              <button
                onClick={() => setIsPublishModalOpen(true)}
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="مشاركة ورابط الببليش العام"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsAIChatOpen(true)}
                className="hidden md:flex relative h-8 px-2.5 rounded-lg items-center gap-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white hover:from-teal-600 hover:to-cyan-700 transition-all shadow-md shadow-teal-500/20 text-xs font-bold"
                title="شات الذكاء الاصطناعي (AI Chat API)"
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-300" />
                <span>الذكاء الاصطناعي</span>
              </button>

              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title={isRtl ? "تغيير كلمة المرور" : "Change Password"}
              >
                <Flag className="w-4 h-4" />
              </button>

              {/* 3. LANGUAGE SWITCHER (تغيير اللغة) */}
              <div className="shrink-0">
                <SystemTranslator />
              </div>

              {/* 4. LOGOUT (تسجيل الخروج) */}
              <button
                onClick={logout}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors shadow-sm shrink-0"
                title="تسجيل الخروج"
              >
                <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              <button
                className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                title="القائمة"
              >
                <Menu className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
        </header>
        )}

        <div ref={mainScrollRef} className="flex-1 overflow-auto relative">
            {view === "hr-presentation" && (
              <motion.div key="hr-presentation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="w-full h-full">
                <HRSuitePresentation onBack={() => handleBack("dashboard")} />
              </motion.div>
            )}
            {view === "dashboard" && (
              <div
                key="dashboard"
                className="w-full h-full"
              >
                <ErrorBoundary fallbackTitle="حدث خطأ في لوحة التحكم">
                  <Dashboard
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    mainItems={filteredOperationalItems}
                    adminItems={filteredAdminItems}
                    selectedBranch={selectedBranch}
                    branches={filteredBranches}
                    setSelectedBranch={setSelectedBranch}
                    onItemClick={handleItemClick}
                    user={user}
                    onLogout={logout}
                    systemName={systemName}
                    webOrderCount={newWebOrderCount}
                  />
                </ErrorBoundary>
              </div>
            )}

            {view === "security-dashboard" && (
              <motion.div
                key="security-dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="p-6"
              >
                <div className="flex justify-between items-center mb-6">
                  <h1 className="text-2xl font-bold text-slate-800">
                    السرية والتحكم
                  </h1>
                  <button
                    onClick={() => handleBack("dashboard")}
                    className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-300 font-bold text-sm"
                  >
                    رجوع
                  </button>
                </div>

                <SystemDateTimeWidget />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {hasExplicitPermission("security.users") && (
                    <div
                      onClick={() => handleItemClick("security", "users")}
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        <Users className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        إدارة المستخدمين
                      </h3>
                      <p className="text-slate-500 text-sm">
                        إضافة مستخدمين جدد وتحديد الصلاحيات
                      </p>
                    </div>
                  )}

                  {hasExplicitPermission("security.backup") && (
                    <div
                      onClick={() => handleItemClick("security", "backup")}
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                        <Database className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        النسخ الاحتياطي
                      </h3>
                      <p className="text-slate-500 text-sm">
                        أخذ نسخة احتياطية واستعادة البيانات
                      </p>
                    </div>
                  )}

                  {hasExplicitPermission("security.appearance") && (
                    <div
                      onClick={() => handleItemClick("security", "appearance")}
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        تخصيص المظهر
                      </h3>
                      <p className="text-slate-500 text-sm">
                        تغيير خلفية النظام (صورة أو فيديو)
                      </p>
                    </div>
                  )}

                  {hasExplicitPermission("security.system-settings") && (
                    <div
                      onClick={() =>
                        handleItemClick("security", "system-settings")
                      }
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                        <Settings className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        إعدادات النظام
                      </h3>
                      <p className="text-slate-500 text-sm">
                        تغيير اسم النظام والإعدادات العامة
                      </p>
                    </div>
                  )}

                  {hasExplicitPermission("security.system-settings") && (
                    <div
                      onClick={() =>
                        handleItemClick("security", "system-health")
                      }
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                        <Activity className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        صحة النظام
                      </h3>
                      <p className="text-slate-500 text-sm">
                        فحص مخطط قاعدة البيانات والإعدادات المستخدمة
                      </p>
                    </div>
                  )}

                  {hasExplicitPermission("security.receipt-settings") && (
                    <div
                      onClick={() =>
                        handleItemClick("security", "receipt-settings")
                      }
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        تخصيص الفاتورة
                      </h3>
                      <p className="text-slate-500 text-sm">
                        اختر شكل وتصميم ريست الطباعة
                      </p>
                    </div>
                  )}

                  {hasExplicitPermission("security.user-logs") && (
                    <div
                      onClick={() => handleItemClick("security", "user-logs")}
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center text-orange-600">
                        <History className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        سجل حركات المستخدمين
                      </h3>
                      <p className="text-slate-500 text-sm">
                        مراقبة جميع العمليات التي تمت على النظام
                      </p>
                    </div>
                  )}


                  {hasExplicitPermission("security.modifications_report") && (
                    <div
                      onClick={() =>
                        handleItemClick("security", "modifications_report")
                      }
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center text-amber-600">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        تقرير تعديلات النظام
                      </h3>
                      <p className="text-slate-500 text-sm">
                        عرض تقارير التلاعب أو التعديلات المحمية
                      </p>
                    </div>
                  )}

                  {hasExplicitPermission("security.mobile_app") && (
                    <div
                      onClick={() =>
                        handleItemClick("security", "mobile_app")
                      }
                      className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-slate-100 flex flex-col items-center text-center gap-4"
                    >
                      <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                        <Smartphone className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800">
                        تطبيق موبايل الطاولات والمنيو
                      </h3>
                      <p className="text-slate-500 text-sm">
                        اختبار وتعديل تطبيقات الطاولات والموظفين
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {view === "mobile_app" && (
              <motion.div
                key="mobile_app"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <MobileAppsSimulatorView
                  selectedBranch={selectedBranch}
                  onBack={() => handleBack("security-dashboard")}
                />
              </motion.div>
            )}

            {view === "system-settings" && (
              <motion.div
                key="system-settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <SystemSettings onBack={() => handleBack("security-dashboard")} />
              </motion.div>
            )}

            {view === "delivery-settings" && (
              <motion.div
                key="delivery-settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <DeliverySettings
                  onBack={() => handleBack(deliverySettingsBackView)}
                />
              </motion.div>
            )}

            {view === "receipt-settings" && (
              <motion.div
                key="receipt-settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <ReceiptSettings onBack={() => handleBack("security-dashboard")} />
              </motion.div>
            )}

            {view === "pos-settings" && (
              <motion.div
                key="pos-settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <POSSettings onBack={() => handleBack("dashboard")} />
              </motion.div>
            )}

            {view === "user-logs" && (
              <motion.div
                key="user-logs"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <UserLogs onBack={() => handleBack("security-dashboard")} />
              </motion.div>
            )}

            {view === "modifications_report" && (
              <motion.div
                key="modifications_report"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <ModificationsReport
                  onBack={() => handleBack("security-dashboard")}
                />
              </motion.div>
            )}

            {view === "month-lock" && (
              <motion.div
                key="month-lock"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <MonthLockSettings
                  onBack={() => handleBack("dashboard")}
                />
              </motion.div>
            )}

            {view === "fingerprint-settings" && (
              <motion.div
                key="fingerprint-settings"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <FingerprintSettings
                  onBack={() => handleBack(activeTab === "admin" ? "security-dashboard" : "dashboard")}
                  initialTab={activeSubView === "fingerprint-logs" ? "logs" : "devices"}
                  hideTabs={activeSubView === "fingerprint-logs" || activeSubView === "fingerprint-settings"}
                />
              </motion.div>
            )}

            {view === "appearance" && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <AppearanceSettings
                  onBack={() => handleBack("security-dashboard")}
                />
              </motion.div>
            )}

            {view === "users" && (
              <motion.div
                key="users"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <UserManagement onBack={() => handleBack("security-dashboard")} />
              </motion.div>
            )}

            {view === "system-health" && (
              <motion.div
                key="system-health"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <SystemHealthView
                  onBack={() => handleBack("security-dashboard")}
                />
              </motion.div>
            )}

            {view === "printers" && (
              <motion.div
                key="printers"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Printers
                  onBack={() => handleBack("dashboard")}
                  selectedBranch={selectedBranch}
                />
              </motion.div>
            )}

            {view === "pos" && (
              <div
                key="pos"
                className="w-full h-full"
              >
                <ErrorBoundary fallbackTitle="حدث خطأ أثناء عرض نقطة البيع">
                  <POS
                    selectedBranch={selectedBranch}
                    branches={branches}
                    posMode={posMode}
                    initialCategories={posData.categories}
                    initialProducts={posData.products}
                    subView={activeSubView}
                    onBack={() => handleBack(posMode.type === "table" ? "tables" : "dashboard")}
                    onOpenShifts={() => { setActiveSubView("shifts"); setView("pos"); }}
                    onExitShifts={() => setActiveSubView(undefined)}
                    onOpenVoid={() => { setActiveSubView("void"); setView("pos"); }}
                    onExitVoid={() => handleBack("dashboard")}
                    onOrderSuccess={() => {
                      // إتمام الأوردر لا يُخرج من شاشة نقطة البيع: الشاشة تبقى مفتوحة
                      // وتُفرَّغ السلة لبدء فاتورة جديدة (مهم في نقطة بيع الكول سنتر).
                      // الاستثناء الوحيد هو طاولات الخدمة: نرجع لخريطة الطاولات بعد السداد.
                      if (posMode.type === "table") setView("tables");
                    }}
                  />
                </ErrorBoundary>
              </div>
            )}

            {view === "branches" && (
              <motion.div
                key="branches"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Branches
                  branches={branches}
                  onBack={() => handleBack("dashboard")}
                  onRefresh={fetchBranches}
                />
              </motion.div>
            )}

            {view === "tables" && (
              <motion.div
                key="tables"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Tables
                  selectedBranch={selectedBranch}
                  subView={activeSubView}
                  onBack={() => handleBack("dashboard")}
                  onOpenPOS={(mode) => {
                    setPosMode(mode);
                    setView("pos");
                  }}
                />
              </motion.div>
            )}

            {view === "kitchen" && (
              <motion.div
                key="kitchen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Kitchen
                  onBack={() => handleBack("dashboard")}
                  selectedBranch={selectedBranch}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "products" && (
              <motion.div
                key="products"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Products
                  onBack={() => handleBack("dashboard")}
                  onRefresh={fetchPOSData}
                  initialTab={activeSubView as any}
                  initialCategories={posData.categories}
                  initialProducts={posData.products}
                />
              </motion.div>
            )}

            {view === "delivery" && (
              <motion.div
                key="delivery"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Delivery
                  onBack={() => handleBack("dashboard")}
                  selectedBranch={selectedBranch}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "hr" && (
              <motion.div
                key="hr"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <HR
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                />
              </motion.div>
            )}

            {view === "customers" && (
              <motion.div
                key="customers"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Customers
                  onBack={() => handleBack("dashboard")}
                  onViewAccount={() => setView("customer-accounts")}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "reservations" && (
              <motion.div
                key="reservations"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Reservations
                  selectedBranch={selectedBranch}
                  onBack={() => handleBack("dashboard")}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "customer-accounts" && (
              <motion.div
                key="customer-accounts"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <CustomerAccounts onBack={() => handleBack("dashboard")} />
              </motion.div>
            )}

            {view === "general-accounts" && (
              <motion.div
                key="general-accounts"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <GeneralAccounts
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                  onNavigateModule={(mod) => {
                    if (mod === "treasury") {
                      setView("safes");
                    } else if (mod === "suppliers_report" || mod === "suppliers_detailed_report") {
                      setView("suppliers");
                      setActiveSubView("suppliers_detailed_report");
                    } else {
                      setView(mod as any);
                    }
                  }}
                />
              </motion.div>
            )}

            {view === "costs" && (
              <motion.div
                key="costs"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Costs
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                />
              </motion.div>
            )}

            {view === "branch-reports" && (
              <motion.div
                key="branch-reports"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <BranchReports
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                />
              </motion.div>
            )}

            {view === "web-orders" && (
              <motion.div
                key="web-orders"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <WebOrders
                  selectedBranch={selectedBranch}
                  onBack={() => handleBack("dashboard")}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "central-reports" && (
              <motion.div
                key="central-reports"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <CentralReports
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                />
              </motion.div>
            )}

            {view === "database" && (
              <motion.div
                key="database"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <DatabaseManager
                  onBack={() => handleBack("dashboard")}
                  onBackup={handleBackup}
                  onRestore={handleRestore}
                  status={status || ""}
                />
              </motion.div>
            )}

            {view === "banks" && (
              <motion.div
                key="banks"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <BankManagement
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                />
              </motion.div>
            )}

            {view === "real-estate" && (
              <motion.div key="real-estate" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
                <RealEstateManagement onBack={() => handleBack("dashboard")} initialTab={activeSubView as any} />
              </motion.div>
            )}

            {view === "safes" && (
              <motion.div
                key="safes"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <TreasurySystem
                  onBack={() => handleBack("dashboard")}
                  onOpenReports={() => setView("treasury-reports")}
                  initialTab={activeSubView as any}
                />
              </motion.div>
            )}

            {view === "treasury-reports" && (
              <motion.div
                key="treasury-reports"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <TreasuryReports
                  onBack={() => handleBack("dashboard")}
                  initialTab={
                    activeSubView === "treasury_transfers"
                      ? "transfers"
                      : activeSubView === "treasury_closings"
                        ? "closings"
                        : activeSubView === "treasury_custodies"
                          ? "custodies"
                          : activeSubView === "treasury_payroll_report"
                            ? "payroll"
                            : "detailed"
                  }
                />
              </motion.div>
            )}

            {view === "attendance" && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Attendance
                  onBack={() => handleBack("dashboard")}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "salaries" && (
              <motion.div
                key="salaries"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Payroll
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                  hideTabs={true}
                />
              </motion.div>
            )}

            {/* Warehouse Module */}
            {view === "warehouses" && (
              <motion.div
                key="warehouses"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Inventory
                  onBack={() => handleBack("dashboard")}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "supplier-reports" && (
              <motion.div
                key="supplier-reports"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <SupplierReports 
                  onBack={() => handleBack("suppliers")} 
                  initialTab={activeSubView === "suppliers_detailed_report" ? "detailed" : undefined}
                />
              </motion.div>
            )}

            {view === "suppliers" && (
              <motion.div
                key="suppliers"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Suppliers 
                  onBack={() => handleBack("dashboard")} 
                  onViewReports={() => {
                    setActiveSubView("suppliers_detailed_report");
                    setView("supplier-reports");
                  }}
                />
              </motion.div>
            )}

            {view === "purchases" && (
              <motion.div
                key="purchases"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Purchases
                  onBack={() => handleBack("dashboard")}
                  initialTab={
                    activeSubView === "purchase_einvoice"
                      ? "settings"
                      : activeSubView && activeSubView.endsWith("_report") || activeSubView === "purchase_summary"
                        ? "reports"
                        : activeSubView as any
                  }
                  initialReport={activeSubView}
                  onNavigateToGRN={(poId) => {
                    localStorage.setItem("initialPurchaseOrderId", String(poId));
                    setView("warehouses");
                    setActiveSubView("goods_receipts");
                  }}
                />
              </motion.div>
            )}

            {view === "approvals" && (
              <motion.div
                key="approvals"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Approvals
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView as any}
                />
              </motion.div>
            )}

            {view === "sales" && (
              <motion.div
                key="sales"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Sales
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView}
                />
              </motion.div>
            )}

            {view === "hotel" && (
              <motion.div
                key="hotel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <HotelManagement
                  currentTab={activeSubView}
                  userPermissions={user?.permissions}
                  onBack={() => handleBack("dashboard")}
                />
              </motion.div>
            )}

            {view === "transfer-log" && (
              <motion.div
                key="transfer-log"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <TransferLog onBack={() => handleBack("dashboard")} />
              </motion.div>
            )}

            {view === "production" && (
              <motion.div
                key="production"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Production
                  selectedBranch={selectedBranch}
                  onBack={() => handleBack("dashboard")}
                  initialTab={activeSubView}
                />
              </motion.div>
            )}

            {view === "complaints" && (
              <motion.div
                key="complaints"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <Complaints
                  selectedBranch={selectedBranch}
                  onBack={() => handleBack("dashboard")}
                  subView={activeSubView}
                />
              </motion.div>
            )}

            {view === "erp_core" && (
              <motion.div
                key="erp_core"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <ERPCore user={user} onBack={() => handleBack("dashboard")} />
              </motion.div>
            )}

            {view === "ai_developer" && (
              <motion.div
                key="ai_developer"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <AIDeveloperCenter initialTab={activeSubView} user={user} onBack={() => handleBack("dashboard")} />
              </motion.div>
            )}
        </div>
      </div>

      {/* BOTTOM NAVIGATION (Dashboard Only) */}
      {(view === "dashboard" || view === "security-dashboard") && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-[150] bg-white/90 backdrop-blur-md p-1.5 rounded-full shadow-xl border border-slate-200/60"
        >
          <button
            onClick={() => {
              setActiveTab("main");
              setView("dashboard");
            }}
            className={`transition-all duration-300 rounded-full flex items-center gap-2 px-5 py-2.5 ${activeTab === "main" && view === "dashboard" ? "bg-emerald-100 text-emerald-700 shadow-sm" : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"}`}
            title="العمليات التشغيلية"
          >
            <Shield className="w-5 h-5" />
            <span
              className={`text-sm font-bold transition-all ${activeTab === "main" && view === "dashboard" ? "block" : "hidden sm:block"}`}
            >
              العمليات
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("admin");
              setView("dashboard");
            }}
            className={`transition-all duration-300 rounded-full flex items-center gap-2 px-5 py-2.5 ${activeTab === "admin" && view === "dashboard" ? "bg-blue-100 text-blue-700 shadow-sm" : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"}`}
            title="الأنظمة الإدارية"
          >
            <Settings className="w-5 h-5" />
            <span
              className={`text-sm font-bold transition-all ${activeTab === "admin" && view === "dashboard" ? "block" : "hidden sm:block"}`}
            >
              الإدارة
            </span>
          </button>

          {(user?.role === "manager" || user?.role === "admin") && (
            <button
              onClick={() => {
                setView("security-dashboard");
              }}
              className={`transition-all duration-300 rounded-full flex items-center gap-2 px-5 py-2.5 ${view === "security-dashboard" ? "bg-slate-800 text-white shadow-md shadow-slate-900/20" : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"}`}
              title="الإعدادات والأمان"
            >
              <Lock className="w-5 h-5" />
              <span
                className={`text-sm font-bold transition-all ${view === "security-dashboard" ? "block" : "hidden sm:block"}`}
              >
                الأمان
              </span>
            </button>
          )}
        </div>
      )}

      <BackupModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        status={status}
        onBackup={handleBackup}
        onRestore={handleRestore}
      />

      {toastNotification && (() => {
        const details = getToastDetails(toastNotification, setView);
        return (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={`fixed top-4 left-1/2 -translate-x-1/2 text-white px-6 py-3 rounded-lg shadow-xl z-50 flex items-center gap-3 ${details.bg} ${details.action ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
            onClick={() => {
              if (details.action) {
                details.action();
              }
              setToastNotification(null);
            }}
          >
            {details.icon}
            <span className="font-bold text-xs md:text-sm">{toastNotification}</span>
            <button
              type="button"
              className="p-1 rounded-full hover:bg-white/15 transition-colors focus:outline-none"
              onClick={(e) => {
                e.stopPropagation();
                setToastNotification(null);
              }}
            >
              <X className="w-4 h-4 ml-2" />
            </button>
          </motion.div>
        );
      })()}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <AIChatAssistantModal
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
      />
      <PublishSystemModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        systemName={systemName}
      />

      {/* Floating AI Chat Assistant Launcher Button */}
      <button
        onClick={() => setIsAIChatOpen(true)}
        className="fixed bottom-6 left-6 z-40 p-3.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white rounded-2xl shadow-xl shadow-teal-500/30 flex items-center gap-2 group transition-all duration-300 hover:scale-105 active:scale-95 border border-teal-400/30"
        title="فتح شات الذكاء الاصطناعي (Gemini AI API)"
      >
        <Sparkles className="w-5 h-5 animate-pulse text-amber-300" />
        <span className="text-xs font-bold hidden sm:inline max-w-0 group-hover:max-w-xs transition-all duration-300 overflow-hidden whitespace-nowrap">
          المساعد الذكي Gemini AI
        </span>
      </button>
    </div>
  );
}

export default function App() {
  const [background, setBackground] = useState<{
    url: string;
    type: "image" | "video";
  } | null>(null);
  const [systemName, setSystemName] = useState("REMO PRO");
  const [businessType, setBusinessType] = useState("general");
  const [customerRoute, setCustomerRoute] = useState<{
    branchId: number;
    tableId: number;
  } | null>(null);
  const [isEmployeePortalRoute, setIsEmployeePortalRoute] = useState(false);
  const [isCareersPortalRoute, setIsCareersPortalRoute] = useState(false);
  // === Service Worker update prompt ===
  // When a new version of the app is built and deployed, the SW detects it and
  // prompts the user to refresh — this prevents "broken files" errors after updates.
  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);
  const [swOfflineReady, setSwOfflineReady] = useState(false);

  useEffect(() => {
    // === Skip SW registration entirely on Capacitor/mobile ===
    // On mobile, we use a custom cache-buster (scripts/cache-bust-mobile.cjs) that runs
    // BEFORE the app loads. It handles APK version detection + cache clearing more reliably
    // than Service Worker (which causes "Application files are invalid" errors when APKs
    // are shared via Bluetooth between phones).
    const isCapacitor =
      (window as any).Capacitor !== undefined ||
      window.location.protocol === 'file:' ||
      window.location.protocol === 'capacitor:';

    if (isCapacitor) {
      console.log('[App] Capacitor mobile detected → skipping Service Worker registration');
      return;
    }

    // PWA service worker registration (web-only) with update prompt
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // Listen for new updates
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (!newWorker) return;
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  setSwUpdateAvailable(true);
                } else {
                  setSwOfflineReady(true);
                  setTimeout(() => setSwOfflineReady(false), 3000);
                }
              }
            });
          });
          // Check for updates every 60 minutes on web (less aggressive than mobile)
          setInterval(() => {
            reg.update().catch(() => {});
          }, 60 * 60 * 1000);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const search = window.location.search;
    
    const isCareers =
      path === "/careers" ||
      path === "/jobs" ||
      path === "/apply" ||
      path === "/recruitment" ||
      search.includes("portal=jobs") ||
      search.includes("portal=careers") ||
      search.includes("view=careers") ||
      search.includes("view=jobs") ||
      search.includes("view=apply") ||
      window.location.hash === "#careers" ||
      window.location.hash === "#jobs";

    if (isCareers) {
      setIsCareersPortalRoute(true);
      return;
    }

    const isEmployee = 
      path === "/employee" || 
      path === "/portal" || 
      search.includes("portal=employee") || 
      search.includes("view=mobile_portal") || 
      window.location.hash === "#employee";
      
    if (isEmployee) {
      setIsEmployeePortalRoute(true);
      return;
    }

    const match = path.match(/\/menu\/(\d+)\/(\d+)/);
    if (match) {
      setCustomerRoute({
        branchId: parseInt(match[1]),
        tableId: parseInt(match[2]),
      });
    } else if (
      path === "/public" ||
      path === "/publish" ||
      path === "/menu" ||
      search.includes("publish=true") ||
      search.includes("mode=publish")
    ) {
      setCustomerRoute({
        branchId: 1,
        tableId: 1,
      });
    }
  }, []);

  useEffect(() => {
    const fetchSettings = async (retries = 3) => {
      try {
        const resBg = await api.get("/api/settings/system_background");
        if (resBg.ok) {
          const dataBg = await resBg.json();
          if (dataBg.value) {
            setBackground(JSON.parse(dataBg.value));
          }
        }

        const resName = await api.get("/api/settings/system_name");
        if (resName.ok) {
          const dataName = await resName.json();
          if (dataName.value) {
            setSystemName(dataName.value);
            document.title = dataName.value;
          }
        }

        const resType = await api.get("/api/settings/business_type");
        if (resType.ok) {
          const dataType = await resType.json();
          if (dataType.value) {
            setBusinessType(dataType.value);
          }
        }
      } catch (error) {
        if (retries > 0) {
          setTimeout(() => fetchSettings(retries - 1), 1000);
        } else {
          console.error("Failed to fetch settings", error);
        }
      }
    };
    fetchSettings();
  }, []);

  if (customerRoute) {
    return (
      <CustomerMenu
        branchId={customerRoute.branchId}
        tableId={customerRoute.tableId}
      />
    );
  }

  if (isCareersPortalRoute) {
    return (
      <PublicCareersPortal
        onBackToErp={() => {
          setIsCareersPortalRoute(false);
          window.location.hash = "";
          window.location.href = window.location.origin;
        }}
      />
    );
  }

  if (isEmployeePortalRoute) {
    return (
      <EmployeeMobilePortal
        onBackToErp={() => {
          setIsEmployeePortalRoute(false);
          window.location.hash = "";
          // redirect to home
          window.location.href = window.location.origin;
        }}
      />
    );
  }

  return (
    <>
      {background && background.url && (
        <div className="fixed inset-0 z-[-1] overflow-hidden">
          {background.type === "video" ? (
            <video
              src={background.url}
              autoPlay
              loop
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: `url(${background.url})` }}
            />
          )}
          <div className="absolute inset-0 bg-slate-50/30 backdrop-blur-[2px]"></div>
        </div>
      )}
      <MainApp systemName={systemName} businessType={businessType} />

      {/* === Service Worker Update Prompt === */}
      {/* Shows a toast when a new version is available — critical for mobile users
          so they refresh to load the new assets instead of getting broken files. */}
      {swUpdateAvailable && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-3 max-w-sm">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <RefreshCw className="w-4 h-4 animate-spin" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-bold">تحديث جديد متوفر</div>
            <div className="text-xs text-slate-300">يُرجى تحديث التطبيق لتحميل أحدث الملفات</div>
          </div>
          <button
            onClick={() => {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({ type: "SKIP_WAITING" });
              }
              window.location.reload();
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition"
          >
            تحديث
          </button>
        </div>
      )}

      {/* === SW Offline-Ready Confirmation Toast (auto-dismiss after 3s) === */}
      {swOfflineReady && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-bold">
          <CheckCircle className="w-4 h-4" />
          التطبيق جاهز للعمل دون إنترنت
        </div>
      )}
    </>
  );
}
