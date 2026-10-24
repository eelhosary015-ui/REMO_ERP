export type PermissionRisk = "normal" | "sensitive" | "critical";

export interface DetailedPermission {
  id: string;
  label: string;
  description?: string;
  risk?: PermissionRisk;
}

export interface PermissionGroup {
  moduleId: string;
  section: string;
  description?: string;
  permissions: DetailedPermission[];
}

export interface PermissionTemplate {
  id: string;
  label: string;
  description: string;
  permissions: Record<string, any>;
}

export const CORE_ACTION_PERMISSIONS: DetailedPermission[] = [
  { id: "read", label: "مشاهدة", description: "فتح الشاشة وعرض البيانات" },
  { id: "create", label: "إضافة", description: "إنشاء مستندات أو سجلات جديدة" },
  { id: "update", label: "تعديل", description: "تعديل السجلات الموجودة" },
  { id: "delete", label: "حذف", description: "حذف أو إخفاء السجلات" },
  { id: "approve", label: "اعتماد", description: "اعتماد العمليات والمستندات" },
  { id: "print", label: "طباعة", description: "طباعة الفواتير والتقارير" },
  { id: "export", label: "تصدير", description: "تصدير Excel/PDF أو تحميل ملفات" },
];

export const ADVANCED_PERMISSION_GROUPS: PermissionGroup[] = [
  {
    moduleId: "pos",
    section: "شاشة البيع والكاشير",
    permissions: [
      { id: "pos.pos_screen", label: "فتح شاشة البيع" },
      { id: "pos.void", label: "فتح شاشة الفويد واسترجاع وتعديل الأوردرات (Void)", risk: "critical" },
      { id: "pos.create_order", label: "إنشاء فاتورة بيع" },
      { id: "pos.checkout", label: "تحصيل/إغلاق الفاتورة" },
      { id: "pos.hold_order", label: "تعليق واسترجاع فاتورة" },
      { id: "pos.edit_open_order", label: "تعديل فاتورة مفتوحة" },
      { id: "pos.cancel_order", label: "إلغاء فاتورة", risk: "critical" },
      { id: "pos.void_item", label: "إلغاء صنف داخل الفاتورة", risk: "sensitive" },
      { id: "pos.refund", label: "مرتجع/استرداد من POS", risk: "critical" },
      { id: "pos.discount", label: "تطبيق خصم", risk: "sensitive" },
      { id: "pos.price_override", label: "تعديل سعر الصنف يدويًا", risk: "critical" },
      { id: "pos.open_cash_drawer", label: "فتح درج الكاش", risk: "sensitive" },
      { id: "pos.reprint_receipt", label: "إعادة طباعة فاتورة", risk: "sensitive" },
      { id: "pos.shift_open_close", label: "فتح/قفل وردية" },
      { id: "pos.shift_open", label: "فتح وردية" },
      { id: "pos.shift_view_own", label: "مشاهدة ورديتي" },
      { id: "pos.shift_close_own", label: "إغلاق ورديتي" },
      { id: "pos.shift_view_all", label: "مشاهدة ورديات الموظفين" },
      { id: "pos.shift_close_other", label: "إغلاق وردية موظف آخر", risk: "sensitive" },
      { id: "pos.shift_force_close", label: "إغلاق وردية إجباري", risk: "critical" },
      { id: "pos.shift_opening_balance_edit", label: "تعديل الرصيد الافتتاحي", risk: "sensitive" },
      { id: "pos.shift_variance_approve", label: "اعتماد فرق الجرد", risk: "sensitive" },
      { id: "pos.shift_shortage_settle", label: "تسوية العجز", risk: "critical" },
      { id: "pos.shift_surplus_settle", label: "تسوية الزيادة", risk: "sensitive" },
      { id: "pos.shift_reopen", label: "إعادة فتح وردية", risk: "critical" },
      { id: "pos.shift_reports", label: "مشاهدة تقارير الورديات" },
      { id: "pos.mixed_payment", label: "دفع مختلط" },
      { id: "pos.credit_sale", label: "بيع آجل/على حساب عميل", risk: "critical" },
    ],
  },
  {
    moduleId: "pos",
    section: "إعدادات وتقارير POS",
    permissions: [
      { id: "pos.products", label: "فتح إدارة منتجات POS" },
      { id: "pos.pos_settings", label: "تعديل إعدادات نقطة البيع", risk: "critical" },
      { id: "pos.payment_methods", label: "تعديل طرق الدفع", risk: "critical" },
      { id: "pos.tax_service_settings", label: "تعديل الضريبة ورسوم الخدمة", risk: "critical" },
      { id: "pos.device_settings", label: "إعدادات الأجهزة والطابعات" },
      { id: "pos.cashier_dashboard", label: "لوحة مؤشرات الكاشير" },
      { id: "pos.sales_report", label: "تقرير مبيعات POS" },
      { id: "pos.pos_cancelled_report", label: "تقرير الأوردرات الملغاة والمرتجعة (Void)" },
      { id: "pos.export_reports", label: "تصدير تقارير POS", risk: "sensitive" },
    ],
  },
  {
    moduleId: "products",
    section: "الأصناف والمنتجات",
    permissions: [
      { id: "products.categories", label: "إدارة الأقسام الرئيسية" },
      { id: "products.subcategories", label: "إدارة الأقسام الفرعية" },
      { id: "products.products", label: "إدارة المنتجات" },
      { id: "products.pricing", label: "تعديل أسعار البيع", risk: "critical" },
      { id: "products.cost", label: "عرض/تعديل تكلفة الصنف", risk: "critical" },
      { id: "products.barcode", label: "إدارة الباركود و SKU" },
      { id: "products.variants", label: "المقاسات/الألوان/الوحدات" },
      { id: "products.recipes", label: "الوصفات ومكونات الإنتاج" },
      { id: "products.stock_properties", label: "خصائص المخزون والحدود" },
      { id: "products.hide_from_pos", label: "إظهار/إخفاء من شاشة البيع" },
      { id: "products.import_export", label: "استيراد/تصدير المنتجات", risk: "sensitive" },
    ],
  },
  {
    moduleId: "warehouses",
    section: "المخازن والمخزون",
    permissions: [
      { id: "warehouses.items", label: "عرض أرصدة المخازن" },
      { id: "warehouses.receipts", label: "استلام مخزني" },
      { id: "warehouses.issues", label: "صرف مخزني" },
      { id: "warehouses.transfers", label: "تحويل بين المخازن" },
      { id: "warehouses.adjustment", label: "تسوية/تعديل رصيد", risk: "critical" },
      { id: "warehouses.count", label: "الجرد" },
      { id: "warehouses.approve_count", label: "اعتماد نتيجة الجرد", risk: "critical" },
      { id: "warehouses.negative_stock", label: "السماح بمخزون سالب", risk: "critical" },
      { id: "warehouses.valuation", label: "عرض تكلفة وقيمة المخزون", risk: "sensitive" },
      { id: "warehouses.settings", label: "إعدادات المخازن", risk: "critical" },
      { id: "warehouses.export", label: "تصدير تقارير المخزون", risk: "sensitive" },
    ],
  },
  {
    moduleId: "purchases",
    section: "المشتريات والموردين",
    permissions: [
      { id: "purchases.suppliers", label: "إدارة الموردين" },
      { id: "purchases.purchase_orders", label: "أوامر الشراء" },
      { id: "purchases.receive_goods", label: "استلام مشتريات" },
      { id: "purchases.purchase_returns", label: "مرتجعات مشتريات", risk: "sensitive" },
      { id: "purchases.approve_purchase", label: "اعتماد فاتورة/أمر شراء", risk: "critical" },
      { id: "purchases.cost_price", label: "عرض/تعديل أسعار التكلفة", risk: "critical" },
      { id: "purchases.supplier_payments", label: "مدفوعات الموردين", risk: "critical" },
      { id: "purchases.export", label: "تصدير المشتريات", risk: "sensitive" },
      { id: "purchases.purchase_summary", label: "تقرير ملخص المشتريات" },
      { id: "purchases.purchase_orders_report", label: "تقرير أوامر الشراء" },
      { id: "purchases.purchase_requests_report", label: "تقرير طلبات الشراء" },
      { id: "purchases.purchase_quotations_report", label: "تقرير عروض الأسعار" },
      { id: "purchases.purchase_receipts_report", label: "تقرير الاستلام والفحص GRN" },
      { id: "purchases.purchase_invoices_report", label: "تقرير فواتير المشتريات" },
      { id: "purchases.purchase_returns_report", label: "تقرير المرتجعات" },
      { id: "purchases.purchase_expenses_report", label: "تقرير المصاريف والتكاليف الإضافية" },
      { id: "purchases.purchase_suppliers_report", label: "تقرير مشتريات الموردين" },
      { id: "purchases.purchase_items_report", label: "تقرير الأصناف والكميات" },
      { id: "purchases.purchase_prices_report", label: "تقرير أسعار الشراء" },
      { id: "purchases.purchase_payments_report", label: "تقرير مدفوعات الموردين" },
      { id: "purchases.purchase_outstanding_report", label: "تقرير المستحقات وأعمار الديون" },
      { id: "purchases.purchase_taxes_report", label: "تقرير ضرائب المشتريات" },
      { id: "purchases.purchase_matching_report", label: "تقرير المطابقة الثلاثية" },
      { id: "purchases.purchase_warehouse_report", label: "تقرير المشتريات حسب المخزن" },
      { id: "purchases.purchase_cost_centers_report", label: "تقرير المشتريات حسب مراكز التكلفة" },
      { id: "purchases.purchase_monthly_report", label: "التقرير الشهري والاتجاهات" },
      { id: "purchases.purchase_workflow_report", label: "تقرير دورة المشتريات" },
    ],
  },
  {
    moduleId: "sales",
    section: "المبيعات والتوريد",
    permissions: [
      { id: "sales.quotations", label: "عروض الأسعار" },
      { id: "sales.sales_orders", label: "أوامر البيع" },
      { id: "sales.deliveries", label: "أذونات التسليم" },
      { id: "sales.invoices", label: "فواتير البيع" },
      { id: "sales.returns", label: "مرتجعات البيع", risk: "critical" },
      { id: "sales.approve_invoice", label: "اعتماد الفاتورة", risk: "critical" },
      { id: "sales.credit_sales", label: "بيع آجل", risk: "critical" },
      { id: "sales.products_view", label: "عرض منتجات المبيعات" },
      { id: "sales.products_create", label: "إضافة منتج للمبيعات" },
      { id: "sales.products_edit", label: "تعديل منتج المبيعات" },
      { id: "sales.products_disable", label: "تفعيل / تعطيل منتجات المبيعات", risk: "sensitive" },
      { id: "sales.manage_prices", label: "إدارة وتعديل أسعار المبيعات", risk: "critical" },
      { id: "sales.manage_pricelists", label: "إدارة قوائم الأسعار (Price Lists)", risk: "critical" },
      { id: "sales.pricelists", label: "قوائم الأسعار والخصومات", risk: "critical" },
      { id: "sales.commissions", label: "المناديب والعمولات" },
      { id: "sales.export", label: "تصدير المبيعات", risk: "sensitive" },
    ],
  },
  {
    moduleId: "customers",
    section: "العملاء والحسابات",
    permissions: [
      { id: "customers.list", label: "عرض العملاء" },
      { id: "customers.manage", label: "إضافة/تعديل عميل" },
      { id: "customers.delete", label: "حذف عميل", risk: "sensitive" },
      { id: "customers.credit_limit", label: "تعديل حد الائتمان", risk: "critical" },
      { id: "customers.loyalty", label: "نقاط الولاء والخصومات" },
      { id: "customers.statement", label: "كشف حساب العميل" },
      { id: "customers.export", label: "تصدير بيانات العملاء", risk: "sensitive" },
    ],
  },
  {
    moduleId: "safes",
    section: "الخزائن والكاش",
    permissions: [
      { id: "safes.accounts", label: "إدارة الخزائن والحسابات" },
      { id: "safes.transactions", label: "حركات الخزنة" },
      { id: "safes.cash_in", label: "قبض/إيداع" },
      { id: "safes.cash_out", label: "صرف/سحب", risk: "critical" },
      { id: "safes.transfers", label: "تحويل بين الخزائن", risk: "critical" },
      { id: "safes.closings", label: "إقفال خزنة/وردية", risk: "sensitive" },
      { id: "safes.reopen_closing", label: "إعادة فتح إقفال", risk: "critical" },
      { id: "safes.custodies", label: "العهد والسلف" },
      { id: "safes.audit", label: "مراجعة وتدقيق الخزائن", risk: "sensitive" },
      { id: "safes.settings", label: "إعدادات الخزائن", risk: "critical" },
    ],
  },
  {
    moduleId: "general-accounts",
    section: "الحسابات العامة",
    permissions: [
      { id: "general-accounts.chart", label: "دليل الحسابات" },
      { id: "general-accounts.journal", label: "القيود اليومية" },
      { id: "general-accounts.posting", label: "ترحيل القيود", risk: "critical" },
      { id: "general-accounts.delete_journal", label: "حذف قيد", risk: "critical" },
      { id: "general-accounts.financial_periods", label: "إغلاق/فتح الشهور", risk: "critical" },
      { id: "general-accounts.taxes", label: "الضرائب" },
      { id: "general-accounts.reports", label: "القوائم المالية" },
      { id: "general-accounts.export", label: "تصدير الحسابات", risk: "sensitive" },
    ],
  },
  {
    moduleId: "costs",
    section: "إدارة التكاليف والمصروفات",
    permissions: [
      { id: "costs.view", label: "عرض التكاليف ومراكز التكلفة" },
      { id: "costs.create", label: "إضافة مصروف تشغيلي وبنود التكلفة" },
      { id: "costs.edit", label: "تعديل التكاليف وبنود التكلفة" },
      { id: "costs.delete", label: "حذف التكاليف", risk: "critical" },
      { id: "costs.post", label: "ترحيل التكاليف إلى القيود المحاسبية", risk: "critical" },
      { id: "costs.centers", label: "إدارة مراكز التكلفة" },
      { id: "costs.recipes", label: "تكاليف الوصفات والمنتجات" },
    ],
  },
  {
    moduleId: "production",
    section: "الإنتاج والتصنيع",
    permissions: [
      { id: "production.bom", label: "قوائم المواد BOM" },
      { id: "production.work_orders", label: "أوامر الإنتاج" },
      { id: "production.mrp", label: "تخطيط الاحتياجات MRP" },
      { id: "production.quality", label: "مراقبة الجودة" },
      { id: "production.maintenance", label: "الصيانة" },
      { id: "production.costing", label: "تكلفة الإنتاج", risk: "sensitive" },
      { id: "production.scrap", label: "الهالك/التالف", risk: "sensitive" },
      { id: "production.approve", label: "اعتماد أوامر الإنتاج", risk: "critical" },
    ],
  },
  {
    moduleId: "hr",
    section: "الموارد البشرية",
    permissions: [
      { id: "hr.dashboard", label: "لوحة مؤشرات الموارد البشرية" },
      { id: "hr.employees", label: "ملفات الموظفين" },
      { id: "hr.contracts", label: "العقود والبيانات الحساسة", risk: "sensitive" },
      { id: "hr.leaves", label: "طلبات الإجازات والأرصدة", risk: "sensitive" },
      { id: "hr.evaluations", label: "تقييمات الأداء", risk: "sensitive" },
      { id: "hr.documents", label: "مستندات الموظفين والملفات", risk: "critical" },
      { id: "hr.training", label: "برامج التدريب والتأهيل" },
      { id: "hr.settings", label: "إعدادات وسياسات HR", risk: "critical" },
      { id: "hr.attendance", label: "الحضور والانصراف" },
      { id: "hr.manual_attendance", label: "تعديل حضور يدوي", risk: "critical" },
      { id: "hr.penalties", label: "الجزاءات والخصومات" },
      { id: "hr.payroll", label: "المرتبات", risk: "critical" },
      { id: "hr.fingerprint", label: "أجهزة البصمة والمزامنة" },
      { id: "hr.export", label: "تصدير بيانات الموارد البشرية", risk: "sensitive" },
    ],
  },
  {
    moduleId: "salaries",
    section: "إدارة المرتبات والرواتب",
    permissions: [
      { id: "salaries.view", label: "عرض كشوف المرتبات" },
      { id: "salaries.approved", label: "كشوف الرواتب المعتمدة" },
      { id: "salaries.advances", label: "إدارة السلف والعهد" },
      { id: "salaries.bonuses", label: "المكافآت والبدلات" },
      { id: "salaries.penalties", label: "الخصومات والاستقطاعات" },
      { id: "salaries.run", label: "إقفال وصرف المسير", risk: "critical" },
      { id: "salaries.settings", label: "إعدادات البنود", risk: "critical" },
      { id: "salaries.absence_conversion", label: "تحويل غياب", risk: "sensitive" },
      { id: "salaries.leave_deduction", label: "خصم إجازة", risk: "sensitive" },
      { id: "salaries.reports", label: "تقارير المرتبات" },
      { id: "salaries.export", label: "تصدير كشوف المرتبات", risk: "sensitive" },
    ],
  },
  {
    moduleId: "reports",
    section: "التقارير والتحليلات",
    permissions: [
      { id: "reports.sales", label: "تقارير المبيعات" },
      { id: "reports.inventory", label: "تقارير المخزون" },
      { id: "reports.profit", label: "الربحية والتكاليف", risk: "sensitive" },
      { id: "reports.financial", label: "التقارير المالية", risk: "critical" },
      { id: "reports.tax", label: "تقارير الضرائب" },
      { id: "reports.branch_all_users", label: "عرض كل مستخدمي الفرع", risk: "sensitive" },
      { id: "reports.print", label: "طباعة التقارير" },
      { id: "reports.export", label: "تصدير التقارير", risk: "sensitive" },
    ],
  },
  {
    moduleId: "restaurant",
    section: "تشغيل المطاعم والفروع",
    permissions: [
      { id: "restaurant.tables", label: "إدارة الطاولات" },
      { id: "restaurant.reservations", label: "الحجوزات" },
      { id: "restaurant.kitchen", label: "شاشة المطبخ" },
      { id: "restaurant.recipes", label: "الوصفات" },
      { id: "restaurant.delivery", label: "الدليفري" },
      { id: "restaurant.drivers", label: "السائقين" },
      { id: "restaurant.web_orders", label: "طلبات الأونلاين" },
      { id: "restaurant.branches", label: "إدارة الفروع", risk: "critical" },
      { id: "restaurant.printers", label: "الطابعات" },
    ],
  },
  {
    moduleId: "hotel",
    section: "مكتب الاستقبال والحجوزات",
    permissions: [
      { id: "hotel.front_desk", label: "مكتب الاستقبال" },
      { id: "hotel.reservations", label: "الحجوزات الفندقية" },
      { id: "hotel.guests", label: "سجل النزلاء" },
      { id: "hotel.create_reservation", label: "إنشاء حجز جديد" },
      { id: "hotel.check_in", label: "تسجيل الدخول (Check-in)" },
      { id: "hotel.check_out", label: "تسجيل الخروج (Check-out)" },
      { id: "hotel.cancel_reservation", label: "إلغاء حجز", risk: "critical" },
      { id: "hotel.edit_reservation", label: "تعديل حجز" },
    ],
  },
  {
    moduleId: "hotel",
    section: "الخدمات والصيانة (الفنادق)",
    permissions: [
      { id: "hotel.housekeeping", label: "النظافة وتجهيز الغرف" },
      { id: "hotel.room_service", label: "خدمة الغرف والطلبات" },
      { id: "hotel.maintenance", label: "صيانة الغرف والأعطال" },
      { id: "hotel.inventory", label: "مخزون الفندق والمستلزمات" },
    ],
  },
  {
    moduleId: "hotel",
    section: "الحسابات وإدارة الفندق",
    permissions: [
      { id: "hotel.billing", label: "الفواتير والمدفوعات" },
      { id: "hotel.add_payment", label: "إضافة دفعة/سداد" },
      { id: "hotel.print_invoice", label: "طباعة فاتورة" },
      { id: "hotel.reports", label: "تقارير الفندق" },
      { id: "hotel.settings", label: "إعدادات وتأسيس الفندق", risk: "sensitive" },
      { id: "hotel.dashboard", label: "لوحة التحكم (Dashboard)" },
      { id: "hotel.ai_insights", label: "الذكاء الاصطناعي" },
    ],
  },
  {
    moduleId: "system",
    section: "النظام والأمان",
    permissions: [
      { id: "security.users", label: "إدارة المستخدمين", risk: "critical" },
      { id: "security.permissions", label: "تعديل الصلاحيات", risk: "critical" },
      { id: "security.roles", label: "قوالب وأدوار الصلاحيات", risk: "critical" },
      { id: "security.user_logs", label: "سجل المستخدمين" },
      { id: "security.system_settings", label: "إعدادات النظام", risk: "critical" },
      { id: "security.appearance", label: "الهوية والمظهر" },
      { id: "security.receipt_settings", label: "إعدادات الفاتورة" },
      { id: "database.backup", label: "إنشاء نسخة احتياطية", risk: "critical" },
      { id: "database.download_backup", label: "تحميل نسخة احتياطية", risk: "critical" },
      { id: "database.restore", label: "استرجاع نسخة احتياطية", risk: "critical" },
      { id: "database.seed_demo", label: "توليد بيانات تجريبية", risk: "critical" },
      { id: "system.integrations", label: "التكاملات الخارجية", risk: "sensitive" },
    ],
  },
];

const p = (...keys: string[]) =>
  keys.reduce<Record<string, boolean>>((acc, key) => {
    acc[key] = true;
    const moduleId = key.split(".")[0];
    acc[moduleId] = true;
    acc[`${moduleId}.read`] = true;
    return acc;
  }, {});

const withActions = (base: Record<string, any>, modules: string[], actions: string[] = ["read"]) => {
  const output = { ...base };
  modules.forEach((moduleId) => {
    output[moduleId] = true;
    actions.forEach((action) => {
      output[`${moduleId}.${action}`] = true;
    });
  });
  return output;
};

export const PERMISSION_TEMPLATES: PermissionTemplate[] = [
  {
    id: "cashier",
    label: "كاشير POS",
    description: "مناسب للكاشير: بيع وتحصيل وطباعة بدون خصومات خطيرة أو إلغاء فواتير.",
    permissions: withActions(
      p("pos.pos_screen", "pos.create_order", "pos.checkout", "pos.reprint_receipt", "pos.shift_open_close", "customers.list", "restaurant.tables", "restaurant.kitchen"),
      ["pos", "customers", "restaurant"],
      ["read", "create", "print"]
    ),
  },
  {
    id: "cashier_supervisor",
    label: "مشرف كاشير",
    description: "كاشير متقدم مع خصومات وإلغاء واسترداد ومتابعة مؤشرات الكاشير.",
    permissions: withActions(
      p("pos.pos_screen", "pos.create_order", "pos.checkout", "pos.discount", "pos.cancel_order", "pos.void_item", "pos.refund", "pos.open_cash_drawer", "pos.cashier_dashboard", "pos.sales_report", "customers.list", "customers.manage", "safes.transactions", "safes.closings"),
      ["pos", "customers", "safes", "reports"],
      ["read", "create", "update", "approve", "print"]
    ),
  },
  {
    id: "inventory_keeper",
    label: "أمين مخزن",
    description: "إدارة أرصدة وحركات وجرد المخازن بدون الوصول للحسابات الحساسة.",
    permissions: withActions(
      p("warehouses.items", "warehouses.receipts", "warehouses.issues", "warehouses.transfers", "warehouses.count", "products.products", "products.barcode", "products.stock_properties", "reports.inventory"),
      ["warehouses", "products", "reports"],
      ["read", "create", "update", "print", "export"]
    ),
  },
  {
    id: "purchasing",
    label: "مسؤول مشتريات",
    description: "الموردين وأوامر الشراء والاستلام والمرتجعات مع صلاحيات تكلفة.",
    permissions: withActions(
      p("purchases.suppliers", "purchases.purchase_orders", "purchases.receive_goods", "purchases.purchase_returns", "purchases.cost_price", "warehouses.receipts", "products.cost"),
      ["purchases", "suppliers", "warehouses", "products"],
      ["read", "create", "update", "approve", "print", "export"]
    ),
  },
  {
    id: "accountant",
    label: "محاسب",
    description: "الحسابات والخزائن والتكاليف والتقارير المالية بدون إدارة المستخدمين.",
    permissions: withActions(
      p("general-accounts.chart", "general-accounts.journal", "general-accounts.posting", "general-accounts.taxes", "general-accounts.reports", "costs.view", "costs.create", "costs.edit", "costs.post", "costs.centers", "safes.accounts", "safes.transactions", "safes.audit", "reports.financial", "reports.tax", "reports.profit"),
      ["general-accounts", "costs", "safes", "reports", "customer-accounts"],
      ["read", "create", "update", "approve", "print", "export"]
    ),
  },
  {
    id: "branch_manager",
    label: "مدير فرع",
    description: "إدارة تشغيل الفرع ومراجعة المبيعات والمخزون والكاشير داخل الفرع.",
    permissions: withActions(
      p("pos.pos_screen", "pos.discount", "pos.cancel_order", "pos.cashier_dashboard", "pos.sales_report", "warehouses.items", "warehouses.transfers", "customers.statement", "safes.closings", "reports.sales", "reports.inventory", "restaurant.tables", "restaurant.delivery", "restaurant.web_orders"),
      ["pos", "warehouses", "customers", "safes", "reports", "restaurant"],
      ["read", "create", "update", "approve", "print", "export"]
    ),
  },
  {
    id: "hr_manager",
    label: "مسؤول موارد بشرية",
    description: "إدارة الموظفين والحضور والبصمة والمرتبات.",
    permissions: withActions(
      p("hr.dashboard", "hr.employees", "hr.contracts", "hr.leaves", "hr.evaluations", "hr.documents", "hr.training", "hr.settings", "hr.attendance", "hr.manual_attendance", "hr.penalties", "hr.payroll", "hr.fingerprint", "hr.export"),
      ["hr", "attendance"],
      ["read", "create", "update", "delete", "approve", "print", "export"]
    ),
  },
  {
    id: "salaries_manager",
    label: "مدير المرتبات",
    description: "إدارة كشوف الرواتب والسلف والمكافآت والخصومات والإعدادات.",
    permissions: withActions(
      p("salaries.view", "salaries.approved", "salaries.run", "salaries.advances", "salaries.bonuses", "salaries.penalties", "salaries.settings", "salaries.absence_conversion", "salaries.leave_deduction", "salaries.reports", "salaries.export"),
      ["salaries"],
      ["read", "create", "update", "delete", "approve", "print", "export"]
    ),
  },
  {
    id: "production_manager",
    label: "مدير إنتاج",
    description: "قوائم المواد وأوامر الإنتاج والجودة والتكلفة والصيانة.",
    permissions: withActions(
      p("production.bom", "production.work_orders", "production.mrp", "production.quality", "production.maintenance", "production.costing", "production.scrap", "production.approve", "warehouses.items", "products.recipes"),
      ["production", "warehouses", "products"],
      ["read", "create", "update", "approve", "print", "export"]
    ),
  },
  {
    id: "readonly_auditor",
    label: "مراجع قراءة فقط",
    description: "عرض التقارير والسجلات بدون تعديل أو حذف.",
    permissions: withActions(
      p("reports.sales", "reports.inventory", "reports.financial", "reports.tax", "reports.profit", "security.user_logs", "safes.audit"),
      ["reports", "system", "safes", "pos", "warehouses", "customers"],
      ["read", "print", "export"]
    ),
  },
];

export const getAdvancedPermissionsForModule = (moduleId: string) =>
  ADVANCED_PERMISSION_GROUPS.filter((group) => group.moduleId === moduleId);

export const getAllAdvancedPermissionIds = () =>
  ADVANCED_PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.id));

export const permissionIsGranted = (permissions: Record<string, any> | undefined, key: string): boolean => {
  if (!permissions) return false;
  if (permissions.all === true) return true;
  if (permissions[key] === true) return true;
  const parts = key.split(".");
  if (parts.length > 1 && permissions[parts[0]] === true && permissions[`${parts[0]}.full_access`] === true) return true;
  return false;
};

export function getRequiredAdvancedPermissionKeys(pathname: string, method: string, body: any = {}, query: any = {}): string[] {
  const upperMethod = method.toUpperCase();
  const keys = new Set<string>();
  const add = (...items: string[]) => items.forEach((item) => keys.add(item));

  if (pathname.startsWith("/api/auth/") || pathname.startsWith("/api/chat/")) return [];

  if (pathname.startsWith("/api/users")) {
    if (upperMethod === "GET") add("security.users");
    else add("security.permissions");
  }

  if (pathname.startsWith("/api/settings") || pathname.startsWith("/api/system/settings")) {
    const settingKey = String(body?.key || pathname.split("/").pop() || "");
    if (settingKey.includes("receipt")) add("security.receipt_settings");
    else if (settingKey.includes("background") || settingKey.includes("logo") || settingKey.includes("theme") || settingKey.includes("name")) add("security.appearance");
    else if (settingKey.includes("pos")) add("pos.pos_settings");
    else add("security.system_settings");
  }

  if (pathname.includes("/backup")) add(upperMethod === "GET" ? "database.download_backup" : "database.backup");
  if (pathname.includes("/restore")) add("database.restore");
  if (pathname.includes("/seed-demo")) add("database.seed_demo");

  if (pathname.startsWith("/api/pos") || pathname.startsWith("/api/orders")) {
    if (upperMethod === "GET") add("pos.pos_screen");
    if (pathname.includes("/checkout")) add("pos.checkout");
    else if (pathname.includes("/cancel")) add("pos.cancel_order");
    else if (pathname.includes("/add-items")) add("pos.edit_open_order");
    else if (upperMethod === "POST") add("pos.create_order");
    else if (upperMethod === "PUT" || upperMethod === "PATCH") add("pos.edit_open_order");
    if (Number(body?.discount || body?.additionalDiscount || 0) > 0) add("pos.discount");
    if (body?.payment_method === "credit") add("pos.credit_sale");
    if (body?.payment_method === "mixed") add("pos.mixed_payment");
  }

  if (pathname.startsWith("/api/products") || pathname.startsWith("/api/categories")) {
    if (pathname.startsWith("/api/categories")) add("products.categories", "products.subcategories");
    else add("products.products");
    if ("price" in body || "sizes" in body) add("products.pricing");
    if ("cost" in body || "ingredients" in body) add("products.cost");
    if ("barcode" in body || "code" in body) add("products.barcode");
    if ("show_in_pos" in body || "is_active" in body) add("products.hide_from_pos");
  }

  if (pathname.startsWith("/api/inventory") || pathname.startsWith("/api/warehouses")) {
    if (upperMethod === "GET") add("warehouses.items");
    if (pathname.includes("transfer")) add("warehouses.transfers");
    if (pathname.includes("count")) add("warehouses.count");
    if (pathname.includes("settings")) add("warehouses.settings");
    if (upperMethod !== "GET" && keys.size === 0) add("warehouses.adjustment");
  }

  if (pathname.startsWith("/api/purchase") || pathname.startsWith("/api/purchases")) {
    if (pathname.includes("return")) add("purchases.purchase_returns");
    else if (pathname.includes("receive")) add("purchases.receive_goods");
    else add("purchases.purchase_orders");
    if (pathname.includes("approve") || pathname.includes("confirm")) add("purchases.approve_purchase");
  }
  if (pathname.startsWith("/api/suppliers")) add("purchases.suppliers");

  if (pathname.startsWith("/api/safes") || pathname.startsWith("/api/treasury")) {
    if (pathname.includes("transfer")) add("safes.transfers");
    else if (pathname.includes("closing") || pathname.includes("close")) add("safes.closings");
    else if (pathname.includes("custod")) add("safes.custodies");
    else if (pathname.includes("audit")) add("safes.audit");
    else if (pathname.includes("settings")) add("safes.settings");
    else if (upperMethod === "GET") add("safes.accounts");
    else add("safes.transactions");
  }

  if (pathname.startsWith("/api/accounts") || pathname.startsWith("/api/journal")) {
    if (pathname.includes("journal")) add(upperMethod === "DELETE" ? "general-accounts.delete_journal" : "general-accounts.journal");
    else add("general-accounts.chart");
  }
  if (pathname.startsWith("/api/financial-periods") || pathname.startsWith("/api/security/toggle-month-lock")) add("general-accounts.financial_periods");

  if (pathname.startsWith("/api/costs")) {
    if (pathname.includes("/post") || body?.link_ledger === true) {
      add("costs.post");
    } else if (upperMethod === "DELETE") {
      add("costs.delete");
    } else if (upperMethod === "PUT" || upperMethod === "PATCH") {
      add("costs.edit");
    } else if (upperMethod === "POST") {
      if (pathname.includes("/centers")) add("costs.centers");
      else if (pathname.includes("/recipe")) add("costs.recipes");
      else add("costs.create");
    } else {
      add("costs.view");
    }
  }

  if (pathname.startsWith("/api/customers")) {
    if (upperMethod === "GET") add("customers.list");
    else if (upperMethod === "DELETE") add("customers.delete");
    else add("customers.manage");
    if ("credit_limit" in body) add("customers.credit_limit");
  }

  if (pathname.startsWith("/api/hr") || pathname.startsWith("/api/attendance") || pathname.startsWith("/api/payroll") || pathname.startsWith("/api/fingerprint")) {
    if (pathname.startsWith("/api/payroll")) add("hr.payroll");
    else if (pathname.startsWith("/api/attendance")) add(upperMethod === "GET" ? "hr.attendance" : "hr.manual_attendance");
    else if (pathname.startsWith("/api/fingerprint")) add("hr.fingerprint");
    else if (pathname.includes("/dashboard") || pathname.includes("/reports/professional")) add("hr.dashboard");
    else if (pathname.includes("/settings")) add("hr.settings");
    else if (pathname.includes("/leave-requests")) add("hr.leaves");
    else if (pathname.includes("/evaluations")) add("hr.evaluations");
    else if (pathname.includes("/documents")) add("hr.documents");
    else if (pathname.includes("/training-courses")) add("hr.training");
    else if (upperMethod === "GET" && (pathname.includes("/official-holidays") || pathname.includes("/departments") || pathname.includes("/job-titles") || pathname.includes("/branches-status"))) {
      // General reference endpoints
    }
    else add("hr.employees");
  }

  if (pathname.startsWith("/api/v2/production") || pathname.startsWith("/api/production")) {
    if (pathname.includes("quality")) add("production.quality");
    else if (pathname.includes("maintenance")) add("production.maintenance");
    else if (pathname.includes("bom")) add("production.bom");
    else add("production.work_orders");
    if (pathname.includes("approve") || pathname.includes("confirm")) add("production.approve");
  }

  if (pathname.startsWith("/api/reports")) {
    add("reports.sales");
    if (pathname.includes("inventory") || pathname.includes("warehouse")) add("reports.inventory");
    if (pathname.includes("profit") || pathname.includes("cost")) add("reports.profit");
    if (pathname.includes("balance") || pathname.includes("income") || pathname.includes("trial")) add("reports.financial");
    if (String(query?.format || "").toLowerCase() === "export" || String(query?.export || "") === "true") add("reports.export");
  }

  if (pathname.startsWith("/api/branches")) add("restaurant.branches");
  if (pathname.startsWith("/api/printers")) add("restaurant.printers");
  if (pathname.startsWith("/api/kitchen")) add("restaurant.kitchen");
  if (pathname.startsWith("/api/reservations")) add("restaurant.reservations");
  if (pathname.startsWith("/api/delivery")) add("restaurant.delivery");
  if (pathname.startsWith("/api/web-orders")) add("restaurant.web_orders");

  if (pathname.startsWith("/api/hotel")) {
    if (pathname.includes("/reservations")) {
      add("hotel.reservations");
      if (upperMethod === "POST") add("hotel.create_reservation");
      if (upperMethod === "PUT" || upperMethod === "PATCH") {
        if (body?.status === "canceled") add("hotel.cancel_reservation");
        else if (body?.status === "checked_in") add("hotel.check_in");
        else if (body?.status === "checked_out") add("hotel.check_out");
        else add("hotel.edit_reservation");
      }
      if (upperMethod === "DELETE") add("hotel.cancel_reservation");
    } else if (pathname.includes("/guests")) add("hotel.guests");
    else if (pathname.includes("/housekeeping")) add("hotel.housekeeping");
    else if (pathname.includes("/room-service") || pathname.includes("/services")) add("hotel.room_service");
    else if (pathname.includes("/maintenance")) add("hotel.maintenance");
    else if (pathname.includes("/inventory")) add("hotel.inventory");
    else if (pathname.includes("/billing") || pathname.includes("/payments")) {
      add("hotel.billing");
      if (upperMethod === "POST") add("hotel.add_payment");
      if (upperMethod === "GET" && pathname.includes("/invoice")) add("hotel.print_invoice");
    } else if (pathname.includes("/reports")) add("hotel.reports");
    else if (pathname.includes("/settings") || pathname.includes("/rooms") || pathname.includes("/properties")) add("hotel.settings");
    else if (pathname.includes("/dashboard")) add("hotel.dashboard");
    else if (pathname.includes("/ai")) add("hotel.ai_insights");
    else add("hotel.front_desk");
  }

  // Enterprise module permissions
  if (pathname.startsWith("/api/v2/enterprise")) {
    if (pathname.includes("/companies")) add("enterprise.companies");
    else if (pathname.includes("/roles")) add("enterprise.roles");
    else if (pathname.includes("/batches")) add("enterprise.batches");
    else if (pathname.includes("/reordering")) add("enterprise.reordering");
    else if (pathname.includes("/stock-valuation")) add("enterprise.stock_valuation");
    else if (pathname.includes("/boms")) add("enterprise.bom");
    else if (pathname.includes("/work-centers")) add("enterprise.work_centers");
    else if (pathname.includes("/manufacturing")) add("enterprise.manufacturing_orders");
    else if (pathname.includes("/quality")) add("enterprise.quality");
    else if (pathname.includes("/scrap")) add("enterprise.scrap");
    else if (pathname.includes("/assets")) add("enterprise.assets");
    else if (pathname.includes("/maintenance-requests")) add("enterprise.maintenance_requests");
    else if (pathname.includes("/work-orders")) add("enterprise.work_orders");
    else if (pathname.includes("/preventive")) add("enterprise.preventive_maintenance");
    else if (pathname.includes("/leads")) add("enterprise.leads");
    else if (pathname.includes("/opportunities")) add("enterprise.opportunities");
    else if (pathname.includes("/activities")) add("enterprise.activities");
    else if (pathname.includes("/quotations")) add("enterprise.quotations");
    else if (pathname.includes("/recipes")) add("enterprise.recipes");
    else if (pathname.includes("/waste")) add("enterprise.waste");
    else if (pathname.includes("/audit-log")) add("enterprise.audit_log");
    else if (pathname.includes("/dashboard")) add("enterprise.dashboard");
    else if (pathname.includes("/financial-reports")) add("enterprise.financial_reports");
    else add("enterprise.general");
  }

  return Array.from(keys);
}
