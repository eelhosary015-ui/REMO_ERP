/**
 * اختبارات قبول إقفال الفترات المالية والسنة المالية.
 *
 * تعمل على قاعدة `erp_system1_test` فقط (يتحقق منها tests/helpers/testDb.ts).
 * تنشئ سنوات مالية معزولة (2031 / 2032 / 2033) حتى لا تمس بيانات حقيقية،
 * وتنظّف كل ما أنشأته في النهاية مع إعادة أرصدة الحسابات كما كانت.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { pool, ensureChartOfAccounts, ensureUser, uniqueTag, withCommit } from "../helpers/testDb.js";
import { AccountRepository } from "../../modules/accounts/repositories/account.repository.js";
import {
  closePeriod,
  closeFiscalYear,
  getIncompleteOperations,
  preflightPeriod,
  previewFiscalYear,
  reopenPeriod,
} from "../../modules/accounts/services/period-closing.service.js";
import { assertPeriodOpen } from "../../modules/accounts/services/period-lock.service.js";

const repo = new AccountRepository();
const TAG = uniqueTag("PERIOD");

const TEST_YEARS = [2031, 2032, 2033];
const ADMIN = { id: 1, username: "behaviour-test-runner", role: "admin", permissions: { all: true } };

let fy2031 = 0;
let fy2032 = 0;
let accounts: Awaited<ReturnType<typeof ensureChartOfAccounts>>;

/** يحذف كل بيانات السنوات الاختبارية مع تجاوز حماية الفترة (تنظيف فقط). */
async function purgeTestYears(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.period_lock_bypass = 'on'");

    const entries = await client.query(
      `SELECT id FROM journal_entries WHERE date::date BETWEEN $1::date AND $2::date`,
      [`${TEST_YEARS[0]}-01-01`, `${TEST_YEARS[TEST_YEARS.length - 1]}-12-31`],
    );
    const ids = entries.rows.map((row: any) => Number(row.id));

    if (ids.length) {
      // إعادة أرصدة الحسابات إلى ما كانت عليه قبل القيود الاختبارية
      await client.query(
        `UPDATE accounts a
            SET balance = a.balance - d.delta
           FROM (
             SELECT account_id, SUM(debit - credit) AS delta
               FROM journal_items
              WHERE journal_entry_id = ANY($1::int[])
              GROUP BY account_id
           ) d
          WHERE a.id = d.account_id`,
        [ids],
      );
      await client.query("DELETE FROM journal_items WHERE journal_entry_id = ANY($1::int[])", [ids]);
      await client.query("DELETE FROM journal_entries WHERE id = ANY($1::int[])", [ids]);
    }

    await client.query(
      `DELETE FROM financial_period_events WHERE fiscal_year_id IN (SELECT id FROM fiscal_years WHERE name LIKE $1)`,
      [`TEST-%${TAG}%`],
    );
    await client.query(`DELETE FROM financial_periods WHERE year = ANY($1::int[])`, [TEST_YEARS]);
    await client.query(
      `DELETE FROM fiscal_years
        WHERE name LIKE $1
           OR (start_date BETWEEN $2::date AND $3::date)`,
      [`TEST-%${TAG}%`, `${TEST_YEARS[0]}-01-01`, `${TEST_YEARS[TEST_YEARS.length - 1]}-12-31`],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** ينشئ سنة مالية اختبارية مع 12 فترة شهرية مفتوحة. */
async function createTestFiscalYear(year: number): Promise<number> {
  return withCommit(async (client) => {
    const fy = await client.query(
      `INSERT INTO fiscal_years (name, start_date, end_date, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [`TEST-FY-${year}-${TAG}`, `${year}-01-01`, `${year}-12-31`],
    );
    const fyId = Number(fy.rows[0].id);
    for (let month = 1; month <= 12; month += 1) {
      const lastDay = new Date(year, month, 0).getDate();
      await client.query(
        `INSERT INTO financial_periods (fiscal_year_id, month, year, status, start_date, end_date)
         VALUES ($1,$2,$3,'open',$4,$5)
         ON CONFLICT (month, year) DO UPDATE
           SET fiscal_year_id = EXCLUDED.fiscal_year_id,
               start_date = EXCLUDED.start_date,
               end_date = EXCLUDED.end_date,
               status = 'open'`,
        [
          fyId,
          month,
          year,
          `${year}-${String(month).padStart(2, "0")}-01`,
          `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
        ],
      );
    }
    return fyId;
  });
}

async function periodId(year: number, month: number): Promise<number> {
  const row = await pool.query("SELECT id FROM financial_periods WHERE year = $1 AND month = $2", [year, month]);
  return Number(row.rows[0].id);
}

async function postBalanced(date: string, amount: number, reference: string) {
  return repo.createJournalEntry({
    date,
    description: `قيد اختبار ${reference}`,
    reference,
    source_type: "test",
    items: [
      { account_id: accounts.cash, debit: amount, credit: 0 },
      { account_id: accounts.salesRevenue, debit: 0, credit: amount },
    ],
  });
}

async function totalsUntil(endDate: string) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(ji.debit),0)::numeric AS debit, COALESCE(SUM(ji.credit),0)::numeric AS credit
       FROM journal_items ji JOIN journal_entries je ON je.id = ji.journal_entry_id
      WHERE je.status = 'posted' AND je.date::date <= $1::date`,
    [endDate],
  );
  return {
    debit: Number(result.rows[0].debit),
    credit: Number(result.rows[0].credit),
  };
}

async function accountNet(accountId: number, endDate: string): Promise<number> {
  const result = await pool.query(
    `SELECT COALESCE(SUM(ji.debit - ji.credit),0)::numeric AS net
       FROM journal_items ji JOIN journal_entries je ON je.id = ji.journal_entry_id
      WHERE ji.account_id = $1 AND je.status = 'posted' AND je.date::date <= $2::date`,
    [accountId, endDate],
  );
  return Number(result.rows[0].net);
}

beforeAll(async () => {
  await withCommit((client) => ensureUser(client));
  accounts = await withCommit((client) => ensureChartOfAccounts(client));
  await purgeTestYears();
  fy2031 = await createTestFiscalYear(2031);
  fy2032 = await createTestFiscalYear(2032);
}, 120_000);

afterAll(async () => {
  await purgeTestYears();
}, 120_000);

describe("حماية الفترة المالية عند الترحيل", () => {
  it("يرفض الإقفال عند وجود قيد رأسه لا يطابق بنوده ويُبقي الحالة مفتوحة", async () => {
    const pid = await periodId(2031, 5);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const header = await client.query(
        `INSERT INTO journal_entries (date, description, status, total_debit, total_credit, source_type)
         VALUES ('2031-05-10','TEST imbalance','posted',100,50,'test') RETURNING id`,
      );
      const entryId = header.rows[0].id;
      // البنود نفسها متوازنة (100/100) لكن رأس القيد يدّعي 100/50
      await client.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
         VALUES ($1,$2,100,0,'test'),($1,$3,0,100,'test')`,
        [entryId, accounts.cash, accounts.salesRevenue],
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }

    const report = await preflightPeriod(pid);
    expect(report.can_close).toBe(false);
    expect(report.errors.map((error) => error.code)).toContain("UNBALANCED_ENTRIES");

    await expect(closePeriod(pid, { user: ADMIN, reason: "اختبار الرفض" })).rejects.toMatchObject({
      code: "PERIOD_CLOSE_BLOCKED",
    });

    const status = await pool.query("SELECT status FROM financial_periods WHERE id = $1", [pid]);
    expect(status.rows[0].status).toBe("open");
  });

  it("يقفل فترة سليمة ويثبّت الحالة في قاعدة البيانات", async () => {
    const pid = await periodId(2031, 6);
    await postBalanced("2031-06-10", 500, `TEST-CLOSE-${TAG}`);

    const result = await closePeriod(pid, { user: ADMIN, reason: "إقفال اختبار سليم" });
    expect(result.already_closed).toBe(false);

    const row = await pool.query(
      "SELECT status, closed_at, closed_by, close_reason FROM financial_periods WHERE id = $1",
      [pid],
    );
    expect(row.rows[0].status).toBe("closed");
    expect(row.rows[0].closed_at).toBeTruthy();
    expect(Number(row.rows[0].closed_by)).toBe(1);
    expect(row.rows[0].close_reason).toContain("إقفال اختبار");

    const events = await pool.query(
      "SELECT action, from_status, to_status, reason FROM financial_period_events WHERE period_id = $1 ORDER BY id DESC LIMIT 1",
      [pid],
    );
    expect(events.rows[0]).toMatchObject({ action: "close", from_status: "open", to_status: "closed" });
  });

  it("يرفض الترحيل عبر المستودع في فترة مغلقة", async () => {
    await expect(postBalanced("2031-06-15", 300, `TEST-BLOCK-REPO-${TAG}`)).rejects.toMatchObject({
      code: "PERIOD_CLOSED",
    });
  });

  it("يرفض الترحيل المباشر عبر SQL في فترة مغلقة (حماية قاعدة البيانات)", async () => {
    await expect(
      pool.query(
        `INSERT INTO journal_entries (date, description, status, total_debit, total_credit)
         VALUES ('2031-06-16','TEST direct insert','posted',100,100)`,
      ),
    ).rejects.toMatchObject({ detail: "PERIOD_CLOSED" });
  });

  it("يمنع تعديل أو حذف قيد داخل فترة مغلقة", async () => {
    const entry = await pool.query(
      "SELECT id FROM journal_entries WHERE date::date = '2031-06-10' AND status = 'posted' ORDER BY id DESC LIMIT 1",
    );
    const entryId = entry.rows[0].id;

    await expect(
      pool.query("UPDATE journal_entries SET date = '2031-07-01' WHERE id = $1", [entryId]),
    ).rejects.toMatchObject({ detail: "PERIOD_CLOSED" });

    await expect(pool.query("DELETE FROM journal_items WHERE journal_entry_id = $1", [entryId])).rejects.toMatchObject({
      detail: "PERIOD_CLOSED",
    });
  });

  it("يستمر الترحيل في فترة أخرى مفتوحة ويضبط period_id تلقائيًا", async () => {
    const entry = await postBalanced("2031-07-10", 250, `TEST-OPEN-${TAG}`);
    const stored = await pool.query("SELECT period_id FROM journal_entries WHERE id = $1", [entry.id]);
    const expected = await periodId(2031, 7);
    expect(Number(stored.rows[0].period_id)).toBe(expected);
  });

  it("تكرار طلب الإقفال لا يغيّر التاريخ الأصلي ولا ينشئ أثرًا جديدًا", async () => {
    const pid = await periodId(2031, 6);
    const before = await pool.query("SELECT closed_at, close_reason FROM financial_periods WHERE id = $1", [pid]);
    const eventsBefore = await pool.query("SELECT COUNT(*)::int AS n FROM financial_period_events WHERE period_id = $1", [pid]);

    const again = await closePeriod(pid, { user: ADMIN, reason: "محاولة تكرار" });
    expect(again.already_closed).toBe(true);

    const after = await pool.query("SELECT closed_at, close_reason FROM financial_periods WHERE id = $1", [pid]);
    const eventsAfter = await pool.query("SELECT COUNT(*)::int AS n FROM financial_period_events WHERE period_id = $1", [pid]);
    expect(after.rows[0].closed_at).toEqual(before.rows[0].closed_at);
    expect(after.rows[0].close_reason).toEqual(before.rows[0].close_reason);
    expect(eventsAfter.rows[0].n).toBe(eventsBefore.rows[0].n);
  });

  it("إعادة الفتح تتطلب سببًا وتُسجَّل وتعيد الترحيل", async () => {
    const pid = await periodId(2031, 6);

    await expect(reopenPeriod(pid, { reason: "قصير", user: ADMIN })).rejects.toMatchObject({ code: "REASON_REQUIRED" });

    const reopened = await reopenPeriod(pid, { reason: "تصحيح قيد اختباري مسجل بالخطأ", user: ADMIN });
    expect(reopened.already_open).toBe(false);
    expect(reopened.status).toBe("open");

    const event = await pool.query(
      "SELECT action, from_status, to_status, reason, user_id FROM financial_period_events WHERE period_id = $1 ORDER BY id DESC LIMIT 1",
      [pid],
    );
    expect(event.rows[0]).toMatchObject({ action: "reopen", from_status: "closed", to_status: "open" });
    expect(event.rows[0].reason).toContain("تصحيح");
    expect(Number(event.rows[0].user_id)).toBe(1);

    const posted = await postBalanced("2031-06-20", 120, `TEST-AFTER-REOPEN-${TAG}`);
    expect(posted.id).toBeGreaterThan(0);
  });

  it("التحقق من الفترة يأخذ قفلًا يمنع إقفالها في منتصف الترحيل (تزامن)", async () => {
    const pid = await periodId(2031, 8);
    const poster = await pool.connect();
    const closer = await pool.connect();
    try {
      await poster.query("BEGIN");
      // الترحيل يقرأ الفترة ويحجزها FOR SHARE حتى نهاية معاملته
      await assertPeriodOpen(poster, "2031-08-10", "اختبار التزامن");

      await closer.query("SET lock_timeout = '700ms'");
      await expect(
        closer.query("UPDATE financial_periods SET status = 'closed' WHERE id = $1", [pid]),
      ).rejects.toThrow(/lock timeout|canceling statement/i);

      await poster.query("COMMIT");
      // بعد انتهاء معاملة الترحيل يمكن إقفال الفترة
      await closer.query("UPDATE financial_periods SET status = 'closed' WHERE id = $1", [pid]);
      const status = await closer.query("SELECT status FROM financial_periods WHERE id = $1", [pid]);
      expect(status.rows[0].status).toBe("closed");
      await closer.query("UPDATE financial_periods SET status = 'open' WHERE id = $1", [pid]);
    } finally {
      try { await poster.query("ROLLBACK"); } catch { /* انتهت */ }
      poster.release();
      closer.release();
    }
  });

  it("تقرير العمليات غير المكتملة يقرأ الواقع ولا يعدّل شيئًا", async () => {
    const report = await getIncompleteOperations({ from: "2031-01-01", to: "2031-12-31" });
    expect(report.summary).toBeTruthy();
    expect(typeof report.summary.total_items).toBe("number");
    expect(report.items).toBeTruthy();
    expect(report.note).toContain("للعرض فقط");
  });
});

describe("الإقفال السنوي وقيود الإقفال والأرصدة الافتتاحية", () => {
  let netResult = 0;

  it("يرفض إقفال سنة تحتوي فترة غير مغلقة دون تفويض صريح", async () => {
    await postBalanced("2031-09-10", 90, `TEST-OPEN-PERIOD-${TAG}`);
    await expect(closeFiscalYear(fy2031, { user: ADMIN, reason: "بدون إقفال الفترات" })).rejects.toMatchObject({
      code: "PERIOD_CLOSE_BLOCKED",
    });
  });

  it("يحسب نتيجة السنة من الأرصدة الفعلية ويُنشئ قيود الإقفال والأرصدة الافتتاحية", async () => {
    const cashBefore = await accountNet(accounts.cash, "2032-12-31");
    // 1000 إيراد نقدي، ثم 400 مصروف نقدي ⇒ صافي 600
    await repo.createJournalEntry({
      date: "2032-03-05",
      description: "TEST revenue",
      reference: `TEST-REV-${TAG}`,
      source_type: "test",
      items: [
        { account_id: accounts.cash, debit: 1000, credit: 0 },
        { account_id: accounts.salesRevenue, debit: 0, credit: 1000 },
      ],
    });
    await repo.createJournalEntry({
      date: "2032-03-06",
      description: "TEST expense",
      reference: `TEST-EXP-${TAG}`,
      source_type: "test",
      items: [
        { account_id: accounts.expense, debit: 400, credit: 0 },
        { account_id: accounts.cash, debit: 0, credit: 400 },
      ],
    });

    const preview = await previewFiscalYear(fy2032);
    expect(preview.revenue_total).toBeCloseTo(1000, 2);
    expect(preview.expense_total).toBeCloseTo(400, 2);
    expect(preview.net_result).toBeCloseTo(600, 2);
    expect(preview.totals.difference).toBeCloseTo(0, 2);
    expect(preview.totals.openingDebit).toBeCloseTo(preview.totals.openingCredit, 2);

    const snapshot = await pool.query(
      `SELECT (SELECT COALESCE(SUM(current_balance),0) FROM treasury_accounts)::numeric AS treasury,
              (SELECT COALESCE(SUM(balance),0) FROM suppliers)::numeric AS suppliers`,
    );

    const result = await closeFiscalYear(fy2032, {
      user: ADMIN,
      reason: "إقفال سنة اختبارية",
      forceClosePeriods: true,
      nextYearName: `TEST-FY-2033-${TAG}`,
    });

    expect(result.already_closed).toBe(false);
    expect(Number(result.net_result)).toBeCloseTo(600, 2);
    expect(result.closing_entry_id).toBeTruthy();
    expect(result.retained_entry_id).toBeTruthy();
    expect(result.opening_entry_id).toBeTruthy();
    netResult = Number(result.net_result);

    // حسابات الإيرادات والمصروفات أصبحت صفرًا داخل السنة المقفلة
    const plInYear = await pool.query(
      `SELECT a.type, COALESCE(SUM(ji.debit - ji.credit),0)::numeric AS net
         FROM journal_items ji
         JOIN journal_entries je ON je.id = ji.journal_entry_id
         JOIN accounts a ON a.id = ji.account_id
        WHERE je.status = 'posted' AND je.date::date BETWEEN '2032-01-01' AND '2032-12-31'
          AND a.type IN ('revenue','expense')
        GROUP BY a.type`,
    );
    for (const row of plInYear.rows) {
      expect(Number(row.net)).toBeCloseTo(0, 2);
    }

    // قيود الإقفال والأرصدة الافتتاحية موجودة ومرتبطة
    const closingEntries = await pool.query(
      `SELECT id, date::text AS date, status, total_debit, total_credit
         FROM journal_entries WHERE source_type = 'year_end_closing' AND source_id = $1 ORDER BY id`,
      [fy2032],
    );
    expect(closingEntries.rows.length).toBe(2);

    const opening = await pool.query(
      `SELECT je.id, to_char(je.date,'YYYY-MM-DD') AS date, je.status,
              COALESCE(SUM(ji.debit),0)::numeric AS debit,
              COALESCE(SUM(ji.credit),0)::numeric AS credit
         FROM journal_entries je
         LEFT JOIN journal_items ji ON ji.journal_entry_id = je.id
        WHERE je.source_type = 'opening_balance' AND je.source_id = $1
        GROUP BY je.id`,
      [result.next_fiscal_year_id],
    );
    expect(opening.rows.length).toBe(1);
    expect(Number(opening.rows[0].debit)).toBeCloseTo(Number(opening.rows[0].credit), 2);
    expect(opening.rows[0].date).toBe("2033-01-01");

    // الرصيد النقدي الافتتاحي يطابق الرصيد الختامي الفعلي
    const cashAfter = await accountNet(accounts.cash, "2032-12-31");
    expect(cashAfter - cashBefore).toBeCloseTo(600, 2);
    const openingCash = await pool.query(
      `SELECT ji.debit - ji.credit AS net FROM journal_items ji WHERE ji.journal_entry_id = $1 AND ji.account_id = $2`,
      [opening.rows[0].id, accounts.cash],
    );
    expect(Number(openingCash.rows[0].net)).toBeCloseTo(cashAfter, 2);

    // أرصدة الخزائن والموردين لم تُصفَّر
    const afterSnapshot = await pool.query(
      `SELECT (SELECT COALESCE(SUM(current_balance),0) FROM treasury_accounts)::numeric AS treasury,
              (SELECT COALESCE(SUM(balance),0) FROM suppliers)::numeric AS suppliers`,
    );
    expect(Number(afterSnapshot.rows[0].treasury)).toBe(Number(snapshot.rows[0].treasury));
    expect(Number(afterSnapshot.rows[0].suppliers)).toBe(Number(snapshot.rows[0].suppliers));

    // الدفاتر متوازنة بعد الإقفال
    const totals = await totalsUntil("2032-12-31");
    expect(totals.debit).toBeCloseTo(totals.credit, 2);
  });

  it("إعادة طلب الإقفال السنوي لا تنشئ قيودًا مكررة", async () => {
    const again = await closeFiscalYear(fy2032, {
      user: ADMIN,
      reason: "تكرار",
      forceClosePeriods: true,
      nextYearName: `TEST-FY-2033-${TAG}`,
    });
    expect(again.already_closed).toBe(true);

    const count = await pool.query(
      `SELECT COUNT(*)::int AS n FROM journal_entries WHERE source_type = 'year_end_closing' AND source_id = $1`,
      [fy2032],
    );
    expect(count.rows[0].n).toBe(2);
  });

  it("منع ترحيل قيد داخل السنة المالية المغلقة", async () => {
    await expect(postBalanced("2032-06-15", 10, `TEST-BLOCKED-YEAR-${TAG}`)).rejects.toMatchObject({
      code: "PERIOD_CLOSED",
    });
  });

  it("الأرصدة الافتتاحية مطابقة للأرصدة الختامية", async () => {
    const fyRow = await pool.query("SELECT opening_entry_id FROM fiscal_years WHERE id = $1", [fy2032]);
    const openingEntryId = Number(fyRow.rows[0].opening_entry_id);

    const openingLines = await pool.query(
      `SELECT ji.account_id, ji.debit, ji.credit, a.code, a.type
         FROM journal_items ji
         JOIN accounts a ON a.id = ji.account_id
        WHERE ji.journal_entry_id = $1`,
      [openingEntryId],
    );
    expect(openingLines.rows.length).toBeGreaterThan(0);

    // كل حساب أصل/التزام في القيد الافتتاحي يجب أن يطابق رصيده الختامي
    for (const line of openingLines.rows) {
      if (!["asset", "liability"].includes(String(line.type))) continue;
      const closingNet = await accountNet(Number(line.account_id), "2032-12-31");
      const openingNet = Number(line.debit) - Number(line.credit);
      expect(openingNet).toBeCloseTo(closingNet, 2);
    }

    const balance = openingLines.rows.reduce(
      (acc, line) => ({ debit: acc.debit + Number(line.debit), credit: acc.credit + Number(line.credit) }),
      { debit: 0, credit: 0 },
    );
    expect(balance.debit).toBeCloseTo(balance.credit, 2);
    expect(netResult).toBeCloseTo(600, 2);
  });
});
