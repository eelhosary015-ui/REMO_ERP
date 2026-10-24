import { describe, expect, it } from "vitest";
import {
  allocatePaidAcrossItems,
  payrollItemPaymentState,
  payrollRunService,
} from "../../modules/payroll/services/payroll-run.service.js";
import { ensureUser, uniqueTag, withRollback } from "../helpers/testDb.js";

/**
 * اختبارات قبول مسير المرتبات — HR → الخزينة → الحسابات العامة
 * ────────────────────────────────────────────────────────────
 * الاختبار الأول:  إقفال المسير يُنشئ قيد استحقاق بلا أي حركة خزينة.
 * الثاني:        الصرف يخفض الخزينة ويسدد الالتزام دون تسجيل مصروف جديد.
 * الثالث:        منع تكرار الصرف.
 * الرابع:        منع تكرار قيد الاستحقاق.
 * الخامس:        الفشل أثناء الصرف ⇒ تراجع كامل (بلا سند ولا قيد ولا حركة).
 * السادس:        مراجعة توازن القيود والأرصدة.
 * إضافة:         الصرف الجزئي والعكس المحاسبي.
 */

const YEAR = 2026;
const MONTH = 7; // فترة مالية مفتوحة في قاعدة الاختبار

const TEST_USER = { id: 1, username: "payroll-acceptance-tester", role: "admin" };

async function accountIdByKey(client: any, key: string): Promise<number> {
  const result = await client.query("SELECT account_id FROM account_config WHERE key = $1", [key]);
  if (!result.rows[0]) throw new Error(`account_config key ${key} is missing in the test database`);
  return Number(result.rows[0].account_id);
}

async function balanceOf(client: any, accountId: number): Promise<number> {
  const result = await client.query("SELECT COALESCE(balance, 0) AS balance FROM accounts WHERE id = $1", [accountId]);
  return Number(result.rows[0]?.balance ?? 0);
}

async function treasuryBalance(client: any, treasuryId: number): Promise<number> {
  const result = await client.query("SELECT COALESCE(current_balance, 0) AS balance FROM treasury_accounts WHERE id = $1", [treasuryId]);
  return Number(result.rows[0]?.balance ?? 0);
}

async function journalLines(client: any, entryId: number): Promise<any[]> {
  return (
    await client.query("SELECT account_id, debit, credit FROM journal_items WHERE journal_entry_id = $1 ORDER BY id", [entryId])
  ).rows;
}

interface Fixture {
  period: { year: number; month: number; branchId: null; departmentId: number };
  treasuryId: number;
  employeeId: number;
}

/**
 * ينشئ موظف اختبار «محمد أحمد — اختبار / EMP-TEST-001» بصافي 6,000 ج.م
 * (معفى من الجزاءات ⇒ يستحق أساسي الشهر كاملًا، بلا استقطاعات أو إضافات)
 * وقسمًا وخزينة مستقلين لعزل الاختبار عن أي بيانات أخرى.
 */
async function createFixture(client: any, tag: string, treasuryOpening = 10_000): Promise<Fixture> {
  await ensureUser(client);

  const department = await client.query("INSERT INTO hr_departments (name) VALUES ($1) RETURNING id", [`${tag} dept`]);
  const departmentId = Number(department.rows[0].id);

  const employee = await client.query(
    `INSERT INTO employees
       (name, employee_code, basic_salary, work_days, exempt_from_penalties, status, has_insurance, has_meal_allowance, department_id)
     VALUES ($1, $2, $3, 30, 1, 'active', 0, 0, $4)
     RETURNING id`,
    [`محمد أحمد — اختبار ${tag}`, "EMP-TEST-001", 6000, departmentId],
  );

  const treasury = await client.query(
    `INSERT INTO treasury_accounts (name, type, currency, current_balance, opening_balance, status)
     VALUES ($1, 'cash', 'EGP', $2, $2, 'active')
     RETURNING id`,
    [`${tag} treasury`, treasuryOpening],
  );

  return {
    period: { year: YEAR, month: MONTH, branchId: null, departmentId },
    treasuryId: Number(treasury.rows[0].id),
    employeeId: Number(employee.rows[0].id),
  };
}

/** موظف إضافي (معفى من الجزاءات) في نفس قسم الاختبار لاختبار التوزيع على أكثر من موظف. */
async function addEmployee(
  client: any,
  departmentId: number,
  name: string,
  code: string,
  basic: number,
): Promise<number> {
  const result = await client.query(
    `INSERT INTO employees
       (name, employee_code, basic_salary, work_days, exempt_from_penalties, status, has_insurance, has_meal_allowance, department_id)
     VALUES ($1, $2, $3, 30, 1, 'active', 0, 0, $4)
     RETURNING id`,
    [name, code, basic, departmentId],
  );
  return Number(result.rows[0].id);
}

async function createTreasury(client: any, name: string, opening = 10_000): Promise<number> {
  const result = await client.query(
    `INSERT INTO treasury_accounts (name, type, currency, current_balance, opening_balance, status)
     VALUES ($1, 'cash', 'EGP', $2, $2, 'active')
     RETURNING id`,
    [name, opening],
  );
  return Number(result.rows[0].id);
}

describe("ربط المرتبات بالخزينة والحسابات العامة", () => {
  it("الاختبار الأول — إقفال المسير ينشئ قيد استحقاق فقط ولا يمسّ الخزينة", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const expenseAccountId = await accountIdByKey(client, "payroll_expense");

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      expect(draft.status).toBe("draft");
      expect(draft.employees_count).toBe(1);
      expect(draft.total_net).toBe(6000);

      const expenseBefore = await balanceOf(client, expenseAccountId);
      const treasuryBefore = await treasuryBalance(client, fx.treasuryId);

      const closed = await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      expect(closed.status).toBe("accrued");
      expect(closed.status_label).toContain("مستحق");
      expect(closed.accrual_journal_entry_id).toBeTruthy();
      expect(closed.accrual_reference).toMatch(/^PR-/);

      const lines = await journalLines(client, closed.accrual_journal_entry_id);
      expect(lines).toHaveLength(2);
      const expenseLine = lines.find((line) => Number(line.account_id) === expenseAccountId);
      const payableLine = lines.find((line) => Number(line.account_id) !== expenseAccountId);
      expect(Number(expenseLine.debit)).toBe(6000);
      expect(Number(expenseLine.credit)).toBe(0);
      expect(Number(payableLine.credit)).toBe(6000);
      expect(Number(payableLine.debit)).toBe(0);
      expect(lines.reduce((sum, line) => sum + Number(line.debit), 0)).toBe(
        lines.reduce((sum, line) => sum + Number(line.credit), 0),
      );

      // حساب الالتزام مُشتق من الإعدادات/دليل الحسابات لا من رقم مكتوب يدويًا
      const payableAccount = await client.query("SELECT code, type FROM accounts WHERE id = $1", [payableLine.account_id]);
      expect(payableAccount.rows[0].type).toBe("liability");

      // المصروف ارتفع 6,000 والخزينة لم تتغير إطلاقًا
      expect(await balanceOf(client, expenseAccountId)).toBe(expenseBefore + 6000);
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(treasuryBefore);

      const movements = await client.query(
        "SELECT COUNT(*)::int AS n FROM treasury_transactions WHERE reference_type = 'payroll' AND reference_id = $1",
        [draft.id],
      );
      expect(movements.rows[0].n).toBe(0);

      const payments = await client.query("SELECT COUNT(*)::int AS n FROM payroll_payments WHERE run_id = $1", [draft.id]);
      expect(payments.rows[0].n).toBe(0);
    });
  });

  it("الاختبار الثاني — الصرف يخفض الخزينة 6,000 ويسدد الالتزام بلا مصروف جديد", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag, 10_000);
      const expenseAccountId = await accountIdByKey(client, "payroll_expense");
      const cashAccountId = await accountIdByKey(client, "cash");

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      const closed = await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      const payableAccountId = (await journalLines(client, closed.accrual_journal_entry_id)).find(
        (line) => Number(line.account_id) !== expenseAccountId,
      ).account_id;

      const expenseAfterAccrual = await balanceOf(client, expenseAccountId);
      const payableAfterAccrual = await balanceOf(client, Number(payableAccountId));
      const cashBefore = await balanceOf(client, cashAccountId);

      const paid = await payrollRunService.payRun(
        draft.id,
        { paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );

      expect(paid.status).toBe("paid");
      expect(paid.total_net).toBe(6000);
      expect(paid.total_paid).toBe(6000);
      expect(paid.remaining).toBe(0);
      expect(paid.payment.voucher_number).toMatch(/^PAY-\d{4}-\d{4}$/);
      expect(paid.payment.journal_entry_id).toBeTruthy();

      // الخزينة: 10,000 − 6,000
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(4000);

      const movements = await client.query(
        "SELECT * FROM treasury_transactions WHERE reference_type = 'payroll' AND reference_id = $1 ORDER BY id",
        [draft.id],
      );
      expect(movements.rows).toHaveLength(1);
      expect(Number(movements.rows[0].amount)).toBe(-6000);
      expect(movements.rows[0].transaction_type).toBe("cash_out");
      expect(movements.rows[0].status).toBe("approved");
      expect(movements.rows[0].voucher_number).toBe(paid.payment.voucher_number);

      // قيد السداد: مدين مرتبات مستحقة 6,000 / دائن الخزينة 6,000
      const paymentLines = await journalLines(client, paid.payment.journal_entry_id);
      expect(paymentLines).toHaveLength(2);
      const payableDebit = paymentLines.find((line) => Number(line.account_id) === Number(payableAccountId));
      const cashCredit = paymentLines.find((line) => Number(line.account_id) === cashAccountId);
      expect(Number(payableDebit.debit)).toBe(6000);
      expect(Number(cashCredit.credit)).toBe(6000);

      // لا مصروف مرتبات جديد عند الصرف: المصروف كما كان بعد الاستحقاق
      expect(await balanceOf(client, expenseAccountId)).toBe(expenseAfterAccrual);
      // الالتزام سُدِّد بالكامل (رصيد الأستاذ = مدين − دائن، والحساب طبيعته دائن)
      expect(await balanceOf(client, Number(payableAccountId))).toBe(payableAfterAccrual + 6000);
      expect(await balanceOf(client, Number(payableAccountId))).toBe(0);
      // النقد انخفض 6,000 في الأستاذ
      expect(await balanceOf(client, cashAccountId)).toBe(cashBefore - 6000);

      const payments = await client.query("SELECT COUNT(*)::int AS n FROM payroll_payments WHERE run_id = $1", [draft.id]);
      expect(payments.rows[0].n).toBe(1);
    });
  });

  it("الاختبار الثالث — منع صرف المسير مرتين", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      const closed = await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      await payrollRunService.payRun(draft.id, { paymentSource: "cash", treasuryAccountId: fx.treasuryId }, TEST_USER, { client });

      const treasuryAfterFirstPay = await treasuryBalance(client, fx.treasuryId);
      const entriesAfterFirstPay = await client.query(
        "SELECT COUNT(*)::int AS n FROM journal_entries WHERE source_id = $1 AND source_type = 'payroll_payment'",
        [draft.id],
      );

      await expect(
        payrollRunService.payRun(draft.id, { paymentSource: "cash", treasuryAccountId: fx.treasuryId }, TEST_USER, { client }),
      ).rejects.toThrow(/مصروف بالكامل/);

      // لا تغيير في الأرصدة ولا قيد إضافي ولا حركة خزينة إضافية
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(treasuryAfterFirstPay);
      const entries = await client.query(
        "SELECT COUNT(*)::int AS n FROM journal_entries WHERE source_id = $1 AND source_type = 'payroll_payment'",
        [draft.id],
      );
      expect(entries.rows[0].n).toBe(entriesAfterFirstPay.rows[0].n);
      const movements = await client.query(
        "SELECT COUNT(*)::int AS n FROM treasury_transactions WHERE reference_type = 'payroll' AND reference_id = $1",
        [draft.id],
      );
      expect(movements.rows[0].n).toBe(1);
      expect(closed.status).toBe("accrued");
    });
  });

  it("الاختبار الرابع — منع تكرار قيد الاستحقاق", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const expenseAccountId = await accountIdByKey(client, "payroll_expense");
      const expenseBefore = await balanceOf(client, expenseAccountId);

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      const first = await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      const expenseAfterFirst = await balanceOf(client, expenseAccountId);
      expect(expenseAfterFirst).toBe(expenseBefore + 6000);

      const second = await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      expect(second.replayed).toBe(true);
      expect(second.accrual_journal_entry_id).toBe(first.accrual_journal_entry_id);

      const accrualEntries = await client.query(
        "SELECT COUNT(*)::int AS n FROM journal_entries WHERE source_type = 'payroll_accrual' AND source_id = $1",
        [draft.id],
      );
      expect(accrualEntries.rows[0].n).toBe(1);
      expect(await balanceOf(client, expenseAccountId)).toBe(expenseAfterFirst);
    });
  });

  it("الاختبار الخامس — فشل الصرف يتراجع بالكامل بلا سند أو قيد أو حركة", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const cashAccountId = await accountIdByKey(client, "cash");

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      const closed = await payrollRunService.closeRun(draft.id, TEST_USER, { client });

      const treasuryBefore = await treasuryBalance(client, fx.treasuryId);
      const cashBefore = await balanceOf(client, cashAccountId);
      const payableBefore = await balanceOf(
        client,
        Number((await journalLines(client, closed.accrual_journal_entry_id)).find((line) => Number(line.credit) > 0).account_id),
      );

      await client.query("SAVEPOINT before_failed_payment");

      // عميل يفشل عند إنشاء حركة الخزينة (بعد إنشاء القيد) لمحاكاة خطأ في منتصف العملية
      const failingClient = {
        query: async (sql: string, params?: any[]) => {
          if (/INSERT INTO treasury_transactions/i.test(sql)) {
            throw new Error("simulated treasury failure");
          }
          return client.query(sql, params);
        },
        release: () => undefined,
      };

      await expect(
        payrollRunService.payRun(
          draft.id,
          { paymentSource: "cash", treasuryAccountId: fx.treasuryId },
          TEST_USER,
          { client: failingClient },
        ),
      ).rejects.toThrow("simulated treasury failure");

      await client.query("ROLLBACK TO SAVEPOINT before_failed_payment");

      // لا سند صرف ولا قيد سداد ولا حركة خزينة ولا تغيّر في الأرصدة
      const payments = await client.query("SELECT COUNT(*)::int AS n FROM payroll_payments WHERE run_id = $1", [draft.id]);
      const paymentEntries = await client.query(
        "SELECT COUNT(*)::int AS n FROM journal_entries WHERE source_type = 'payroll_payment' AND source_id = $1",
        [draft.id],
      );
      const movements = await client.query(
        "SELECT COUNT(*)::int AS n FROM treasury_transactions WHERE reference_type = 'payroll' AND reference_id = $1",
        [draft.id],
      );
      expect(payments.rows[0].n).toBe(0);
      expect(paymentEntries.rows[0].n).toBe(0);
      expect(movements.rows[0].n).toBe(0);
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(treasuryBefore);
      expect(await balanceOf(client, cashAccountId)).toBe(cashBefore);
      expect(
        await balanceOf(
          client,
          Number((await journalLines(client, closed.accrual_journal_entry_id)).find((line) => Number(line.credit) > 0).account_id),
        ),
      ).toBe(payableBefore);

      const run = await payrollRunService.getRunStatus(draft.id, client);
      expect(run.status).toBe("accrued");
      expect(run.total_paid).toBe(0);
    });
  });

  it("الاختبار السادس — مراجعة الحسابات: قيود متوازنة وأرصدة صحيحة بلا تكرار للمصروف", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag, 10_000);
      const expenseAccountId = await accountIdByKey(client, "payroll_expense");
      const expenseBefore = await balanceOf(client, expenseAccountId);

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      const closed = await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      const paid = await payrollRunService.payRun(
        draft.id,
        { paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );

      const entries = await client.query(
        `SELECT id, total_debit, total_credit FROM journal_entries
          WHERE (source_type = 'payroll_accrual' AND source_id = $1)
             OR (source_type = 'payroll_payment' AND source_id = $1)`,
        [draft.id],
      );
      expect(entries.rows).toHaveLength(2);

      let totalDebit = 0;
      let totalCredit = 0;
      for (const entry of entries.rows) {
        const lines = await journalLines(client, Number(entry.id));
        const debit = lines.reduce((sum, line) => sum + Number(line.debit), 0);
        const credit = lines.reduce((sum, line) => sum + Number(line.credit), 0);
        expect(debit).toBe(credit);
        expect(Number(entry.total_debit)).toBe(debit);
        expect(Number(entry.total_credit)).toBe(credit);
        totalDebit += debit;
        totalCredit += credit;
      }
      expect(totalDebit).toBe(12_000);
      expect(totalCredit).toBe(12_000);

      // مصروف المرتبات 6,000 فقط (لم يُسجَّل مرة أخرى عند الصرف)
      expect(await balanceOf(client, expenseAccountId)).toBe(expenseBefore + 6000);
      // الالتزام مغلق: دائن 6,000 ثم مدين 6,000
      const payableAccountId = Number(
        (await journalLines(client, closed.accrual_journal_entry_id)).find((line) => Number(line.credit) > 0).account_id,
      );
      const payableMovements = await client.query(
        "SELECT COALESCE(SUM(debit),0) AS debit, COALESCE(SUM(credit),0) AS credit FROM journal_items WHERE account_id = $1 AND journal_entry_id = ANY($2::int[])",
        [payableAccountId, entries.rows.map((entry) => Number(entry.id))],
      );
      expect(Number(payableMovements.rows[0].debit)).toBe(6000);
      expect(Number(payableMovements.rows[0].credit)).toBe(6000);
      // الخزينة انخفضت 6,000
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(4000);
      expect(paid.remaining).toBe(0);
    });
  });

  it("يدعم الصرف الجزئي ثم إتمام الصرف", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag, 10_000);
      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      await payrollRunService.closeRun(draft.id, TEST_USER, { client });

      const partial = await payrollRunService.payRun(
        draft.id,
        { amount: 2000, paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );
      expect(partial.status).toBe("partially_paid");
      expect(partial.total_paid).toBe(2000);
      expect(partial.remaining).toBe(4000);
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(8000);

      const rest = await payrollRunService.payRun(
        draft.id,
        { amount: 4000, paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );
      expect(rest.status).toBe("paid");
      expect(rest.remaining).toBe(0);
      expect(rest.payments).toHaveLength(2);
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(4000);

      // منع تجاوز المستحق
      await expect(
        payrollRunService.payRun(draft.id, { amount: 100, paymentSource: "cash", treasuryAccountId: fx.treasuryId }, TEST_USER, { client }),
      ).rejects.toThrow(/مصروف بالكامل/);
    });
  });

  it("العكس المحاسبي لسند الصرف يعيد الرصيد والالتزام بلا حذف القيود", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag, 10_000);
      const cashAccountId = await accountIdByKey(client, "cash");
      const expenseAccountId = await accountIdByKey(client, "payroll_expense");
      const cashBefore = await balanceOf(client, cashAccountId);
      const expenseBefore = await balanceOf(client, expenseAccountId);

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      const closed = await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      const paid = await payrollRunService.payRun(
        draft.id,
        { paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );

      const reversed = await payrollRunService.reversePayment(draft.id, paid.payment.id, TEST_USER, { client });
      expect(reversed.status).toBe("accrued");
      expect(reversed.total_paid).toBe(0);
      expect(reversed.remaining).toBe(6000);
      expect(await treasuryBalance(client, fx.treasuryId)).toBe(10_000);
      expect(await balanceOf(client, cashAccountId)).toBe(cashBefore);

      // القيد الأصلي ما زال مرحّلًا + قيد عكسي متوازن
      const originalEntry = await client.query("SELECT id FROM journal_entries WHERE id = $1", [paid.payment.journal_entry_id]);
      expect(originalEntry.rows).toHaveLength(1);
      const reversalLines = await journalLines(client, Number(reversed.reversal_journal_entry_id));
      expect(reversalLines.reduce((sum, line) => sum + Number(line.debit), 0)).toBe(6000);
      expect(reversalLines.reduce((sum, line) => sum + Number(line.credit), 0)).toBe(6000);
      expect(reversalLines.some((line) => Number(line.account_id) === cashAccountId && Number(line.debit) === 6000)).toBe(true);
      // المصروف لا يتأثر بالعكس
      expect(await balanceOf(client, expenseAccountId)).toBe(expenseBefore + 6000);

      // عكس الاستحقاق بعد عكس الصرف يعيد المسير لمسودة
      const reversedAccrual = await payrollRunService.reverseAccrual(draft.id, TEST_USER, { client });
      expect(reversedAccrual.status).toBe("draft");
      expect(await balanceOf(client, expenseAccountId)).toBe(expenseBefore);
      expect(closed.accrual_journal_entry_id).toBeTruthy();
    });
  });

  it("يرفض ترحيل قيد مرتبات إلى فترة مالية مغلقة", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const expenseAccountId = await accountIdByKey(client, "payroll_expense");
      const expenseBefore = await balanceOf(client, expenseAccountId);

      // 2026-03 مغلقة في قاعدة الاختبار
      const draft = await payrollRunService.buildDraft({ ...fx.period, month: 3 }, TEST_USER, { client });
      await expect(payrollRunService.closeRun(draft.id, TEST_USER, { client })).rejects.toThrow(/مغلقة/);

      // لا قيد ولا مصروف ولا تغيّر في المسير
      const entries = await client.query(
        "SELECT COUNT(*)::int AS n FROM journal_entries WHERE source_type = 'payroll_accrual' AND source_id = $1",
        [draft.id],
      );
      expect(entries.rows[0].n).toBe(0);
      expect(await balanceOf(client, expenseAccountId)).toBe(expenseBefore);
      const run = await payrollRunService.getRunStatus(draft.id, client);
      expect(run.status).toBe("draft");
    });
  });

  it("يمنع تعديل بنود المرتبات بعد إقفال المسير", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });

      await expect(payrollRunService.assertMonthEditable(client, `${YEAR}-07-15`)).resolves.toBeUndefined();

      await payrollRunService.closeRun(draft.id, TEST_USER, { client });
      await expect(payrollRunService.assertMonthEditable(client, `${YEAR}-07-15`)).rejects.toThrow(/لا يمكن تعديل بنود المرتبات/);
    });
  });

  it("يوحّد تاريخ قيد الاستحقاق مع تاريخ الصرف فيصبح القيدان في يوم واحد", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag, 10_000);
      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      const closed = await payrollRunService.closeRun(draft.id, TEST_USER, { client });

      const accrualEntryId = Number(closed.accrual_journal_entry_id);
      const dateOf = async (entryId: number) =>
        (
          await client.query("SELECT TO_CHAR(date, 'YYYY-MM-DD') AS date FROM journal_entries WHERE id = $1", [entryId])
        ).rows[0].date as string;

      // الإقفال يسجّل الاستحقاق على آخر يوم في شهر المسير
      expect(await dateOf(accrualEntryId)).toBe(`${YEAR}-07-31`);

      const paymentDate = `${YEAR}-07-16`;
      const paid = await payrollRunService.payRun(
        draft.id,
        { paymentSource: "cash", treasuryAccountId: fx.treasuryId, paymentDate },
        TEST_USER,
        { client },
      );

      expect(paid.accrual_alignment.applied).toBe(true);
      expect(paid.accrual_alignment.from).toBe(`${YEAR}-07-31`);
      expect(paid.accrual_alignment.to).toBe(paymentDate);

      // القيدان في نفس اليوم: لا صرف يسبق الاستحقاق
      expect(await dateOf(accrualEntryId)).toBe(paymentDate);
      expect(await dateOf(Number(paid.payment.journal_entry_id))).toBe(paymentDate);

      // الواجهة تعرض التاريخ المرحّل الفعلي لا آخر الشهر
      const status = await payrollRunService.getPeriodStatus(fx.period, client);
      expect(status.accrual_date).toBe(paymentDate);

      // التوحيد مُراجَع في سجل التدقيق وسجل الحسابات العامة
      const audit = await client.query(
        "SELECT details FROM payroll_run_audit WHERE run_id = $1 AND action = 'align_accrual_date'",
        [draft.id],
      );
      expect(audit.rows).toHaveLength(1);
      const glAudit = await client.query(
        "SELECT action FROM gl_audit_logs WHERE record_id = $1 AND action = 'align_accrual_date'",
        [accrualEntryId],
      );
      expect(glAudit.rows).toHaveLength(1);
    });
  });

  it("تقرير صرف المرتبات الشهري — المستحق والمصروف لكل موظف بعد الصرف الجزئي ثم الكامل", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const secondEmployeeId = await addEmployee(
        client,
        fx.period.departmentId,
        `سعيد علي — اختبار ${tag}`,
        `EMP-TEST-2-${tag}`,
        4000,
      );

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      expect(draft.employees_count).toBe(2);
      expect(draft.total_net).toBe(10000);
      await payrollRunService.closeRun(draft.id, TEST_USER, { client });

      // قبل أي صرف: المستحق كامل لكل موظف والمصروف صفر
      const beforePay = await payrollRunService.getMonthlyDisbursementReport(
        { year: YEAR, month: MONTH, departmentId: fx.period.departmentId },
        client,
      );
      expect(beforePay.rows).toHaveLength(2);
      expect(beforePay.totals).toMatchObject({ employees_count: 2, total_net: 10000, total_paid: 0, remaining: 10000 });
      expect(beforePay.vouchers).toHaveLength(0);
      for (const row of beforePay.rows) {
        expect(row.paid_amount).toBe(0);
        expect(row.payment_state).toBe("due");
        expect(row.period_label).toBe(`0${MONTH}/${YEAR}`);
      }
      expect(beforePay.rows.find((row: any) => Number(row.employee_id) === fx.employeeId).net_salary).toBe(6000);
      expect(beforePay.rows.find((row: any) => Number(row.employee_id) === secondEmployeeId).net_salary).toBe(4000);

      // صرف جزئي 5,000 ⇒ يُوزَّع بنسبة صافي كل موظف (60% / 40%)
      const partial = await payrollRunService.payRun(
        draft.id,
        { amount: 5000, paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );
      expect(partial.status).toBe("partially_paid");

      const afterPartial = await payrollRunService.getMonthlyDisbursementReport(
        { year: YEAR, month: MONTH, departmentId: fx.period.departmentId },
        client,
      );
      const firstRow = afterPartial.rows.find((row: any) => Number(row.employee_id) === fx.employeeId);
      const secondRow = afterPartial.rows.find((row: any) => Number(row.employee_id) === secondEmployeeId);
      expect(afterPartial.totals.total_paid).toBe(5000);
      expect(afterPartial.totals.remaining).toBe(5000);
      expect(firstRow.paid_amount).toBe(3000);
      expect(secondRow.paid_amount).toBe(2000);
      expect(firstRow.payment_state).toBe("partially_paid");
      expect(firstRow.voucher_numbers).toEqual([partial.payment.voucher_number]);

      // كشف الموظفين داخل سند الصرف (getRunStatus) يعرض نصيب كل موظف من المدفوع
      const statusAfterPartial = await payrollRunService.getRunStatus(draft.id, client);
      const firstItem = statusAfterPartial.items.find((item: any) => Number(item.employee_id) === fx.employeeId);
      const secondItem = statusAfterPartial.items.find((item: any) => Number(item.employee_id) === secondEmployeeId);
      expect(firstItem.paid_amount).toBe(3000);
      expect(firstItem.remaining_amount).toBe(3000);
      expect(secondItem.paid_amount).toBe(2000);
      expect(secondItem.remaining_amount).toBe(2000);

      // سداد الباقي ⇒ كل موظف صار مصروفًا بكامل مستحقه
      const full = await payrollRunService.payRun(
        draft.id,
        { paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );
      expect(full.status).toBe("paid");

      const afterFull = await payrollRunService.getMonthlyDisbursementReport(
        { year: YEAR, month: MONTH, departmentId: fx.period.departmentId },
        client,
      );
      for (const row of afterFull.rows) {
        expect(row.paid_amount).toBe(row.net_salary);
        expect(row.payment_state).toBe("paid");
      }
      expect(afterFull.totals.total_paid).toBe(10000);
      expect(afterFull.totals.remaining).toBe(0);
      expect(afterFull.vouchers).toHaveLength(2);
      expect(afterFull.vouchers.reduce((sum: number, voucher: any) => sum + voucher.amount, 0)).toBe(10000);
      expect(afterFull.runs).toHaveLength(1);
      expect(afterFull.runs[0].run_number).toBe(draft.run_number);
      expect(afterFull.runs[0].total_paid).toBe(10000);

      const statusAfterFull = await payrollRunService.getRunStatus(draft.id, client);
      for (const item of statusAfterFull.items) {
        expect(item.paid_amount).toBe(item.net_salary);
        expect(item.remaining_amount).toBe(0);
      }
    });
  });

  it("تقرير صرف المرتبات الشهري — حصر المصروف على الخزينة المختارة", async () => {
    await withRollback(async (client) => {
      const tag = uniqueTag("PAYRUN");
      const fx = await createFixture(client, tag);
      const otherTreasuryId = await createTreasury(client, `${tag} treasury 2`);

      const draft = await payrollRunService.buildDraft(fx.period, TEST_USER, { client });
      await payrollRunService.closeRun(draft.id, TEST_USER, { client });

      await payrollRunService.payRun(
        draft.id,
        { amount: 3000, paymentSource: "cash", treasuryAccountId: fx.treasuryId },
        TEST_USER,
        { client },
      );
      await payrollRunService.payRun(
        draft.id,
        { amount: 2000, paymentSource: "cash", treasuryAccountId: otherTreasuryId },
        TEST_USER,
        { client },
      );

      const scope = { year: YEAR, month: MONTH, departmentId: fx.period.departmentId };
      const scopedFirst = await payrollRunService.getMonthlyDisbursementReport(
        { ...scope, treasuryAccountId: fx.treasuryId },
        client,
      );
      expect(scopedFirst.rows).toHaveLength(1);
      expect(scopedFirst.rows[0].net_salary).toBe(6000);
      expect(scopedFirst.rows[0].paid_amount).toBe(3000);
      expect(scopedFirst.totals.total_paid).toBe(3000);
      expect(scopedFirst.vouchers).toHaveLength(1);
      expect(Number(scopedFirst.vouchers[0].treasury_account_id)).toBe(fx.treasuryId);

      const scopedSecond = await payrollRunService.getMonthlyDisbursementReport(
        { ...scope, treasuryAccountId: otherTreasuryId },
        client,
      );
      expect(scopedSecond.rows[0].paid_amount).toBe(2000);
      expect(scopedSecond.totals.total_paid).toBe(2000);
      expect(Number(scopedSecond.vouchers[0].treasury_account_id)).toBe(otherTreasuryId);

      // خزينة لم تصرف شيئًا لهذا المسير ⇒ لا صفوف موظفين لها
      const emptyTreasuryId = await createTreasury(client, `${tag} treasury 3`);
      const scopedEmpty = await payrollRunService.getMonthlyDisbursementReport(
        { ...scope, treasuryAccountId: emptyTreasuryId },
        client,
      );
      expect(scopedEmpty.rows).toHaveLength(0);
      expect(scopedEmpty.vouchers).toHaveLength(0);

      const unscoped = await payrollRunService.getMonthlyDisbursementReport(scope, client);
      expect(unscoped.totals.total_paid).toBe(5000);
      expect(unscoped.vouchers).toHaveLength(2);
    });
  });
});

describe("توزيع المصروف على الموظفين داخل المسير", () => {
  it("ينسب المبلغ المدفوع بنسبة صافي كل موظف بلا فروق تقريب", () => {
    const allocations = allocatePaidAcrossItems(
      [{ net_salary: 3333.33 }, { net_salary: 3333.33 }, { net_salary: 3333.34 }],
      10000,
    );
    expect(allocations.reduce((sum, value) => sum + value, 0)).toBeCloseTo(10000, 2);
    expect(allocations[0]).toBe(3333.33);
    expect(allocations[2]).toBe(3333.34);

    expect(allocatePaidAcrossItems([{ net_salary: 6000 }, { net_salary: 4000 }], 5000)).toEqual([3000, 2000]);
  });

  it("لا يتجاوز نصيب الموظف صافيه ولا يتجاوز المصروف الإجمالي", () => {
    expect(allocatePaidAcrossItems([{ net_salary: 5000 }, { net_salary: 1000 }], 9000)).toEqual([5000, 1000]);
    expect(allocatePaidAcrossItems([{ net_salary: 5000 }, { net_salary: 1000 }], 0)).toEqual([0, 0]);
    expect(allocatePaidAcrossItems([{ net_salary: 0 }, { net_salary: 2500 }], 1000)).toEqual([0, 1000]);
    expect(allocatePaidAcrossItems([], 500)).toEqual([]);
  });

  it("حالة صرف الموظف مشتقة من نصيبه وحالة المسير", () => {
    expect(payrollItemPaymentState(6000, 6000, "accrued")).toBe("paid");
    expect(payrollItemPaymentState(6000, 1500, "partially_paid")).toBe("partially_paid");
    expect(payrollItemPaymentState(6000, 0, "partially_paid")).toBe("due");
    expect(payrollItemPaymentState(6000, 0, "draft")).toBe("draft");
    expect(payrollItemPaymentState(0, 0, "accrued")).toBe("paid");
  });
});
