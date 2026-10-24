/**
 * خدمة التدقيق المركزية (سجل حركات المستخدمين)
 * ─────────────────────────────────────────────────────────────
 * المشكلة السابقة: الميدلوير العام كان يكتب أعمدة (username / ip_address) غير موجودة
 * في جدول user_logs، فيفشل الإدراج بصمت ولا يُسجَّل إلا ما تكتبه الاستدعاءات الصريحة.
 *
 * هنا:
 *  - ترقية ذاتية لجدول user_logs (أعمدة سياق + JSON للتفاصيل).
 *  - ميدلوير يلتقط كل العمليات المغيّرة للبيانات (POST/PUT/PATCH/DELETE) مع:
 *    المستخدم، الوحدة، العملية بالعربية، المرجع، المبلغ، الحالة، كود الاستجابة، المدة، IP، المتصفح.
 *  - AsyncLocalStorage يربط السياق، فلا تتكرر الحركة إذا سجّلها الكود صراحةً عبر logAction.
 *  - استعلامات موحّدة للشاشة (فلاتر + إحصاءات).
 */
import { AsyncLocalStorage } from "async_hooks";
import { pool } from "../../../server-db.js";

// ─────────────────────────────────────────────────────────────
// 1. المخطط
// ─────────────────────────────────────────────────────────────
let schemaReady: Promise<void> | null = null;

const COLUMNS: Array<{ name: string; ddl: string }> = [
  { name: "username", ddl: "TEXT" },
  { name: "ip_address", ddl: "TEXT" },
  { name: "user_agent", ddl: "TEXT" },
  { name: "http_method", ddl: "TEXT" },
  { name: "route", ddl: "TEXT" },
  { name: "status_code", ddl: "INTEGER" },
  { name: "status", ddl: "TEXT DEFAULT 'success'" },
  { name: "module", ddl: "TEXT" },
  { name: "entity_type", ddl: "TEXT" },
  { name: "entity_ref", ddl: "TEXT" },
  { name: "amount", ddl: "NUMERIC(18,4)" },
  { name: "duration_ms", ddl: "INTEGER" },
  { name: "severity", ddl: "TEXT DEFAULT 'info'" },
  { name: "request_body", ddl: "JSONB" },
  { name: "response_body", ddl: "JSONB" },
  { name: "meta", ddl: "JSONB" },
  { name: "branch_id", ddl: "INTEGER" },
  { name: "company_id", ddl: "INTEGER" },
  { name: "request_id", ddl: "TEXT" },
];

export function ensureAuditSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const column of COLUMNS) {
        try {
          await pool.query(`ALTER TABLE user_logs ADD COLUMN IF NOT EXISTS ${column.name} ${column.ddl}`);
        } catch (error: any) {
          console.warn(`[Audit] تعذر إضافة العمود ${column.name}: ${error.message}`);
        }
      }
      try {
        await pool.query(`ALTER TABLE user_logs ALTER COLUMN timestamp SET DEFAULT NOW()`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_logs_timestamp ON user_logs(timestamp DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_logs_user ON user_logs(user_id, timestamp DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_logs_module ON user_logs(module, timestamp DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_user_logs_status ON user_logs(status)`);
      } catch (error: any) {
        console.warn(`[Audit] تعذر إنشاء الفهارس: ${error.message}`);
      }
    })().catch((error: any) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

// ─────────────────────────────────────────────────────────────
// 2. السياق (لمنع التسجيل المزدوج)
// ─────────────────────────────────────────────────────────────
interface AuditContext {
  startedAt: number;
  requestId: string;
  explicit?: boolean;
  responseBody?: any;
  userId?: number;
  username?: string;
  /** مرجع الطلب الحالي — لقراءة المستخدم/الـ IP لحظة التسجيل الصريح. */
  req?: any;
}

const auditStorage = new AsyncLocalStorage<AuditContext>();

function newRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────
// 3. قواميس الترجمة (وحدة / كيان / فعل)
// ─────────────────────────────────────────────────────────────
const MODULE_LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: "/api/inventory-wastage", label: "الهالك والتالف" },
  { prefix: "/api/wastage-reasons", label: "الهالك والتالف" },
  { prefix: "/api/inventory-adjustments", label: "تسويات المخزون" },
  { prefix: "/api/inventory-counts", label: "الجرد المخزني" },
  { prefix: "/api/inventory-transactions", label: "حركات المخزون" },
  { prefix: "/api/warehouse-transfers", label: "تحويلات المخازن" },
  { prefix: "/api/inventory-requests", label: "طلبات الصرف" },
  { prefix: "/api/material-requests", label: "طلبات الصرف" },
  { prefix: "/api/inventory", label: "المخازن" },
  { prefix: "/api/warehouse", label: "المخازن" },
  { prefix: "/api/warehouses", label: "المخازن" },
  { prefix: "/api/ingredients", label: "المخازن" },
  { prefix: "/api/goods-receipts", label: "المشتريات" },
  { prefix: "/api/delivery-notes", label: "المخازن" },
  { prefix: "/api/purchase", label: "المشتريات" },
  { prefix: "/api/suppliers", label: "المشتريات" },
  { prefix: "/api/sales", label: "المبيعات" },
  { prefix: "/api/returns", label: "المبيعات" },
  { prefix: "/api/customers", label: "العملاء" },
  { prefix: "/api/orders", label: "نقطة البيع" },
  { prefix: "/api/pos", label: "نقطة البيع" },
  { prefix: "/api/treasury", label: "الخزينة والبنوك" },
  { prefix: "/api/safes", label: "الخزينة والبنوك" },
  { prefix: "/api/banks", label: "الخزينة والبنوك" },
  { prefix: "/api/expenses", label: "المصروفات" },
  { prefix: "/api/journal", label: "الحسابات" },
  { prefix: "/api/erp", label: "الحسابات" },
  { prefix: "/api/accounts", label: "الحسابات" },
  { prefix: "/api/gl", label: "الحسابات" },
  { prefix: "/api/costs", label: "التكاليف" },
  { prefix: "/api/production", label: "الإنتاج" },
  { prefix: "/api/recipes", label: "الإنتاج" },
  { prefix: "/api/payroll", label: "الرواتب" },
  { prefix: "/api/hr", label: "الموارد البشرية" },
  { prefix: "/api/employees", label: "الموارد البشرية" },
  { prefix: "/api/attendance", label: "الحضور والانصراف" },
  { prefix: "/api/fingerprint", label: "الحضور والانصراف" },
  { prefix: "/api/users", label: "المستخدمون والصلاحيات" },
  { prefix: "/api/roles", label: "المستخدمون والصلاحيات" },
  { prefix: "/api/permissions", label: "المستخدمون والصلاحيات" },
  { prefix: "/api/auth", label: "المستخدمون والصلاحيات" },
  { prefix: "/api/security", label: "الأمان" },
  { prefix: "/api/settings", label: "الإعدادات" },
  { prefix: "/api/branches", label: "الفروع" },
  { prefix: "/api/hotel", label: "الفنادق" },
  { prefix: "/api/restaurant", label: "المطاعم" },
  { prefix: "/api/tables", label: "المطاعم" },
  { prefix: "/api/reservations", label: "الحجوزات" },
  { prefix: "/api/reports", label: "التقارير" },
  { prefix: "/api/backups", label: "النسخ الاحتياطي" },
  { prefix: "/api/complaints", label: "الشكاوى" },
  { prefix: "/api/fixed-assets", label: "الأصول الثابتة" },
];

const ENTITY_NOUNS: Record<string, string> = {
  orders: "أوردر",
  order: "أوردر",
  pos: "عملية نقطة بيع",
  products: "منتج",
  product: "منتج",
  categories: "تصنيف",
  ingredients: "صنف مخزني",
  "inventory-items": "رصيد صنف",
  inventory: "حركة مخزنية",
  warehouses: "مخزن",
  "inventory-wastage": "إذن هالك",
  wastage: "إذن هالك",
  "wastage-reasons": "سبب هالك",
  "inventory-adjustments": "إذن تسوية",
  adjustments: "تسوية",
  "warehouse-transfers": "تحويل مخزني",
  transfers: "تحويل",
  "inventory-counts": "جرد",
  counts: "جرد",
  "inventory-transactions": "حركة مخزنية",
  "stock-entries": "إذن استلام",
  "delivery-notes": "إذن صرف",
  "material-requests": "طلب صرف",
  "inventory-requests": "طلب صرف",
  purchases: "أمر شراء",
  "purchase-requests": "طلب شراء",
  suppliers: "مورد",
  "goods-receipts": "إذن استلام",
  sales: "فاتورة بيع",
  invoices: "فاتورة",
  returns: "مرتجع",
  customers: "عميل",
  accounts: "حساب",
  "journal-entries": "قيد يومية",
  gl: "قيد يومية",
  treasury: "حركة خزينة",
  safes: "خزنة",
  banks: "بنك",
  expenses: "مصروف",
  employees: "موظف",
  hr: "إعدادات موارد بشرية",
  attendance: "سجل حضور",
  payroll: "مسير رواتب",
  advances: "سلفة",
  bonuses: "مكافأة",
  deductions: "خصم",
  penalties: "جزاء",
  custody: "عهدة",
  leaves: "إجازة",
  users: "مستخدم",
  roles: "دور صلاحيات",
  permissions: "صلاحيات",
  settings: "إعدادات",
  branches: "فرع",
  production: "أمر إنتاج",
  recipes: "وصفة",
  costs: "تكلفة",
  hotel: "حركة فندق",
  restaurant: "حركة مطعم",
  tables: "طاولة",
  reservations: "حجز",
  reports: "تقرير",
  backups: "نسخة احتياطية",
  notifications: "تنبيه",
  complaints: "شكوى",
  "fixed-assets": "أصل ثابت",
  budgets: "موازنة",
  taxes: "ضريبة",
};

const ACTION_VERBS: Record<string, string> = {
  void: "إلغاء واسترجاع",
  approve: "اعتماد",
  "approve-all": "اعتماد جماعي",
  reject: "رفض",
  cancel: "إلغاء",
  settle: "اعتماد جرد",
  close: "إغلاق",
  reopen: "إعادة فتح",
  restore: "استرجاع",
  backup: "نسخ احتياطي",
  transfer: "تحويل",
  adjust: "تعديل رصيد",
  print: "طباعة",
  send: "إرسال",
  pay: "سداد",
  refund: "استرداد",
  assign: "إسناد",
  reset: "تصفير",
  import: "استيراد",
  export: "تصدير",
  upload: "رفع ملف",
  sync: "مزامنة",
  apply: "تطبيق",
  link: "ربط",
  run: "تشغيل",
  post: "ترحيل",
  reverse: "عكس قيد",
  login: "تسجيل دخول",
  logout: "تسجيل خروج",
};

const HIGH_RISK_SEGMENTS = ["void", "cancel", "delete", "reject", "reverse", "restore", "reset", "close"];

const SKIP_PATHS = [
  "/api/login",
  "/api/health",
  "/api/network/ip",
  "/api/notifications",
  "/api/presence",
  "/api/heartbeat",
  "/api/ping",
  "/api/telemetry",
  "/api/print",
];

function moduleFor(pathname: string) {
  const match = MODULE_LABELS.find((entry) => pathname.startsWith(entry.prefix));
  return match?.label || "النظام";
}

function segments(pathname: string) {
  return pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
}

function entityNounFor(parts: string[]) {
  // نتجاهل المقاطع الرقمية ونأخذ آخر مقطع نصي معروف
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (/^\d+$/.test(part)) continue;
    if (ENTITY_NOUNS[part]) return ENTITY_NOUNS[part];
  }
  return "سجل";
}

function describeAction(method: string, parts: string[]) {
  const last = parts[parts.length - 1] || "";
  const beforeLast = parts[parts.length - 2] || "";
  const verbKey = ACTION_VERBS[last] ? last : ACTION_VERBS[beforeLast] ? beforeLast : "";
  const noun = entityNounFor(parts);

  if (verbKey) {
    const verb = ACTION_VERBS[verbKey];
    // تجنّب التكرار مثل "إلغاء إذن هالك إلغاء"
    return `${verb} ${noun}`.trim();
  }
  if (method === "POST") return `إنشاء ${noun}`;
  if (method === "PUT" || method === "PATCH") return `تعديل ${noun}`;
  if (method === "DELETE") return `حذف ${noun}`;
  return `تنفيذ عملية على ${noun}`;
}

function severityFor(method: string, pathname: string, statusCode: number) {
  if (statusCode >= 500) return "critical";
  if (statusCode >= 400) return "warning";
  const risky = HIGH_RISK_SEGMENTS.some((segment) => pathname.includes(`/${segment}`)) || method === "DELETE";
  if (risky) return "high";
  if (method === "POST") return "normal";
  return "info";
}

// ─────────────────────────────────────────────────────────────
// 4. تنقية البيانات الحساسة
// ─────────────────────────────────────────────────────────────
const SENSITIVE_KEY = /(password|passwd|token|secret|authorization|cookie|cvv|pin|otp|api[_-]?key)/i;

export function sanitize(value: any, depth = 0): any {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[...]";
  if (typeof value === "string") {
    return value.length > 600 ? `${value.slice(0, 600)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitize(item, depth + 1));
  }
  if (typeof value === "object") {
    const output: Record<string, any> = {};
    let count = 0;
    for (const [key, raw] of Object.entries(value)) {
      if (count >= 40) break;
      count++;
      if (SENSITIVE_KEY.test(key)) {
        output[key] = "***";
        continue;
      }
      output[key] = sanitize(raw, depth + 1);
    }
    return output;
  }
  return String(value);
}

const AMOUNT_KEYS = ["total", "total_amount", "total_value", "grand_total", "net_total", "amount", "value", "paid", "cost", "price"];
const REF_KEYS = [
  "invoice_number",
  "order_number",
  "transaction_number",
  "wastage_number",
  "transfer_number",
  "adjustment_number",
  "receipt_number",
  "reference",
  "reference_no",
  "daily_number",
  "code",
  "number",
  "name",
];

function firstNumber(source: any, keys: string[]): number | null {
  if (!source || typeof source !== "object") return null;
  for (const key of keys) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw) && raw !== 0) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw)) && Number(raw) !== 0) return Number(raw);
  }
  // كائنات متداخلة شائعة: { data: {...} } أو { result: {...} }
  for (const wrapper of ["data", "result", "record", "row", "items"]) {
    if (source[wrapper] && typeof source[wrapper] === "object" && !Array.isArray(source[wrapper])) {
      const nested = firstNumber(source[wrapper], keys);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function firstRef(source: any): string | null {
  if (!source || typeof source !== "object") return null;
  for (const key of REF_KEYS) {
    const raw = source[key];
    if ((typeof raw === "string" || typeof raw === "number") && String(raw).trim() !== "") return String(raw);
  }
  for (const wrapper of ["data", "result", "record", "row"]) {
    if (source[wrapper] && typeof source[wrapper] === "object" && !Array.isArray(source[wrapper])) {
      const nested = firstRef(source[wrapper]);
      if (nested) return nested;
    }
  }
  return null;
}

function numericIdFromPath(pathname: string): number | null {
  const parts = pathname.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(parts[i])) return Number(parts[i]);
  }
  return null;
}

function refFromPath(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^[A-Za-z0-9][A-Za-z0-9._-]{2,}$/.test(parts[i]) && /[0-9]/.test(parts[i]) && !/^\d+$/.test(parts[i])) {
      return parts[i];
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// 5. الكتابة
// ─────────────────────────────────────────────────────────────
export interface AuditEntry {
  userId?: number | null;
  username?: string | null;
  action: string;
  tableName?: string | null;
  recordId?: number | null;
  details?: string | null;
  module?: string | null;
  entityType?: string | null;
  entityRef?: string | null;
  amount?: number | null;
  status?: string;
  statusCode?: number | null;
  severity?: string;
  httpMethod?: string | null;
  route?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  durationMs?: number | null;
  requestId?: string | null;
  requestBody?: any;
  responseBody?: any;
  meta?: any;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await ensureAuditSchema();
    const params = [
      entry.userId ?? null,
      entry.username ?? null,
      entry.action,
      entry.tableName ?? null,
      entry.recordId ?? null,
      entry.details ?? null,
      entry.module ?? null,
      entry.entityType ?? entry.tableName ?? null,
      entry.entityRef ?? null,
      entry.amount ?? null,
      entry.status ?? "success",
      entry.statusCode ?? null,
      entry.severity ?? "info",
      entry.httpMethod ?? null,
      entry.route ?? null,
      entry.ip ?? null,
      entry.userAgent ?? null,
      entry.durationMs ?? null,
      entry.requestId ?? null,
      entry.requestBody ? JSON.stringify(sanitize(entry.requestBody)) : null,
      entry.responseBody ? JSON.stringify(sanitize(entry.responseBody)) : null,
      entry.meta ? JSON.stringify(sanitize(entry.meta)) : null,
    ];

    const sql = `INSERT INTO user_logs
        (user_id, username, action, table_name, record_id, details,
         module, entity_type, entity_ref, amount, status, status_code, severity,
         http_method, route, ip_address, user_agent, duration_ms, request_id,
         request_body, response_body, meta, timestamp)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW())`;

    try {
      await pool.query(sql, params);
    } catch (error: any) {
      // مستخدم محذوف أو غير موجود: نحفظ السجل بالاسم فقط حتى لا يضيع أثر الحركة
      if (error?.code === "23503" && params[0] !== null) {
        params[0] = null;
        await pool.query(sql, params);
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    // التدقيق لا يجب أن يفشل العملية الأصلية
    console.error("[Audit] تعذر تسجيل الحركة:", error.message);
  }
}

/**
 * التسجيل الصريح (يُستدعى من الموديولات).
 * يحتفظ بنفس التوقيع القديم ويستفيد من سياق الطلب إن وُجد.
 */
export async function logAction(
  userId: number,
  action: string,
  tableName: string,
  recordId: number,
  details: string,
  extra: Partial<AuditEntry> = {}
): Promise<void> {
  const ctx = auditStorage.getStore();
  if (ctx) ctx.explicit = true;

  const requestUser = ctx?.req?.user || {};
  const resolvedUserId = userId || Number(requestUser.id || requestUser.userId) || ctx?.userId || null;
  let resolvedUsername = extra.username || requestUser.username || ctx?.username || null;
  if (!resolvedUsername && resolvedUserId) {
    try {
      const found = await pool.query(`SELECT username FROM users WHERE id = $1`, [resolvedUserId]);
      resolvedUsername = found.rows[0]?.username || null;
    } catch {
      resolvedUsername = null;
    }
  }

  const route = (extra.route || ctx?.req?.path || "").split("?")[0] || undefined;
  const moduleLabel = extra.module || (route ? moduleFor(route) : moduleForForTable(tableName));

  await writeAudit({
    userId: resolvedUserId,
    username: resolvedUsername,
    action,
    tableName,
    recordId,
    details,
    module: moduleLabel,
    entityType: extra.entityType || tableName,
    entityRef: extra.entityRef || null,
    amount: extra.amount ?? null,
    status: extra.status || "success",
    statusCode: extra.statusCode ?? 200,
    severity: extra.severity || "normal",
    httpMethod: extra.httpMethod || ctx?.req?.method || null,
    route: route || null,
    ip: extra.ip || ctx?.req?.ip || ctx?.req?.connection?.remoteAddress || null,
    userAgent: extra.userAgent || String(ctx?.req?.headers?.["user-agent"] || "").slice(0, 300) || null,
    durationMs: ctx ? Date.now() - ctx.startedAt : null,
    requestId: ctx?.requestId || null,
    requestBody: extra.requestBody,
    responseBody: extra.responseBody,
    meta: { ...(extra.meta || {}), source: "explicit" },
  });
}

function moduleForForTable(tableName?: string | null) {
  if (!tableName) return "النظام";
  const noun = ENTITY_NOUNS[tableName];
  if (!noun) return "النظام";
  const entry = MODULE_LABELS.find((item) => item.label.includes(noun));
  return entry?.label || "النظام";
}

// ─────────────────────────────────────────────────────────────
// 6. الميدلوير
// ─────────────────────────────────────────────────────────────
export function auditMiddleware() {
  return (req: any, res: any, next: any) => {
    const method = String(req.method || "").toUpperCase();
    const pathname = String(req.path || req.originalUrl || "").split("?")[0];

    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return next();
    if (!pathname.startsWith("/api/")) return next();
    if (SKIP_PATHS.some((prefix) => pathname.startsWith(prefix))) return next();
    if (String(req.query?.silent || "") === "1") return next();

    const ctx: AuditContext = { startedAt: Date.now(), requestId: newRequestId(), req };

    auditStorage.run(ctx, () => {
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        try {
          ctx.responseBody = summarizeResponse(body);
        } catch {
          ctx.responseBody = null;
        }
        return originalJson(body);
      };

      res.on("finish", () => {
        // أي تسجيل صريح داخل نفس الطلب يمنع التكرار
        if (ctx.explicit) return;
        if (res.statusCode === 401) return; // فشل مصادقة لا يمثل حركة على البيانات
        void finalizeRequest(req, res, ctx, pathname, method);
      });

      next();
    });
  };
}

function summarizeResponse(body: any) {
  if (!body || typeof body !== "object") return typeof body === "string" ? body.slice(0, 300) : null;
  const summary: Record<string, any> = {};
  for (const key of ["id", "success", "message", "error", "code"]) {
    if (body[key] !== undefined) summary[key] = body[key];
  }
  if (Array.isArray(body)) summary.count = body.length;
  // نستخرج المرجع والمبلغ من الاستجابة الكاملة قبل تلخيصها حتى لا تضيع التفاصيل
  const ref = firstRef(body);
  if (ref) summary.entity_ref = ref;
  const amount = firstNumber(body, AMOUNT_KEYS);
  if (amount !== null) summary.amount = amount;
  return summary;
}

async function finalizeRequest(req: any, res: any, ctx: AuditContext, pathname: string, method: string) {
  try {
    const user = req.user || {};
    const parts = segments(pathname);
    const action = describeAction(method, parts);
    const moduleLabel = moduleFor(pathname);
    const requestBody = sanitize(req.body && Object.keys(req.body).length ? req.body : null);
    const responseBody = ctx.responseBody;

    const entityRef = (responseBody && responseBody.entity_ref) || firstRef(responseBody) || firstRef(req.body) || refFromPath(pathname);
    const amount =
      (responseBody && typeof responseBody.amount === "number" ? responseBody.amount : null) ??
      firstNumber(req.body, AMOUNT_KEYS);
    const recordId = numericIdFromPath(pathname) ?? (responseBody && typeof responseBody.id === "number" ? responseBody.id : null);

    let details = `${action} — ${moduleLabel}`;
    const extraBits: string[] = [];
    if (entityRef) extraBits.push(`المرجع: ${entityRef}`);
    if (amount !== null) extraBits.push(`القيمة: ${Number(amount).toLocaleString("ar-EG")} ج.م`);
    if (requestBody && typeof requestBody === "object") {
      const noteKeys = ["notes", "reason", "note", "comment"];
      for (const key of noteKeys) {
        if (requestBody[key]) {
          extraBits.push(`البيان: ${String(requestBody[key]).slice(0, 160)}`);
          break;
        }
      }
    }
    if (extraBits.length) details += ` — ${extraBits.join(" — ")}`;

    await writeAudit({
      userId: user.id || user.userId || null,
      username: user.username || null,
      action,
      tableName: parts[0] || null,
      recordId,
      details,
      module: moduleLabel,
      entityType: parts[0] || null,
      entityRef: entityRef || null,
      amount: amount,
      status: res.statusCode < 400 ? "success" : "failed",
      statusCode: res.statusCode,
      severity: severityFor(method, pathname, res.statusCode),
      httpMethod: method,
      route: pathname,
      ip: req.ip || req.connection?.remoteAddress || null,
      userAgent: String(req.headers?.["user-agent"] || "").slice(0, 300) || null,
      durationMs: Date.now() - ctx.startedAt,
      requestId: ctx.requestId,
      requestBody,
      responseBody,
      meta: {
        query: sanitize(req.query || {}),
        params: sanitize(req.params || {}),
        source: "middleware",
      },
    });
  } catch (error: any) {
    console.error("[Audit] خطأ في تسجيل الطلب:", error.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 7. استعلامات الشاشة
// ─────────────────────────────────────────────────────────────
export interface UserLogFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
  module?: string;
  status?: string;
  severity?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

function buildWhere(filters: UserLogFilters) {
  const where: string[] = ["1=1"];
  const params: any[] = [];

  if (filters.userId) {
    params.push(Number(filters.userId));
    where.push(`ul.user_id = $${params.length}`);
  }
  if (filters.startDate) {
    params.push(String(filters.startDate));
    where.push(`ul.timestamp >= $${params.length}::date`);
  }
  if (filters.endDate) {
    params.push(String(filters.endDate));
    where.push(`ul.timestamp < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (filters.module) {
    params.push(String(filters.module));
    where.push(`ul.module = $${params.length}`);
  }
  if (filters.status) {
    params.push(String(filters.status));
    where.push(`ul.status = $${params.length}`);
  }
  if (filters.severity) {
    params.push(String(filters.severity));
    where.push(`ul.severity = $${params.length}`);
  }
  if (filters.search) {
    params.push(`%${String(filters.search).trim()}%`);
    const idx = params.length;
    where.push(
      `(ul.action ILIKE $${idx} OR ul.details ILIKE $${idx} OR COALESCE(ul.entity_ref,'') ILIKE $${idx} OR COALESCE(ul.username,'') ILIKE $${idx} OR COALESCE(ul.route,'') ILIKE $${idx} OR COALESCE(ul.ip_address,'') ILIKE $${idx})`
    );
  }

  return { clause: where.join(" AND "), params };
}

export async function listUserLogs(filters: UserLogFilters) {
  await ensureAuditSchema();
  const page = Math.max(Number(filters.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(filters.pageSize) || 50, 1), 500);
  const { clause, params } = buildWhere(filters);

  const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM user_logs ul WHERE ${clause}`, params);
  const total = Number(totalRes.rows[0]?.total || 0);

  const rowsRes = await pool.query(
    `SELECT ul.*, COALESCE(ul.username, u.username) AS username_resolved, u.role AS user_role
       FROM user_logs ul
       LEFT JOIN users u ON u.id = ul.user_id
      WHERE ${clause}
      ORDER BY ul.timestamp DESC, ul.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize]
  );

  return {
    rows: rowsRes.rows.map((row: any) => ({
      ...row,
      username: row.username_resolved || row.username || "غير معروف",
      row_type: row.status === "failed" ? "failed" : row.severity === "high" || row.severity === "critical" ? "high" : "normal",
    })),
    total,
    page,
    pageSize,
    pages: Math.max(Math.ceil(total / pageSize), 1),
  };
}

export async function getUserLogStats(filters: UserLogFilters) {
  await ensureAuditSchema();
  const { clause, params } = buildWhere(filters);

  const totals = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE ul.status = 'failed')::int AS failed,
            COUNT(*) FILTER (WHERE ul.status <> 'failed' OR ul.status IS NULL)::int AS success,
            COUNT(*) FILTER (WHERE ul.severity IN ('high','critical'))::int AS high_risk,
            COUNT(DISTINCT ul.user_id)::int AS active_users
       FROM user_logs ul
      WHERE ${clause}`,
    params
  );

  const byModule = await pool.query(
    `SELECT COALESCE(ul.module, 'النظام') AS module, COUNT(*)::int AS count
       FROM user_logs ul WHERE ${clause}
      GROUP BY 1 ORDER BY count DESC LIMIT 12`,
    params
  );

  const byAction = await pool.query(
    `SELECT ul.action, COUNT(*)::int AS count
       FROM user_logs ul WHERE ${clause}
      GROUP BY 1 ORDER BY count DESC LIMIT 20`,
    params
  );

  const users = await pool.query(
    `SELECT ul.user_id, COALESCE(ul.username, u.username) AS username, COUNT(*)::int AS count
       FROM user_logs ul LEFT JOIN users u ON u.id = ul.user_id
      WHERE ${clause}
      GROUP BY 1, 2 ORDER BY count DESC LIMIT 12`,
    params
  );

  const row = totals.rows[0] || {};
  return {
    total: Number(row.total || 0),
    success: Number(row.success || 0),
    failed: Number(row.failed || 0),
    high_risk: Number(row.high_risk || 0),
    active_users: Number(row.active_users || 0),
    by_module: byModule.rows.map((r: any) => ({ module: r.module, count: Number(r.count) })),
    by_action: byAction.rows.map((r: any) => ({ action: r.action, count: Number(r.count) })),
    by_user: users.rows.map((r: any) => ({ user_id: r.user_id, username: r.username || "غير معروف", count: Number(r.count) })),
  };
}
