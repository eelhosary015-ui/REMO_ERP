/**
 * Period Guard Middleware — بوابة موحّدة للفترة المالية على مستوى الـ HTTP.
 *
 * تُطبَّق على الطلبات التي **تُرحّل** مستندًا فعليًا (أو تنشئ مستندًا بحالة معتمدة)،
 * وليس على إنشاء المسودات أو الاستعلامات، حتى لا تُمنع أعمال غير مؤثرة.
 *
 * القرار يعتمد على تاريخ المستند نفسه، لا على تاريخ اليوم.
 * هذه طبقة «فشل سريع» مكمّلة لفحص الخدمات وtrigger قاعدة البيانات.
 */
import { assertPeriodOpen, PeriodLockError, translatePeriodTriggerError } from "./period-lock.service.js";
import { pool } from "../../../server-db.js";

/** مسارات مالية/مخزنية يُطبَّق عليها الفحص. */
const GUARDED_PREFIXES = [
  "/api/v2/sales",
  "/api/v2/purchases",
  "/api/v2/payroll",
  "/api/v2/production",
  "/api/v2/costs",
  "/api/v2/erp-gl/journal-entries",
  "/api/sales",
  "/api/purchases",
  "/api/purchase-receipts",
  "/api/purchase-returns",
  "/api/returns",
  "/api/goods-receipts",
  "/api/expenses",
  "/api/vouchers",
  "/api/treasury",
  "/api/journal-entries",
];

/** أفعال تدل على ترحيل/اعتماد المستند. */
const POSTING_VERB = /\/(post|posting|confirm|approve|dispatch|issue|settle|disburse|pay|receive|close|transfer|apply|reverse)$/i;

/** حالات المستند التي تعني ترحيلًا فعليًا. */
const POSTING_STATUSES = new Set([
  "معتمدة",
  "معتمد",
  "مرحل",
  "مرحّل",
  "مدفوعة",
  "مدفوعة جزئياً",
  "غير مدفوعة",
  "مكتمل",
  "مكتملة",
  "posted",
  "approved",
  "paid",
  "partially paid",
  "unpaid",
  "completed",
  "confirmed",
]);

const DATE_FIELDS = [
  "date",
  "invoiceDate",
  "invoice_date",
  "receipt_date",
  "return_date",
  "expense_date",
  "delivery_date",
  "transfer_date",
  "adjustment_date",
  "posting_date",
  "transaction_date",
  "payment_date",
  "pay_date",
  "voucher_date",
  "production_date",
  "run_date",
  "period_start",
];

function extractDate(body: any): string | null {
  if (!body || typeof body !== "object") return null;
  for (const field of DATE_FIELDS) {
    const value = body[field];
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.trim())) {
      return value.trim().slice(0, 10);
    }
  }
  return null;
}

function isPostingRequest(path: string, body: any): boolean {
  if (POSTING_VERB.test(path)) return true;
  if (!body || typeof body !== "object") return false;
  if (body.isPosted === true || body.is_posted === true) return true;
  const status = String(body.status ?? "").trim().toLowerCase();
  return POSTING_STATUSES.has(status);
}

export async function periodGuardMiddleware(req: any, res: any, next: any): Promise<void> {
  try {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) return next();

    const path = String(req.path || req.url || "").split("?")[0];
    if (!GUARDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return next();

    const body = req.body || {};
    if (!isPostingRequest(path, body)) return next();

    const date = extractDate(body);
    if (!date) return next();

    await assertPeriodOpen(pool, date, "تنفيذ هذه العملية");
    next();
  } catch (error: any) {
    const translated = translatePeriodTriggerError(error);
    if (translated instanceof PeriodLockError) {
      res.status(translated.statusCode).json({
        error: translated.message,
        code: translated.code,
        period: translated.period,
      });
      return;
    }
    // فشل غير متوقع في البوابة لا يجوز أن يعطّل النظام؛ تبقى حماية الخدمة والـ trigger.
    next();
  }
}
