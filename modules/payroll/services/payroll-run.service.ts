import { pool } from "../../../server-db.js";
import { AccountRepository } from "../../accounts/repositories/account.repository.js";
import { generateNextReference, getOpenPeriod } from "../../accounts/services/auto-posting.service.js";
import { generateTreasuryVoucherNumber } from "../../accounting/services/treasury-voucher.service.js";
import { beginIdempotency, completeIdempotency } from "../../enterprise/services/idempotency.service.js";
import {
  PayrollRunItemRecord,
  PayrollRunRecord,
  PayrollRunStatus,
  payrollRunRepository,
} from "../repositories/payroll-run.repository.js";

/**
 * مسير المرتبات — الربط الكامل بين HR و Payroll والخزينة والحسابات العامة
 * ────────────────────────────────────────────────────────────────────────
 * 1) الإقفال (close):   مدين مصروف المرتبات والأجور  / دائن مرتبات مستحقة الدفع
 *    → يثبت المصروف والالتزام ولا يمسّ الخزينة إطلاقًا.
 * 2) الصرف (pay):       مدين مرتبات مستحقة الدفع     / دائن الخزينة أو البنك
 *    → ينشئ حركة خزينة فعلية + سند صرف، ويخفض الالتزام، بلا تسجيل مصروف جديد.
 *
 * القيود تمر عبر AccountRepository.createJournalEntry حتى تُتحقق قاعدة التوازن
 * ويُحدَّث دليل الحسابات، وكل عملية تجري داخل معاملة واحدة مع منع تكرار.
 */

export interface PayrollPeriodInput {
  year: number;
  month: number;
  branchId?: number | null;
  departmentId?: number | null;
}

export interface PayrollPaymentInput {
  amount?: number;
  treasuryAccountId?: number | null;
  paymentSource?: "cash" | "bank" | string;
  paymentDate?: string;
  referenceNumber?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface ServiceOptions {
  client?: any;
  idempotencyKey?: string | null;
}

const RUN_STATUS_LABELS: Record<string, string> = {
  draft: "مسودة",
  open: "مسودة",
  accrued: "معتمد / مقفل — مستحق الدفع",
  partially_paid: "مصروف جزئيًا",
  paid: "مصروف بالكامل",
};

const SALARY_SETTINGS_DEFAULTS: Record<string, any> = {
  default_work_days: 30,
  default_daily_hours: 8,
};

export class PayrollRunError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isTruthyFlag(value: any): boolean {
  if (value === true) return true;
  if (value === 1) return true;
  const text = String(value ?? "").trim().toLowerCase();
  return text === "نعم" || text === "yes" || text === "true" || text === "1";
}

/** يحوّل تاريخاً قادماً من قاعدة البيانات (Date) أو نصاً إلى تاريخ محلي بدون وقت */
function toLocalDateOnly(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(text);
  if (isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

/**
 * ✅ عدد أيام الشهر المؤهلة للمرتب حسب "تاريخ استلام العمل".
 * تاريخ بعد نهاية الشهر → صفر، داخل الشهر → من التاريخ لنهايته، قبله → الشهر كامل.
 */
function eligibleSalaryDaysInMonth(startDateRaw: any, year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  const start = toLocalDateOnly(startDateRaw);
  if (!start) return daysInMonth;
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month - 1, daysInMonth);
  if (start.getTime() > monthEnd.getTime()) return 0;
  if (start.getTime() <= monthStart.getTime()) return daysInMonth;
  return Math.round((monthEnd.getTime() - start.getTime()) / 86400000) + 1;
}

function parseComponents(raw: any): any[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** آخر يوم في الشهر الميلادي — تاريخ استحقاق المرتبات المحاسبي. */
export function payrollAccrualDate(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${pad2(month)}-${pad2(lastDay)}`;
}

export type PayrollItemPaymentState = "draft" | "due" | "partially_paid" | "paid";

const ITEM_PAYMENT_STATE_LABELS: Record<PayrollItemPaymentState, string> = {
  draft: "لم يُعتمد بعد",
  due: "مستحق لم يُصرف",
  partially_paid: "مصروف جزئيًا",
  paid: "مصروف",
};

/**
 * توزيع المبلغ المصروف فعليًا للمسير على بنود الموظفين بنسبة صافي كل موظف من
 * إجمالي صافي المسير. الصرف يتم على مستوى المسير (سند واحد للخزينة) لا لكل
 * موظف، فهذه السياسة هي التي تجعل «المستحق لكل موظف» و«المصروف له» متسقين
 * مع إجمالي المصروف. تُحسب بالقرش (عدد صحيح) لتجنب فروق التقريب وضمان أن مجموع
 * الأنصبة = المصروف بالضبط، وبلا أن يتجاوز نصيب أي موظف صافيه.
 */
export function allocatePaidAcrossItems(
  items: Array<{ net_salary?: number | string | null }>,
  totalPaid: number,
): number[] {
  const nets = items.map((item) => Math.max(0, Math.round((Number(item?.net_salary) || 0) * 100)));
  const totalNetCents = nets.reduce((sum, cents) => sum + cents, 0);
  const allocations = new Array(items.length).fill(0) as number[];
  const paidCents = Math.max(0, Math.min(Math.round((Number(totalPaid) || 0) * 100), totalNetCents));
  if (totalNetCents <= 0 || paidCents <= 0) return allocations;

  let allocated = 0;
  for (let index = 0; index < nets.length; index += 1) {
    const share = Math.floor((nets[index] * paidCents) / totalNetCents);
    allocations[index] = share;
    allocated += share;
  }
  // توزيع فرق التقريب (أقل من عدد البنود قرشًا) على البنود بالترتيب
  let remainder = paidCents - allocated;
  for (let index = 0; index < nets.length && remainder > 0; index += 1) {
    const capacity = nets[index] - allocations[index];
    const addition = Math.min(capacity, remainder);
    allocations[index] += addition;
    remainder -= addition;
  }
  return allocations.map((cents) => round2(cents / 100));
}

/** حالة صرف الموظف داخل المسير — مشتقة من نصيبه من المصروف الفعلي. */
export function payrollItemPaymentState(
  netSalary: number,
  paidAmount: number,
  runStatus: string,
): PayrollItemPaymentState {
  const net = round2(Number(netSalary) || 0);
  const paid = round2(Number(paidAmount) || 0);
  if (net <= 0.004) return "paid";
  if (paid + 0.004 >= net) return "paid";
  if (paid > 0.004) return "partially_paid";
  return ["accrued", "partially_paid", "paid"].includes(String(runStatus || "")) ? "due" : "draft";
}

export class PayrollRunService {
  private readonly repository = payrollRunRepository;
  private readonly accountRepository = new AccountRepository();

  async ensureSchema(db: any = pool): Promise<void> {
    await this.repository.ensureSchema(db);
  }

  private async withTransaction<T>(client: any, work: (tx: any) => Promise<T>): Promise<T> {
    if (client) return work(client);
    const connection = await pool.connect();
    let began = false;
    try {
      await connection.query("BEGIN");
      began = true;
      const result = await work(connection);
      await connection.query("COMMIT");
      began = false;
      return result;
    } catch (error) {
      if (began) {
        try {
          await connection.query("ROLLBACK");
        } catch {
          /* connection already gone */
        }
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  // ═══════════════════════════════════════
  // حساب مسير الشهر (نفس مصادر وقواعد شاشة المرتبات)
  // ═══════════════════════════════════════
  async computePeriod(
    db: any,
    input: PayrollPeriodInput,
  ): Promise<{ items: PayrollRunItemRecord[]; totalNet: number; totalAdditions: number; totalDeductions: number }> {
    const { year, month } = input;
    const monthPrefix = `${year}-${pad2(month)}-%`;

    const settings: Record<string, any> = { ...SALARY_SETTINGS_DEFAULTS };
    try {
      const settingsRes = await db.query("SELECT key, value FROM hr_settings");
      for (const row of settingsRes.rows) {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = row.value;
        }
      }
    } catch {
      /* hr_settings is optional */
    }
    const defaultWorkDays = Number(settings.default_work_days) > 0 ? Number(settings.default_work_days) : 30;
    const defaultDailyHours = Number(settings.default_daily_hours) > 0 ? Number(settings.default_daily_hours) : 8;

    const empConditions: string[] = ["COALESCE(e.status, 'active') = 'active'"];
    const empParams: any[] = [];
    if (input.branchId) {
      empParams.push(input.branchId);
      empConditions.push(`e.branch_id = $${empParams.length}`);
    }
    if (input.departmentId) {
      empParams.push(input.departmentId);
      empConditions.push(`e.department_id = $${empParams.length}`);
    }
    const employees = (
      await db.query(
        `SELECT e.id, e.name, e.employee_code, e.basic_salary, e.work_days, e.work_days_count,
                e.works_hourly, e.new_hour_rate, e.exempt_from_penalties,
                e.attendance_method, e.has_meal_allowance, e.meal_allowance_amount,
                e.has_insurance, e.insurance_amount, e.salary_components,
                shift.total_hours AS shift_hours
           FROM employees e
           LEFT JOIN LATERAL (
             SELECT s.total_hours
               FROM employee_shifts es
               JOIN hr_shifts s ON s.id = es.shift_id
              WHERE es.employee_id = e.id
              ORDER BY s.id
              LIMIT 1
           ) shift ON true
          WHERE ${empConditions.join(" AND ")}
          ORDER BY e.id`,
        empParams,
      )
    ).rows;

    const attendance = (
      await db.query(
        `SELECT employee_id, COUNT(DISTINCT date)::int AS days, COALESCE(SUM(work_hours), 0) AS hours
           FROM attendance
          WHERE date::text LIKE $1
          GROUP BY employee_id`,
        [monthPrefix],
      )
    ).rows;
    const attendanceMap = new Map<number, { days: number; hours: number }>(
      attendance.map((row: any) => [Number(row.employee_id), { days: Number(row.days) || 0, hours: Number(row.hours) || 0 }]),
    );

    const loadMonthTotals = async (table: string): Promise<Map<number, number>> => {
      try {
        const res = await db.query(
          `SELECT employee_id, COALESCE(SUM(amount), 0) AS total FROM ${table} WHERE date::text LIKE $1 GROUP BY employee_id`,
          [monthPrefix],
        );
        return new Map<number, number>(res.rows.map((row: any) => [Number(row.employee_id), Number(row.total) || 0]));
      } catch {
        return new Map<number, number>();
      }
    };
    const advancesMap = await loadMonthTotals("payroll_advances");
    const bonusesMap = await loadMonthTotals("payroll_bonuses");
    const deductionsMap = await loadMonthTotals("payroll_deductions");

    const items: PayrollRunItemRecord[] = [];
    let totalNet = 0;
    let totalAdditions = 0;
    let totalDeductions = 0;

    for (const emp of employees) {
      const basic = Number(emp.basic_salary) || 0;
      const expectedDays =
        Number(emp.work_days_count) || Number(emp.work_days) || defaultWorkDays;
      const attendanceRow = attendanceMap.get(Number(emp.id)) || { days: 0, hours: 0 };
      const days = attendanceRow.days;
      // ✅ المرتب يبدأ من تاريخ استلام العمل (actual_start_date وإلا hire_date)
      const eligibleDays = eligibleSalaryDaysInMonth(emp.actual_start_date || emp.hire_date, year, month);
      const isHourly = isTruthyFlag(emp.works_hourly);
      const isExempt =
        isTruthyFlag(emp.exempt_from_penalties) || String(emp.attendance_method || "").includes("عدم اتباع");

      let actual = 0;
      if (isHourly) {
        const shiftHours = Number(emp.shift_hours) > 0 ? Number(emp.shift_hours) : defaultDailyHours;
        const customRate = Number(emp.new_hour_rate) || 0;
        const calculatedRate =
          expectedDays > 0 && shiftHours > 0 ? basic / expectedDays / shiftHours : 0;
        const hourRate = customRate > 0 ? customRate : calculatedRate;
        let workedMinutes = Math.round(Number(attendanceRow.hours) * 60);
        if (workedMinutes === 0 && days > 0) workedMinutes = Math.round(days * shiftHours * 60);
        actual = (workedMinutes * hourRate) / 60;
      } else if (isExempt) {
        // ✅ لا راتب قبل تاريخ استلام العمل
        actual = expectedDays > 0 ? (basic / expectedDays) * Math.min(expectedDays, eligibleDays) : 0;
      } else {
        actual = expectedDays > 0 ? (basic / expectedDays) * Math.min(days, eligibleDays) : 0;
      }

      const components = parseComponents(emp.salary_components);
      let componentInsurance = 0;
      let insuranceComponentRows = 0;
      let componentBonuses = 0;
      let componentDeductions = 0;
      let componentAdvances = 0;
      let componentMealRate = 0;

      for (const comp of components) {
        if (!comp || !comp.name) continue;
        // ✅ نعدّ بنود التأمين حتى المعطّلة — لمعرفة هل للموظف بند تأمين أم لا
        const rawName = String(comp.name);
        if ((comp.type === "استقطاع" || !comp.type) && (rawName.includes("تأمين") || rawName.toLowerCase().includes("insurance"))) {
          insuranceComponentRows += 1;
        }
        // البند غير المُفعّل لا يدخل في أي حساب
        if (comp.is_active === false) continue;
        const name = String(comp.name);
        const nameLower = name.toLowerCase();
        let amount = Number(comp.amount) || 0;
        if (comp.value_type === "نسبة من الأساسي") {
          amount = (basic * (Number(comp.discount_pct) || 0)) / 100;
        }
        const isMeal = name.includes("وجبة") || name.includes("طعام") || nameLower.includes("meal");
        if (isMeal) {
          if (!comp.type || comp.type === "استحقاق") componentMealRate += amount;
          continue;
        }
        if (name.includes("أساسي") || nameLower === "basic" || nameLower.includes("مرتب أساسي")) continue;
        if ((comp.type === "استقطاع" || !comp.type) && (name.includes("تأمين") || nameLower.includes("insurance"))) {
          componentInsurance += amount;
        } else if (comp.type === "استحقاق") {
          componentBonuses += amount;
        } else if (comp.type === "استقطاع" && (name.includes("سلف") || name.includes("قسط"))) {
          componentAdvances += amount;
        } else if (comp.type === "استقطاع") {
          componentDeductions += amount;
        }
      }

      const baseMeal = isTruthyFlag(emp.has_meal_allowance) ? Number(emp.meal_allowance_amount) || 0 : 0;
      const mealDays = isExempt ? expectedDays : days;
      // ✅ بدل الوجبة يبدأ أيضاً من تاريخ استلام العمل
      const meal = (baseMeal + componentMealRate) * Math.min(mealDays, eligibleDays);

      const additions = round2(actual + meal + componentBonuses + (bonusesMap.get(Number(emp.id)) || 0));

      const hasInsuranceFlag = isTruthyFlag(emp.has_insurance);
      // ✅ المبلغ المحفوظ يُستخدم فقط لو لا توجد بنود تأمين إطلاقاً (بيانات قديمة)
      const baseInsurance = hasInsuranceFlag && insuranceComponentRows === 0 ? Number(emp.insurance_amount) || 0 : 0;
      const componentInsuranceTotal = hasInsuranceFlag ? componentInsurance : 0;
      const insurance = round2(componentInsuranceTotal + baseInsurance);
      const deductions = round2(
        insurance +
          componentDeductions +
          componentAdvances +
          (deductionsMap.get(Number(emp.id)) || 0) +
          (advancesMap.get(Number(emp.id)) || 0),
      );

      const net = round2(Math.max(0, additions - deductions));

      items.push({
        id: 0,
        run_id: 0,
        employee_id: Number(emp.id),
        employee_code: emp.employee_code ?? null,
        employee_name: emp.name ?? null,
        basic_salary: round2(basic),
        additions,
        deductions,
        net_salary: net,
        paid_amount: 0,
      });

      totalNet = round2(totalNet + net);
      totalAdditions = round2(totalAdditions + additions);
      totalDeductions = round2(totalDeductions + deductions);
    }

    return { items, totalNet, totalAdditions, totalDeductions };
  }

  // ═══════════════════════════════════════
  // دليل الحسابات
  // ═══════════════════════════════════════
  private async loadConfigMap(db: any): Promise<Record<string, number>> {
    const result = await db.query("SELECT key, account_id FROM account_config WHERE account_id IS NOT NULL");
    const map: Record<string, number> = {};
    for (const row of result.rows) {
      const id = Number(row.account_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      const raw = String(row.key || "").trim();
      map[raw] = id;
      map[raw.replace(/_account$/, "")] = id;
    }
    return map;
  }

  private pickConfig(map: Record<string, number>, keys: string[]): number | null {
    for (const key of keys) {
      if (map[key]) return map[key];
    }
    return null;
  }

  private async persistConfig(db: any, key: string, accountId: number): Promise<void> {
    await db.query(
      `INSERT INTO account_config (key, account_id, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = NOW()`,
      [key, accountId],
    );
  }

  /**
   * حساب مصروف المرتبات: إذا كان الربط يشير إلى حساب «تكلفة البضاعة المباعة»
   * أو أي حساب غير مصروفي، يُستبدل تلقائيًا بحساب المرتبات الصحيح ويُحفظ الربط،
   * حتى لا تُرحّل مرتبات على حساب المخزون/التكلفة.
   */
  private async resolveSalariesExpense(db: any, configuredAccountId: number): Promise<number> {
    const row = await db.query(
      "SELECT id, code, COALESCE(name_ar, name) AS name, COALESCE(account_type, type) AS account_type FROM accounts WHERE id = $1 LIMIT 1",
      [configuredAccountId],
    );
    const account = row.rows[0];
    const name = String(account?.name || "");
    const code = String(account?.code || "");
    const isCogs =
      code === "5101" ||
      name.includes("تكلفة البضاعة") ||
      name.includes("بضاعة المباعة") ||
      name.includes("COGS");

    if (account && !isCogs) return configuredAccountId;

    const fallback = await db.query(
      `SELECT id FROM accounts
        WHERE (code = '5200'
          OR COALESCE(name_ar, name) LIKE '%مرتب%'
          OR COALESCE(name_ar, name) LIKE '%رواتب%'
          OR COALESCE(name_ar, name) LIKE '%أجور%')
          AND (LOWER(COALESCE(account_type, type)) LIKE '%expense%'
            OR LOWER(COALESCE(account_type, type)) LIKE '%مصروف%'
            OR code LIKE '52%')
        ORDER BY CASE WHEN code = '5200' THEN 0 ELSE 1 END, id
        LIMIT 1`,
    );
    const fallbackId = Number(fallback.rows[0]?.id) || null;
    if (!fallbackId) {
      throw new PayrollRunError(
        400,
        "ACCOUNT_CONFIG_MISSING",
        "حساب مصروف المرتبات والأجور مربوط حاليًا بحساب غير صحيح (تكلفة البضاعة المباعة). اضبط مفتاح payroll_expense على حساب مصروف المرتبات من شاشة إعدادات الحسابات.",
      );
    }
    await this.persistConfig(db, "payroll_expense", fallbackId);
    return fallbackId;
  }

  /**
   * حساب "مرتبات مستحقة الدفع": يُقرأ من إعدادات الحسابات، فإن لم يكن مربوطًا
   * أو كان مربوطًا بحساب غير صحيح (مصروف/تكلفة) يُبحث عن حساب مطابق بالاسم
   * أو بالكود 2140 (بلا تكرار)، ويُنشأ مرة واحدة فقط إن لم يكن موجودًا بالكامل
   * ثم يُربط بالإعدادات.
   */
  private async resolveSalariesPayable(db: any, map: Record<string, number>): Promise<number> {
    const configured = this.pickConfig(map, [
      "salaries_payable",
      "salary_payable",
      "payroll_payable",
      "wages_payable",
      "accrued_salaries",
      "salaries_accrued",
    ]);
    if (configured) {
      const row = await db.query(
        "SELECT id, code, COALESCE(name_ar, name) AS name, LOWER(COALESCE(account_type, type)) AS account_type FROM accounts WHERE id = $1 LIMIT 1",
        [configured],
      );
      const account = row.rows[0];
      const name = String(account?.name || "");
      const code = String(account?.code || "");
      const isPayable =
        !!account &&
        (code === "2140" ||
          code === "2102" ||
          name.includes("مستحق") ||
          name.includes("دائنة") ||
          name.includes("payable") ||
          account.account_type.includes("liability") ||
          account.account_type.includes("خصوم") ||
          account.account_type.includes("التزام"));
      if (isPayable) return configured;
    }

    const byCode = await db.query("SELECT id FROM accounts WHERE code = '2140' LIMIT 1");
    if (byCode.rows[0]?.id) {
      await this.persistConfig(db, "salaries_payable", Number(byCode.rows[0].id));
      return Number(byCode.rows[0].id);
    }

    const byName = await db.query(
      `SELECT id FROM accounts
        WHERE COALESCE(name_ar, name) LIKE '%مستحق%'
          AND (COALESCE(name_ar, name) LIKE '%مرتب%'
            OR COALESCE(name_ar, name) LIKE '%رواتب%'
            OR COALESCE(name_ar, name) LIKE '%أجور%')
        ORDER BY id LIMIT 1`,
    );
    if (byName.rows[0]?.id) {
      await this.persistConfig(db, "salaries_payable", Number(byName.rows[0].id));
      return Number(byName.rows[0].id);
    }

    const created = await db.query(
      `INSERT INTO accounts
         (code, name, name_ar, type, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, balance, currency)
       VALUES ('2140', 'Salaries Payable', 'مرتبات وأجور مستحقة الدفع', 'liability', 'LIABILITY', 'CREDIT', 2, true, true, true, true, 0, 'EGP')
       ON CONFLICT (code) DO NOTHING
       RETURNING id`,
    );
    let accountId = created.rows[0]?.id ? Number(created.rows[0].id) : null;
    if (!accountId) {
      const again = await db.query("SELECT id FROM accounts WHERE code = '2140' LIMIT 1");
      accountId = again.rows[0]?.id ? Number(again.rows[0].id) : null;
    }
    if (!accountId) {
      throw new PayrollRunError(
        400,
        "ACCOUNT_CONFIG_MISSING",
        "تعذر تحديد حساب «مرتبات مستحقة الدفع». اضبط الحساب من شاشة إعدادات الحسابات (مفتاح salaries_payable) قبل الترحيل.",
      );
    }
    await this.persistConfig(db, "salaries_payable", accountId);
    return accountId;
  }

  private async resolvePayrollAccounts(db: any): Promise<{
    expenseAccountId: number;
    payableAccountId: number;
    cashAccountId: number | null;
    bankAccountId: number | null;
  }> {
    const map = await this.loadConfigMap(db);
    const configuredExpenseAccountId = this.pickConfig(map, [
      "payroll_expense",
      "salary_expense",
      "salaries_expense",
      "wages_expense",
    ]);
    if (!configuredExpenseAccountId) {
      throw new PayrollRunError(
        400,
        "ACCOUNT_CONFIG_MISSING",
        "حساب مصروف المرتبات والأجور غير معرّف في إعدادات الحسابات (مفتاح payroll_expense). اضبط الإعدادات قبل إقفال مسير المرتبات.",
      );
    }
    const expenseAccountId = await this.resolveSalariesExpense(db, configuredExpenseAccountId);
    const payableAccountId = await this.resolveSalariesPayable(db, map);
    return {
      expenseAccountId,
      payableAccountId,
      cashAccountId: this.pickConfig(map, ["cash", "cash_main", "treasury"]),
      bankAccountId: this.pickConfig(map, ["bank", "bank_account"]),
    };
  }

  private async assertPeriodOpen(db: any, date: string): Promise<any | null> {
    const [yearText, monthText] = String(date).split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const period = await db.query(
      "SELECT status FROM financial_periods WHERE month = $1 AND year = $2 LIMIT 1",
      [month, year],
    );
    if (period.rows[0] && period.rows[0].status !== "open") {
      throw new PayrollRunError(
        403,
        "PERIOD_CLOSED",
        `الفترة المالية ${pad2(month)}/${year} مغلقة. لا يمكن ترحيل قيد مرتبات إليها؛ استخدم آلية إعادة الفتح المعتمدة.`,
      );
    }
    return getOpenPeriod(date, db);
  }

  // ═══════════════════════════════════════
  // مسودة المسير
  // ═══════════════════════════════════════
  async buildDraft(input: PayrollPeriodInput, user: any, options: ServiceOptions = {}): Promise<any> {
    const { year, month } = input;
    if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || month < 1 || month > 12) {
      throw new PayrollRunError(400, "INVALID_PERIOD", "الشهر والسنة مطلوبان بصيغة صحيحة (month 1-12, year 4 أرقام)");
    }

    await this.ensureSchema(options.client ?? pool);

    return this.withTransaction(options.client, async (tx) => {
      const existing = await this.repository.findRunByPeriod(tx, input, true);
      if (existing && !["draft", "open"].includes(String(existing.status))) {
        throw new PayrollRunError(
          409,
          "PAYROLL_RUN_LOCKED",
          `مسير مرتبات ${pad2(month)}/${year} معتمد ومقفل بالفعل — لا يمكن إعادة حسابه. استخدم إعادة الفتح أو العكس المعتمد.`,
        );
      }

      const computed = await this.computePeriod(tx, input);
      if (computed.items.length === 0) {
        throw new PayrollRunError(400, "NO_EMPLOYEES", "لا يوجد موظفون نشطون لحساب مسير المرتبات في هذه الفترة");
      }

      let runId = existing?.id;
      if (!runId) {
        const created = await this.repository.insertRun(tx, {
          ...input,
          runNumber: `PAY-${year}${pad2(month)}`,
          userId: user?.id ?? null,
        });
        runId = created.id;
        await tx.query("UPDATE payroll_months SET run_number = $2 WHERE id = $1", [
          runId,
          `PAY-${year}${pad2(month)}-${runId}`,
        ]);
      }

      await this.repository.replaceItems(tx, runId, computed.items);
      await this.repository.updateRunTotals(tx, runId, computed);

      await this.repository.audit(tx, {
        runId,
        action: existing ? "recalculate" : "create",
        fromStatus: existing?.status ?? null,
        toStatus: "draft",
        amount: computed.totalNet,
        userId: user?.id ?? null,
        userName: user?.username ?? null,
        details: `مسودة مسير مرتبات ${pad2(month)}/${year}`,
      });

      const run = await this.repository.findRunById(tx, runId);
      const items = await this.repository.getItems(tx, runId);
      return this.buildSummary(run!, items, await this.repository.listPayments(tx, runId), {
        employeesCount: items.length,
        totalNetOverride: computed.totalNet,
      });
    });
  }

  // ═══════════════════════════════════════
  // إقفال المسير — قيد الاستحقاق
  // ═══════════════════════════════════════
  async closeRun(runId: number, user: any, options: ServiceOptions = {}): Promise<any> {
    await this.ensureSchema(options.client ?? pool);
    const scope = "payroll.run.close";

    return this.withTransaction(options.client, async (tx) => {
      const guard = await beginIdempotency(
        scope,
        options.idempotencyKey,
        { runId },
        user?.id ?? null,
        null,
        null,
        tx,
      );
      if (guard.replay) {
        return { replayed: true, ...(guard.body || {}) };
      }

      const run = await this.repository.findRunByIdForUpdate(tx, runId);
      if (!run) {
        throw new PayrollRunError(404, "RUN_NOT_FOUND", "مسير المرتبات غير موجود");
      }

      // منع تكرار قيد الاستحقاق عند الضغط على الإقفال أكثر من مرة.
      if (["accrued", "partially_paid", "paid"].includes(String(run.status))) {
        const items = await this.repository.getItems(tx, run.id);
        const payload = this.buildSummary(run, items, await this.repository.listPayments(tx, run.id), {
          employeesCount: items.length,
          note: "المسير مقفل بالفعل ولم يُنشأ قيد استحقاق جديد",
        });
        await completeIdempotency(scope, options.idempotencyKey, 200, payload, tx);
        return { replayed: true, already_closed: true, ...payload };
      }

      const items = await this.repository.getItems(tx, run.id);
      if (items.length === 0) {
        const recomputed = await this.computePeriod(tx, {
          year: Number(run.year),
          month: Number(run.month),
          branchId: run.branch_id,
          departmentId: run.department_id,
        });
        if (recomputed.items.length === 0) {
          throw new PayrollRunError(400, "EMPTY_RUN", "لا يوجد موظفون في هذا المسير؛ احسب المسودة أولًا");
        }
        await this.repository.replaceItems(tx, run.id, recomputed.items);
        await this.repository.updateRunTotals(tx, run.id, recomputed);
        items.push(...recomputed.items);
      }

      const total = round2(items.reduce((sum, item) => sum + Number(item.net_salary || 0), 0));
      if (total <= 0) {
        throw new PayrollRunError(400, "ZERO_NET", "إجمالي صافي المرتبات صفر — لا يمكن إنشاء قيد استحقاق");
      }

      const accrualDate = payrollAccrualDate(Number(run.year), Number(run.month));
      const period = await this.assertPeriodOpen(tx, accrualDate);
      const accounts = await this.resolvePayrollAccounts(tx);
      const reference = await generateNextReference("payroll", tx, accrualDate);
      const periodLabel = `${pad2(Number(run.month))}/${run.year}`;

      const entry = await this.accountRepository.createJournalEntry(
        {
          date: accrualDate,
          description: `قيد استحقاق مرتبات وأجور ${periodLabel} — مسير ${run.run_number || run.id}`,
          reference,
          source_type: "payroll_accrual",
          source_id: run.id,
          status: "posted",
          branch_id: run.branch_id,
          period_id: period?.id ?? null,
          created_by: user?.id ?? null,
          items: [
            {
              account_id: accounts.expenseAccountId,
              debit: total,
              credit: 0,
              notes: `مصروف مرتبات وأجور ${periodLabel} — مسير ${run.run_number || run.id}`,
            },
            {
              account_id: accounts.payableAccountId,
              debit: 0,
              credit: total,
              notes: `مرتبات مستحقة الدفع ${periodLabel} — مسير ${run.run_number || run.id}`,
            },
          ],
        },
        tx,
      );

      await this.repository.markAccrued(tx, run.id, {
        journalEntryId: Number(entry.id),
        reference,
        userId: user?.id ?? null,
      });
      await this.repository.audit(tx, {
        runId: run.id,
        action: "close",
        fromStatus: String(run.status),
        toStatus: "accrued",
        amount: total,
        userId: user?.id ?? null,
        userName: user?.username ?? null,
        details: `قيد استحقاق ${reference} بمبلغ ${total}`,
      });
      await this.repository.logUserAction(
        tx,
        user?.id ?? null,
        "إقفال مسير مرتبات",
        run.id,
        `تم ترحيل قيد استحقاق مرتبات ${periodLabel} بمبلغ ${total} ج.م (${reference}) بدون أي صرف من الخزينة`,
      );

      const updated = await this.repository.findRunById(tx, run.id);
      const payload = this.buildSummary(updated!, items, await this.repository.listPayments(tx, run.id), {
        employeesCount: items.length,
      });
      await completeIdempotency(scope, options.idempotencyKey, 200, payload, tx);
      return payload;
    });
  }

  // ═══════════════════════════════════════
  // صرف المرتبات من الخزينة أو البنك
  // ═══════════════════════════════════════
  async payRun(runId: number, input: PayrollPaymentInput, user: any, options: ServiceOptions = {}): Promise<any> {
    await this.ensureSchema(options.client ?? pool);
    const scope = "payroll.run.pay";

    return this.withTransaction(options.client, async (tx) => {
      const guard = await beginIdempotency(
        scope,
        options.idempotencyKey,
        { runId, ...input },
        user?.id ?? null,
        null,
        null,
        tx,
      );
      if (guard.replay) return { replayed: true, ...(guard.body || {}) };

      const run = await this.repository.findRunByIdForUpdate(tx, runId);
      if (!run) throw new PayrollRunError(404, "RUN_NOT_FOUND", "مسير المرتبات غير موجود");

      const status = String(run.status);
      if (status === "paid") {
        throw new PayrollRunError(409, "ALREADY_PAID", "هذا المسير مصروف بالكامل — لا يمكن صرفه مرة أخرى");
      }
      if (status === "draft" || status === "open") {
        throw new PayrollRunError(
          409,
          "RUN_NOT_ACCRUED",
          "يجب إقفال مسير المرتبات (قيد الاستحقاق) قبل الصرف من الخزينة",
        );
      }

      const totalNet = round2(Number(run.total_net));
      const totalPaid = round2(Number(run.total_paid));
      const remaining = round2(totalNet - totalPaid);
      if (remaining <= 0.004) {
        throw new PayrollRunError(409, "NOTHING_TO_PAY", "لا يوجد مبلغ متبقٍ للصرف في هذا المسير");
      }

      const requested = input.amount === undefined || input.amount === null ? remaining : round2(Number(input.amount));
      if (!Number.isFinite(requested) || requested <= 0) {
        throw new PayrollRunError(400, "INVALID_AMOUNT", "مبلغ الصرف يجب أن يكون أكبر من صفر");
      }
      if (requested - remaining > 0.004) {
        throw new PayrollRunError(
          400,
          "AMOUNT_EXCEEDS_BALANCE",
          `مبلغ الصرف ${requested} أكبر من المتبقي المستحق ${remaining} ج.م`,
        );
      }

      const paymentDate = String(input.paymentDate || new Date().toISOString().slice(0, 10));
      const period = await this.assertPeriodOpen(tx, paymentDate);
      const accounts = await this.resolvePayrollAccounts(tx);

      const treasury = await this.lockTreasuryAccount(tx, input);
      const isBank = String(treasury.type || "").toLowerCase() === "bank" || String(treasury.type || "").toLowerCase() === "intermediate";
      const requestedSource = String(input.paymentSource || "").trim().toLowerCase();
      if (requestedSource === "bank" && !isBank) {
        throw new PayrollRunError(400, "TREASURY_TYPE_MISMATCH", `حساب «${treasury.name}» ليس حساب بنك`);
      }
      if (requestedSource === "cash" && isBank) {
        throw new PayrollRunError(400, "TREASURY_TYPE_MISMATCH", `حساب «${treasury.name}» حساب بنكي؛ اختر طريقة الدفع البنكية`);
      }

      const glAccountId = isBank ? accounts.bankAccountId : accounts.cashAccountId;
      if (!glAccountId) {
        throw new PayrollRunError(
          400,
          "ACCOUNT_CONFIG_MISSING",
          isBank
            ? "حساب البنك غير معرّف في إعدادات الحسابات (مفتاح bank) — اضبط الإعدادات قبل الصرف"
            : "حساب الخزينة/الصندوق غير معرّف في إعدادات الحسابات (مفتاح cash) — اضبط الإعدادات قبل الصرف",
        );
      }

      const balanceBefore = round2(Number(treasury.current_balance) || 0);
      if (balanceBefore < requested && !(await this.allowNegativeTreasuryBalance(tx))) {
        throw new PayrollRunError(
          400,
          "INSUFFICIENT_TREASURY_BALANCE",
          `رصيد «${treasury.name}» غير كافٍ: المتاح ${balanceBefore} ${treasury.currency || "EGP"} والمطلوب ${requested}`,
        );
      }
      const balanceAfter = round2(balanceBefore - requested);

      const periodLabel = `${pad2(Number(run.month))}/${run.year}`;
      const voucherNumber = await generateTreasuryVoucherNumber(tx, "payment");
      const reference = await generateNextReference("treasury", tx, paymentDate);

      const entry = await this.accountRepository.createJournalEntry(
        {
          date: paymentDate,
          description: `صرف مرتبات ${periodLabel} من ${treasury.name} — مسير ${run.run_number || run.id}`,
          reference,
          source_type: "payroll_payment",
          source_id: run.id,
          status: "posted",
          branch_id: run.branch_id,
          period_id: period?.id ?? null,
          created_by: user?.id ?? null,
          items: [
            {
              account_id: accounts.payableAccountId,
              debit: requested,
              credit: 0,
              notes: `سداد مرتبات مستحقة ${periodLabel} — مسير ${run.run_number || run.id}`,
            },
            {
              account_id: glAccountId,
              debit: 0,
              credit: requested,
              notes: `صرف من ${treasury.name} — سند ${voucherNumber}`,
            },
          ],
        },
        tx,
      );

      // سياسة معتمدة: قيد الاستحقاق وقيد الصرف لنفس حركة المرتب، فيُوحَّد تاريخ قيد
      // الاستحقاق على تاريخ الصرف حتى لا يظهر الصرف سابقًا للاستحقاق في اليومية.
      const accrualAlignment = await this.alignAccrualDateWithPayment(tx, run, paymentDate, period, user);

      const createdBy = Number(user?.id);
      const transaction = await tx.query(
        `INSERT INTO treasury_transactions (
           account_id, amount, transaction_type, reference_type, reference_id,
           created_by, approved_by, approved_at, notes, cost_center_id, status,
           voucher_number, voucher_type, payment_method, balance_before, balance_after,
           current_balance_after, branch_id, date, type, reference_number, category, description
         ) VALUES (
           $1, $2, 'cash_out', 'payroll', $3, $4, $4, CURRENT_TIMESTAMP, $5, $6, 'approved',
           $7, 'payment', $8, $9, $10, $10, $11, COALESCE($12::date, CURRENT_DATE),
           'cash_out', $7, 'payroll', $5
         ) RETURNING *`,
        [
          treasury.id,
          -requested,
          run.id,
          Number.isInteger(createdBy) && createdBy > 0 ? createdBy : null,
          input.notes || `صرف مرتبات ${periodLabel} — مسير ${run.run_number || run.id}`,
          null,
          voucherNumber,
          isBank ? "bank" : "cash",
          balanceBefore,
          balanceAfter,
          run.branch_id,
          input.paymentDate || null,
        ],
      );

      const updatedBalance = await tx.query(
        `UPDATE treasury_accounts
            SET current_balance = current_balance - $1
          WHERE id = $2 AND ($3::boolean OR current_balance >= $1)`,
        [requested, treasury.id, await this.allowNegativeTreasuryBalance(tx)],
      );
      if (updatedBalance.rowCount !== 1) {
        throw new PayrollRunError(400, "TREASURY_UPDATE_FAILED", `تعذر تحديث رصيد «${treasury.name}» — أُلغيت المعاملة`);
      }
      if (updatedBalance.rowCount > 0) {
        await tx.query("UPDATE treasury_transactions SET current_balance_after = $2 WHERE id = $1", [
          transaction.rows[0].id,
          balanceAfter,
        ]);
      }

      const payment = await this.repository.insertPayment(tx, {
        runId: run.id,
        amount: requested,
        paymentSource: isBank ? "bank" : "cash",
        treasuryAccountId: treasury.id,
        treasuryTransactionId: transaction.rows[0].id,
        journalEntryId: entry.id,
        voucherNumber,
        paymentDate,
        referenceNumber: input.referenceNumber ?? null,
        paymentMethod: input.paymentMethod ?? (isBank ? "bank" : "cash"),
        notes: input.notes ?? null,
        idempotencyKey: options.idempotencyKey ?? null,
        createdBy: Number.isInteger(createdBy) && createdBy > 0 ? createdBy : null,
      });

      const newPaid = round2(totalPaid + requested);
      const nextStatus: PayrollRunStatus = newPaid + 0.004 >= totalNet ? "paid" : "partially_paid";
      await this.repository.applyPayment(tx, run.id, requested, nextStatus);
      await this.repository.audit(tx, {
        runId: run.id,
        action: "pay",
        fromStatus: status,
        toStatus: nextStatus,
        amount: requested,
        userId: user?.id ?? null,
        userName: user?.username ?? null,
        details: `سند صرف ${voucherNumber} من ${treasury.name} — قيد ${reference}`,
      });
      await this.repository.logUserAction(
        tx,
        user?.id ?? null,
        "صرف مسير مرتبات",
        run.id,
        `صرف ${requested} ج.م من ${treasury.name} مقابل مسير مرتبات ${periodLabel} — سند ${voucherNumber} وقيد ${reference}`,
      );

      const updated = await this.repository.findRunById(tx, run.id);
      const items = await this.repository.getItems(tx, run.id);
      const payload = {
        ...this.buildSummary(updated!, items, await this.repository.listPayments(tx, run.id), {
          employeesCount: items.length,
        }),
        accrual_alignment: accrualAlignment,
        payment: {
          id: payment.id,
          amount: requested,
          voucher_number: voucherNumber,
          journal_entry_id: entry.id,
          journal_entry_reference: reference,
          treasury_account_id: treasury.id,
          treasury_account_name: treasury.name,
          treasury_transaction_id: transaction.rows[0].id,
          payment_date: paymentDate,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
        },
      };
      await completeIdempotency(scope, options.idempotencyKey, 200, payload, tx);
      return payload;
    });
  }

  /**
   * توحيد تاريخ قيد الاستحقاق مع تاريخ الصرف (سياسة معتمدة).
   * القيدان يمثلان نفس حركة المرتب، فاختلاف تاريخيهما يجعل الصرف يظهر قبل
   * الاستحقاق ويترك حساب «مرتبات مستحقة الدفع» مدينًا مؤقتًا في اليومية.
   * لا يُعدَّل شيء إن لم تكن فترة تاريخ الصرف مفتوحة/موجودة أو لم يكن هناك
   * قيد استحقاق مرحّل؛ في هذه الحالات يُبلَّغ السبب للمستخدم بلا فشل للصرف.
   */
  private async alignAccrualDateWithPayment(
    db: any,
    run: PayrollRunRecord,
    paymentDate: string,
    period: any,
    user: any,
  ): Promise<{ applied: boolean; from: string | null; to: string; reason?: string }> {
    const skipped = (reason: string, from: string | null = null) => ({
      applied: false,
      from,
      to: paymentDate,
      reason,
    });

    if (!run.accrual_journal_entry_id) return skipped("NO_ACCRUAL");
    if (!period?.id) return skipped("PAYMENT_PERIOD_NOT_OPEN");

    const result = await db.query(
      `SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date, status, period_id
         FROM journal_entries
        WHERE id = $1 AND source_type = 'payroll_accrual'
        FOR UPDATE`,
      [run.accrual_journal_entry_id],
    );
    const accrual = result.rows[0];
    if (!accrual) return skipped("ACCRUAL_NOT_FOUND");
    if (String(accrual.status) === "canceled") return skipped("ACCRUAL_CANCELED", accrual.date);
    if (String(accrual.date) === paymentDate) {
      return { applied: true, from: accrual.date, to: paymentDate };
    }

    await db.query(
      "UPDATE journal_entries SET date = $1::timestamp, period_id = $2 WHERE id = $3",
      [paymentDate, period.id, run.accrual_journal_entry_id],
    );

    const operatorId = Number(user?.id);
    await db.query(
      `INSERT INTO gl_audit_logs (table_name, record_id, action, old_values, new_values, user_id)
       VALUES ('journal_entries', $1, 'align_accrual_date', $2, $3, $4)`,
      [
        run.accrual_journal_entry_id,
        JSON.stringify({ date: accrual.date, period_id: accrual.period_id ?? null }),
        JSON.stringify({ date: paymentDate, period_id: period.id, run_id: run.id }),
        Number.isInteger(operatorId) && operatorId > 0 ? operatorId : null,
      ],
    );
    await this.repository.audit(db, {
      runId: run.id,
      action: "align_accrual_date",
      fromStatus: String(run.status),
      toStatus: String(run.status),
      userId: Number.isInteger(operatorId) && operatorId > 0 ? operatorId : null,
      userName: user?.username ?? null,
      details: `توحيد تاريخ قيد الاستحقاق مع تاريخ الصرف: ${accrual.date} → ${paymentDate}`,
    });
    return { applied: true, from: accrual.date, to: paymentDate };
  }

  private async allowNegativeTreasuryBalance(db: any): Promise<boolean> {
    try {
      const setting = await db.query("SELECT value FROM treasury_settings WHERE key = 'allow_negative_balance'");
      if (setting.rows.length === 0) return true;
      return setting.rows[setting.rows.length - 1].value !== "false";
    } catch {
      return true;
    }
  }

  private async lockTreasuryAccount(
    db: any,
    input: PayrollPaymentInput,
  ): Promise<any> {
    let result;
    if (input.treasuryAccountId) {
      result = await db.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [input.treasuryAccountId]);
    } else {
      const source = String(input.paymentSource || "cash").toLowerCase();
      const types = source === "bank" ? ["bank", "intermediate"] : ["cash", "petty_cash"];
      result = await db.query(
        `SELECT * FROM treasury_accounts
          WHERE LOWER(COALESCE(type, '')) = ANY($1::text[])
          ORDER BY is_main DESC NULLS LAST, id
          LIMIT 1 FOR UPDATE`,
        [types],
      );
    }
    const account = result.rows[0];
    if (!account) {
      throw new PayrollRunError(
        400,
        "TREASURY_ACCOUNT_NOT_FOUND",
        input.treasuryAccountId
          ? "حساب الخزينة/البنك المحدد غير موجود"
          : "لا يوجد حساب خزينة أو بنك نشط لطريقة الدفع المحددة",
      );
    }
    if (account.status && String(account.status).toLowerCase() !== "active") {
      throw new PayrollRunError(400, "TREASURY_ACCOUNT_INACTIVE", `حساب «${account.name}» غير نشط`);
    }
    return account;
  }

  // ═══════════════════════════════════════
  // العكس المحاسبي
  // ═══════════════════════════════════════
  async reverseAccrual(runId: number, user: any, options: ServiceOptions = {}): Promise<any> {
    await this.ensureSchema(options.client ?? pool);
    return this.withTransaction(options.client, async (tx) => {
      const run = await this.repository.findRunByIdForUpdate(tx, runId);
      if (!run) throw new PayrollRunError(404, "RUN_NOT_FOUND", "مسير المرتبات غير موجود");
      if (!run.accrual_journal_entry_id) {
        throw new PayrollRunError(409, "NO_ACCRUAL", "لا يوجد قيد استحقاق مرحّل لعكسه");
      }
      if (round2(Number(run.total_paid)) > 0.004) {
        throw new PayrollRunError(409, "PAYMENTS_EXIST", "لا يمكن عكس الاستحقاق قبل عكس سندات الصرف");
      }

      const reversal = await this.createReversalEntry(tx, Number(run.accrual_journal_entry_id), user, {
        sourceType: "payroll_accrual_reversal",
        sourceId: run.id,
        description: `عكس قيد استحقاق مرتبات ${pad2(Number(run.month))}/${run.year} — مسير ${run.run_number || run.id}`,
      });
      await this.repository.markAccrualReversed(tx, run.id, user?.id ?? null);
      await this.repository.audit(tx, {
        runId: run.id,
        action: "reverse_accrual",
        fromStatus: String(run.status),
        toStatus: "draft",
        amount: Number(run.total_net),
        userId: user?.id ?? null,
        userName: user?.username ?? null,
        details: `قيد عكسي ${reversal.reference}`,
      });

      const updated = await this.repository.findRunById(tx, run.id);
      const items = await this.repository.getItems(tx, run.id);
      return {
        ...this.buildSummary(updated!, items, await this.repository.listPayments(tx, run.id), {
          employeesCount: items.length,
        }),
        reversal_journal_entry_id: reversal.id,
        reversal_reference: reversal.reference,
      };
    });
  }

  async reversePayment(runId: number, paymentId: number, user: any, options: ServiceOptions = {}): Promise<any> {
    await this.ensureSchema(options.client ?? pool);
    return this.withTransaction(options.client, async (tx) => {
      const run = await this.repository.findRunByIdForUpdate(tx, runId);
      if (!run) throw new PayrollRunError(404, "RUN_NOT_FOUND", "مسير المرتبات غير موجود");
      const payment = await this.repository.findPaymentById(tx, paymentId, true);
      if (!payment || Number(payment.run_id) !== Number(run.id)) {
        throw new PayrollRunError(404, "PAYMENT_NOT_FOUND", "سند الصرف غير موجود على هذا المسير");
      }
      if (String(payment.status) === "reversed") {
        throw new PayrollRunError(409, "ALREADY_REVERSED", "سند الصرف معكوس بالفعل");
      }

      const amount = round2(Number(payment.amount));
      const reversal = await this.createReversalEntry(tx, Number(payment.journal_entry_id), user, {
        sourceType: "payroll_payment_reversal",
        sourceId: run.id,
        description: `عكس صرف مرتبات — سند ${payment.voucher_number || payment.id}`,
      });

      let reversalTransactionId: number | null = null;
      if (payment.treasury_account_id) {
        const treasury = (
          await tx.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [payment.treasury_account_id])
        ).rows[0];
        if (treasury) {
          const balanceBefore = round2(Number(treasury.current_balance) || 0);
          const balanceAfter = round2(balanceBefore + amount);
          const reversalTransaction = await tx.query(
            `INSERT INTO treasury_transactions (
               account_id, amount, transaction_type, reference_type, reference_id,
               created_by, approved_by, approved_at, notes, cost_center_id, status,
               voucher_number, voucher_type, payment_method, balance_before, balance_after,
               current_balance_after, branch_id, date, type, reference_number, category, description
             ) VALUES (
               $1, $2, 'cash_in', 'payroll', $3, $4, $4, CURRENT_TIMESTAMP, $5, NULL, 'approved',
               $6, 'receipt', $7, $8, $9, $9, $10, CURRENT_DATE, 'cash_in', $6, 'payroll_reversal', $5
             ) RETURNING *`,
            [
              treasury.id,
              amount,
              run.id,
              Number.isInteger(Number(user?.id)) && Number(user?.id) > 0 ? Number(user.id) : null,
              `عكس صرف مرتبات — سند ${payment.voucher_number || payment.id}`,
              `REV-${payment.voucher_number || payment.id}`,
              String(payment.payment_source || "cash"),
              balanceBefore,
              balanceAfter,
              run.branch_id,
            ],
          );
          reversalTransactionId = reversalTransaction.rows[0].id;
          await tx.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [
            amount,
            treasury.id,
          ]);
        }
      }

      await this.repository.markPaymentReversed(tx, paymentId, {
        reversalJournalEntryId: reversal.id,
        reversalTransactionId,
        userId: user?.id ?? null,
      });

      const paidRow = await tx.query(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM payroll_payments WHERE run_id = $1 AND status = 'posted'`,
        [run.id],
      );
      const totalPaid = round2(Number(paidRow.rows[0]?.total) || 0);
      const totalNet = round2(Number(run.total_net));
      const nextStatus: PayrollRunStatus =
        totalPaid <= 0.004 ? "accrued" : totalPaid + 0.004 >= totalNet ? "paid" : "partially_paid";
      await tx.query(
        `UPDATE payroll_months
            SET total_paid = $2::numeric, status = $3::text,
                paid_at = CASE WHEN $3::text = 'paid' THEN paid_at ELSE NULL END,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1::int`,
        [run.id, totalPaid, nextStatus],
      );
      await this.repository.audit(tx, {
        runId: run.id,
        action: "reverse_payment",
        fromStatus: String(run.status),
        toStatus: nextStatus,
        amount,
        userId: user?.id ?? null,
        userName: user?.username ?? null,
        details: `عكس سند ${payment.voucher_number || payment.id} — قيد عكسي ${reversal.reference}`,
      });
      await this.repository.logUserAction(
        tx,
        user?.id ?? null,
        "عكس صرف مسير مرتبات",
        run.id,
        `تم عكس سند صرف بمبلغ ${amount} ج.م وإرجاع الرصيد للخزينة — قيد عكسي ${reversal.reference}`,
      );

      const updated = await this.repository.findRunById(tx, run.id);
      const items = await this.repository.getItems(tx, run.id);
      return {
        ...this.buildSummary(updated!, items, await this.repository.listPayments(tx, run.id), {
          employeesCount: items.length,
        }),
        reversal_journal_entry_id: reversal.id,
        reversal_reference: reversal.reference,
      };
    });
  }

  /** قيد عكسي متوازن (تبديل المدين بالدائن) — لا حذف للحركات المرحّلة. */
  private async createReversalEntry(
    db: any,
    originalEntryId: number,
    user: any,
    meta: { sourceType: string; sourceId: number; description: string },
  ): Promise<any> {
    const original = (
      await db.query("SELECT * FROM journal_entries WHERE id = $1 LIMIT 1", [originalEntryId])
    ).rows[0];
    if (!original) {
      throw new PayrollRunError(409, "ENTRY_NOT_FOUND", "القيد الأصلي غير موجود لعكسه");
    }
    const originalItems = (
      await db.query("SELECT account_id, debit, credit, notes, cost_center_id FROM journal_items WHERE journal_entry_id = $1 ORDER BY id", [
        originalEntryId,
      ])
    ).rows;
    if (originalItems.length === 0) {
      throw new PayrollRunError(409, "ENTRY_EMPTY", "القيد الأصلي بلا بنود — تعذر العكس");
    }

    const reversed = await this.accountRepository.createJournalEntry(
      {
        date: original.date || undefined,
        description: meta.description,
        reference: `REV-${String(original.reference || original.id)}`,
        source_type: meta.sourceType,
        source_id: meta.sourceId,
        status: "posted",
        branch_id: original.branch_id ?? null,
        period_id: original.period_id ?? null,
        created_by: user?.id ?? null,
        items: originalItems.map((item: any) => ({
          account_id: item.account_id,
          debit: Number(item.credit) || 0,
          credit: Number(item.debit) || 0,
          notes: `عكس: ${item.notes || ""}`.trim(),
          cost_center_id: item.cost_center_id ?? null,
        })),
      },
      db,
    );
    return reversed;
  }

  // ═══════════════════════════════════════
  // قراءة الحالة
  // ═══════════════════════════════════════
  async getRunStatus(runId: number, db: any = pool): Promise<any> {
    await this.ensureSchema(db);
    const run = await this.repository.findRunById(db, runId);
    if (!run) throw new PayrollRunError(404, "RUN_NOT_FOUND", "مسير المرتبات غير موجود");
    const items = await this.repository.getItems(db, run.id);
    const payments = await this.repository.listPayments(db, run.id);
    const names = await this.treasuryNames(db, payments);
    const accrualDate = await this.findAccrualDate(db, run);
    return this.buildSummary(run, items, payments, { employeesCount: items.length, treasuryNames: names, accrualDate });
  }

  async getPeriodStatus(input: PayrollPeriodInput, db: any = pool): Promise<any> {
    await this.ensureSchema(db);
    const run = await this.repository.findRunByPeriod(db, input);
    if (!run) {
      return {
        exists: false,
        year: input.year,
        month: input.month,
        period: `${input.year}-${pad2(input.month)}`,
        status: "draft",
        status_label: RUN_STATUS_LABELS.draft,
        employees_count: 0,
        total_net: 0,
        total_paid: 0,
        remaining: 0,
        can_close: false,
        can_pay: false,
      };
    }
    const summary = await this.getRunStatus(run.id, db);
    return { exists: true, ...summary };
  }

  async listRuns(query: { year?: number; month?: number; branchId?: number | null; departmentId?: number | null }, db: any = pool): Promise<any[]> {
    await this.ensureSchema(db);
    const runs = await this.repository.listRuns(db, query);
    return runs.map((run) =>
      this.buildSummary(run, [], [], { employeesCount: Number((run as any).employees_count) || 0, partial: true }),
    );
  }

  /**
   * تقرير صرف المرتبات الشهري — صف لكل موظف مع المستحق له والمصروف فعليًا.
   *
   * المصدر: مسيرات الشهر (payroll_months + payroll_run_items) وسندات الصرف
   * الفعلية (payroll_payments). كل أرقام «المستحق» تأتي من بنود المسير، وأرقام
   * «المصروف» من السندات غير الملغاة فقط، وتُوزَّع على الموظفين بنسبة صافي كل
   * موظف من المسير (نفس السياسة الموثقة في allocatePaidAcrossItems).
   *
   * عند تمرير treasuryAccountId تُحتسب السندات الصادرة من هذه الخزينة فقط،
   * وتُستبعد المسيرات التي لم يُصرف منها شيء على هذه الخزينة.
   */
  async getMonthlyDisbursementReport(
    query: {
      year: number;
      month: number;
      branchId?: number | null;
      departmentId?: number | null;
      treasuryAccountId?: number | null;
    },
    db: any = pool,
  ): Promise<any> {
    await this.ensureSchema(db);
    const year = Number(query.year);
    const month = Number(query.month);
    if (!Number.isInteger(year) || year < 2000 || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new PayrollRunError(400, "INVALID_PERIOD", "سنة أو شهر تقرير المرتبات غير صحيح");
    }
    const treasuryAccountId =
      Number(query.treasuryAccountId) > 0 ? Number(query.treasuryAccountId) : null;
    const period = `${year}-${pad2(month)}`;
    const periodLabel = `${pad2(month)}/${year}`;

    const runs = await this.repository.listRuns(db, {
      year,
      month,
      branchId: query.branchId ?? null,
      departmentId: query.departmentId ?? null,
    });

    const rows: any[] = [];
    const runSummaries: any[] = [];
    const vouchers: any[] = [];
    const treasuryNameMap: Record<number, string> = {};
    const totals = {
      employees_count: 0,
      total_basic: 0,
      total_additions: 0,
      total_deductions: 0,
      total_net: 0,
      total_paid: 0,
      remaining: 0,
    };

    for (const run of runs) {
      const items = await this.repository.getItems(db, run.id);
      const payments = (await this.repository.listPayments(db, run.id)).filter(
        (payment: any) => String(payment.status || "posted") !== "reversed" && !payment.reversal_journal_entry_id,
      );
      const scopedPayments = treasuryAccountId
        ? payments.filter((payment: any) => Number(payment.treasury_account_id) === treasuryAccountId)
        : payments;

      // خزينة الصرف المختارة لم تصرف شيئًا لهذا المسير ⇒ لا صفوف للموظفين.
      if (treasuryAccountId && scopedPayments.length === 0) continue;

      Object.assign(treasuryNameMap, await this.treasuryNames(db, scopedPayments));

      const scopedPaid = round2(scopedPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
      const totalNet = round2(items.reduce((sum, item) => sum + Number(item.net_salary || 0), 0));
      const allocations = allocatePaidAcrossItems(items, scopedPaid);
      const runStatus = String(run.status || "draft");
      const runVouchers = scopedPayments
        .map((payment: any) => payment.voucher_number || payment.transaction_voucher || null)
        .filter((voucher: any) => !!voucher);

      const runRows = items.map((item, index) => {
        const net = round2(Number(item.net_salary || 0));
        const paid = allocations[index] || 0;
        const state = payrollItemPaymentState(net, paid, runStatus);
        totals.employees_count += 1;
        totals.total_basic = round2(totals.total_basic + Number(item.basic_salary || 0));
        totals.total_additions = round2(totals.total_additions + Number(item.additions || 0));
        totals.total_deductions = round2(totals.total_deductions + Number(item.deductions || 0));
        totals.total_net = round2(totals.total_net + net);
        totals.total_paid = round2(totals.total_paid + paid);
        return {
          run_id: run.id,
          run_number: run.run_number,
          period,
          period_label: periodLabel,
          run_status: runStatus,
          run_status_label: RUN_STATUS_LABELS[runStatus] || runStatus,
          employee_id: item.employee_id,
          employee_code: item.employee_code,
          employee_name: item.employee_name,
          basic_salary: round2(Number(item.basic_salary || 0)),
          additions: round2(Number(item.additions || 0)),
          deductions: round2(Number(item.deductions || 0)),
          net_salary: net,
          paid_amount: paid,
          payment_state: state,
          payment_state_label: ITEM_PAYMENT_STATE_LABELS[state],
          voucher_numbers: runVouchers,
          payment_dates: scopedPayments.map((payment: any) => payment.payment_date).filter((value: any) => !!value),
        };
      });
      rows.push(...runRows);

      for (const payment of scopedPayments) {
        const accountId = Number(payment.treasury_account_id) || 0;
        vouchers.push({
          run_id: run.id,
          run_number: run.run_number,
          voucher_number: payment.voucher_number || payment.transaction_voucher || null,
          amount: round2(Number(payment.amount || 0)),
          payment_date: payment.payment_date,
          payment_source: payment.payment_source,
          payment_method: payment.payment_method,
          treasury_account_id: payment.treasury_account_id ?? null,
          treasury_account_name: treasuryNameMap[accountId] || null,
          reference_number: payment.reference_number ?? null,
          journal_entry_id: payment.journal_entry_id ?? null,
          treasury_transaction_id: payment.treasury_transaction_id ?? null,
        });
      }

      runSummaries.push({
        run_id: run.id,
        run_number: run.run_number,
        status: runStatus,
        status_label: RUN_STATUS_LABELS[runStatus] || runStatus,
        employees_count: items.length,
        total_net: totalNet,
        total_paid: round2(Number(run.total_paid || 0)),
        paid_from_scope: scopedPaid,
        remaining: round2(Math.max(0, totalNet - Number(run.total_paid || 0))),
        scope_remaining: round2(Math.max(0, totalNet - scopedPaid)),
        paid_at: run.paid_at ?? null,
        voucher_numbers: runVouchers,
      });
    }

    totals.remaining = round2(Math.max(0, totals.total_net - totals.total_paid));
    vouchers.sort((a, b) => String(a.payment_date || "").localeCompare(String(b.payment_date || "")));

    return {
      year,
      month,
      period,
      period_label: periodLabel,
      treasury_account_id: treasuryAccountId,
      runs: runSummaries,
      rows,
      vouchers,
      totals,
    };
  }

  /** يمنع تعديل بنود مرتبات (سلف/مكافآت/خصومات) في شهر مقفل أو مُعتمد. */
  async assertMonthEditable(db: any, date: string): Promise<void> {
    const [yearText, monthText] = String(date || "").split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    if (!Number.isInteger(year) || !Number.isInteger(month)) return;
    try {
      const result = await db.query(
        "SELECT id, status, run_number FROM payroll_months WHERE year = $1 AND month = $2",
        [year, month],
      );
      for (const row of result.rows) {
        const status = String(row.status || "");
        if (status && status !== "draft" && status !== "open") {
          throw new PayrollRunError(
            409,
            "PAYROLL_RUN_CLOSED",
            `مسير مرتبات ${pad2(month)}/${year} (${row.run_number || row.id}) حالته «${RUN_STATUS_LABELS[status] || status}» — لا يمكن تعديل بنود المرتبات. استخدم إعادة الفتح أو العكس المحاسبي المعتمد.`,
          );
        }
      }
    } catch (error) {
      if (error instanceof PayrollRunError) throw error;
      /* الجدول قد لا يكون موجودًا بعد — لا نمنع العمل */
    }
  }

  /**
   * تاريخ قيد الاستحقاق الفعلي كما هو مرحّل في اليومية. يختلف عن آخر يوم في
   * الشهر بعد توحيد تاريخه مع تاريخ الصرف، فالواجهة تعرض المرحّل لا المتوقّع.
   */
  private async findAccrualDate(db: any, run: PayrollRunRecord): Promise<string | null> {
    if (!run.accrual_journal_entry_id) return null;
    try {
      const result = await db.query(
        "SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date FROM journal_entries WHERE id = $1",
        [run.accrual_journal_entry_id],
      );
      return result.rows[0]?.date ?? null;
    } catch {
      return null;
    }
  }

  private async treasuryNames(db: any, payments: any[]): Promise<Record<number, string>> {
    const ids = Array.from(
      new Set(payments.map((payment) => Number(payment.treasury_account_id)).filter((id) => Number.isInteger(id) && id > 0)),
    );
    if (ids.length === 0) return {};
    try {
      const result = await db.query("SELECT id, name FROM treasury_accounts WHERE id = ANY($1::int[])", [ids]);
      const map: Record<number, string> = {};
      for (const row of result.rows) map[Number(row.id)] = row.name;
      return map;
    } catch {
      return {};
    }
  }

  private buildSummary(
    run: PayrollRunRecord,
    items: PayrollRunItemRecord[],
    payments: any[],
    extra: { employeesCount?: number; partial?: boolean; note?: string; treasuryNames?: Record<number, string>; totalNetOverride?: number; accrualDate?: string | null } = {},
  ): any {
    const status = String(run.status || "draft");
    const totalNet = round2(extra.totalNetOverride ?? Number(run.total_net ?? 0));
    const totalPaid = round2(Number(run.total_paid ?? 0));
    const remaining = round2(Math.max(0, totalNet - totalPaid));
    const treasuryNames = extra.treasuryNames || {};
    // توزيع المبلغ المصروف على بنود المسير بنفس سياسة تقرير الصرف الشهري،
    // حتى يعرض كشف الموظفين داخل سند الصرف نصيب كل موظف من المبلغ المصروف
    // لا صافي المستحق فقط.
    const validPayments = (payments || []).filter(
      (payment: any) => String(payment.status || "posted") !== "reversed" && !payment.reversal_journal_entry_id,
    );
    const paidForItems = round2(validPayments.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0));
    const itemAllocations = items.length ? allocatePaidAcrossItems(items, paidForItems) : [];

    return {
      id: run.id,
      run_number: run.run_number,
      year: Number(run.year),
      month: Number(run.month),
      period: `${run.year}-${pad2(Number(run.month))}`,
      // تاريخ قيد الاستحقاق المحاسبي — مصدر واحد للحقيقة تعرضه الواجهة
      // بدل أن تعيد حساب آخر يوم في الشهر بنفسها.
      // التاريخ الفعلي لقيد الاستحقاق المرحّل إن وُجد (قد يكون تاريخ الصرف بعد
      // التوحيد)، وإلا تاريخ استحقاق الشهر المتوقع.
      accrual_date: extra.accrualDate || payrollAccrualDate(Number(run.year), Number(run.month)),
      branch_id: run.branch_id ?? null,
      department_id: run.department_id ?? null,
      status,
      status_label: RUN_STATUS_LABELS[status] || status,
      total_net: totalNet,
      total_paid: totalPaid,
      remaining,
      total_additions: round2(Number(run.total_additions ?? 0)),
      total_deductions: round2(Number(run.total_deductions ?? 0)),
      employees_count: extra.employeesCount ?? items.length,
      accrual_journal_entry_id: run.accrual_journal_entry_id ?? null,
      accrual_reference: run.accrual_reference ?? null,
      closed_at: (run as any).closed_at ?? null,
      paid_at: run.paid_at ?? null,
      notes: run.notes ?? null,
      items: extra.partial ? undefined : items.map((item, index) => {
        const net = round2(Number(item.net_salary || 0));
        const paid = itemAllocations[index] || 0;
        return {
          employee_id: item.employee_id,
          employee_code: item.employee_code,
          employee_name: item.employee_name,
          basic_salary: round2(Number(item.basic_salary || 0)),
          additions: round2(Number(item.additions || 0)),
          deductions: round2(Number(item.deductions || 0)),
          net_salary: net,
          paid_amount: paid,
          remaining_amount: round2(Math.max(0, net - paid)),
        };
      }),
      payments: extra.partial
        ? undefined
        : payments.map((payment) => ({
            id: payment.id,
            amount: round2(Number(payment.amount || 0)),
            status: payment.status,
            payment_source: payment.payment_source,
            treasury_account_id: payment.treasury_account_id,
            treasury_account_name: treasuryNames[Number(payment.treasury_account_id)] || null,
            treasury_transaction_id: payment.treasury_transaction_id,
            voucher_number: payment.voucher_number || payment.transaction_voucher || null,
            journal_entry_id: payment.journal_entry_id,
            payment_date: payment.payment_date,
            reference_number: payment.reference_number,
            reversal_journal_entry_id: payment.reversal_journal_entry_id ?? null,
          })),
      can_close: ["draft", "open"].includes(status) && totalNet > 0,
      can_pay: ["accrued", "partially_paid"].includes(status) && remaining > 0.004,
      can_reverse_accrual: status === "accrued" && totalPaid <= 0.004 && !!run.accrual_journal_entry_id,
      ...(extra.note ? { note: extra.note } : {}),
    };
  }
}

export const payrollRunService = new PayrollRunService();
