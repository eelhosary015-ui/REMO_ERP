/**
 * Period Lock Service — طبقة حماية الفترات المالية
 *
 * هذا الملف هو المصدر الوحيد للحقيقة عند الإجابة على سؤال:
 * «هل يمكن ترحيل حركة بتاريخ معيّن؟»
 *
 * القواعد المطبَّقة:
 *  1. الفترة تُحدَّد من **تاريخ المستند** وليس من تاريخ اليوم.
 *  2. تُرفض الحركة إذا كانت الفترة `closed` أو `frozen`.
 *  3. تُرفض الحركة إذا لم تكن هناك فترة مالية معرّفة تغطي التاريخ (fail-closed)،
 *     ما لم تُفعّل سياسة `period_lock_allow_unassigned` صراحةً.
 *  4. أي تجاوز مبرمج (إقفال السنة المالية) يجب أن يكون داخل معاملة محددة عبر
 *     `app.period_lock_bypass`، وهو متغير جلسة لا يبقى بعد نهاية المعاملة.
 *
 * نفس القواعد مطبَّقة أيضًا داخل قاعدة البيانات عبر trigger على `journal_entries`
 * (انظر migrations/2026-10-19-period-closing-hardening.sql) حتى لا يمكن تجاوزها
 * عبر مسار API آخر أو عبر SQL مباشر.
 */
import { pool } from "../../../server-db.js";

/** اسم متغير الجلسة الذي يسمح لخدمة الإقفال السنوي بالكتابة داخل فترة مغلقة. */
export const PERIOD_BYPASS_GUC = "app.period_lock_bypass";

export type PeriodStatus = "open" | "closed" | "frozen";

export interface FinancialPeriod {
  id: number;
  month: number;
  year: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  fiscal_year_id: number | null;
  fiscal_year_name?: string | null;
  closed_at?: string | null;
  closed_by?: number | null;
  close_reason?: string | null;
}

export interface PeriodPolicy {
  /** السماح بالترحيل على تاريخ لا تغطيه أي فترة مالية. الافتراضي: لا. */
  allowUnassigned: boolean;
  /** اعتبار الفترة المجمدة (frozen) مثل المغلقة. الافتراضي: نعم. */
  blockFrozen: boolean;
}

export class PeriodLockError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly period: FinancialPeriod | null;
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    statusCode = 403,
    period: FinancialPeriod | null = null,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PeriodLockError";
    this.code = code;
    this.statusCode = statusCode;
    this.period = period;
    this.details = details;
  }
}

export class PeriodValidationError extends Error {
  readonly code = "PERIOD_CLOSE_BLOCKED";
  readonly statusCode = 409;
  readonly report: any;

  constructor(message: string, report: any) {
    super(message);
    this.name = "PeriodValidationError";
    this.report = report;
  }
}

// ─────────────────────────────────────────────────────────────
// أدوات التاريخ
// ─────────────────────────────────────────────────────────────

/**
 * تحويل أي مدخل تاريخ إلى `YYYY-MM-DD` بالتوقيت المحلي.
 *
 * لا نستخدم `toISOString()` لأنها تُرجع UTC: في القاهرة (UTC+3) يتحول
 * منتصف الليل المحلي إلى اليوم السابق، وهو سبب خطأ تواريخ الفترات الأصلي.
 */
export function toYMD(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return toYMD(new Date());
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new PeriodLockError("INVALID_DATE", "تاريخ الحركة غير صالح");
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  // صيغة ISO كاملة أو تاريخ فقط: نأخذ الجزء الأول كما هو لتجنّب إزاحة المنطقة الزمنية.
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (match) {
    const [, y, m, d] = match;
    const asDate = new Date(Number(y), Number(m) - 1, Number(d));
    if (asDate.getFullYear() !== Number(y) || asDate.getMonth() !== Number(m) - 1 || asDate.getDate() !== Number(d)) {
      throw new PeriodLockError("INVALID_DATE", `تاريخ الحركة غير صالح: ${text}`);
    }
    return `${y}-${m}-${d}`;
  }
  return toYMD(new Date(text));
}

export function isValidYMD(value: string): boolean {
  try {
    return toYMD(value) === value;
  } catch {
    return false;
  }
}

/** أول يوم في الشهر التالي (بصيغة YYYY-MM-DD) — لحساب نطاقات شهرية بدقة. */
export function monthBounds(month: number, year: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/** تنسيق تاريخ جاهز للعرض في الرسائل العربية. */
export function formatPeriodLabel(period: FinancialPeriod | null | undefined): string {
  if (!period) return "فترة غير معرّفة";
  return `${String(period.month).padStart(2, "0")}/${period.year}`;
}

// ─────────────────────────────────────────────────────────────
// السياسة القابلة للتهيئة
// ─────────────────────────────────────────────────────────────

let policyCache: { at: number; value: PeriodPolicy } | null = null;
const POLICY_CACHE_MS = 30_000;

export function invalidatePeriodPolicyCache(): void {
  policyCache = null;
}

export async function getPeriodPolicy(db: any = pool): Promise<PeriodPolicy> {
  if (policyCache && Date.now() - policyCache.at < POLICY_CACHE_MS) return policyCache.value;

  const policy: PeriodPolicy = { allowUnassigned: false, blockFrozen: true };
  try {
    const result = await db.query(
      "SELECT key, value FROM settings WHERE key IN ('period_lock_allow_unassigned', 'period_lock_block_frozen')",
    );
    for (const row of result.rows) {
      const raw = String(row.value ?? "").trim().toLowerCase();
      const truthy = raw === "1" || raw === "true" || raw === "yes" || raw === "on";
      if (row.key === "period_lock_allow_unassigned") policy.allowUnassigned = truthy;
      if (row.key === "period_lock_block_frozen") policy.blockFrozen = truthy;
    }
  } catch {
    // إن تعذّرت قراءة الإعدادات نُبقي على القيم الآمنة (رفض الترحيل بلا فترة).
  }
  policyCache = { at: Date.now(), value: policy };
  return policy;
}

// ─────────────────────────────────────────────────────────────
// حَلّ الفترة من تاريخ المستند
// ─────────────────────────────────────────────────────────────

/**
 * جلب الفترة المالية التي يقع داخلها تاريخ المستند.
 *
 * البحث يعتمد على نطاق `start_date..end_date` مع احتياطي للصفوف القديمة التي
 * لا تحتوي تواريخ (نستنتج النطاق من month/year). إن وُجدت أكثر من فترة متقاطعة
 * نأخذ الأقدم بدايةً، ويُبلَّغ عن التقاطع في تقرير التحقق قبل الإقفال.
 */
export async function resolvePeriodForDate(
  db: any,
  date: string | Date,
  options: { forUpdate?: boolean; forShare?: boolean } = {},
): Promise<FinancialPeriod | null> {
  const ymd = toYMD(date);
  const lockClause = options.forUpdate ? "FOR UPDATE OF fp" : options.forShare ? "FOR SHARE OF fp" : "";
  const byRange = await db.query(
    `SELECT fp.*, fy.name AS fiscal_year_name
       FROM financial_periods fp
       LEFT JOIN fiscal_years fy ON fy.id = fp.fiscal_year_id
      WHERE $1::date BETWEEN COALESCE(fp.start_date, make_date(fp.year, fp.month, 1))
                         AND COALESCE(fp.end_date, (make_date(fp.year, fp.month, 1) + INTERVAL '1 month - 1 day')::date)
      ORDER BY fp.start_date NULLS LAST, fp.id
      LIMIT 1
      ${lockClause}`,
    [ymd],
  );
  if (byRange.rows[0]) return byRange.rows[0] as FinancialPeriod;

  // احتياطي: فترات قديمة بلا تواريخ صحيحة أو تواريخ مُزاحة بيوم.
  const byMonth = await db.query(
    `SELECT fp.*, fy.name AS fiscal_year_name
       FROM financial_periods fp
       LEFT JOIN fiscal_years fy ON fy.id = fp.fiscal_year_id
      WHERE fp.month = EXTRACT(MONTH FROM $1::date)
        AND fp.year = EXTRACT(YEAR FROM $1::date)
      ORDER BY fp.id DESC
      LIMIT 1
      ${lockClause}`,
    [ymd],
  );
  return (byMonth.rows[0] as FinancialPeriod) || null;
}

async function isBypassEnabled(db: any): Promise<boolean> {
  try {
    const result = await db.query(`SELECT current_setting('${PERIOD_BYPASS_GUC}', true) AS bypass`);
    return String(result.rows[0]?.bypass || "").toLowerCase() === "on";
  } catch {
    return false;
  }
}

/**
 * التحقق من إمكانية الترحيل بتاريخ معيّن، وإرجاع الفترة المرتبطة به.
 *
 * تُستخدم في كل المسارات التي تنشئ قيودًا أو حركات مالية. عند الرفض تُرمى
 * `PeriodLockError` برسالة عربية واضحة وكود `PERIOD_CLOSED` / `PERIOD_NOT_FOUND`.
 */
export async function assertPeriodOpen(
  db: any,
  date: string | Date,
  actionLabel = "الترحيل",
): Promise<FinancialPeriod | null> {
  const ymd = toYMD(date);
  if (await isBypassEnabled(db)) {
    return resolvePeriodForDate(db, ymd);
  }

  // FOR SHARE يمنع إغلاق الفترة (UPDATE يأخذ FOR NO KEY UPDATE المتعارض معه)
  // طالما أن المعاملة لم تنته، فيصبح قرار «مفتوحة» صالحًا حتى لحظة COMMIT.
  // هذا يسدّ نافذة التزامن بين الترحيل والإقفال.
  const period = await resolvePeriodForDate(db, ymd, { forShare: true });
  const policy = await getPeriodPolicy(db);

  if (!period) {
    if (policy.allowUnassigned) return null;
    throw new PeriodLockError(
      "PERIOD_NOT_FOUND",
      `لا توجد فترة مالية معرّفة تغطي تاريخ ${ymd}؛ لا يمكن ${actionLabel} قبل إنشاء الفترة المالية.`,
      409,
      null,
      { date: ymd },
    );
  }

  const status = String(period.status || "open").toLowerCase();
  const isBlocking = status === "closed" || (status === "frozen" && policy.blockFrozen);
  if (isBlocking) {
    const label = formatPeriodLabel(period);
    const statusAr = status === "closed" ? "مغلقة" : "مجمدة للمراجعة";
    const since = period.closed_at
      ? ` منذ ${String(period.closed_at).slice(0, 16).replace("T", " ")}`
      : "";
    throw new PeriodLockError(
      "PERIOD_CLOSED",
      `لا يمكن ${actionLabel} بتاريخ ${ymd}: الفترة المالية ${label} ${statusAr}${since}. ` +
        `يلزم طلب إعادة فتح الفترة بصلاحية معتمدة أو تنفيذ إجراء تسوية مصرّح به.`,
      403,
      period,
      { date: ymd, status },
    );
  }

  return period;
}

/** تعيين تجاوز محلي للمعاملة الحالية فقط (يُستخدم في إقفال السنة المالية). */
export async function enablePeriodBypass(client: any): Promise<void> {
  await client.query(`SET LOCAL ${PERIOD_BYPASS_GUC} = 'on'`);
}

/** تحويل خطأ قاعدة البيانات الناتج عن trigger الحماية إلى خطأ مفهوم. */
export function translatePeriodTriggerError(error: any): Error {
  if (!error) return error;
  const detail = String(error.detail || "");
  const message = String(error.message || "");
  if (detail === "PERIOD_CLOSED" || message.includes("PERIOD_CLOSED")) {
    return new PeriodLockError(
      "PERIOD_CLOSED",
      message.includes("|") ? message.split("|").slice(1).join("|") : message,
      403,
    );
  }
  if (detail === "PERIOD_NOT_FOUND" || message.includes("PERIOD_NOT_FOUND")) {
    return new PeriodLockError("PERIOD_NOT_FOUND", message, 409);
  }
  return error;
}
