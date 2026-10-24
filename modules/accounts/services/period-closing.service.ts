/**
 * Period Closing Service — إقفال الفترات الشهرية والسنة المالية
 *
 * المسؤوليات:
 *  - التحقق المسبق قبل الإقفال (قيود غير مرحّلة، غير متوازنة، بلا فترة، فروق دفترية).
 *  - إقفال/إعادة فتح الفترة الشهرية بشكل ذرّي مع سجل كامل.
 *  - الإقفال السنوي: إقفال حسابات الإيرادات والمصروفات في «ملخص الدخل»،
 *    ثم ترحيل النتيجة إلى «الأرباح المحتجزة»، ثم إنشاء أرصدة افتتاحية
 *    للسنة التالية متوازنة ومطابقة للأرصدة الختامية.
 *
 * كل الكتابات تتم داخل معاملة واحدة؛ وأي فشل يُرجع الحالة كما كانت.
 * لا تُصفَّر أرصدة الخزائن أو المخزون أو العملاء أو الموردين: فهي أرصدة
 * تشغيلية مستمرة، والترحيل يتم على مستوى دفتر الأستاذ العام فقط.
 */
import { pool } from "../../../server-db.js";
import { AccountRepository } from "../repositories/account.repository.js";
import {
  PeriodLockError,
  PeriodValidationError,
  assertPeriodOpen,
  enablePeriodBypass,
  formatPeriodLabel,
  monthBounds,
  resolvePeriodForDate,
  toYMD,
} from "./period-lock.service.js";

const repo = new AccountRepository();

/**
 * يضمن وجود جداول/أعمدة إقفال الفترات على أي قاعدة بيانات (تثبيت جديد أو ترقية).
 * العملية idempotent ولا تعتمد على تشغيل migration يدويًا، حتى لا يتعطل
 * الإقفال على بيئة لم تُنفَّذ عليها migration الحماية بعد.
 *
 * ملاحظة: طبقة trigger الحماية نفسها تُنشأ عبر migration
 * (migrations/2026-10-19-period-closing-hardening.sql) لأنها تتطلب صلاحية DDL
 * كاملة وتُطبَّق مرة واحدة تحت مراجعة.
 */
let schemaReady: Promise<void> | null = null;

export function ensurePeriodClosingSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        ALTER TABLE financial_periods
          ADD COLUMN IF NOT EXISTS start_date DATE,
          ADD COLUMN IF NOT EXISTS end_date DATE,
          ADD COLUMN IF NOT EXISTS closed_by INTEGER,
          ADD COLUMN IF NOT EXISTS close_reason TEXT,
          ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS reopened_by INTEGER,
          ADD COLUMN IF NOT EXISTS reopen_reason TEXT
      `);
      await pool.query(`
        ALTER TABLE fiscal_years
          ADD COLUMN IF NOT EXISTS closed_by INTEGER,
          ADD COLUMN IF NOT EXISTS close_reason TEXT,
          ADD COLUMN IF NOT EXISTS reopened_at TIMESTAMP,
          ADD COLUMN IF NOT EXISTS reopened_by INTEGER,
          ADD COLUMN IF NOT EXISTS reopen_reason TEXT,
          ADD COLUMN IF NOT EXISTS closing_entry_id INTEGER,
          ADD COLUMN IF NOT EXISTS opening_entry_id INTEGER
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS financial_period_events (
          id SERIAL PRIMARY KEY,
          scope VARCHAR(20) NOT NULL,
          period_id INTEGER REFERENCES financial_periods(id) ON DELETE SET NULL,
          fiscal_year_id INTEGER REFERENCES fiscal_years(id) ON DELETE SET NULL,
          action VARCHAR(30) NOT NULL,
          from_status VARCHAR(20),
          to_status VARCHAR(20),
          reason TEXT,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          user_name TEXT,
          amount NUMERIC(18,2),
          entry_ids INTEGER[],
          details JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_fpe_period ON financial_period_events (period_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_fpe_fiscal_year ON financial_period_events (fiscal_year_id, created_at DESC)`);
      // تصحيح تواريخ الفترات المزاحة يومًا (idempotent، لا يمس أي بيانات أخرى).
      await pool.query(`
        UPDATE financial_periods
           SET end_date = (make_date(year, month, 1) + INTERVAL '1 month - 1 day')::date
         WHERE end_date IS NOT NULL
           AND end_date IS DISTINCT FROM (make_date(year, month, 1) + INTERVAL '1 month - 1 day')::date
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export interface ActingUser {
  id?: number | null;
  username?: string | null;
  role?: string | null;
  permissions?: Record<string, any> | null;
}

export type ClosingAction = "close" | "reopen" | "year_close" | "year_reopen";

const round2 = (value: number): number => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toYMD(date);
}

function addYears(ymd: string, years: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y + years, m - 1, d);
  return toYMD(date);
}

// ─────────────────────────────────────────────────────────────
// الصلاحيات
// ─────────────────────────────────────────────────────────────

/**
 * التحقق من صلاحية إجراء الإقفال.
 * الإقفال السنوي وإعادة فتح سنة مغلقة يتطلبان صلاحية أعلى من إقفال شهر.
 */
export function assertClosingPermission(user: ActingUser | undefined | null, action: ClosingAction): void {
  const permissions = (user?.permissions || {}) as Record<string, any>;
  const isAdmin = user?.role === "admin" || permissions.all === true;
  const has = (...keys: string[]): boolean => keys.some((key) => permissions[key] === true);

  if (isAdmin) return;

  const allowed: Record<ClosingAction, () => boolean> = {
    close: () => has("accounting.close_period", "accounting.full_access", "general-accounts.full_access", "accounting.approve"),
    reopen: () => has("accounting.reopen_period", "accounting.full_access", "general-accounts.full_access"),
    year_close: () => has("accounting.year_close", "accounting.full_access", "general-accounts.full_access"),
    year_reopen: () => has("accounting.year_reopen", "accounting.full_access"),
  };

  if (!allowed[action]()) {
    const labels: Record<ClosingAction, string> = {
      close: "إقفال الفترات المالية",
      reopen: "إعادة فتح الفترات المالية",
      year_close: "إقفال السنة المالية",
      year_reopen: "إعادة فتح سنة مالية مغلقة",
    };
    throw new PeriodLockError(
      "FORBIDDEN",
      `لا تملك صلاحية ${labels[action]}. راجع مسؤول النظام لمنح الصلاحية المناسبة.`,
      403,
    );
  }
}

// ─────────────────────────────────────────────────────────────
// سجل الأحداث
// ─────────────────────────────────────────────────────────────

async function recordEvent(
  client: any,
  event: {
    scope: "period" | "fiscal_year";
    periodId?: number | null;
    fiscalYearId?: number | null;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    reason?: string | null;
    user?: ActingUser | null;
    amount?: number | null;
    entryIds?: number[];
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const userId = event.user?.id ?? null;
  const userName = event.user?.username ?? null;

  await client.query(
    `INSERT INTO financial_period_events
       (scope, period_id, fiscal_year_id, action, from_status, to_status, reason, user_id, user_name, amount, entry_ids, details)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
    [
      event.scope,
      event.periodId ?? null,
      event.fiscalYearId ?? null,
      event.action,
      event.fromStatus ?? null,
      event.toStatus ?? null,
      event.reason ?? null,
      userId,
      userName,
      event.amount ?? null,
      event.entryIds ?? null,
      JSON.stringify(event.details ?? {}),
    ],
  );

  // سجل المستخدم العام (تدقيق موحّد مع بقية الموديولات)
  try {
    await client.query(
      `INSERT INTO user_logs (user_id, action, table_name, record_id, details)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        userId,
        event.action,
        event.scope === "period" ? "financial_periods" : "fiscal_years",
        event.periodId ?? event.fiscalYearId ?? null,
        `[${event.action}] ${event.fromStatus ?? "-"} → ${event.toStatus ?? "-"} | ${event.reason ?? ""}`,
      ],
    );
  } catch {
    // لا نُفشل الإقفال بسبب تعذّر كتابة السجل العام؛ السجل المخصص مكتوب بالفعل.
  }
}

// ─────────────────────────────────────────────────────────────
// التحقق المسبق للفترة الشهرية
// ─────────────────────────────────────────────────────────────

export interface PreflightIssue {
  code: string;
  message: string;
  count?: number;
  details?: any;
}

export interface PreflightReport {
  period: any;
  range: { start: string; end: string };
  generated_at: string;
  counts: Record<string, number>;
  errors: PreflightIssue[];
  warnings: PreflightIssue[];
  reconciliations: Array<{ key: string; label: string; gl: number; subledger: number; difference: number; note?: string }>;
  can_close: boolean;
}

function effectiveRange(period: any): { start: string; end: string } {
  const bounds = monthBounds(Number(period.month), Number(period.year));
  return {
    start: period.start_date ? toYMD(period.start_date) : bounds.start,
    end: period.end_date ? toYMD(period.end_date) : bounds.end,
  };
}

async function safeRows(db: any, sql: string, params: any[], warnings: PreflightIssue[], label: string): Promise<any[]> {
  try {
    return (await db.query(sql, params)).rows;
  } catch (error: any) {
    warnings.push({ code: "CHECK_UNAVAILABLE", message: `تعذّر تنفيذ فحص «${label}»: ${error.message}` });
    return [];
  }
}

async function configAccountId(db: any, ...keys: string[]): Promise<number | null> {
  try {
    const result = await db.query(
      `SELECT key, account_id FROM account_config WHERE account_id IS NOT NULL AND key = ANY($1::text[])`,
      [keys],
    );
    for (const key of keys) {
      const row = result.rows.find((r: any) => r.key === key);
      if (row) return Number(row.account_id);
    }
    return null;
  } catch {
    return null;
  }
}

async function glBalanceUntil(db: any, accountIds: number[], endDate: string): Promise<number> {
  const ids = accountIds.filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return 0;
  const result = await db.query(
    `SELECT COALESCE(SUM(ji.debit - ji.credit), 0)::numeric AS net
       FROM journal_items ji
       JOIN journal_entries je ON je.id = ji.journal_entry_id
      WHERE ji.account_id = ANY($1::int[])
        AND je.status = 'posted'
        AND je.date::date <= $2::date`,
    [ids, endDate],
  );
  return round2(Number(result.rows[0]?.net || 0));
}

/**
 * فحص شامل قبل إقفال الفترة.
 * الأخطاء تمنع الإقفال؛ التحذيرات تُعرض فقط. أي فحص يتعذّر تنفيذه يظهر
 * كتحذير صريح بدل أن يمرّ بصمت.
 */
export async function preflightPeriod(
  periodId: number,
  existingClient?: any,
  options: { allowDrafts?: boolean } = {},
): Promise<PreflightReport> {
  await ensurePeriodClosingSchema();
  const db = existingClient || pool;
  const periodResult = await db.query(
    `SELECT fp.*, fy.name AS fiscal_year_name, fy.status AS fiscal_year_status
       FROM financial_periods fp
       LEFT JOIN fiscal_years fy ON fy.id = fp.fiscal_year_id
      WHERE fp.id = $1`,
    [periodId],
  );
  const period = periodResult.rows[0];
  if (!period) throw new PeriodLockError("PERIOD_NOT_FOUND", "الفترة المالية غير موجودة", 404);

  const range = effectiveRange(period);
  const errors: PreflightIssue[] = [];
  const warnings: PreflightIssue[] = [];
  const counts: Record<string, number> = {};

  // 1) توزيع حالات القيود داخل الفترة
  const statusRows = await db.query(
    `SELECT COALESCE(status, 'draft') AS status, COUNT(*)::int AS count, COALESCE(SUM(total_debit), 0)::numeric AS total
       FROM journal_entries
      WHERE (date::date BETWEEN $1::date AND $2::date) OR period_id = $3
      GROUP BY 1`,
    [range.start, range.end, periodId],
  );
  for (const row of statusRows.rows) counts[`status_${row.status}`] = Number(row.count);
  counts.entries = statusRows.rows.reduce((sum: number, row: any) => sum + Number(row.count), 0);

  const draftStatuses = ["draft", "pending", "unposted", "approved"];
  for (const row of statusRows.rows) {
    const status = String(row.status).toLowerCase();
    if (draftStatuses.includes(status)) {
      const issue = {
        code: "UNPOSTED_ENTRIES",
        message: `توجد ${row.count} قيود بحالة «${row.status}» داخل الفترة بإجمالي ${Number(row.total).toFixed(2)}. يجب ترحيلها أو إلغاؤها قبل الإقفال.`,
        count: Number(row.count),
      };
      if (options.allowDrafts) warnings.push(issue);
      else errors.push(issue);
    }
  }

  // 2) القيود غير المتوازنة أو التي لا يطابق رأسها مجموع بنودها
  const unbalanced = await db.query(
    `SELECT je.id, to_char(je.date, 'YYYY-MM-DD') AS date, je.reference, je.source_type,
            je.total_debit, je.total_credit,
            COALESCE(SUM(ji.debit), 0)::numeric AS items_debit,
            COALESCE(SUM(ji.credit), 0)::numeric AS items_credit
       FROM journal_entries je
       LEFT JOIN journal_items ji ON ji.journal_entry_id = je.id
      WHERE (je.date::date BETWEEN $1::date AND $2::date) OR je.period_id = $3
      GROUP BY je.id
     HAVING ABS(COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0)) > 0.005
         OR ABS(je.total_debit - COALESCE(SUM(ji.debit), 0)) > 0.005
         OR ABS(je.total_credit - COALESCE(SUM(ji.credit), 0)) > 0.005
      ORDER BY je.id
      LIMIT 25`,
    [range.start, range.end, periodId],
  );
  counts.unbalanced = unbalanced.rows.length;
  if (unbalanced.rows.length) {
    errors.push({
      code: "UNBALANCED_ENTRIES",
      message: `توجد ${unbalanced.rows.length} قيود غير متوازنة أو رأسها لا يطابق بنودها (مدين ≠ دائن).`,
      count: unbalanced.rows.length,
      details: unbalanced.rows.map((row: any) => ({
        id: row.id,
        date: row.date,
        reference: row.reference,
        difference: round2(Number(row.items_debit) - Number(row.items_credit)),
      })),
    });
  }

  // 3) قيود داخل الفترة بلا رابط فترة
  const missingPeriod = await db.query(
    `SELECT COUNT(*)::int AS count FROM journal_entries
      WHERE date::date BETWEEN $1::date AND $2::date AND period_id IS NULL`,
    [range.start, range.end],
  );
  counts.missing_period = Number(missingPeriod.rows[0]?.count || 0);
  if (counts.missing_period > 0) {
    warnings.push({
      code: "ENTRIES_WITHOUT_PERIOD",
      message: `يوجد ${counts.missing_period} قيدًا داخل نطاق الفترة بلا رابط فترة مالية. سيُعاد ربطها تلقائيًا عند الترحيل القادم، ويُفضّل تشغيل migration التصحيح.`,
      count: counts.missing_period,
    });
  }

  // 4) بنود تشير إلى حسابات غير موجودة
  const orphanItems = await safeRows(
    db,
    `SELECT COUNT(*)::int AS count
       FROM journal_items ji
       JOIN journal_entries je ON je.id = ji.journal_entry_id
      WHERE je.date::date BETWEEN $1::date AND $2::date
        AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = ji.account_id)`,
    [range.start, range.end],
    warnings,
    "بنود بحسابات مفقودة",
  );
  counts.orphan_items = Number(orphanItems[0]?.count || 0);
  if (counts.orphan_items > 0) {
    errors.push({
      code: "ORPHAN_ITEMS",
      message: `يوجد ${counts.orphan_items} بندًا في القيود يشير إلى حسابات غير موجودة.`,
      count: counts.orphan_items,
    });
  }

  // 5) قيود إقفال أو أرصدة افتتاحية داخل فترة شهرية
  const closingInside = await safeRows(
    db,
    `SELECT source_type, COUNT(*)::int AS count
       FROM journal_entries
      WHERE date::date BETWEEN $1::date AND $2::date
        AND source_type IN ('closing', 'year_end_closing', 'opening_balance')
      GROUP BY 1`,
    [range.start, range.end],
    warnings,
    "قيود الإقفال داخل الفترة",
  );
  if (closingInside.length) {
    errors.push({
      code: "CLOSING_ENTRY_INSIDE_PERIOD",
      message: `توجد قيود إقفال/أرصدة افتتاحية داخل الفترة (${closingInside.map((r: any) => `${r.source_type}: ${r.count}`).join("، ")}). راجع ترتيب الإقفال السنوي.`,
    });
  }

  // 6) توازن الدفاتر حتى نهاية الفترة
  const trial = await safeRows(
    db,
    `SELECT COALESCE(SUM(ji.debit), 0)::numeric AS debit, COALESCE(SUM(ji.credit), 0)::numeric AS credit
       FROM journal_items ji
       JOIN journal_entries je ON je.id = ji.journal_entry_id
      WHERE je.status = 'posted' AND je.date::date <= $1::date`,
    [range.end],
    warnings,
    "ميزان المراجعة",
  );
  const trialDebit = round2(Number(trial[0]?.debit || 0));
  const trialCredit = round2(Number(trial[0]?.credit || 0));
  counts.trial_debit = trialDebit;
  counts.trial_credit = trialCredit;
  if (Math.abs(trialDebit - trialCredit) > 0.01) {
    errors.push({
      code: "TRIAL_BALANCE_MISMATCH",
      message: `الدفاتر غير متوازنة حتى ${range.end}: إجمالي المدين ${trialDebit.toFixed(2)} ≠ إجمالي الدائن ${trialCredit.toFixed(2)}.`,
    });
  }

  // 7) فترات متقاطعة (خطر أن يُنسب القيد لفترة خاطئة)
  const overlap = await safeRows(
    db,
    `SELECT a.id AS a_id, b.id AS b_id, a.month AS a_month, a.year AS a_year, b.month AS b_month, b.year AS b_year
       FROM financial_periods a
       JOIN financial_periods b ON a.id < b.id
      WHERE COALESCE(a.start_date, make_date(a.year, a.month, 1)) <= COALESCE(b.end_date, (make_date(b.year, b.month, 1) + INTERVAL '1 month - 1 day')::date)
        AND COALESCE(b.start_date, make_date(b.year, b.month, 1)) <= COALESCE(a.end_date, (make_date(a.year, a.month, 1) + INTERVAL '1 month - 1 day')::date)`,
    [],
    warnings,
    "تقاطع الفترات",
  );
  if (overlap.length) {
    warnings.push({
      code: "OVERLAPPING_PERIODS",
      message: `يوجد ${overlap.length} زوجًا من الفترات المالية المتقاطعة في التواريخ؛ قد يُنسب القيد إلى فترة غير المقصودة.`,
      count: overlap.length,
    });
  }

  // 8) فواتير مبيعات داخل الفترة بلا قيد محاسبي
  const unpostedInvoices = await safeRows(
    db,
    `SELECT COUNT(*)::int AS count
       FROM sales_invoices
      WHERE date::date BETWEEN $1::date AND $2::date
        AND journal_entry_id IS NULL
        AND COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'draft', 'quotation', 'ملغاة', 'ملغي', 'مسودة')`,
    [range.start, range.end],
    warnings,
    "فواتير مبيعات بلا قيد",
  );
  const invoiceGap = Number(unpostedInvoices[0]?.count || 0);
  if (invoiceGap > 0) {
    warnings.push({
      code: "SALES_INVOICES_NOT_POSTED",
      message: `يوجد ${invoiceGap} فاتورة مبيعات داخل الفترة بلا قيد محاسبي مرتبط. تحقق من الترحيل قبل الإقفال.`,
      count: invoiceGap,
    });
  }

  // 9) مطابقات دفتر الأستاذ مع الدفاتر الفرعية (تحذيرات)
  const reconciliations: PreflightReport["reconciliations"] = [];

  const apAccount = await configAccountId(db, "accounts_payable", "supplier_payables");
  if (apAccount) {
    const gl = -1 * (await glBalanceUntil(db, [apAccount], range.end)); // دائن موجب
    const sub = await safeRows(db, "SELECT COALESCE(SUM(balance), 0)::numeric AS v FROM suppliers", [], warnings, "أرصدة الموردين");
    const subledger = round2(Number(sub[0]?.v || 0));
    reconciliations.push({
      key: "suppliers",
      label: "أرصدة الموردين",
      gl: round2(gl),
      subledger,
      difference: round2(gl - subledger),
    });
  }

  const arAccount = await configAccountId(db, "accounts_receivable", "customer_receivables");
  if (arAccount) {
    const gl = await glBalanceUntil(db, [arAccount], range.end);
    const sub = await safeRows(
      db,
      `SELECT COALESCE(SUM(net_amount - COALESCE(paid_amount, 0)), 0)::numeric AS v
         FROM sales_invoices WHERE COALESCE(status, '') NOT IN ('cancelled', 'canceled', 'draft', 'ملغاة', 'ملغي', 'مسودة')`,
      [],
      warnings,
      "أرصدة العملاء",
    );
    const subledger = round2(Number(sub[0]?.v || 0));
    reconciliations.push({
      key: "customers",
      label: "أرصدة العملاء (فواتير غير مسددة)",
      gl: round2(gl),
      subledger,
      difference: round2(gl - subledger),
    });
  }

  const cashAccount = await configAccountId(db, "cash", "cash_main");
  const bankAccount = await configAccountId(db, "bank");
  if (cashAccount || bankAccount) {
    const gl = await glBalanceUntil(db, [cashAccount, bankAccount].filter(Boolean) as number[], range.end);
    const treasury = await safeRows(
      db,
      "SELECT COALESCE(SUM(current_balance), 0)::numeric AS v FROM treasury_accounts WHERE COALESCE(status, 'active') = 'active'",
      [],
      warnings,
      "أرصدة الخزائن",
    );
    const subledger = round2(Number(treasury[0]?.v || 0));
    reconciliations.push({
      key: "cash",
      label: "أرصدة الخزائن والبنوك",
      gl: round2(gl),
      subledger,
      difference: round2(gl - subledger),
      note: "فرق دائم ممكن إذا كانت الخزائن تُدار خارج دفتر الأستاذ؛ يُعرض للمراجعة فقط.",
    });
  }

  for (const item of reconciliations) {
    if (Math.abs(item.difference) > 0.5) {
      warnings.push({
        code: `RECONCILIATION_${item.key.toUpperCase()}`,
        message: `${item.label}: رصيد دفتر الأستاذ ${item.gl.toFixed(2)} مقابل ${item.subledger.toFixed(2)} في الدفتر الفرعي (فرق ${item.difference.toFixed(2)}).`,
      });
    }
  }

  const canClose = errors.length === 0;

  return {
    period: {
      ...period,
      label: formatPeriodLabel(period),
      status: String(period.status || "open").toLowerCase(),
      effective_start: range.start,
      effective_end: range.end,
    },
    range,
    generated_at: new Date().toISOString(),
    counts,
    errors,
    warnings,
    reconciliations,
    can_close: canClose,
  };
}

// ─────────────────────────────────────────────────────────────
// إقفال وإعادة فتح الشهر
// ─────────────────────────────────────────────────────────────

export interface ClosePeriodOptions {
  reason?: string | null;
  user?: ActingUser | null;
  allowDrafts?: boolean;
  force?: boolean;
}

export async function closePeriod(periodId: number, options: ClosePeriodOptions = {}): Promise<any> {
  await ensurePeriodClosingSchema();
  const user = options.user || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const periodResult = await client.query("SELECT * FROM financial_periods WHERE id = $1 FOR UPDATE", [periodId]);
    const period = periodResult.rows[0];
    if (!period) throw new PeriodLockError("PERIOD_NOT_FOUND", "الفترة المالية غير موجودة", 404);

    const currentStatus = String(period.status || "open").toLowerCase();
    if (currentStatus === "closed") {
      // Idempotency: إعادة الطلب لا تُنشئ أي شيء ولا تُغيّر تاريخ الإقفال الأصلي.
      await client.query("ROLLBACK");
      return {
        success: true,
        already_closed: true,
        period_id: Number(periodId),
        label: formatPeriodLabel(period),
        closed_at: period.closed_at,
        message: `الفترة ${formatPeriodLabel(period)} مغلقة بالفعل — لم يُنفَّذ أي تغيير.`,
      };
    }

    const report = await preflightPeriod(Number(periodId), client, { allowDrafts: options.allowDrafts });
    if (!report.can_close && !options.force) {
      await client.query("ROLLBACK");
      throw new PeriodValidationError(
        `لا يمكن إقفال الفترة ${formatPeriodLabel(period)}: توجد ${report.errors.length} مشكلة حرجة يجب معالجتها أولاً.`,
        report,
      );
    }
    if (!report.can_close && options.force && !(user?.role === "admin" || user?.permissions?.all === true)) {
      await client.query("ROLLBACK");
      throw new PeriodLockError("FORBIDDEN", "التجاوز القسري للإقفال متاح لمدير النظام فقط.", 403);
    }

    const reason = (options.reason || "").trim() || "إقفال دوري معتمد";
    await client.query(
      `UPDATE financial_periods
          SET status = 'closed', closed_at = NOW(), closed_by = $2, close_reason = $3
        WHERE id = $1`,
      [periodId, user?.id ?? null, reason],
    );

    await recordEvent(client, {
      scope: "period",
      periodId: Number(periodId),
      fiscalYearId: period.fiscal_year_id ? Number(period.fiscal_year_id) : null,
      action: "close",
      fromStatus: currentStatus,
      toStatus: "closed",
      reason,
      user,
      details: {
        forced: !report.can_close && !!options.force,
        errors: report.errors.map((e) => e.code),
        warnings: report.warnings.map((w) => w.code),
        counts: report.counts,
      },
    });

    await client.query("COMMIT");
    return {
      success: true,
      already_closed: false,
      period_id: Number(periodId),
      label: formatPeriodLabel(period),
      status: "closed",
      forced: !report.can_close && !!options.force,
      report,
      message: `تم إقفال الفترة ${formatPeriodLabel(period)} بنجاح.`,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* المعاملة أُغلقت بالفعل */
    }
    throw error;
  } finally {
    client.release();
  }
}

export interface ReopenPeriodOptions {
  reason: string;
  user?: ActingUser | null;
  /** إعادة فتح فترة داخل سنة مالية مغلقة تتطلب ضوابط أعلى. */
  reopenClosedFiscalYear?: boolean;
  force?: boolean;
}

export async function reopenPeriod(periodId: number, options: ReopenPeriodOptions): Promise<any> {
  await ensurePeriodClosingSchema();
  const reason = String(options.reason || "").trim();
  if (reason.length < 10) {
    throw new PeriodLockError(
      "REASON_REQUIRED",
      "سبب إعادة فتح الفترة إلزامي ويجب ألا يقل عن 10 أحرف، ويُسجَّل في سجل التدقيق.",
      400,
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const periodResult = await client.query("SELECT * FROM financial_periods WHERE id = $1 FOR UPDATE", [periodId]);
    const period = periodResult.rows[0];
    if (!period) throw new PeriodLockError("PERIOD_NOT_FOUND", "الفترة المالية غير موجودة", 404);

    const currentStatus = String(period.status || "open").toLowerCase();
    if (currentStatus === "open") {
      await client.query("ROLLBACK");
      return {
        success: true,
        already_open: true,
        period_id: Number(periodId),
        message: `الفترة ${formatPeriodLabel(period)} مفتوحة بالفعل — لم يُنفَّذ أي تغيير.`,
      };
    }

    if (period.fiscal_year_id) {
      const fy = (await client.query("SELECT * FROM fiscal_years WHERE id = $1", [period.fiscal_year_id])).rows[0];
      if (fy && String(fy.status || "").toLowerCase() === "closed") {
        if (!options.reopenClosedFiscalYear) {
          await client.query("ROLLBACK");
          throw new PeriodLockError(
            "FISCAL_YEAR_CLOSED",
            `السنة المالية «${fy.name}» مغلقة نهائيًا. لا يمكن إعادة فتح فترة تابعة لها إلا بعد إعادة فتح السنة بصلاحية خاصة.`,
            409,
            period,
          );
        }
        if (!(options.user?.role === "admin" || options.user?.permissions?.all === true)) {
          await client.query("ROLLBACK");
          throw new PeriodLockError("FORBIDDEN", "إعادة فتح فترة داخل سنة مالية مغلقة متاحة لمدير النظام فقط.", 403);
        }
      }
    }

    // منع إعادة فتح فترة تسبق فترة مغلقة (يقلب ترتيب الإقفال)
    if (!options.force) {
      const laterClosed = await client.query(
        `SELECT id, month, year FROM financial_periods
          WHERE COALESCE(start_date, make_date(year, month, 1)) > COALESCE($2::date, make_date($1, 1, 1))
            AND status = 'closed'
          ORDER BY start_date
          LIMIT 1`,
        [Number(period.year), period.start_date],
      );
      if (laterClosed.rows.length) {
        const row = laterClosed.rows[0];
        await client.query("ROLLBACK");
        throw new PeriodLockError(
          "LATER_PERIOD_CLOSED",
          `لا يمكن إعادة فتح ${formatPeriodLabel(period)}: الفترة ${String(row.month).padStart(2, "0")}/${row.year} مغلقة بالفعل. أعد فتح الفترات من الأحدث إلى الأقدم.`,
          409,
          period,
        );
      }
    }

    await client.query(
      `UPDATE financial_periods
          SET status = 'open', closed_at = NULL, reopened_at = NOW(), reopened_by = $2, reopen_reason = $3
        WHERE id = $1`,
      [periodId, options.user?.id ?? null, reason],
    );

    await recordEvent(client, {
      scope: "period",
      periodId: Number(periodId),
      fiscalYearId: period.fiscal_year_id ? Number(period.fiscal_year_id) : null,
      action: "reopen",
      fromStatus: currentStatus,
      toStatus: "open",
      reason,
      user: options.user || null,
      details: { previous_closed_at: period.closed_at, previous_close_reason: period.close_reason },
    });

    await client.query("COMMIT");
    return {
      success: true,
      already_open: false,
      period_id: Number(periodId),
      label: formatPeriodLabel(period),
      status: "open",
      reason,
      message: `تم إعادة فتح الفترة ${formatPeriodLabel(period)}. سُجّل الإجراء والسبب في سجل التدقيق.`,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

/** تغيير الحالة عبر نقطة التبديل القديمة: يُوجَّه إلى الإجراءات الرسمية فقط. */
export async function setPeriodStatus(
  periodId: number,
  targetStatus: string,
  options: { reason?: string; user?: ActingUser | null } = {},
): Promise<any> {
  await ensurePeriodClosingSchema();
  const target = String(targetStatus || "").toLowerCase();
  if (target === "closed") {
    assertClosingPermission(options.user, "close");
    return closePeriod(periodId, { reason: options.reason, user: options.user });
  }
  if (target === "open") {
    assertClosingPermission(options.user, "reopen");
    return reopenPeriod(periodId, { reason: (options.reason || "").trim() || "إعادة فتح معتمدة", user: options.user });
  }
  if (target === "frozen") {
    // التجميد للمراجعة إجراء إقفال؛ لا يفتح باب الترحيل.
    assertClosingPermission(options.user, "close");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const period = (await client.query("SELECT * FROM financial_periods WHERE id = $1 FOR UPDATE", [periodId])).rows[0];
      if (!period) throw new PeriodLockError("PERIOD_NOT_FOUND", "الفترة المالية غير موجودة", 404);
      await client.query(
        `UPDATE financial_periods SET status = 'frozen', closed_at = COALESCE(closed_at, NOW()), closed_by = $2, close_reason = $3 WHERE id = $1`,
        [periodId, options.user?.id ?? null, options.reason || "تجميد للمراجعة"],
      );
      await recordEvent(client, {
        scope: "period",
        periodId,
        fiscalYearId: period.fiscal_year_id ? Number(period.fiscal_year_id) : null,
        action: "close",
        fromStatus: period.status,
        toStatus: "frozen",
        reason: options.reason || "تجميد للمراجعة",
        user: options.user || null,
      });
      await client.query("COMMIT");
      return { success: true, period_id: periodId, status: "frozen", message: `تم تجميد الفترة ${formatPeriodLabel(period)} للمراجعة.` };
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        /* ignore */
      }
      throw error;
    } finally {
      client.release();
    }
  }
  throw new PeriodLockError("INVALID_STATUS", `حالة فترة غير معروفة: ${targetStatus}`, 400);
}

// ─────────────────────────────────────────────────────────────
// الإقفال السنوي
// ─────────────────────────────────────────────────────────────

type PlanLine = { account_id: number; code: string; name: string; debit: number; credit: number; notes: string };

interface YearEndPlan {
  fiscalYear: any;
  periods: any[];
  range: { start: string; end: string };
  revenueAccounts: any[];
  expenseAccounts: any[];
  netResult: number;
  closingLines: PlanLine[];
  closingExists: boolean;
  incomeSummaryAccountId: number | null;
  retainedEarningsAccountId: number | null;
  incomeSummaryBalance: number;
  retainedLines: PlanLine[];
  nextFiscalYear: { id: number | null; name: string; start: string; end: string; exists: boolean };
  openingLines: PlanLine[];
  openingExists: boolean;
  nextYearHasActivity: boolean;
  totals: { debit: number; credit: number; openingDebit: number; openingCredit: number; difference: number };
}

async function loadYearEndPlan(
  db: any,
  fiscalYearId: number,
  options: { incomeSummaryAccountId?: number | null; retainedEarningsAccountId?: number | null; nextYearName?: string | null },
): Promise<YearEndPlan> {
  const fiscalYear = (await db.query("SELECT * FROM fiscal_years WHERE id = $1", [fiscalYearId])).rows[0];
  if (!fiscalYear) throw new PeriodLockError("FISCAL_YEAR_NOT_FOUND", "السنة المالية غير موجودة", 404);

  const range = { start: toYMD(fiscalYear.start_date), end: toYMD(fiscalYear.end_date) };
  const periods = (
    await db.query(
      `SELECT id, month, year, status, to_char(start_date,'YYYY-MM-DD') AS start_date,
              to_char(end_date,'YYYY-MM-DD') AS end_date
         FROM financial_periods WHERE fiscal_year_id = $1 ORDER BY year, month`,
      [fiscalYearId],
    )
  ).rows;

  const incomeSummaryAccountId =
    options.incomeSummaryAccountId ?? (await configAccountId(db, "income_summary", "income_summary_account"));
  const retainedEarningsAccountId =
    options.retainedEarningsAccountId ?? (await configAccountId(db, "retained_earnings", "retained_earnings_account"));

  if (!incomeSummaryAccountId || !retainedEarningsAccountId) {
    throw new PeriodLockError(
      "CLOSING_ACCOUNTS_MISSING",
      "حسابات الإقفال غير مكتملة: يجب ربط «ملخص الدخل» و«الأرباح المحتجزة» في إعدادات الحسابات العامة.",
      400,
    );
  }

  // أرصدة حسابات الإيرادات والمصروفات داخل السنة المالية (من القيود المرحّلة فقط)
  const plRows = (
    await db.query(
      `SELECT a.id, a.code, COALESCE(a.name_ar, a.name) AS name, a.type,
              COALESCE(SUM(ji.debit), 0)::numeric AS debit,
              COALESCE(SUM(ji.credit), 0)::numeric AS credit
         FROM journal_items ji
         JOIN journal_entries je ON je.id = ji.journal_entry_id
         JOIN accounts a ON a.id = ji.account_id
        WHERE je.status = 'posted'
          AND je.date::date BETWEEN $1::date AND $2::date
          AND a.type IN ('revenue', 'expense')
        GROUP BY a.id, a.code, a.name_ar, a.name, a.type
        ORDER BY a.code`,
      [range.start, range.end],
    )
  ).rows;

  const revenueAccounts = plRows.filter((row: any) => row.type === "revenue");
  const expenseAccounts = plRows.filter((row: any) => row.type === "expense");

  let revenueTotal = 0;
  let expenseTotal = 0;
  for (const row of revenueAccounts) revenueTotal += Number(row.credit) - Number(row.debit);
  for (const row of expenseAccounts) expenseTotal += Number(row.debit) - Number(row.credit);
  const netResult = round2(revenueTotal - expenseTotal);

  const closingLines: PlanLine[] = [];
  for (const row of revenueAccounts) {
    const net = round2(Number(row.credit) - Number(row.debit));
    if (Math.abs(net) < 0.005) continue;
    closingLines.push({
      account_id: Number(row.id),
      code: row.code,
      name: row.name,
      debit: net > 0 ? net : 0,
      credit: net > 0 ? 0 : -net,
      notes: `إقفال حساب إيراد ${row.code} — ${row.name}`,
    });
  }
  for (const row of expenseAccounts) {
    const net = round2(Number(row.debit) - Number(row.credit));
    if (Math.abs(net) < 0.005) continue;
    closingLines.push({
      account_id: Number(row.id),
      code: row.code,
      name: row.name,
      debit: net > 0 ? 0 : -net,
      credit: net > 0 ? net : 0,
      notes: `إقفال حساب مصروف ${row.code} — ${row.name}`,
    });
  }

  const debitTotal = round2(closingLines.reduce((sum, line) => sum + line.debit, 0));
  const creditTotal = round2(closingLines.reduce((sum, line) => sum + line.credit, 0));
  const imbalance = round2(debitTotal - creditTotal);
  if (Math.abs(imbalance) > 0.005 && closingLines.length) {
    closingLines.push({
      account_id: Number(incomeSummaryAccountId),
      code: "IS",
      name: "ملخص الدخل",
      debit: imbalance < 0 ? -imbalance : 0,
      credit: imbalance > 0 ? imbalance : 0,
      notes: "ترحيل نتيجة السنة إلى ملخص الدخل",
    });
  }

  const closingExists = (
    await db.query(
      `SELECT id FROM journal_entries WHERE source_type = 'year_end_closing' AND source_id = $1 LIMIT 1`,
      [fiscalYearId],
    )
  ).rows.length > 0;

  const isBalanceRow = await db.query(
    `SELECT COALESCE(SUM(ji.credit - ji.debit), 0)::numeric AS net
       FROM journal_items ji JOIN journal_entries je ON je.id = ji.journal_entry_id
      WHERE ji.account_id = $1 AND je.status = 'posted' AND je.date::date <= $2::date`,
    [incomeSummaryAccountId, range.end],
  );
  let incomeSummaryBalance = round2(Number(isBalanceRow.rows[0]?.net || 0));
  // في المعاينة قبل التنفيذ نضيف أثر قيد الإقفال المتوقّع
  if (!closingExists) incomeSummaryBalance = round2(incomeSummaryBalance + netResult);

  const retainedLines: PlanLine[] = [];
  if (Math.abs(incomeSummaryBalance) >= 0.005) {
    if (incomeSummaryBalance > 0) {
      retainedLines.push(
        { account_id: Number(incomeSummaryAccountId), code: "IS", name: "ملخص الدخل", debit: incomeSummaryBalance, credit: 0, notes: "إقفال ملخص الدخل" },
        { account_id: Number(retainedEarningsAccountId), code: "RE", name: "الأرباح المحتجزة", debit: 0, credit: incomeSummaryBalance, notes: "ترحيل نتيجة السنة إلى الأرباح المحتجزة" },
      );
    } else {
      retainedLines.push(
        { account_id: Number(retainedEarningsAccountId), code: "RE", name: "الأرباح المحتجزة", debit: -incomeSummaryBalance, credit: 0, notes: "تغطية خسارة السنة من الأرباح المحتجزة" },
        { account_id: Number(incomeSummaryAccountId), code: "IS", name: "ملخص الدخل", debit: 0, credit: -incomeSummaryBalance, notes: "إقفال ملخص الدخل" },
      );
    }
  }

  // السنة التالية
  const nextStart = addDays(range.end, 1);
  const nextEnd = addDays(addYears(nextStart, 1), -1);
  const nextYearName = (options.nextYearName || "").trim() || `السنة المالية ${nextStart.slice(0, 4)}`;
  const existingNext = (
    await db.query(
      `SELECT id, name, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date
         FROM fiscal_years
        WHERE name = $1 OR start_date = $2::date
        ORDER BY id LIMIT 1`,
      [nextYearName, nextStart],
    )
  ).rows[0];

  let nextYearHasActivity = false;
  if (existingNext) {
    const activity = await db.query(
      `SELECT COUNT(*)::int AS count FROM journal_entries je
        WHERE je.date::date BETWEEN $1::date AND $2::date
          AND je.status = 'posted'
          AND NOT (je.source_type = 'opening_balance' AND je.source_id = $3)`,
      [nextStart, nextEnd, existingNext.id],
    );
    nextYearHasActivity = Number(activity.rows[0]?.count || 0) > 0;
  }

  // أرصدة افتتاحية = أرصدة الحسابات الدائمة حتى نهاية السنة (بعد قيد الإقفال)
  const balanceRows = (
    await db.query(
      `SELECT a.id, a.code, COALESCE(a.name_ar, a.name) AS name, a.type,
              COALESCE((
                SELECT SUM(ji.debit - ji.credit)
                  FROM journal_items ji
                  JOIN journal_entries je ON je.id = ji.journal_entry_id
                 WHERE ji.account_id = a.id AND je.status = 'posted' AND je.date::date <= $1::date
              ), 0)::numeric AS net
         FROM accounts a
        WHERE COALESCE(a.type, '') NOT IN ('revenue', 'expense')
        ORDER BY a.code`,
      [range.end],
    )
  ).rows;

  const openingLines: PlanLine[] = [];
  for (const row of balanceRows) {
    const net = round2(Number(row.net));
    if (Math.abs(net) < 0.005) continue;
    openingLines.push({
      account_id: Number(row.id),
      code: row.code,
      name: row.name,
      debit: net > 0 ? net : 0,
      credit: net > 0 ? 0 : -net,
      notes: `رصيد افتتاحي ${row.code} — ${row.name} حتى ${range.end}`,
    });
  }

  const openingDebit = round2(openingLines.reduce((sum, line) => sum + line.debit, 0));
  const openingCredit = round2(openingLines.reduce((sum, line) => sum + line.credit, 0));
  let openingDifference = round2(openingDebit - openingCredit);

  // قد تبقى فروق في حسابات الإيرادات/المصروفات من سنوات سابقة لم تُقفل.
  // نرحّلها صراحةً إلى الأرباح المحتجزة حتى يبقى القيد الافتتاحي متوازنًا،
  // مع تسجيل الفرق في التقرير بدل إخفائه. اختلال الدفاتر الحقيقي يظهر
  // كخطأ مستقل في فحص الاتزان قبل الإقفال.
  if (Math.abs(openingDifference) > 0.005) {
    openingLines.push({
      account_id: Number(retainedEarningsAccountId),
      code: "RE",
      name: "الأرباح المحتجزة",
      debit: openingDifference < 0 ? -openingDifference : 0,
      credit: openingDifference > 0 ? openingDifference : 0,
      notes: "تسوية فروق سنوات سابقة غير مقفلة — تُرحّل إلى الأرباح المحتجزة",
    });
    openingDifference = 0;
  }

  const openingExists = existingNext
    ? (
        await db.query(
          `SELECT id FROM journal_entries WHERE source_type = 'opening_balance' AND source_id = $1 LIMIT 1`,
          [existingNext.id],
        )
      ).rows.length > 0
    : false;

  return {
    fiscalYear,
    periods,
    range,
    revenueAccounts,
    expenseAccounts,
    netResult,
    closingLines,
    closingExists,
    incomeSummaryAccountId,
    retainedEarningsAccountId,
    incomeSummaryBalance,
    retainedLines,
    nextFiscalYear: {
      id: existingNext ? Number(existingNext.id) : null,
      name: nextYearName,
      start: nextStart,
      end: nextEnd,
      exists: !!existingNext,
    },
    openingLines,
    openingExists,
    nextYearHasActivity,
    totals: {
      debit: round2(closingLines.reduce((sum, line) => sum + line.debit, 0)),
      credit: round2(closingLines.reduce((sum, line) => sum + line.credit, 0)),
      openingDebit: round2(openingLines.reduce((sum, line) => sum + line.debit, 0)),
      openingCredit: round2(openingLines.reduce((sum, line) => sum + line.credit, 0)),
      difference: openingDifference,
    },
  };
}

function publicPlan(plan: YearEndPlan): any {
  return {
    fiscal_year: {
      id: plan.fiscalYear.id,
      name: plan.fiscalYear.name,
      status: plan.fiscalYear.status,
      start: plan.range.start,
      end: plan.range.end,
    },
    periods: plan.periods,
    periods_open: plan.periods.filter((p: any) => String(p.status).toLowerCase() !== "closed").length,
    revenue_total: round2(plan.revenueAccounts.reduce((sum: number, r: any) => sum + Number(r.credit) - Number(r.debit), 0)),
    expense_total: round2(plan.expenseAccounts.reduce((sum: number, r: any) => sum + Number(r.debit) - Number(r.credit), 0)),
    net_result: plan.netResult,
    revenue_accounts: plan.revenueAccounts.map((r: any) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      net: round2(Number(r.credit) - Number(r.debit)),
    })),
    expense_accounts: plan.expenseAccounts.map((r: any) => ({
      id: Number(r.id),
      code: r.code,
      name: r.name,
      net: round2(Number(r.debit) - Number(r.credit)),
    })),
    closing_entry_exists: plan.closingExists,
    closing_lines: plan.closingLines,
    income_summary_account_id: plan.incomeSummaryAccountId,
    retained_earnings_account_id: plan.retainedEarningsAccountId,
    income_summary_balance: plan.incomeSummaryBalance,
    retained_lines: plan.retainedLines,
    next_fiscal_year: plan.nextFiscalYear,
    next_year_has_activity: plan.nextYearHasActivity,
    opening_entry_exists: plan.openingExists,
    opening_lines: plan.openingLines,
    totals: plan.totals,
    can_close: plan.closingLines.length > 0 || plan.retainedLines.length > 0 || plan.openingLines.length > 0,
  };
}

/** معاينة الإقفال السنوي دون أي كتابة. */
export async function previewFiscalYear(fiscalYearId: number, options: { nextYearName?: string } = {}): Promise<any> {
  await ensurePeriodClosingSchema();
  const plan = await loadYearEndPlan(pool, fiscalYearId, { nextYearName: options.nextYearName });
  const yearIssues: PreflightIssue[] = [];

  const unposted = await pool.query(
    `SELECT COALESCE(status,'draft') AS status, COUNT(*)::int AS count
       FROM journal_entries WHERE date::date BETWEEN $1::date AND $2::date
      GROUP BY 1`,
    [plan.range.start, plan.range.end],
  );
  for (const row of unposted.rows) {
    if (!["posted", "canceled", "cancelled"].includes(String(row.status).toLowerCase())) {
      yearIssues.push({
        code: "UNPOSTED_ENTRIES",
        message: `توجد ${row.count} قيود بحالة «${row.status}» داخل السنة المالية.`,
        count: Number(row.count),
      });
    }
  }

  const openPeriods = plan.periods.filter((p: any) => String(p.status).toLowerCase() !== "closed");
  if (openPeriods.length) {
    yearIssues.push({
      code: "OPEN_PERIODS",
      message: `توجد ${openPeriods.length} فترة غير مغلقة داخل السنة: ${openPeriods
        .map((p: any) => `${String(p.month).padStart(2, "0")}/${p.year}`)
        .join("، ")}.`,
      count: openPeriods.length,
    });
  }

  if (Math.abs(plan.totals.difference) > 0.01) {
    yearIssues.push({
      code: "OPENING_NOT_BALANCED",
      message: `الأرصدة الافتتاحية غير متوازنة: مدين ${plan.totals.openingDebit.toFixed(2)} مقابل دائن ${plan.totals.openingCredit.toFixed(2)} (فرق ${plan.totals.difference.toFixed(2)}).`,
    });
  }

  if (plan.nextYearHasActivity) {
    yearIssues.push({
      code: "NEXT_YEAR_HAS_ACTIVITY",
      message: `السنة التالية تحتوي قيودًا مرحّلة بالفعل؛ ترحيل أرصدة افتتاحية جديدة قد يضاعف الأرصدة.`,
    });
  }

  return {
    ...publicPlan(plan),
    generated_at: new Date().toISOString(),
    issues: yearIssues,
    ready: yearIssues.filter((issue) => issue.code !== "OPEN_PERIODS").length === 0,
  };
}

export interface CloseFiscalYearOptions {
  nextYearName?: string | null;
  retainedEarningsAccountId?: number | null;
  incomeSummaryAccountId?: number | null;
  reason?: string | null;
  user?: ActingUser | null;
  /** إقفال الفترات الشهرية المتبقية تلقائيًا داخل نفس المعاملة. */
  forceClosePeriods?: boolean;
  /** ترحيل الأرصدة الافتتاحية للسنة التالية (الافتراضي: نعم). */
  carryForward?: boolean;
  /** تجاوز تحذيرات كالمعاملات القائمة في السنة التالية. */
  force?: boolean;
  /** إنشاء السنة المالية التالية إن لم تكن موجودة (الافتراضي: نعم). */
  createNextYear?: boolean;
}

/**
 * الإقفال السنوي الفعلي:
 *  1) يتحقق من الفترات والقيود.
 *  2) يقفل حسابات الإيرادات والمصروفات في ملخص الدخل.
 *  3) يرحّل رصيد ملخص الدخل إلى الأرباح المحتجزة.
 *  4) ينشئ السنة التالية وفتراتها وأرصدتها الافتتاحية.
 * العملية idempotent: إعادة الطلب بعد النجاح لا تُنشئ أي قيد جديد.
 */
export async function closeFiscalYear(fiscalYearId: number, options: CloseFiscalYearOptions = {}): Promise<any> {
  await ensurePeriodClosingSchema();
  const user = options.user || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fy = (await client.query("SELECT * FROM fiscal_years WHERE id = $1 FOR UPDATE", [fiscalYearId])).rows[0];
    if (!fy) throw new PeriodLockError("FISCAL_YEAR_NOT_FOUND", "السنة المالية غير موجودة", 404);

    // تثبيت الفترات ضد أي ترحيل متزامن أثناء الإقفال
    await client.query("SELECT id FROM financial_periods WHERE fiscal_year_id = $1 FOR UPDATE", [fiscalYearId]);

    if (String(fy.status || "").toLowerCase() === "closed") {
      await client.query("ROLLBACK");
      return {
        success: true,
        already_closed: true,
        fiscal_year_id: Number(fiscalYearId),
        fiscal_year: fy.name,
        closing_entry_id: fy.closing_entry_id ?? null,
        opening_entry_id: fy.opening_entry_id ?? null,
        message: `السنة المالية «${fy.name}» مغلقة بالفعل — لم يُنشأ أي قيد جديد.`,
      };
    }

    const plan = await loadYearEndPlan(client, fiscalYearId, {
      nextYearName: options.nextYearName || null,
      incomeSummaryAccountId: options.incomeSummaryAccountId ?? null,
      retainedEarningsAccountId: options.retainedEarningsAccountId ?? null,
    });

    // 1) قيود غير مرحّلة داخل السنة
    const unposted = await client.query(
      `SELECT COALESCE(status,'draft') AS status, COUNT(*)::int AS count
         FROM journal_entries WHERE date::date BETWEEN $1::date AND $2::date GROUP BY 1`,
      [plan.range.start, plan.range.end],
    );
    const blocking = unposted.rows.filter(
      (row: any) => !["posted", "canceled", "cancelled"].includes(String(row.status).toLowerCase()),
    );
    if (blocking.length) {
      await client.query("ROLLBACK");
      throw new PeriodValidationError(
        `لا يمكن إقفال السنة «${fy.name}»: توجد قيود غير مرحّلة (${blocking
          .map((row: any) => `${row.status}: ${row.count}`)
          .join("، ")}).`,
        { errors: blocking, plan: publicPlan(plan) },
      );
    }

    // 2) الفترات غير المغلقة
    const openPeriods = plan.periods.filter((p: any) => String(p.status).toLowerCase() !== "closed");
    if (openPeriods.length && !options.forceClosePeriods) {
      await client.query("ROLLBACK");
      throw new PeriodValidationError(
        `لا يمكن إقفال السنة «${fy.name}»: توجد ${openPeriods.length} فترة شهرية غير مغلقة. أغلقها أولًا أو استخدم خيار إقفال الفترات المتبقية.`,
        { errors: [{ code: "OPEN_PERIODS", periods: openPeriods }], plan: publicPlan(plan) },
      );
    }

    if (openPeriods.length && options.forceClosePeriods) {
      await client.query(
        `UPDATE financial_periods SET status = 'closed', closed_at = COALESCE(closed_at, NOW()), closed_by = $2,
                close_reason = COALESCE(close_reason, 'إقفال ضمن إقفال السنة المالية')
          WHERE fiscal_year_id = $1 AND status <> 'closed'`,
        [fiscalYearId, user?.id ?? null],
      );
      for (const period of openPeriods) {
        await recordEvent(client, {
          scope: "period",
          periodId: Number(period.id),
          fiscalYearId: Number(fiscalYearId),
          action: "close",
          fromStatus: period.status,
          toStatus: "closed",
          reason: "إقفال تلقائي ضمن إقفال السنة المالية",
          user,
          details: { auto_closed_by_year_end: true },
        });
      }
    }

    if (plan.closingExists) {
      await client.query("ROLLBACK");
      return {
        success: true,
        already_closed: true,
        fiscal_year_id: Number(fiscalYearId),
        fiscal_year: fy.name,
        message: `قيود إقفال السنة «${fy.name}» موجودة بالفعل — لم يُنشأ أي قيد جديد.`,
      };
    }

    if (Math.abs(plan.totals.difference) > 0.01) {
      await client.query("ROLLBACK");
      throw new PeriodValidationError(
        `الأرصدة الافتتاحية غير متوازنة (فرق ${plan.totals.difference.toFixed(2)}). لن يتم الإقفال حتى تصحيح الدفاتر.`,
        { errors: [{ code: "OPENING_NOT_BALANCED" }], plan: publicPlan(plan) },
      );
    }

    // من هنا نكتب قيود نظام داخل سنة/فترة مغلقة — تصريح محصور في هذه المعاملة.
    await enablePeriodBypass(client);

    const entryIds: number[] = [];
    const closingDate = plan.range.end;

    // 3) قيد إقفال الإيرادات والمصروفات في ملخص الدخل
    let closingEntryId: number | null = null;
    if (plan.closingLines.length) {
      const closingEntry = await repo.createJournalEntry(
        {
          date: closingDate,
          description: `قيد إقفال السنة المالية ${fy.name} — إقفال حسابات الإيرادات والمصروفات`,
          reference: `CLOSE-${fiscalYearId}-PL`,
          source_type: "year_end_closing",
          source_id: fiscalYearId,
          status: "posted",
          created_by: user?.id ?? null,
          period_id: null,
          items: plan.closingLines.map((line) => ({
            account_id: line.account_id,
            debit: line.debit,
            credit: line.credit,
            notes: line.notes,
          })),
        },
        client,
      );
      closingEntryId = Number(closingEntry.id);
      entryIds.push(closingEntryId);
    }

    // 4) ترحيل رصيد ملخص الدخل إلى الأرباح المحتجزة
    let retainedEntryId: number | null = null;
    if (plan.retainedLines.length) {
      const retainedEntry = await repo.createJournalEntry(
        {
          date: closingDate,
          description: `ترحيل نتيجة السنة المالية ${fy.name} إلى الأرباح المحتجزة`,
          reference: `CLOSE-${fiscalYearId}-RE`,
          source_type: "year_end_closing",
          source_id: fiscalYearId,
          status: "posted",
          created_by: user?.id ?? null,
          period_id: null,
          items: plan.retainedLines.map((line) => ({
            account_id: line.account_id,
            debit: line.debit,
            credit: line.credit,
            notes: line.notes,
          })),
        },
        client,
      );
      retainedEntryId = Number(retainedEntry.id);
      entryIds.push(retainedEntryId);
    }

    // 5) السنة التالية + الفترات
    let nextFyId = plan.nextFiscalYear.id;
    const createNextYear = options.createNextYear !== false;
    const carryForward = options.carryForward !== false && createNextYear;

    if (createNextYear && !nextFyId) {
      const inserted = await client.query(
        `INSERT INTO fiscal_years (name, start_date, end_date, status) VALUES ($1,$2,$3,'active') RETURNING id`,
        [plan.nextFiscalYear.name, plan.nextFiscalYear.start, plan.nextFiscalYear.end],
      );
      nextFyId = Number(inserted.rows[0].id);

      for (let offset = 0; offset < 12; offset += 1) {
        const cursor = new Date(
          Number(plan.nextFiscalYear.start.slice(0, 4)),
          Number(plan.nextFiscalYear.start.slice(5, 7)) - 1 + offset,
          1,
        );
        const bounds = monthBounds(cursor.getMonth() + 1, cursor.getFullYear());
        if (bounds.end < plan.nextFiscalYear.start) continue;
        if (bounds.start > plan.nextFiscalYear.end) break;
        await client.query(
          `INSERT INTO financial_periods (fiscal_year_id, month, year, status, start_date, end_date)
           VALUES ($1,$2,$3,'open',$4,$5)
           ON CONFLICT (month, year) DO NOTHING`,
          [nextFyId, cursor.getMonth() + 1, cursor.getFullYear(), bounds.start, bounds.end],
        );
      }
    }

    // 6) الأرصدة الافتتاحية للسنة التالية
    let openingEntryId: number | null = null;
    if (carryForward && nextFyId && plan.openingLines.length) {
      const already = (
        await client.query(
          `SELECT id FROM journal_entries WHERE source_type = 'opening_balance' AND source_id = $1 LIMIT 1`,
          [nextFyId],
        )
      ).rows[0];
      if (!already) {
        const openingEntry = await repo.createJournalEntry(
          {
            date: plan.nextFiscalYear.start,
            description: `الأرصدة الافتتاحية للسنة المالية ${plan.nextFiscalYear.name} — مرحّلة من ${fy.name}`,
            reference: `OPEN-${nextFyId}`,
            source_type: "opening_balance",
            source_id: nextFyId,
            status: "posted",
            created_by: user?.id ?? null,
            period_id: null,
            items: plan.openingLines.map((line) => ({
              account_id: line.account_id,
              debit: line.debit,
              credit: line.credit,
              notes: line.notes,
            })),
          },
          client,
        );
        openingEntryId = Number(openingEntry.id);
        entryIds.push(openingEntryId);
      } else {
        openingEntryId = Number(already.id);
      }
    }

    const reason = (options.reason || "").trim() || "إقفال السنة المالية";
    await client.query(
      `UPDATE fiscal_years
          SET status = 'closed', closed_at = NOW(), closed_by = $2, close_reason = $3,
              closing_entry_id = $4, opening_entry_id = $5
        WHERE id = $1`,
      [fiscalYearId, user?.id ?? null, reason, closingEntryId, openingEntryId],
    );

    await recordEvent(client, {
      scope: "fiscal_year",
      fiscalYearId: Number(fiscalYearId),
      action: "year_close",
      fromStatus: fy.status,
      toStatus: "closed",
      reason,
      user,
      amount: plan.netResult,
      entryIds,
      details: {
        closing_entry_id: closingEntryId,
        retained_entry_id: retainedEntryId,
        opening_entry_id: openingEntryId,
        next_fiscal_year_id: nextFyId,
        auto_closed_periods: openPeriods.map((p: any) => p.id),
        revenue_total: publicPlan(plan).revenue_total,
        expense_total: publicPlan(plan).expense_total,
        net_result: plan.netResult,
      },
    });

    await client.query("COMMIT");

    return {
      success: true,
      already_closed: false,
      fiscal_year_id: Number(fiscalYearId),
      fiscal_year: fy.name,
      net_result: plan.netResult,
      revenue_total: publicPlan(plan).revenue_total,
      expense_total: publicPlan(plan).expense_total,
      closing_entry_id: closingEntryId,
      retained_entry_id: retainedEntryId,
      opening_entry_id: openingEntryId,
      next_fiscal_year_id: nextFyId,
      next_fiscal_year: plan.nextFiscalYear,
      entries_created: entryIds.length,
      message: `تم إقفال السنة المالية «${fy.name}» وترحيل نتيجتها (${plan.netResult.toFixed(2)}) إلى الأرباح المحتجزة، وإنشاء الأرصدة الافتتاحية للسنة التالية.`,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

/** إعادة فتح سنة مالية مغلقة: إجراء استثنائي بصلاحية عالية وسبب إلزامي. */
export async function reopenFiscalYear(
  fiscalYearId: number,
  options: { reason: string; user?: ActingUser | null; deleteClosingEntries?: boolean },
): Promise<any> {
  const reason = String(options.reason || "").trim();
  if (reason.length < 10) {
    throw new PeriodLockError("REASON_REQUIRED", "سبب إعادة فتح السنة المالية إلزامي (10 أحرف على الأقل).", 400);
  }
  if (!(options.user?.role === "admin" || options.user?.permissions?.all === true)) {
    throw new PeriodLockError("FORBIDDEN", "إعادة فتح سنة مالية مغلقة متاحة لمدير النظام فقط.", 403);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const fy = (await client.query("SELECT * FROM fiscal_years WHERE id = $1 FOR UPDATE", [fiscalYearId])).rows[0];
    if (!fy) throw new PeriodLockError("FISCAL_YEAR_NOT_FOUND", "السنة المالية غير موجودة", 404);
    if (String(fy.status || "").toLowerCase() !== "closed") {
      await client.query("ROLLBACK");
      return { success: true, already_open: true, fiscal_year_id: Number(fiscalYearId), message: `السنة «${fy.name}» غير مغلقة.` };
    }

    await client.query(
      `UPDATE fiscal_years
          SET status = 'active', closed_at = NULL, reopened_at = NOW(), reopened_by = $2, reopen_reason = $3
        WHERE id = $1`,
      [fiscalYearId, options.user?.id ?? null, reason],
    );

    await recordEvent(client, {
      scope: "fiscal_year",
      fiscalYearId: Number(fiscalYearId),
      action: "year_reopen",
      fromStatus: fy.status,
      toStatus: "active",
      reason,
      user: options.user || null,
      details: { closing_entry_id: fy.closing_entry_id, opening_entry_id: fy.opening_entry_id },
    });

    await client.query("COMMIT");
    return {
      success: true,
      fiscal_year_id: Number(fiscalYearId),
      fiscal_year: fy.name,
      status: "active",
      message:
        `تم إعادة فتح السنة المالية «${fy.name}». قيود الإقفال والأرصدة الافتتاحية محفوظة كما هي للمراجعة؛ ` +
        `ولتعديل فترة محددة يجب إعادة فتحها بشكل مستقل.`,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// استعلامات التقارير
// ─────────────────────────────────────────────────────────────

export async function listPeriodEvents(filters: { periodId?: number; fiscalYearId?: number; limit?: number }): Promise<any[]> {
  await ensurePeriodClosingSchema();
  const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
  const params: any[] = [];
  const where: string[] = [];
  if (filters.periodId) {
    params.push(filters.periodId);
    where.push(`e.period_id = $${params.length}`);
  }
  if (filters.fiscalYearId) {
    params.push(filters.fiscalYearId);
    where.push(`e.fiscal_year_id = $${params.length}`);
  }
  params.push(limit);

  const result = await pool.query(
    `SELECT e.*, fp.month AS period_month, fp.year AS period_year, fy.name AS fiscal_year_name
       FROM financial_period_events e
       LEFT JOIN financial_periods fp ON fp.id = e.period_id
       LEFT JOIN fiscal_years fy ON fy.id = e.fiscal_year_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY e.created_at DESC, e.id DESC
      LIMIT $${params.length}`,
    params,
  );
  return result.rows;
}

export async function getOpeningBalances(fiscalYearId: number): Promise<any> {
  await ensurePeriodClosingSchema();
  const fy = (await pool.query("SELECT * FROM fiscal_years WHERE id = $1", [fiscalYearId])).rows[0];
  if (!fy) throw new PeriodLockError("FISCAL_YEAR_NOT_FOUND", "السنة المالية غير موجودة", 404);

  const entry = (
    await pool.query(
      `SELECT * FROM journal_entries WHERE source_type = 'opening_balance' AND source_id = $1 ORDER BY id LIMIT 1`,
      [fiscalYearId],
    )
  ).rows[0];

  if (!entry) {
    return {
      fiscal_year: { id: fy.id, name: fy.name },
      exists: false,
      entry: null,
      lines: [],
      total_debit: 0,
      total_credit: 0,
      message: "لا يوجد قيد أرصدة افتتاحية لهذه السنة المالية.",
    };
  }

  const lines = (
    await pool.query(
      `SELECT ji.account_id, a.code, COALESCE(a.name_ar, a.name) AS name, a.type,
              ji.debit, ji.credit, ji.notes
         FROM journal_items ji
         LEFT JOIN accounts a ON a.id = ji.account_id
        WHERE ji.journal_entry_id = $1
        ORDER BY a.code`,
      [entry.id],
    )
  ).rows;

  return {
    fiscal_year: { id: fy.id, name: fy.name },
    exists: true,
    entry,
    lines,
    total_debit: round2(lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0)),
    total_credit: round2(lines.reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0)),
  };
}

/**
 * تقرير العمليات غير المكتملة: مستندات لها أثر مخزني/مالي بلا قيد،
 * أو قيود مرحّلة داخل فترة مغلقة، أو قيود بلا فترة/غير متوازنة.
 *
 * قراءة فقط — لا يُصلح ولا يعكس أي بيانات تاريخية تلقائيًا.
 */
export async function getIncompleteOperations(options: { from?: string; to?: string; limit?: number } = {}): Promise<any> {
  await ensurePeriodClosingSchema();
  const limit = Math.min(Math.max(Number(options.limit) || 200, 1), 1000);
  const from = options.from || "2000-01-01";
  const to = options.to || "2100-12-31";

  const safe = async (sql: string, params: any[] = []) => {
    try {
      return (await pool.query(sql, params)).rows;
    } catch {
      return [];
    }
  };

  const salesWithoutJe = await safe(
    `SELECT id, invoice_no, customer_name, to_char(date,'YYYY-MM-DD') AS date, status, net_amount, journal_entry_id
        FROM sales_invoices
       WHERE is_posted = true AND journal_entry_id IS NULL
         AND date::date BETWEEN $1::date AND $2::date
       ORDER BY date DESC LIMIT $3`,
    [from, to, limit],
  );

  const purchasesWithoutJe = await safe(
    `SELECT id, invoice_number, supplier_id, to_char(date,'YYYY-MM-DD') AS date, status, total_amount, posted_journal_entry_id
        FROM purchases
       WHERE posted_journal_entry_id IS NULL
         AND COALESCE(status,'') NOT IN ('مسودة','draft','ملغي','cancelled','canceled','')
         AND date::date BETWEEN $1::date AND $2::date
       ORDER BY date DESC LIMIT $3`,
    [from, to, limit],
  );

  const grnWithoutJe = await safe(
    `SELECT id, receipt_no, supplier_id, to_char(date,'YYYY-MM-DD') AS date, status, net_amount, journal_entry_id
        FROM goods_receipts
       WHERE is_posted = true AND journal_entry_id IS NULL
         AND date::date BETWEEN $1::date AND $2::date
       ORDER BY date DESC LIMIT $3`,
    [from, to, limit],
  );

  const postedInsideClosed = await safe(
    `SELECT je.id, to_char(je.date,'YYYY-MM-DD') AS date, je.reference, je.source_type, je.status,
            fp.month, fp.year, to_char(fp.closed_at,'YYYY-MM-DD HH24:MI') AS closed_at,
            (fp.closed_at IS NOT NULL AND je.created_at > fp.closed_at) AS after_close
       FROM journal_entries je
       JOIN financial_periods fp ON fp.id = je.period_id
      WHERE je.status = 'posted'
        AND fp.status IN ('closed','frozen')
        AND COALESCE(je.source_type,'') NOT IN ('year_end_closing','closing','opening_balance')
        AND je.date::date BETWEEN $1::date AND $2::date
      ORDER BY je.date DESC LIMIT $3`,
    [from, to, limit],
  );

  // الترحيل بعد لحظة الإقفال = مخالفة فعلية، وليس مجرد قيد تاريخي أُغلقت فترته لاحقًا.
  const postedAfterClose = postedInsideClosed.filter((row: any) => row.after_close === true);

  const missingPeriod = await safe(
    `SELECT COUNT(*)::int AS count
       FROM journal_entries
      WHERE period_id IS NULL AND date::date BETWEEN $1::date AND $2::date`,
    [from, to],
  );

  const unbalanced = await safe(
    `SELECT je.id, to_char(je.date,'YYYY-MM-DD') AS date, je.reference,
            COALESCE(SUM(ji.debit),0)::numeric AS debit, COALESCE(SUM(ji.credit),0)::numeric AS credit
       FROM journal_entries je
       LEFT JOIN journal_items ji ON ji.journal_entry_id = je.id
      WHERE je.status = 'posted' AND je.date::date BETWEEN $1::date AND $2::date
      GROUP BY je.id
     HAVING ABS(COALESCE(SUM(ji.debit),0) - COALESCE(SUM(ji.credit),0)) > 0.01
      ORDER BY je.date DESC LIMIT $3`,
    [from, to, limit],
  );

  const total = salesWithoutJe.length + purchasesWithoutJe.length + grnWithoutJe.length
    + postedInsideClosed.length + unbalanced.length + Number(missingPeriod[0]?.count || 0);

  return {
    generated_at: new Date().toISOString(),
    range: { from, to },
    summary: {
      total_items: total,
      sales_posted_without_journal: salesWithoutJe.length,
      purchases_posted_without_journal: purchasesWithoutJe.length,
      goods_receipts_without_journal: grnWithoutJe.length,
      journal_posted_inside_closed_period: postedInsideClosed.length,
      journal_posted_after_period_closed: postedAfterClose.length,
      journal_entries_without_period: Number(missingPeriod[0]?.count || 0),
      unbalanced_journal_entries: unbalanced.length,
    },
    items: {
      sales_posted_without_journal: salesWithoutJe,
      purchases_posted_without_journal: purchasesWithoutJe,
      goods_receipts_without_journal: grnWithoutJe,
      journal_posted_inside_closed_period: postedInsideClosed,
      journal_posted_after_period_closed: postedAfterClose,
      unbalanced_journal_entries: unbalanced,
    },
    note: "تقرير للعرض فقط: لا يحذف ولا يعكس ولا ينشئ قيودًا. أي معالجة تحتاج خطة معتمدة من المستخدم.",
  };
}

/** ملخص حالة الإقفال لفترة أو سنة — أرقام حقيقية من القاعدة. */export async function getClosingSummary(filters: { periodId?: number; fiscalYearId?: number }): Promise<any> {
  if (filters.periodId) {
    const report = await preflightPeriod(Number(filters.periodId));
    const events = await listPeriodEvents({ periodId: Number(filters.periodId), limit: 50 });
    const entries = (
      await pool.query(
        `SELECT COUNT(*)::int AS count, COALESCE(SUM(total_debit),0)::numeric AS total
           FROM journal_entries WHERE period_id = $1 AND status = 'posted'`,
        [Number(filters.periodId)],
      )
    ).rows[0];
    return { scope: "period", report, events, posted_entries: entries };
  }

  if (!filters.fiscalYearId) throw new PeriodLockError("MISSING_FILTER", "يجب تحديد الفترة أو السنة المالية", 400);
  const preview = await previewFiscalYear(Number(filters.fiscalYearId));
  const events = await listPeriodEvents({ fiscalYearId: Number(filters.fiscalYearId), limit: 100 });
  return { scope: "fiscal_year", preview, events };
}
