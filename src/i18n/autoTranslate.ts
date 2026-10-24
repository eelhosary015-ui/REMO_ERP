/**
 * Auto UI Translation — ترجمة واجهة الصفحات عند التبديل للإنجليزية.
 *
 * المشروع مبني بالعربية داخل المكوّنات (نصوص ثابتة)، ولا يستخدم t() إلا في
 * الهيدر والداشبورد. هذه الطبقة تترجم **نصوص الواجهة** فقط (أزرار، تسميات،
 * رؤوس جداول، عناوين، خيارات قوائم) عبر قاموس مطابقة تامة، ولا تلمس:
 *   - بيانات المستخدم (أسماء عملاء/موردين/أصناف/أرقام) لأنها داخل td أو عناصر
 *     موسومة بـ data-no-translate.
 *   - قيم الحقول (input/textarea/select value).
 *   - النصوص التي لا تطابق القاموس حرفيًا تبقى كما هي (لا تخمين).
 *
 * عند العودة للعربية يُستعاد النص الأصلي من الذاكرة، فلا يحدث تراكم أو تلف.
 */

type Lang = "ar" | "en";

const AR_TO_EN: Record<string, string> = {
  // أزرار عامة
  "حفظ": "Save", "حفظ التغييرات": "Save changes", "إلغاء": "Cancel", "حذف": "Delete",
  "تعديل": "Edit", "إضافة": "Add", "جديد": "New", "إضافة جديد": "Add new", "بحث": "Search",
  "تصدير": "Export", "طباعة": "Print", "تحديث": "Refresh", "إغلاق": "Close", "رجوع": "Back",
  "التالي": "Next", "السابق": "Previous", "تأكيد": "Confirm", "اعتماد": "Approve", "رفض": "Reject",
  "إرسال": "Send", "تحميل": "Download", "رفع": "Upload", "استيراد": "Import", "نسخ": "Copy",
  "عرض": "View", "تفاصيل": "Details", "المزيد": "More", "اختيار": "Select", "الكل": "All",
  "تطبيق": "Apply", "إعادة تعيين": "Reset", "تفريغ": "Clear", "ترحيل": "Post", "إلغاء الترحيل": "Unpost",
  "إعادة فتح": "Reopen", "إقفال": "Close period", "تسجيل": "Record", "دفع": "Pay", "تحصيل": "Collect",
  // تسميات الحقول
  "الاسم": "Name", "الكود": "Code", "التاريخ": "Date", "الوقت": "Time", "الحالة": "Status",
  "الكمية": "Quantity", "السعر": "Price", "الإجمالي": "Total", "المجموع": "Subtotal", "الصافي": "Net",
  "الخصم": "Discount", "الضريبة": "Tax", "الرصيد": "Balance", "المبلغ": "Amount", "العملة": "Currency",
  "البيان": "Description", "الوصف": "Description", "ملاحظات": "Notes", "المرجع": "Reference",
  "من": "From", "إلى": "To", "الفترة": "Period", "الشهر": "Month", "السنة": "Year", "اليوم": "Day",
  "الفرع": "Branch", "الشركة": "Company", "المخزن": "Warehouse", "الخزينة": "Treasury", "البنك": "Bank",
  "الحساب": "Account", "الحسابات": "Accounts", "العميل": "Customer", "العملاء": "Customers",
  "المورد": "Supplier", "الموردون": "Suppliers", "الموظف": "Employee", "الموظفون": "Employees",
  "الصنف": "Item", "الأصناف": "Items", "المنتج": "Product", "المنتجات": "Products",
  "الفاتورة": "Invoice", "الفواتير": "Invoices", "القيد": "Journal entry", "القيود": "Journal entries",
  "المستند": "Document", "المستندات": "Documents", "السند": "Voucher", "السندات": "Vouchers",
  "النوع": "Type", "المدين": "Debit", "الدائن": "Credit", "مدين": "Debit", "دائن": "Credit",
  "رصيد أول الفترة": "Opening balance", "الرصيد الافتتاحي": "Opening balance", "الرصيد النهائي": "Closing balance",
  "مركز التكلفة": "Cost center", "مراكز التكلفة": "Cost centers", "المستخدم": "User", "المستخدمون": "Users",
  "الصلاحيات": "Permissions", "الإعدادات": "Settings", "التقارير": "Reports", "الوحدات": "Units",
  // عناوين شاشات
  "لوحة التحكم": "Dashboard", "الرئيسية": "Home", "الإدارة": "Admin", "الحسابات العامة": "General Accounts",
  "دفتر اليومية": "Journal", "الأستاذ العام": "General Ledger", "ميزان المراجعة": "Trial Balance",
  "الميزانية العمومية": "Balance Sheet", "قائمة الدخل": "Income Statement", "الأصول الثابتة": "Fixed Assets",
  "الضرائب": "Taxes", "الخزينة والبنوك": "Treasury & Banks", "المبيعات": "Sales", "المشتريات": "Purchases",
  "المخازن": "Warehouses", "الإنتاج": "Production", "الموارد البشرية": "Human Resources",
  "المرتبات": "Payroll", "التكاليف": "Costs", "التقارير المركزية": "Central Reports",
  // رؤوس جداول شائعة
  "رقم المستند": "Document No.", "اسم الحساب": "Account name", "كود الحساب": "Account code",
  "تاريخ المستند": "Document date", "تاريخ الترحيل": "Posting date", "عدد القيود": "Entries",
  "إجمالي المدين": "Total debit", "إجمالي الدائن": "Total credit", "الفرق": "Difference",
  "الإجراءات": "Actions", "التوقيت": "Timestamp",
  // حالات
  "مفتوحة": "Open", "مغلقة": "Closed", "مجمدة": "Frozen", "مسودة": "Draft", "معتمدة": "Approved",
  "مرحّل": "Posted", "مرحل": "Posted", "ملغي": "Cancelled", "نشط": "Active", "غير نشط": "Inactive",
  "مدفوعة": "Paid", "غير مدفوعة": "Unpaid", "مدفوعة جزئياً": "Partially paid",
  // رسائل فارغة شائعة
  "لا توجد بيانات": "No data found", "لا توجد نتائج": "No results", "لا يوجد حركات مسجلة لهذا الحساب": "No movements recorded for this account",
  "جاري التحميل...": "Loading...", "جارٍ التحميل...": "Loading...", "لا توجد فواتير": "No invoices",
  // ترقيم الصفحات
  "صف": "rows", "الصفحة الأولى": "First page", "الصفحة الأخيرة": "Last page",
};

// مفردات واجهة إضافية مأخوذة من النصوص الأكثر تكرارًا في الشاشات.
// لا تُطبع فوق أي ترجمة موجودة، والهدف تغطية أوسع للصفحات.
const EXTRA_AR_EN: Record<string, string> = {
  "ج.م": "EGP", "ج.م.": "EGP", "جنيه مصري": "Egyptian Pound", "مصري": "Egyptian",
  "قطعة": "Piece", "وحدة": "Unit", "الوحدة": "Unit", "كجم": "kg", "لتر": "Liter",
  "غير محدد": "Not specified", "معتمد": "Approved", "مرفوض": "Rejected", "معلق": "Suspended",
  "مكتمل": "Completed", "مفتوح": "Open", "معطل": "Disabled", "نعم": "Yes", "لا": "No",
  "قيد الانتظار": "Pending", "بانتظار الاعتماد": "Pending approval", "جاري الحفظ...": "Saving...",
  "جاري التحميل...": "Loading...", "مستند عام": "General document", "عام": "General",
  "المخزن الرئيسي": "Main Warehouse", "الفرع الرئيسي": "Main Branch", "كل الفروع": "All branches",
  "كل الأقسام": "All departments", "كل الوظائف": "All functions", "كل الموظفين": "All employees",
  "نقدي": "Cash", "آجل": "Credit", "أجل": "Credit", "فيزا": "Visa", "شيك": "Cheque",
  "تحويل بنكي": "Bank transfer", "إيداع": "Deposit", "استقطاع": "Deduction", "استحقاق": "Accrual",
  "طريقة الدفع": "Payment method", "نوع الحركة": "Transaction type", "رقم الفاتورة": "Invoice No.",
  "رقم السند": "Voucher No.", "كود الصنف": "Item code", "اسم الصنف": "Item name", "صنف": "Item",
  "مورد": "Supplier", "موظف": "Employee", "الموظف": "Employee", "اسم الموظف": "Employee name",
  "القسم": "Department", "التصنيف": "Category", "العنوان": "Address", "الهاتف": "Phone",
  "رقم الهاتف": "Phone number", "البريد الإلكتروني": "Email", "القيمة": "Value", "التكلفة": "Cost",
  "متوسط التكلفة": "Average cost", "تكلفة الوحدة": "Unit cost", "سعر الوحدة": "Unit price",
  "المدفوع": "Paid", "المتبقي": "Remaining", "مبلغ ثابت": "Fixed amount", "الراتب الأساسي": "Basic salary",
  "ساعات العمل": "Work hours", "من تاريخ": "From date", "إلى تاريخ": "To date",
  "التاريخ والوقت": "Date & time", "التاريخ:": "Date:", "ملاحظات:": "Notes:",
  "حضور": "Attendance", "انصراف": "Check-out", "غياب": "Absence", "راحة": "Break", "عمل": "Work",
  "العمليات": "Operations", "إجراءات": "Actions", "التحليلات والرسوم": "Analytics & charts",
  "إدارة الأقسام": "Department management", "تحديث البيانات": "Refresh data", "تصدير Excel": "Export Excel",
  "أخرى": "Other", "يوم": "Day", "تشغيل": "Enable", "مرفوع": "Uploaded",
};

for (const [key, value] of Object.entries(EXTRA_AR_EN)) {
  if (!AR_TO_EN[key]) AR_TO_EN[key] = value;
}

const LEAF_OK = new Set(["BUTTON", "LABEL", "TH", "H1", "H2", "H3", "H4", "H5", "H6", "OPTION", "SUMMARY", "A", "STRONG", "B"]);
const SKIP = new Set(["INPUT", "TEXTAREA", "SELECT", "SCRIPT", "STYLE", "CODE", "PRE"]);

const originals = new WeakMap<Text, { ar: string; en: string }>();
let observer: MutationObserver | null = null;
let applying = false;
let scheduled: number | null = null;

function shouldTranslate(node: Text): boolean {
  const parent = node.parentElement;
  if (!parent) return false;
  if (SKIP.has(parent.tagName)) return false;
  if (parent.closest("[data-no-translate]")) return false;
  // خلية جدول بيانات لا تُترجم (أسماء/مبالغ)، لكن الأزرار داخل الخلية تُترجم
  if (parent.tagName === "TD") return false;
  const tag = parent.tagName;

  // عناصر الواجهة المباشرة
  const allowedByTag = LEAF_OK.has(tag);
  // span/div/p الورقية (بدون عناصر داخلية) تُعتبر نص واجهة
  const isLeafBlock = (tag === "SPAN" || tag === "DIV" || tag === "P") && parent.childElementCount === 0;

  if (!allowedByTag && !isLeafBlock) return false;
  if (parent.childElementCount > 0 && tag !== "BUTTON" && tag !== "A" && tag !== "SUMMARY") return false;
  return true;
}

function applyTo(root: ParentNode = document.body): void {
  if (applying) return;
  applying = true;
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode() as Text | null;
    while (node) {
      const raw = node.nodeValue || "";
      const trimmed = raw.trim();
      const english = AR_TO_EN[trimmed];
      if (english && trimmed.length <= 60 && shouldTranslate(node)) {
        const start = raw.indexOf(trimmed);
        const leading = raw.slice(0, start);
        const trailing = raw.slice(start + trimmed.length);
        const previous = originals.get(node);
        // لا نخزن "أصلاً" جديداً لو النص الحالي هو نفس ترجمتنا السابقة
        if (!previous || previous.en !== trimmed) {
          originals.set(node, { ar: raw, en: english });
        }
        const next = leading + english + trailing;
        if (node.nodeValue !== next) node.nodeValue = next;
      }
      node = walker.nextNode() as Text | null;
    }
  } finally {
    setTimeout(() => { applying = false; }, 0);
  }
}

function restore(): void {
  if (observer) { observer.disconnect(); observer = null; }
  if (scheduled !== null) { clearTimeout(scheduled); scheduled = null; }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const saved = originals.get(node);
    // نعيد الأصل فقط إذا كان النص الحالي ما زال ترجمتنا (لم يغيّره React)
    if (saved && (node.nodeValue || "").trim() === saved.en) node.nodeValue = saved.ar;
    node = walker.nextNode() as Text | null;
  }
}

/** تشغيل/إيقاف ترجمة الواجهة. تُستدعى من نقطة واحدة عند تغيير اللغة. */
export function setUiLanguage(lang: Lang): void {
  if (lang === "ar") {
    restore();
    return;
  }

  applyTo();
  if (observer) return;
  observer = new MutationObserver((mutations) => {
    if (applying || scheduled !== null) return;
    for (const m of mutations) {
      if (m.type === "childList" || m.type === "characterData") {
        scheduled = window.setTimeout(() => {
          scheduled = null;
          applyTo();
        }, 120);
        return;
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function translatedCount(): number {
  return Object.keys(AR_TO_EN).length;
}
