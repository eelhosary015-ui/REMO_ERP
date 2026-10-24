/**
 * خدمة الحسابات التجريبية — التطبيق الحقيقي لسياسة trial-policy على قاعدة البيانات.
 * ───────────────────────────────────────────────────────────────────────────────
 * هذه الخدمة هي الجهة الوحيدة المسموح لها بتثبيت أو رفع القفل الدائم:
 *  - enforceTrialAccess: تُستدعى في كل طلب مُصادَق عليه وفي تسجيل الدخول.
 *  - lockExpiredTrials: مهمة دورية تقفل الحسابات المنتهية حتى دون محاولة دخول.
 *  - unlockTrialAccount: الإجراء الإداري الصريح الوحيد لفتح حساب مقفول.
 *
 * ملاحظات تصميمية:
 *  - التواريخ تُقرأ من قاعدة البيانات كنص `to_char(...,'YYYY-MM-DD')` لتفادي
 *    انزياح اليوم الناتج عن تحويل DATE إلى Date محلي ثم إلى UTC.
 *  - القفل لا يُرفع إلا بدالة unlockTrialAccount، ولا يرفعه تعديل بيانات
 *    المستخدم العادي مهما كان التاريخ المُمرَّر.
 *  - كل قفل/فتح يُسجَّل في سجل التدقيق المركزي (user_logs).
 */
import { pool } from "../../../server-db.js";
import { logAction } from "./audit.service.js";
import {
  TRIAL_MAX_DAYS,
  buildTrialSummary,
  businessToday,
  evaluateTrialAccess,
  toDateOnly,
  validateTrialEndDate,
  validateUnlockReason,
  type TrialDecision,
  type TrialSubject,
} from "./trial-policy.js";

/** أعمدة التجربة/القفل القياسية — استخدمها في كل SELECT يتعلق بالمستخدمين. */
export const TRIAL_USER_COLUMNS = `
  is_trial,
  to_char(trial_ends_at, 'YYYY-MM-DD') AS trial_ends_at,
  is_locked,
  locked_at,
  locked_reason,
  locked_by,
  trial_unlock_count
`;

let schemaReady: Promise<void> | null = null;

/**
 * ترقية ذاتية لمخطط users (متوافقة مع قواعد بيانات قديمة).
 * آمنة للتكرار، وتُستدعى عند الإقلاع وعند أول فحص.
 */
export function ensureTrialSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const statements = [
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_reason TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_by TEXT`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_unlock_count INTEGER DEFAULT 0`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_last_unlocked_at TIMESTAMPTZ`,
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_last_unlocked_by INTEGER`,
        `CREATE INDEX IF NOT EXISTS idx_users_trial_lock ON users (is_trial, is_locked, trial_ends_at)`,
      ];
      for (const statement of statements) {
        try {
          await pool.query(statement);
        } catch (error: any) {
          console.warn(`[Trial] تعذر تنفيذ ترقية المخطط: ${error?.message || error}`);
        }
      }

      // حساب مدير النظام لا يخضع للتجربة إطلاقًا — تنظيف أي بيانات قديمة تمنع الدخول.
      try {
        const cleaned = await pool.query(
          `UPDATE users SET is_trial = false, trial_ends_at = NULL
           WHERE LOWER(COALESCE(role, 'user')) = 'admin' AND (is_trial = true OR trial_ends_at IS NOT NULL)
           RETURNING id, username`
        );
        if (cleaned.rowCount) {
          console.warn(
            `[Trial] تم تعطيل الفترة التجريبية عن ${cleaned.rowCount} حساب مدير نظام: ${cleaned.rows
              .map((row: any) => row.username)
              .join(", ")}`
          );
        }
      } catch (error: any) {
        console.warn(`[Trial] تعذر تنظيف حسابات مدير النظام: ${error?.message || error}`);
      }

      // قيد وقائي: أي حساب تجريبي جديد يجب أن يحمل تاريخ انتهاء.
      // NOT VALID يسمح بمرور البيانات القديمة (التي تُقفل دوريًا) مع منع الصفوف الجديدة.
      try {
        await pool.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_trial_requires_date') THEN
              ALTER TABLE users
                ADD CONSTRAINT users_trial_requires_date
                CHECK (is_trial = false OR trial_ends_at IS NOT NULL) NOT VALID;
            END IF;
          END
          $$;
        `);
      } catch (error: any) {
        console.warn(`[Trial] تعذر إضافة قيد users_trial_requires_date: ${error?.message || error}`);
      }

      // قفل الحسابات المنتهية الموجودة أصلًا قبل تفعيل الخدمة.
      try {
        await lockExpiredTrials();
      } catch (error: any) {
        console.warn(`[Trial] تعذر قفل الحسابات المنتهية عند الترقية: ${error?.message || error}`);
      }
    })().catch((error: any) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export interface TrialSubjectRow extends TrialSubject {
  trial_unlock_count?: number | null;
}

/** قراءة حالة حساب واحد من قاعدة البيانات (المصدر الموثوق). */
export async function getTrialSubject(userId: number): Promise<TrialSubjectRow | null> {
  await ensureTrialSchema();
  const result = await pool.query(
    `SELECT id, username, role, ${TRIAL_USER_COLUMNS} FROM users WHERE id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * تثبيت القفل الدائم على حساب تجريبي منتهٍ أو مُعطَّل الإعداد.
 * لا يمس حسابات مدير النظام، ولا يعيد القفل إن كان مثبتًا (idempotent).
 */
export async function lockTrialAccount(
  userId: number,
  reason: string,
  actor: string = "system:trial-expiry"
): Promise<boolean> {
  try {
    const result = await pool.query(
      `UPDATE users
          SET is_locked = TRUE,
              locked_at = COALESCE(locked_at, NOW()),
              locked_reason = $2,
              locked_by = $3
        WHERE id = $1
          AND COALESCE(is_locked, FALSE) = FALSE
          AND LOWER(COALESCE(role, 'user')) <> 'admin'
        RETURNING id, username, to_char(trial_ends_at, 'YYYY-MM-DD') AS trial_ends_at`,
      [userId, reason, actor]
    );
    const row = result.rows[0];
    if (!row) return false;

    await logAction(
      row.id,
      "AUTO_LOCK_TRIAL_ACCOUNT",
      "users",
      row.id,
      `قفل تلقائي دائم للحساب التجريبي "${row.username}" — السبب: ${reason} — تاريخ الانتهاء: ${row.trial_ends_at || "غير محدد"}`,
      {
        module: "security",
        severity: "warning",
        status: "blocked",
        entityType: "user",
        entityRef: row.username,
        meta: { reason, trial_ends_at: row.trial_ends_at, locked_by: actor },
      }
    );
    console.warn(`[Trial] تم قفل الحساب التجريبي "${row.username}" (${row.id}) — ${reason}`);
    return true;
  } catch (error: any) {
    console.error(`[Trial] تعذر قفل الحساب ${userId}: ${error?.message || error}`);
    return false;
  }
}

/**
 * بوابة الوصول الموحّدة: تُرجع قرارًا نهائيًا، وتثبّت القفل عند اللزوم.
 * تُستخدم في تسجيل الدخول وفي الميدلوير العام.
 */
export async function enforceTrialAccess(
  subject: TrialSubjectRow,
  today: string = businessToday()
): Promise<TrialDecision> {
  const decision = evaluateTrialAccess(subject, today);
  if (decision.shouldLock && subject.id) {
    await lockTrialAccount(subject.id, decision.reason || "TRIAL_EXPIRED");
  }
  return decision;
}

/**
 * مهمة دورية: قفل كل الحسابات التجريبية المنتهية أو بلا تاريخ.
 * تعمل حتى لو لم يحاول المستخدم تسجيل الدخول، فلا تبقى جلسات مفتوحة بلا رقابة.
 */
export async function lockExpiredTrials(today: string = businessToday()): Promise<Array<{ id: number; username: string }>> {
  const result = await pool.query(
    `UPDATE users
        SET is_locked = TRUE,
            locked_at = NOW(),
            locked_reason = CASE WHEN trial_ends_at IS NULL THEN 'TRIAL_DATE_MISSING' ELSE 'TRIAL_EXPIRED' END,
            locked_by = 'system:trial-expiry'
      WHERE COALESCE(is_locked, FALSE) = FALSE
        AND is_trial = TRUE
        AND LOWER(COALESCE(role, 'user')) <> 'admin'
        AND (trial_ends_at IS NULL OR trial_ends_at < $1::date)
      RETURNING id, username,
                to_char(trial_ends_at, 'YYYY-MM-DD') AS trial_ends_at,
                locked_reason`,
    [today]
  );

  const locked = result.rows.map((row: any) => ({ id: row.id, username: row.username }));
  for (const row of result.rows) {
    try {
      await logAction(
        row.id,
        "AUTO_LOCK_TRIAL_ACCOUNT",
        "users",
        row.id,
        `قفل تلقائي دائم للحساب التجريبي "${row.username}" — السبب: ${row.locked_reason} — تاريخ الانتهاء: ${row.trial_ends_at || "غير محدد"}`,
        {
          module: "security",
          severity: "warning",
          status: "blocked",
          entityType: "user",
          entityRef: row.username,
          meta: { reason: row.locked_reason, trial_ends_at: row.trial_ends_at, locked_by: "system:trial-expiry" },
        }
      );
    } catch {
      // التدقيق لا يجب أن يوقف القفل.
    }
  }
  if (locked.length > 0) {
    console.warn(`[Trial] تم قفل ${locked.length} حساب تجريبي منتهٍ: ${locked.map((row) => row.username).join(", ")}`);
  }
  return locked;
}

let sweeperTimer: ReturnType<typeof setInterval> | null = null;

/**
 * مُشغّل المهمة الدورية (كل 30 دقيقة افتراضيًا) + فحص فوري بعد الإقلاع.
 * يُعطَّل عبر DISABLE_BACKGROUND_JOBS=true (المستخدم في بيئة الاختبار).
 */
export function startTrialExpirySweeper(intervalMs: number = 30 * 60 * 1000): void {
  if (process.env.DISABLE_BACKGROUND_JOBS === "true") return;
  if (sweeperTimer) return;

  const run = async () => {
    try {
      await ensureTrialSchema();
      await lockExpiredTrials();
    } catch (error: any) {
      console.error(`[Trial] فشل فحص الحسابات التجريبية: ${error?.message || error}`);
    }
  };

  const kickoff = setTimeout(run, 5_000);
  if (typeof (kickoff as any).unref === "function") (kickoff as any).unref();

  sweeperTimer = setInterval(run, Math.max(60_000, intervalMs));
  if (typeof (sweeperTimer as any).unref === "function") (sweeperTimer as any).unref();
}

export type TrialUnlockMode = "extend" | "permanent";

export interface UnlockTrialParams {
  userId: number;
  mode: TrialUnlockMode;
  /** مطلوب في وضع extend. */
  endsAt?: string | null;
  reason: string;
  actorId: number;
  actorUsername?: string | null;
}

export type UnlockTrialResult =
  | { ok: true; mode: TrialUnlockMode; endsOn: string | null; user: Record<string, any> }
  | { ok: false; code: string; message: string };

/**
 * الإجراء الإداري الوحيد الذي يرفع القفل الدائم.
 * - extend: تمديد التجربة إلى تاريخ جديد (اليوم أو بعده، وبحد أقصى سنة).
 * - permanent: تحويل الحساب إلى حساب دائم.
 * كلاهما يتطلب سببًا مكتوبًا ويُسجَّل في سجل التدقيق.
 */
export async function unlockTrialAccount(params: UnlockTrialParams): Promise<UnlockTrialResult> {
  await ensureTrialSchema();
  const today = businessToday();

  const reasonCheck = validateUnlockReason(params.reason);
  if (!reasonCheck.ok) {
    return { ok: false, code: "REASON_REQUIRED", message: reasonCheck.error || "سبب إعادة الفتح مطلوب" };
  }

  if (params.mode !== "extend" && params.mode !== "permanent") {
    return { ok: false, code: "INVALID_MODE", message: "نوع إعادة الفتح غير معروف" };
  }
  const mode: TrialUnlockMode = params.mode;

  const found = await pool.query(
    `SELECT id, username, role, ${TRIAL_USER_COLUMNS} FROM users WHERE id = $1`,
    [params.userId]
  );
  const target = found.rows[0];
  if (!target) {
    return { ok: false, code: "NOT_FOUND", message: "المستخدم غير موجود" };
  }
  if (String(target.role || "").toLowerCase() === "admin") {
    return {
      ok: false,
      code: "NOT_APPLICABLE",
      message: "حساب مدير النظام لا يخضع للفترة التجريبية ولا يحتاج إعادة فتح",
    };
  }

  let newEndsOn: string | null = null;
  if (mode === "extend") {
    const dateCheck = validateTrialEndDate(params.endsAt, today, TRIAL_MAX_DAYS);
    if (!dateCheck.ok || !dateCheck.dateOnly) {
      return { ok: false, code: "INVALID_TRIAL_DATE", message: dateCheck.error || "تاريخ انتهاء غير صالح" };
    }
    newEndsOn = dateCheck.dateOnly;
  }

  const result = await pool.query(
    `UPDATE users
        SET is_trial = $2,
            trial_ends_at = $3::date,
            is_locked = FALSE,
            locked_at = NULL,
            locked_reason = NULL,
            locked_by = NULL,
            trial_unlock_count = COALESCE(trial_unlock_count, 0) + 1,
            trial_last_unlocked_at = NOW(),
            trial_last_unlocked_by = $4
      WHERE id = $1
        AND LOWER(COALESCE(role, 'user')) <> 'admin'
      RETURNING id, username, role, ${TRIAL_USER_COLUMNS}`,
    [params.userId, mode === "extend", newEndsOn, params.actorId]
  );

  const updated = result.rows[0];
  if (!updated) {
    return { ok: false, code: "NOT_UPDATED", message: "تعذر تحديث الحساب، يرجى إعادة المحاولة" };
  }

  const action = mode === "extend" ? "TRIAL_ACCOUNT_UNLOCK_EXTENDED" : "TRIAL_ACCOUNT_CONVERTED_PERMANENT";
  const details =
    mode === "extend"
      ? `إعادة فتح حساب تجريبي بتمديد الفترة حتى ${newEndsOn} — المستخدم: ${updated.username} — السبب: ${reasonCheck.reason}`
      : `إعادة فتح حساب تجريبي بتحويله إلى حساب دائم — المستخدم: ${updated.username} — السبب: ${reasonCheck.reason}`;

  await logAction(params.actorId, action, "users", updated.id, details, {
    module: "security",
    severity: "warning",
    status: "success",
    entityType: "user",
    entityRef: updated.username,
    username: params.actorUsername || null,
    meta: {
      mode,
      previous_locked_reason: target.locked_reason || null,
      previous_trial_ends_at: target.trial_ends_at || null,
      new_trial_ends_at: newEndsOn,
      reason: reasonCheck.reason,
      unlock_count: updated.trial_unlock_count,
    },
  });

  return { ok: true, mode, endsOn: newEndsOn, user: updated };
}

/** ملخص عرض حالة الحساب (للجداول وواجهة الاستخدام). */
export function trialSummaryFor(subject: TrialSubjectRow, today: string = businessToday()) {
  return buildTrialSummary(
    {
      ...subject,
      trial_ends_at: toDateOnly(subject.trial_ends_at),
    },
    today
  );
}
