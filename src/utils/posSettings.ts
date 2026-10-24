export type POSBusinessProfile = "restaurant" | "clothing" | "supermarket" | "general";
export type POSDefaultView = "grid" | "list";
export type POSPaymentMethod = "cash" | "visa" | "mastercard" | "instapay" | "wallet" | "credit" | "mixed" | (string & {});
export type POSOrderType = "WALK-IN" | "DELIVERY" | "PICK UP" | "MEMBERSHIP" | "DINE-IN" | "TAKEAWAY" | "EXCHANGE";
export type POSLinkedModule = "web-orders" | "tables" | "kitchen" | "service" | "delivery" | "customers" | "warehouses";
export type POSOpeningBalanceMode = "required" | "optional" | "none";

export type POSInvoiceTemplateStyle = "standard" | "modern" | "classic" | "compact" | "detailed-table" | "elegant" | "minimal";

export interface POSInvoiceTemplate {
  id: string;
  name: string;
  style: POSInvoiceTemplateStyle;
  isBuiltIn: boolean;
  logoUrl: string;
  companyName: string;
  headerText: string;
  footerText: string;
  hotline: string;
  showLogo: boolean;
  showCompanyName: boolean;
  showDate: boolean;
  showTime: boolean;
  showOrderNumber: boolean;
  showOrderType: boolean;
  showCashier: boolean;
  showCustomer: boolean;
  showTable: boolean;
  showDeliveryAddress: boolean;
  showItemsTable: boolean;
  showItemPrices: boolean;
  showSubtotal: boolean;
  showTax: boolean;
  showDiscount: boolean;
  showDeliveryFee: boolean;
  showServiceCharge: boolean;
  showGrandTotal: boolean;
  showPaymentMethod: boolean;
  showNotes: boolean;
  fontSize: number;
  fontWeight: number;
  headerBgColor: string;
  headerTextColor: string;
  borderColor: string;
}

export const POS_LINKED_MODULES_LIST: { id: POSLinkedModule; label: string; description: string; icon: string }[] = [
  { id: "web-orders", label: "طلبات الأون لاين", description: "استقبال ومعالجة الطلبات من الموقع أو التطبيق", icon: "Target" },
  { id: "tables", label: "الطاولات والمعارض", description: "إدارة الطاولات والمقاعد أو المعارض والأقسام", icon: "Table2" },
  { id: "kitchen", label: "تجهيز الطلبات والتشغيل", description: "شاشة المطبخ والتجهيز والوصفات والمقادير", icon: "ChefHat" },
  { id: "service", label: "نقطة البيع الكول سنتر", description: "شاشة نقطة البيع للكول سنتر واستقبال طلبات العملاء هاتفياً", icon: "UserCircle" },
  { id: "delivery", label: "خدمة التوصيل", description: "إدارة السائقين والشحنات وتتبع التوصيل", icon: "Truck" },
  { id: "customers", label: "قاعدة العملاء", description: "بيانات العملاء والنقاط والعقود", icon: "Users" },
  { id: "warehouses", label: "المخازن والمخزون", description: "حركة المخزون والتحويلات بين المخازن", icon: "Warehouse" },
];

export type POSScreenDesignStyle = "standard" | "neobrutalist" | "dark-emerald" | "royal-luxury" | "cafe-warm" | "fast-cashier";
export type POSScreenLayoutPosition = "cart-right" | "cart-left";
export type POSCategoriesPosition = "sidebar" | "top-bar";

export interface POSScreenDesignPreset {
  id: string;
  name: string;
  badge: string;
  description: string;
  isBuiltIn: boolean;
  style: POSScreenDesignStyle;
  layoutPosition: POSScreenLayoutPosition;
  categoriesPosition: POSCategoriesPosition;
  primaryColor: string;
  accentColor: string;
  cardRadius: "rounded" | "sharp" | "pill";
  defaultView: POSDefaultView;
  showImages: boolean;
  productsPerRow: number;
  compactCart: boolean;
}

export interface POSConfiguration {
  profile: POSBusinessProfile;
  screen: {
    activeDesignId?: string;
    customDesigns?: POSScreenDesignPreset[];
    defaultView: POSDefaultView;
    showImages: boolean;
    showBarcode: boolean;
    showCustomer: boolean;
    showCategorySidebar: boolean;
    showQuickActions: boolean;
    showBrandFilter: boolean;
    showUnitFilter: boolean;
    showSubcategories: boolean;
    showNumpad: boolean;
    showCashDrawer: boolean;
    compactCart: boolean;
    productsPerRow: number;
  };
  salesFlow: {
    allowHoldInvoices: boolean;
    allowReturns: boolean;
    allowInvoiceNotes: boolean;
    allowItemNotes: boolean;
    requireCustomer: boolean;
    requireCustomerForDelivery: boolean;
    allowNegativeStock: boolean;
    autoPrintReceipt: boolean;
    autoPrintKitchen: boolean;
    askBeforeCheckout: boolean;
    defaultOrderType: POSOrderType;
    enabledOrderTypes: POSOrderType[];
  };
  pricing: {
    currency: string;
    enableTax: boolean;
    taxPercent: number;
    taxIncluded: boolean;
    enableDiscount: boolean;
    maxDiscountPercent: number;
    allowLineDiscount: boolean;
    enableServiceCharge: boolean;
    serviceChargePercent: number;
  };
  payments: {
    enabledMethods: POSPaymentMethod[];
    defaultMethod: POSPaymentMethod;
    allowPartialPayments: boolean;
    openCashDrawerOnCash: boolean;
    customMethods?: { key: string; label: string; en: string }[];
  };
  restaurant: {
    enableTables: boolean;
    enableKitchenNotes: boolean;
    enableModifiers: boolean;
    enableCourses: boolean;
    enableWaiterMode: boolean;
  };
  supermarket: {
    enableScaleBarcode: boolean;
    weightedBarcodePrefix: string;
    priceEmbeddedBarcodePrefix: string;
    fastBarcodeFocus: boolean;
    showStockLevel: boolean;
  };
  clothing: {
    enableVariants: boolean;
    variantLabels: string[];
    enableExchanges: boolean;
    showSeason: boolean;
  };
  reports: {
    showTodaySales: boolean;
    showInvoiceCount: boolean;
    showAverageTicket: boolean;
    showTopProducts: boolean;
    showCashierPerformance: boolean;
    showPaymentBreakdown: boolean;
  };
  shiftManagement: {
    enabled: boolean;
    openingBalanceMode: POSOpeningBalanceMode;
    employeeOwnShiftOnly: boolean;
    terminalId: string;
    allowMultipleOpenShifts: boolean;
  };
  linkedModules: POSLinkedModule[];
  invoiceTemplates: {
    customerTemplateId: string;
    internalTemplateId: string;
    customTemplates: POSInvoiceTemplate[];
  };
}

export const POS_INVOICE_STYLE_LABELS: Record<POSInvoiceTemplateStyle, { label: string; description: string }> = {
  "standard": { label: "النمط القياسي", description: "تصميم بسيط بخطوط متقطعة، مناسب لجميع الطابعات الحرارية" },
  "modern": { label: "النمط العصري", description: "رأس داكن أنيق مع تقسيمات واضحة وحديثة" },
  "classic": { label: "النمط الكلاسيكي", description: "إطار مزدوج وتصميم تقليدي يركز على سهولة القراءة" },
  "compact": { label: "النمط المدمج", description: "موفر للمساحة، مثالي للفواتير الطويلة والطلبات الكبيرة" },
  "detailed-table": { label: "الجدول التفصيلي", description: "جداول كاملة بحدود واضحة، كل عنصر في خلية مستقلة مفصل" },
  "elegant": { label: "النمط الأنيق", description: "زوايا مدورة وتدرجات لونية، تصميم راقي للمطاعم الراقية" },
  "minimal": { label: "النمط البسيط", description: "بدون حدود زائدة، نظيف وخفيف، مناسب لكل الأنشطة" }
};

export const POS_BUILT_IN_TEMPLATES: POSInvoiceTemplate[] = [
  {
    id: "standard", name: "النمط القياسي", style: "standard", isBuiltIn: true,
    logoUrl: "", companyName: "", headerText: "فاتورة طلب", footerText: "شكراً لزيارتكم!", hotline: "",
    showLogo: true, showCompanyName: true, showDate: true, showTime: true, showOrderNumber: true,
    showOrderType: true, showCashier: false, showCustomer: true, showTable: true, showDeliveryAddress: true,
    showItemsTable: true, showItemPrices: true, showSubtotal: false, showTax: false, showDiscount: true,
    showDeliveryFee: true, showServiceCharge: false, showGrandTotal: true, showPaymentMethod: true, showNotes: true,
    fontSize: 12, fontWeight: 400, headerBgColor: "#1e293b", headerTextColor: "#ffffff", borderColor: "#000000"
  },
  {
    id: "modern", name: "النمط العصري", style: "modern", isBuiltIn: true,
    logoUrl: "", companyName: "", headerText: "", footerText: "شكراً لزيارتكم!", hotline: "",
    showLogo: true, showCompanyName: true, showDate: true, showTime: true, showOrderNumber: true,
    showOrderType: true, showCashier: false, showCustomer: true, showTable: true, showDeliveryAddress: true,
    showItemsTable: true, showItemPrices: true, showSubtotal: true, showTax: true, showDiscount: true,
    showDeliveryFee: true, showServiceCharge: true, showGrandTotal: true, showPaymentMethod: true, showNotes: true,
    fontSize: 12, fontWeight: 400, headerBgColor: "#0f172a", headerTextColor: "#ffffff", borderColor: "#e2e8f0"
  },
  {
    id: "classic", name: "النمط الكلاسيكي", style: "classic", isBuiltIn: true,
    logoUrl: "", companyName: "", headerText: "فاتورة ضريبية مبسطة", footerText: "شكراً لزيارتكم!", hotline: "",
    showLogo: true, showCompanyName: true, showDate: true, showTime: true, showOrderNumber: true,
    showOrderType: true, showCashier: true, showCustomer: true, showTable: true, showDeliveryAddress: true,
    showItemsTable: true, showItemPrices: true, showSubtotal: true, showTax: true, showDiscount: true,
    showDeliveryFee: true, showServiceCharge: false, showGrandTotal: true, showPaymentMethod: true, showNotes: true,
    fontSize: 13, fontWeight: 400, headerBgColor: "#ffffff", headerTextColor: "#000000", borderColor: "#1e293b"
  },
  {
    id: "compact", name: "النمط المدمج", style: "compact", isBuiltIn: true,
    logoUrl: "", companyName: "", headerText: "", footerText: "", hotline: "",
    showLogo: false, showCompanyName: true, showDate: true, showTime: true, showOrderNumber: true,
    showOrderType: false, showCashier: false, showCustomer: false, showTable: false, showDeliveryAddress: false,
    showItemsTable: true, showItemPrices: true, showSubtotal: false, showTax: false, showDiscount: true,
    showDeliveryFee: true, showServiceCharge: false, showGrandTotal: true, showPaymentMethod: false, showNotes: false,
    fontSize: 10, fontWeight: 400, headerBgColor: "#ffffff", headerTextColor: "#000000", borderColor: "#cbd5e1"
  },
  {
    id: "detailed-table", name: "الجدول التفصيلي", style: "detailed-table", isBuiltIn: true,
    logoUrl: "", companyName: "", headerText: "", footerText: "", hotline: "",
    showLogo: true, showCompanyName: true, showDate: true, showTime: true, showOrderNumber: true,
    showOrderType: true, showCashier: true, showCustomer: true, showTable: true, showDeliveryAddress: true,
    showItemsTable: true, showItemPrices: true, showSubtotal: true, showTax: true, showDiscount: true,
    showDeliveryFee: true, showServiceCharge: true, showGrandTotal: true, showPaymentMethod: true, showNotes: true,
    fontSize: 11, fontWeight: 400, headerBgColor: "#f8fafc", headerTextColor: "#0f172a", borderColor: "#000000"
  },
  {
    id: "elegant", name: "النمط الأنيق", style: "elegant", isBuiltIn: true,
    logoUrl: "", companyName: "", headerText: "", footerText: "نتشرف بخدمتكم دائماً", hotline: "",
    showLogo: true, showCompanyName: true, showDate: true, showTime: true, showOrderNumber: true,
    showOrderType: true, showCashier: false, showCustomer: true, showTable: true, showDeliveryAddress: true,
    showItemsTable: true, showItemPrices: true, showSubtotal: true, showTax: true, showDiscount: true,
    showDeliveryFee: true, showServiceCharge: true, showGrandTotal: true, showPaymentMethod: true, showNotes: true,
    fontSize: 12, fontWeight: 400, headerBgColor: "#581c87", headerTextColor: "#ffffff", borderColor: "#c084fc"
  },
  {
    id: "minimal", name: "النمط البسيط", style: "minimal", isBuiltIn: true,
    logoUrl: "", companyName: "", headerText: "", footerText: "", hotline: "",
    showLogo: true, showCompanyName: true, showDate: true, showTime: false, showOrderNumber: true,
    showOrderType: false, showCashier: false, showCustomer: true, showTable: false, showDeliveryAddress: false,
    showItemsTable: true, showItemPrices: true, showSubtotal: false, showTax: false, showDiscount: false,
    showDeliveryFee: false, showServiceCharge: false, showGrandTotal: true, showPaymentMethod: true, showNotes: false,
    fontSize: 12, fontWeight: 300, headerBgColor: "#ffffff", headerTextColor: "#374151", borderColor: "#e5e7eb"
  }
];

export const createDefaultCustomTemplate = (): POSInvoiceTemplate => ({
  id: `custom_${Date.now()}`,
  name: "قالب مخصص جديد",
  style: "standard",
  isBuiltIn: false,
  logoUrl: "", companyName: "", headerText: "", footerText: "", hotline: "",
  showLogo: true, showCompanyName: true, showDate: true, showTime: true, showOrderNumber: true,
  showOrderType: true, showCashier: false, showCustomer: true, showTable: true, showDeliveryAddress: true,
  showItemsTable: true, showItemPrices: true, showSubtotal: true, showTax: true, showDiscount: true,
  showDeliveryFee: true, showServiceCharge: true, showGrandTotal: true, showPaymentMethod: true, showNotes: true,
  fontSize: 12, fontWeight: 400, headerBgColor: "#1e293b", headerTextColor: "#ffffff", borderColor: "#000000"
});

export const POS_SETTINGS_KEY = "pos_configuration";

export const POS_SCREEN_DESIGN_STYLE_LABELS: Record<POSScreenDesignStyle, { label: string; description: string }> = {
  "standard": { label: "النمط الاحترافي الهادئ", description: "واجهة عصرية نظيفة بألوان زرقاء ورمادية مريحة للعين" },
  "neobrutalist": { label: "النمط الجريء (نيوبروتاليزم)", description: "حدود سوداء واضحة وأزرار صفراء عالية التباين للسرعة القصوى" },
  "dark-emerald": { label: "النمط الليلي الزمردي", description: "واجهة داكنة فاخرة مع لمسات خضراء زمردية مريحة للإضاءة الخافتة" },
  "royal-luxury": { label: "النمط الملكي الفاخر", description: "تصميم راقٍ للمطاعم والكافيهات الفاخرة بلمسات ذهبية وبنفسجية" },
  "cafe-warm": { label: "نمط الكافيه الدافئ", description: "ألوان القهوة والكراميل الدافئة مع شريط أقسام علوي سريع" },
  "fast-cashier": { label: "نمط الكاشير السريع", description: "كثافة عرض عالية وأزرار كبيرة للسوبر ماركت والبيع السريع" }
};

export const POS_BUILT_IN_SCREEN_DESIGNS: POSScreenDesignPreset[] = [
  {
    id: "standard",
    name: "النمط الاحترافي الهادئ",
    badge: "Classic Modern",
    description: "تصميم هادئ ومتوازن ببطاقات ناعمة وقائمة أقسام جانبية واضحة، مثالي للعمل لساعات طويلة.",
    isBuiltIn: true,
    style: "standard",
    layoutPosition: "cart-right",
    categoriesPosition: "sidebar",
    primaryColor: "#1a3a8a",
    accentColor: "#3b82f6",
    cardRadius: "rounded",
    defaultView: "grid",
    showImages: true,
    productsPerRow: 5,
    compactCart: false
  },
  {
    id: "neobrutalist",
    name: "النمط الجريء (REMO PRO)",
    badge: "High Contrast",
    description: "تباين عالٍ جداً بحدود سوداء عريضة وأزرار صفراء بارزة لسرعة اللمس والوضوح التام.",
    isBuiltIn: true,
    style: "neobrutalist",
    layoutPosition: "cart-right",
    categoriesPosition: "sidebar",
    primaryColor: "#000000",
    accentColor: "#ffeb3b",
    cardRadius: "sharp",
    defaultView: "grid",
    showImages: true,
    productsPerRow: 5,
    compactCart: false
  },
  {
    id: "dark-emerald",
    name: "النمط الليلي الزمردي",
    badge: "Dark Mode Pro",
    description: "ثيم ليلي داكن بالكامل مع إضاءات زمردية يقلل إجهاد العين في الكافيهات والمطاعم المسائية.",
    isBuiltIn: true,
    style: "dark-emerald",
    layoutPosition: "cart-right",
    categoriesPosition: "sidebar",
    primaryColor: "#064e3b",
    accentColor: "#10b981",
    cardRadius: "rounded",
    defaultView: "grid",
    showImages: true,
    productsPerRow: 4,
    compactCart: false
  },
  {
    id: "cafe-warm",
    name: "نمط الكافيه والباريستا",
    badge: "Cafe & Bakery",
    description: "ألوان دافئة مستوحاة من القهوة والمخبوزات مع شريط أقسام علوي لسهولة الوصول السريع.",
    isBuiltIn: true,
    style: "cafe-warm",
    layoutPosition: "cart-left",
    categoriesPosition: "top-bar",
    primaryColor: "#78350f",
    accentColor: "#f59e0b",
    cardRadius: "rounded",
    defaultView: "grid",
    showImages: true,
    productsPerRow: 4,
    compactCart: false
  },
  {
    id: "royal-luxury",
    name: "النمط الملكي الفاخر",
    badge: "Fine Dining",
    description: "تصميم فخم للمطاعم الراقية والفنادق بألوان كحلية وذهبية وتنسيق واسع للصور.",
    isBuiltIn: true,
    style: "royal-luxury",
    layoutPosition: "cart-right",
    categoriesPosition: "sidebar",
    primaryColor: "#311042",
    accentColor: "#d97706",
    cardRadius: "rounded",
    defaultView: "grid",
    showImages: true,
    productsPerRow: 4,
    compactCart: false
  },
  {
    id: "fast-cashier",
    name: "نمط الكاشير السريع (سوبر ماركت)",
    badge: "Express Touch",
    description: "مخصص للسرعة الفائقة وكثافة الأصناف العالية مع سلة مدمجة وشريط أقسام علوي.",
    isBuiltIn: true,
    style: "fast-cashier",
    layoutPosition: "cart-right",
    categoriesPosition: "top-bar",
    primaryColor: "#0f766e",
    accentColor: "#14b8a6",
    cardRadius: "sharp",
    defaultView: "grid",
    showImages: false,
    productsPerRow: 6,
    compactCart: true
  }
];

export const createDefaultCustomScreenDesign = (): POSScreenDesignPreset => ({
  id: `design_${Date.now()}`,
  name: "تصميم شاشة مخصص",
  badge: "Custom UI",
  description: "تصميم مخصص لشاشة نقطة البيع حسب اختيارك.",
  isBuiltIn: false,
  style: "standard",
  layoutPosition: "cart-right",
  categoriesPosition: "sidebar",
  primaryColor: "#1e40af",
  accentColor: "#3b82f6",
  cardRadius: "rounded",
  defaultView: "grid",
  showImages: true,
  productsPerRow: 5,
  compactCart: false
});

export const POS_BUSINESS_PROFILES: Record<POSBusinessProfile, { label: string; description: string; badge: string }> = {
  restaurant: {
    label: "مطاعم وكافيهات",
    description: "طاولات، تيك أواي، دليفري، ملاحظات مطبخ، طباعة مطبخ، تقسيم الطلبات.",
    badge: "Restaurant Ready"
  },
  clothing: {
    label: "ملابس وأحذية",
    description: "ألوان ومقاسات وموديلات، استبدال ومرتجعات، فلاتر براند وموسم.",
    badge: "Fashion Retail"
  },
  supermarket: {
    label: "سوبر ماركت وبقالة",
    description: "باركود سريع، ميزان، وحدات وعبوات، أسعار مضمنة، كثافة عرض عالية.",
    badge: "Grocery Fast POS"
  },
  general: {
    label: "تجاري عام",
    description: "نقطة بيع مرنة تصلح للمتاجر والخدمات والأنشطة المختلطة.",
    badge: "Universal POS"
  }
};

export const DEFAULT_POS_CONFIGURATION: POSConfiguration = {
  profile: "restaurant",
  screen: {
    activeDesignId: "standard",
    customDesigns: [],
    defaultView: "grid",
    showImages: true,
    showBarcode: true,
    showCustomer: true,
    showCategorySidebar: true,
    showQuickActions: true,
    showBrandFilter: true,
    showUnitFilter: true,
    showSubcategories: true,
    showNumpad: true,
    showCashDrawer: true,
    compactCart: false,
    productsPerRow: 5
  },
  salesFlow: {
    allowHoldInvoices: true,
    allowReturns: true,
    allowInvoiceNotes: true,
    allowItemNotes: true,
    requireCustomer: false,
    requireCustomerForDelivery: true,
    allowNegativeStock: false,
    autoPrintReceipt: false,
    autoPrintKitchen: false,
    askBeforeCheckout: false,
    defaultOrderType: "WALK-IN",
    enabledOrderTypes: ["WALK-IN", "DINE-IN", "PICK UP", "DELIVERY"]
  },
  pricing: {
    currency: "EGP",
    enableTax: true,
    taxPercent: 14,
    // الضريبة تُضاف فوق سعر الصنف كما يُدخَل في بطاقة المنتج. تشغيل هذا الخيار
    // يعني أن السعر المدخل يشمَل الضريبة، فتُستخرج منه ويقل إيراد المبيعات
    // المسجَّل في القيود بنسبتها — وهو ما يظهر للمستخدم كأنه خصم على الصنف.
    taxIncluded: false,
    enableDiscount: true,
    maxDiscountPercent: 100,
    allowLineDiscount: false,
    enableServiceCharge: false,
    serviceChargePercent: 0
  },
  payments: {
    enabledMethods: ["cash", "visa", "mastercard", "instapay", "wallet"],
    defaultMethod: "cash",
    allowPartialPayments: false,
    openCashDrawerOnCash: true,
    customMethods: []
  },
  restaurant: {
    enableTables: true,
    enableKitchenNotes: true,
    enableModifiers: true,
    enableCourses: false,
    enableWaiterMode: true
  },
  supermarket: {
    enableScaleBarcode: true,
    weightedBarcodePrefix: "21",
    priceEmbeddedBarcodePrefix: "22",
    fastBarcodeFocus: true,
    showStockLevel: true
  },
  clothing: {
    enableVariants: true,
    variantLabels: ["المقاس", "اللون", "الموديل", "الموسم"],
    enableExchanges: true,
    showSeason: true
  },
  reports: {
    showTodaySales: true,
    showInvoiceCount: true,
    showAverageTicket: true,
    showTopProducts: true,
    showCashierPerformance: true,
    showPaymentBreakdown: true
  },
  shiftManagement: {
    enabled: false,
    openingBalanceMode: "optional",
    employeeOwnShiftOnly: true,
    terminalId: "POS-01",
    allowMultipleOpenShifts: true
  },
  linkedModules: ["tables", "kitchen", "delivery", "customers"],
  invoiceTemplates: {
    customerTemplateId: "standard",
    internalTemplateId: "detailed-table",
    customTemplates: []
  }
};

const profileOverrides: Record<POSBusinessProfile, Partial<POSConfiguration>> = {
  restaurant: {
    screen: {
      ...DEFAULT_POS_CONFIGURATION.screen,
      defaultView: "grid",
      showImages: true,
      showCategorySidebar: true,
      showNumpad: true
    },
    salesFlow: {
      ...DEFAULT_POS_CONFIGURATION.salesFlow,
      defaultOrderType: "DINE-IN",
      enabledOrderTypes: ["DINE-IN", "PICK UP", "DELIVERY", "WALK-IN"]
    },
    restaurant: {
      ...DEFAULT_POS_CONFIGURATION.restaurant,
      enableTables: true,
      enableKitchenNotes: true,
      enableModifiers: true,
      enableWaiterMode: true
    },
    linkedModules: ["tables", "kitchen", "delivery", "customers"]
  },
  clothing: {
    screen: {
      ...DEFAULT_POS_CONFIGURATION.screen,
      defaultView: "grid",
      showImages: true,
      showBrandFilter: true,
      showUnitFilter: true,
      showNumpad: true
    },
    salesFlow: {
      ...DEFAULT_POS_CONFIGURATION.salesFlow,
      defaultOrderType: "WALK-IN",
      enabledOrderTypes: ["WALK-IN", "EXCHANGE", "MEMBERSHIP"]
    },
    clothing: {
      ...DEFAULT_POS_CONFIGURATION.clothing,
      enableVariants: true,
      enableExchanges: true,
      showSeason: true
    },
    linkedModules: ["customers", "warehouses"]
  },
  supermarket: {
    screen: {
      ...DEFAULT_POS_CONFIGURATION.screen,
      defaultView: "list",
      showImages: false,
      showBarcode: true,
      showBrandFilter: true,
      showUnitFilter: true,
      showNumpad: true,
      compactCart: true
    },
    salesFlow: {
      ...DEFAULT_POS_CONFIGURATION.salesFlow,
      defaultOrderType: "WALK-IN",
      enabledOrderTypes: ["WALK-IN", "DELIVERY", "MEMBERSHIP"]
    },
    supermarket: {
      ...DEFAULT_POS_CONFIGURATION.supermarket,
      enableScaleBarcode: true,
      fastBarcodeFocus: true,
      showStockLevel: true
    },
    linkedModules: ["warehouses", "customers", "delivery"]
  },
  general: {
    screen: DEFAULT_POS_CONFIGURATION.screen,
    salesFlow: {
      ...DEFAULT_POS_CONFIGURATION.salesFlow,
      defaultOrderType: "WALK-IN",
      enabledOrderTypes: ["WALK-IN", "PICK UP", "DELIVERY", "MEMBERSHIP"]
    },
    linkedModules: ["customers"]
  }
};

export const createProfileConfiguration = (profile: POSBusinessProfile): POSConfiguration => {
  const overrides = profileOverrides[profile] || {};
  return normalizePOSConfiguration({
    ...DEFAULT_POS_CONFIGURATION,
    ...overrides,
    profile,
    screen: { ...DEFAULT_POS_CONFIGURATION.screen, ...(overrides.screen || {}) },
    salesFlow: { ...DEFAULT_POS_CONFIGURATION.salesFlow, ...(overrides.salesFlow || {}) },
    pricing: { ...DEFAULT_POS_CONFIGURATION.pricing, ...(overrides.pricing || {}) },
    payments: { ...DEFAULT_POS_CONFIGURATION.payments, ...(overrides.payments || {}) },
    restaurant: { ...DEFAULT_POS_CONFIGURATION.restaurant, ...(overrides.restaurant || {}) },
    supermarket: { ...DEFAULT_POS_CONFIGURATION.supermarket, ...(overrides.supermarket || {}) },
    clothing: { ...DEFAULT_POS_CONFIGURATION.clothing, ...(overrides.clothing || {}) },
    reports: { ...DEFAULT_POS_CONFIGURATION.reports, ...(overrides.reports || {}) },
    shiftManagement: { ...DEFAULT_POS_CONFIGURATION.shiftManagement, ...(overrides.shiftManagement || {}) },
    linkedModules: overrides.linkedModules || DEFAULT_POS_CONFIGURATION.linkedModules,
    invoiceTemplates: { ...DEFAULT_POS_CONFIGURATION.invoiceTemplates, ...(overrides.invoiceTemplates || {}) }
  });
};

export const normalizePOSConfiguration = (value?: Partial<POSConfiguration> | null): POSConfiguration => {
  const input = value || {};
  const profile = input.profile || DEFAULT_POS_CONFIGURATION.profile;
  const enabledMethods = input.payments?.enabledMethods?.length
    ? input.payments.enabledMethods
    : DEFAULT_POS_CONFIGURATION.payments.enabledMethods;
  const enabledOrderTypes = input.salesFlow?.enabledOrderTypes?.length
    ? input.salesFlow.enabledOrderTypes
    : DEFAULT_POS_CONFIGURATION.salesFlow.enabledOrderTypes;

  return {
    ...DEFAULT_POS_CONFIGURATION,
    ...input,
    profile,
    screen: {
      ...DEFAULT_POS_CONFIGURATION.screen,
      ...(input.screen || {}),
      activeDesignId: input.screen?.activeDesignId || DEFAULT_POS_CONFIGURATION.screen.activeDesignId || "standard",
      customDesigns: Array.isArray(input.screen?.customDesigns) ? input.screen!.customDesigns : []
    },
    salesFlow: {
      ...DEFAULT_POS_CONFIGURATION.salesFlow,
      ...(input.salesFlow || {}),
      enabledOrderTypes,
      defaultOrderType: enabledOrderTypes.includes(input.salesFlow?.defaultOrderType || DEFAULT_POS_CONFIGURATION.salesFlow.defaultOrderType)
        ? (input.salesFlow?.defaultOrderType || DEFAULT_POS_CONFIGURATION.salesFlow.defaultOrderType)
        : enabledOrderTypes[0]
    },
    pricing: { ...DEFAULT_POS_CONFIGURATION.pricing, ...(input.pricing || {}) },
    payments: {
      ...DEFAULT_POS_CONFIGURATION.payments,
      ...(input.payments || {}),
      enabledMethods,
      defaultMethod: enabledMethods.includes(input.payments?.defaultMethod || DEFAULT_POS_CONFIGURATION.payments.defaultMethod)
        ? (input.payments?.defaultMethod || DEFAULT_POS_CONFIGURATION.payments.defaultMethod)
        : enabledMethods[0]
    },
    restaurant: { ...DEFAULT_POS_CONFIGURATION.restaurant, ...(input.restaurant || {}) },
    supermarket: { ...DEFAULT_POS_CONFIGURATION.supermarket, ...(input.supermarket || {}) },
    clothing: { ...DEFAULT_POS_CONFIGURATION.clothing, ...(input.clothing || {}) },
    reports: { ...DEFAULT_POS_CONFIGURATION.reports, ...(input.reports || {}) },
    shiftManagement: { ...DEFAULT_POS_CONFIGURATION.shiftManagement, ...(input.shiftManagement || {}) },
    linkedModules: input.linkedModules?.length ? input.linkedModules : DEFAULT_POS_CONFIGURATION.linkedModules,
    invoiceTemplates: {
      ...DEFAULT_POS_CONFIGURATION.invoiceTemplates,
      ...(input.invoiceTemplates || {}),
      customTemplates: input.invoiceTemplates?.customTemplates || []
    }
  };
};

export const parsePOSConfiguration = (raw: unknown): POSConfiguration => {
  if (!raw) return DEFAULT_POS_CONFIGURATION;

  try {
    if (typeof raw === "string") {
      return normalizePOSConfiguration(JSON.parse(raw));
    }
    return normalizePOSConfiguration(raw as Partial<POSConfiguration>);
  } catch {
    return DEFAULT_POS_CONFIGURATION;
  }
};
