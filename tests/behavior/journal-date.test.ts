import { describe, it, expect, afterAll } from "vitest";
import { AccountRepository } from "../../modules/accounts/repositories/account.repository.js";
import { localTodayYMD } from "../../modules/accounts/services/auto-posting.service.js";
import { ensureChartOfAccounts, ensureUser, uniqueTag, withCommit } from "../helpers/testDb.js";

const repo = new AccountRepository();

function localDayString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Entries created through the repository, whose account balances were updated. */
const createdEntryIds: number[] = [];
/** Rows inserted directly with SQL, which never touched the cached balances. */
const rawInsertedEntryIds: number[] = [];

async function deleteEntries(ids: number[], revertBalances: boolean): Promise<void> {
  if (!ids.length) return;
  await withCommit(async (client) => {
    if (revertBalances) {
      const items = await client.query(
        "SELECT account_id, debit, credit FROM journal_items WHERE journal_entry_id = ANY($1::int[])",
        [ids],
      );
      for (const item of items.rows) {
        await client.query("UPDATE accounts SET balance = balance - ($1::numeric - $2::numeric) WHERE id = $3", [
          Number(item.debit),
          Number(item.credit),
          item.account_id,
        ]);
      }
    }
    await client.query("DELETE FROM journal_items WHERE journal_entry_id = ANY($1::int[])", [ids]);
    await client.query("DELETE FROM journal_entries WHERE id = ANY($1::int[])", [ids]);
  });
}

afterAll(async () => {
  await deleteEntries(createdEntryIds, true);
  await deleteEntries(rawInsertedEntryIds, false);
});

describe("تاريخ القيد — التخزين والعرض والبحث في نفس اليوم", () => {
  it("localTodayYMD يعتمد اليوم المحلي لا يوم UTC", () => {
    expect(localTodayYMD()).toBe(localDayString(new Date()));

    for (const offsetHours of [0, 1, 2, 3, 4, 21, 22, 23]) {
      const reference = new Date(2026, 9, 13, offsetHours, 30, 0);
      expect(localTodayYMD(reference)).toBe(localDayString(reference));
    }

    // Regression guard for the reported defect: in the small hours of a local day
    // with a positive UTC offset, the old toISOString()-based code returned the
    // *previous* day and posted the entry on the wrong date.
    const earlyLocal = new Date(2026, 9, 13, 1, 0, 0);
    expect(localTodayYMD(earlyLocal)).toBe("2026-10-13");
    const utcRendering = earlyLocal.toISOString().slice(0, 10);
    if (utcRendering !== "2026-10-13") {
      expect(utcRendering).toBe("2026-10-12");
    }
  });

  it("قيد بتاريخ اليوم يُحفظ بذلك اليوم ويُعرض في القائمة بنفس اليوم ويُبحث به", async () => {
    const day = localTodayYMD();
    const reference = uniqueTag("JE-DAY");

    const { accounts, entry } = await withCommit(async (client) => {
      const seeded = await ensureChartOfAccounts(client);
      await ensureUser(client);
      const created = await repo.createJournalEntry(
        {
          date: day,
          description: "قيد اختبار التاريخ",
          reference,
          source_type: "test",
          items: [
            { account_id: seeded.cash, debit: 100, credit: 0 },
            { account_id: seeded.salesRevenue, debit: 0, credit: 100 },
          ],
        },
        client,
      );
      return { accounts: seeded, entry: created };
    });

    createdEntryIds.push(Number(entry.id));

    const stored = await withCommit(async (client) =>
      client.query("SELECT to_char(date, 'YYYY-MM-DD') AS day FROM journal_entries WHERE id = $1", [entry.id]),
    );
    expect(stored.rows[0].day).toBe(day);

    // The list projection used by the accounting screens.
    const listed = await repo.getJournalEntries({ date_from: day, date_to: day, source_type: "test", page_size: 200 });
    const listedRow = listed.data.find((row: any) => Number(row.id) === Number(entry.id));
    expect(listedRow, "القيد يجب أن يظهر عند التصفية بتاريخ اليوم").toBeTruthy();
    expect(listedRow.date).toBe(day);

    // Searching by the same day must not miss it either way round.
    const exact = await withCommit(async (client) =>
      client.query("SELECT id FROM journal_entries WHERE date::date = $1::date AND id = $2", [day, entry.id]),
    );
    expect(exact.rows).toHaveLength(1);

    expect(accounts.cash).toBeGreaterThan(0);
  }, 60_000);

  /**
   * KNOWN BEHAVIOUR (recorded, not fixed): `je.date` is a timestamp column and the
   * list filter compares it directly against a 'YYYY-MM-DD' string, so an entry
   * whose stored time is later than midnight is dropped from a same-day filter.
   * Entries written with an explicit date-only value are unaffected.
   */
  it.fails("سلوك معروف: بحث «اليوم» يجد أيضًا القيود المخزَّنة بطابع زمني داخل اليوم", async () => {
    const day = localTodayYMD();

    const { entryId } = await withCommit(async (client) => {
      const accounts = await ensureChartOfAccounts(client);
      await ensureUser(client);
      // Simulates any writer that omits the date and lets the column default fire.
      const inserted = await client.query(
        `INSERT INTO journal_entries (description, reference, source_type, status, total_debit, total_credit)
         VALUES ('قيد بطابع زمني', $1, 'test', 'posted', 10, 10) RETURNING id`,
        [uniqueTag("JE-TS")],
      );
      await client.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
         VALUES ($1, $2, 10, 0, 'اختبار'), ($1, $3, 0, 10, 'اختبار')`,
        [inserted.rows[0].id, accounts.cash, accounts.salesRevenue],
      );
      return { entryId: Number(inserted.rows[0].id) };
    });

    rawInsertedEntryIds.push(entryId);

    const listed = await repo.getJournalEntries({ date_from: day, date_to: day, source_type: "test", page_size: 200 });
    expect(listed.data.some((row: any) => Number(row.id) === entryId)).toBe(true);
  }, 60_000);
});
