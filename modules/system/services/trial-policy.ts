/**
 * سياسة الحسابات التجريبية — منطق خالص (Pure) بلا قاعدة بيانات ولا HTTP.
 * ─────────────────────────────────────────────────────────────────────────
 * الهدف: مصدر حقيقة واحد يُستخدم في تسجيل الدخول، وفي الميدلوير العام، وفي
 * إنشاء/تعديل المستخدمين، وفي شاشة "السرية والتحكم" — حتى لا تختلف النتيجة
 * بين مسار وآخر.
 *
 * قواعد العمل (متفق عليها):
 *  1) تاريخ الانتهاء `trial_ends_at` هو آخر يوم مسموح به (شامل اليوم نفسه).
 *  2) بعد نهاية ذلك اليوم يُقفل الحساب قفلًا دائمًا (`is_locked = true`)،
 *     ولا يُفتح إلا بإجراء صريح من مدير النظام (زر إعادة الفتح).
 *  3) القفل الدائم هو المرجع النهائي: تعديل تاريخ الانتهاء أو تغيير
 *     `is_trial` لا يفتح الحساب المقفول تلقائيًا.
 *  4) الحساب التجريبي بدون تاريخ انتهاء = إعداد خاطئ يُقفل احتياطيًا (fail-closed)
 *     بدلًا من أن يبقى مفتوحًا للأبد.
 *  5) حساب مدير النظام (`role = 'admin'`) لا يخضع للفترة التجريبية إطلاقًا،
 *     حتى لا يُقفل النظام بالكامل بسبب تاريخ قديم.
 *  6) كل حسابات التواريخ تُقارن بتقويم "اليوم" في توقيت العمل (أفريقيا/القاهرة)
 *     لا بتوقيت UTC — الفرق كان يجعل التجربة تنتهي يومًا مبكرًا.
 */

/** التوقيت المرجعي لحساب "اليوم" — يمكن تجاوزه للتشغيل في توقيت آخر. */
export const TRIAL_TIMEZONE = process.env.TRIAL_TIMEZONE || "Africa/Cairo";

/** أقصى مدة مسموح بها للحساب التجريبي (يومًا). */
export const TRIAL_MAX_DAYS = 365;

/** المدة الافتراضية عند تفعيل حساب تجريبي بدون تحديد تاريخ. */
export const TRIAL_DEFAULT_DAYS = 7;

/** أقل طول مقبول لسبب إعادة فتح حساب مقفول. */
export const TRIAL_MIN_REASON_LENGTH = 5;

export type TrialState =
  | "permanent"           // حساب دائم — لا علاقة له بالتجربة
  | "trial_active"        // تجريبي ساري
  | "trial_expiring_today"// آخر يوم في التجربة
  | "trial_expired"       // انتهى ولم يُقفل بعد (سيُقفل الآن)
  | "trial_locked"        // مقفول (بقفل دائم) — لا وصول
  | "trial_misconfigured";// تجريبي بلا تاريخ صالح — يُقفل احتياطيًا

export type TrialBlockReason =
  | "TRIAL_EXPIRED"
  | "TRIAL_DATE_MISSING"
  | "TRIAL_DATE_INVALID"
  | "ACCOUNT_LOCKED";

export interface TrialSubject {
  id?: number | null;
  username?: string | null;
  role?: string | null;
  is_trial?: boolean | string | number | null;
  trial_ends_at?: string | Date | null;
  is_locked?: boolean | string | number | null;
  locked_reason?: string | null;
}

export interface TrialDecision {
  /** هل يُسمح لهذا الحساب باستخدام النظام الآن؟ */
  allowed: boolean;
  state: TrialState;
  /** كود سبب المنع — يُعاد للعميل كـ error code. */
  reason: TrialBlockReason | null;
  /** تاريخ الانتهاء بصيغة YYYY-MM-DD. */
  endsOn: string | null;
  /** الأيام المتبقية (0 = آخر يوم). */
  daysLeft: number | null;
  /** هل يجب تثبيت القفل في قاعدة البيانات الآن؟ */
  shouldLock: boolean;
  /** رسالة عربية جاهزة للعرض. */
  message: string;
}

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** تحويل أي قيمة منطقية قادمة من قاعدة البيانات أو JSON إلى boolean. */
export function isTruthyFlag(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "t" || normalized === "yes";
  }
  return false;
}

/** هل النص تاريخ تقويمي صالح بصيغة YYYY-MM-DD؟ (يرفض 2026-02-31) */
export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_ONLY_PATTERN.exec(value.trim());
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * استخراج التاريخ كـ YYYY-MM-DD دون أي تحويل للمنطقة الزمنية.
 *
 * مهم: استعلامات قاعدة البيانات يجب أن تُرجع `to_char(trial_ends_at,'YYYY-MM-DD')`
 * كنص. تمرير كائن Date هنا يفترض أنه قادم من JSON (منتصف ليل UTC)، لذا تُستخدم
 * دوال UTC — أما تحويل DATE إلى Date محلي ثم toISOString() فهو سبب انزياح اليوم.
 */
export function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    const candidate = `${year}-${month}-${day}`;
    return isValidDateOnly(candidate) ? candidate : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const candidate = trimmed.length > 10 ? trimmed.slice(0, 10) : trimmed;
  return isValidDateOnly(candidate) ? candidate : null;
}

/** إضافة أيام إلى تاريخ تقويمي (بدون تأثير التوقيت الصيفي). */
export function addDays(dateOnly: string, days: number): string | null {
  if (!isValidDateOnly(dateOnly) || !Number.isFinite(days)) return null;
  const [year, month, day] = dateOnly.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day + Math.trunc(days));
  const shifted = new Date(base);
  const result = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
  return isValidDateOnly(result) ? result : null;
}

/** فرق الأيام بين تاريخين تقويميين (b - a). */
export function daysBetween(from: string, to: string): number {
  if (!isValidDateOnly(from) || !isValidDateOnly(to)) return Number.NaN;
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/** تاريخ "اليوم" في توقيت العمل بصيغة YYYY-MM-DD. */
export function businessToday(now: Date = new Date(), timeZone: string = TRIAL_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const pick = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const candidate = `${pick("year")}-${pick("month")}-${pick("day")}`;
  return isValidDateOnly(candidate) ? candidate : new Date(now.getTime()).toISOString().slice(0, 10);
}

/** إزاحة المنطقة الزمنية بالمللي ثانية عند لحظة معينة. */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const pick = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  const asUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), pick("hour") % 24, pick("minute"), pick("second"));
  return asUtc - instant.getTime();
}

/** تحويل لحظة محلية (تاريخ + ساعة) في منطقة زمنية إلى UTC. */
export function zonedTimeToUtc(dateOnly: string, hours: number, minutes: number, timeZone: string = TRIAL_TIMEZONE): Date | null {
  if (!isValidDateOnly(dateOnly)) return null;
  const [year, month, day] = dateOnly.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);
  let timestamp = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  // تمريرة ثانية لضبط لحظات تغيير التوقيت الصيفي.
  timestamp = guess - timeZoneOffsetMs(new Date(timestamp), timeZone);
  return new Date(timestamp);
}

/** لحظة انتهاء التجربة: بداية اليوم التالي لتاريخ الانتهاء بتوقيت العمل. */
export function trialDeadline(endsOn: string, timeZone: string = TRIAL_TIMEZONE): Date | null {
  const nextDay = addDays(endsOn, 1);
  if (!nextDay) return null;
  return zonedTimeToUtc(nextDay, 0, 0, timeZone);
}

/** هل الحساب مدير نظام (لا يخضع للتجربة)؟ */
export function isAdminSubject(subject: TrialSubject): boolean {
  return String(subject.role || "").trim().toLowerCase() === "admin";
}

function lockedReasonLabel(reason: string | null | undefined): string {
  switch ((reason || "").trim().toUpperCase()) {
    case "TRIAL_EXPIRED":
      return "بعد انتهاء الفترة التجريبية";
    case "TRIAL_DATE_MISSING":
    case "TRIAL_DATE_INVALID":
      return "لعدم ضبط تاريخ انتهاء صالح للفترة التجريبية";
    case "ADMIN_LOCK":
      return "بقرار من مدير النظام";
    default:
      return reason ? `(${reason})` : "بقرار إداري";
  }
}

/**
 * القرار الوحيد المعتمد لصلاحية الحساب.
 * الترتيب مقصود: مدير النظام ← القفل الدائم ← دائم ← تجريبي.
 */
export function evaluateTrialAccess(subject: TrialSubject, today: string = businessToday()): TrialDecision {
  const safeToday = isValidDateOnly(today) ? today : businessToday();

  // 1) مدير النظام لا يُقفل أبدًا بسبب التجربة.
  if (isAdminSubject(subject)) {
    return {
      allowed: true,
      state: "permanent",
      reason: null,
      endsOn: null,
      daysLeft: null,
      shouldLock: false,
      message: "",
    };
  }

  // 2) القفل الدائم هو المرجع النهائي — يسبق أي تاريخ.
  if (isTruthyFlag(subject.is_locked)) {
    return {
      allowed: false,
      state: "trial_locked",
      reason: "ACCOUNT_LOCKED",
      endsOn: toDateOnly(subject.trial_ends_at),
      daysLeft: null,
      shouldLock: false,
      message: `هذا الحساب مقفول ${lockedReasonLabel(subject.locked_reason)}، ولا يمكن فتحه إلا بواسطة مدير النظام.`,
    };
  }

  // 3) حساب دائم.
  if (!isTruthyFlag(subject.is_trial)) {
    return {
      allowed: true,
      state: "permanent",
      reason: null,
      endsOn: null,
      daysLeft: null,
      shouldLock: false,
      message: "",
    };
  }

  // 4) تجريبي بدون تاريخ انتهاء → إعداد خاطئ يُقفل احتياطيًا.
  if (!subject.trial_ends_at) {
    return {
      allowed: false,
      state: "trial_misconfigured",
      reason: "TRIAL_DATE_MISSING",
      endsOn: null,
      daysLeft: null,
      shouldLock: true,
      message: "هذا الحساب تجريبي بدون تاريخ انتهاء محدد، لذلك تم إقفاله احتياطيًا. حدّد تاريخ انتهاء صالحًا من شاشة إدارة المستخدمين.",
    };
  }

  // 5) تجريبي بتاريخ غير صالح → إعداد خاطئ يُقفل احتياطيًا.
  const endsOn = toDateOnly(subject.trial_ends_at);
  if (!endsOn) {
    return {
      allowed: false,
      state: "trial_misconfigured",
      reason: "TRIAL_DATE_INVALID",
      endsOn: null,
      daysLeft: null,
      shouldLock: true,
      message: "تاريخ انتهاء الفترة التجريبية غير صالح، لذلك تم إقفال الحساب احتياطيًا. حدّد تاريخًا صحيحًا من شاشة إدارة المستخدمين.",
    };
  }

  const daysLeft = daysBetween(safeToday, endsOn);

  if (daysLeft < 0) {
    return {
      allowed: false,
      state: "trial_expired",
      reason: "TRIAL_EXPIRED",
      endsOn,
      daysLeft: 0,
      shouldLock: true,
      message: `انتهت الفترة التجريبية لهذا الحساب بتاريخ ${endsOn} وتم إقفاله. فتح الحساب من جديد يتم بواسطة مدير النظام فقط.`,
    };
  }

  if (daysLeft === 0) {
    return {
      allowed: true,
      state: "trial_expiring_today",
      reason: null,
      endsOn,
      daysLeft: 0,
      shouldLock: false,
      message: `آخر يوم في الفترة التجريبية (${endsOn}). سيُقفل الحساب بعد منتصف الليل.`,
    };
  }

  return {
    allowed: true,
    state: "trial_active",
    reason: null,
    endsOn,
    daysLeft,
    shouldLock: false,
    message: `الفترة التجريبية سارية حتى ${endsOn} (${daysLeft} يوم متبقٍ).`,
  };
}

export interface DateValidationResult {
  ok: boolean;
  dateOnly: string | null;
  error: string | null;
}

/**
 * التحقق من تاريخ انتهاء تجربة يُدخله المدير.
 * - مطلوب دائمًا (لا تجربة مفتوحة).
 * - لا يقبل تاريخًا ماضيًا.
 * - لا يتجاوز TRIAL_MAX_DAYS يومًا من اليوم.
 */
export function validateTrialEndDate(
  value: unknown,
  today: string = businessToday(),
  maxDays: number = TRIAL_MAX_DAYS
): DateValidationResult {
  if (value === null || value === undefined || value === "") {
    return { ok: false, dateOnly: null, error: "تاريخ انتهاء الفترة التجريبية مطلوب" };
  }
  const dateOnly = toDateOnly(value as string | Date);
  if (!dateOnly) {
    return { ok: false, dateOnly: null, error: "تاريخ انتهاء الفترة التجريبية غير صالح (الصيغة المطلوبة YYYY-MM-DD)" };
  }
  const safeToday = isValidDateOnly(today) ? today : businessToday();
  const diff = daysBetween(safeToday, dateOnly);
  if (diff < 0) {
    return { ok: false, dateOnly: null, error: "لا يمكن أن يكون تاريخ انتهاء الفترة التجريبية في الماضي" };
  }
  if (diff > maxDays) {
    return { ok: false, dateOnly: null, error: `أقصى مدة للفترة التجريبية ${maxDays} يومًا` };
  }
  return { ok: true, dateOnly, error: null };
}

export interface ReasonValidationResult {
  ok: boolean;
  reason: string;
  error: string | null;
}

/** سبب إعادة فتح الحساب إلزامي وقابل للتدقيق. */
export function validateUnlockReason(value: unknown, minLength: number = TRIAL_MIN_REASON_LENGTH): ReasonValidationResult {
  const reason = typeof value === "string" ? value.trim() : "";
  if (reason.length < minLength) {
    return { ok: false, reason, error: `سبب إعادة الفتح مطلوب (${minLength} أحرف على الأقل) لأغراض التدقيق` };
  }
  if (reason.length > 500) {
    return { ok: false, reason: reason.slice(0, 500), error: "سبب إعادة الفتح أطول من الحد المسموح (500 حرف)" };
  }
  return { ok: true, reason, error: null };
}

export interface UsernameValidationResult {
  ok: boolean;
  username: string;
  error: string | null;
}

/**
 * التحقق من اسم المستخدم: بلا فراغات أو محارف تحكّم، وبطول معقول.
 * يسمح بالحروف العربية واللاتينية والأرقام والنقطة والشرطة والشرطة السفلية و@.
 */
export function sanitizeUsername(value: unknown): UsernameValidationResult {
  const raw = typeof value === "string" ? value : "";
  const username = raw.trim();
  if (!username) return { ok: false, username, error: "اسم المستخدم مطلوب" };
  if (username.length < 3) return { ok: false, username, error: "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" };
  if (username.length > 64) return { ok: false, username, error: "اسم المستخدم أطول من الحد المسموح (64 حرفًا)" };
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\s]/.test(username)) {
    return { ok: false, username, error: "اسم المستخدم لا يجوز أن يحتوي على فراغات أو محارف تحكّم" };
  }
  if (!/^[\p{L}\p{N}._@-]+$/u.test(username)) {
    return { ok: false, username, error: "اسم المستخدم يحتوي على محارف غير مسموح بها" };
  }
  return { ok: true, username, error: null };
}

/** ملخص جاهز للعرض في واجهة إدارة المستخدمين. */
export function buildTrialSummary(subject: TrialSubject, today: string = businessToday()) {
  const decision = evaluateTrialAccess(subject, today);
  return {
    trial_state: decision.state,
    trial_days_left: decision.daysLeft,
    trial_ends_on: decision.endsOn,
    is_locked: isTruthyFlag(subject.is_locked),
    locked_reason: subject.locked_reason || null,
    trial_message: decision.message,
  };
}
