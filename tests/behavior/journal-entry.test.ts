import { describe, it, expect } from "vitest";
import { AccountRepository } from "../../modules/accounts/repositories/account.repository.js";
import { ensureChartOfAccounts, uniqueTag, withRollback } from "../helpers/testDb.js";

const repo = new AccountRepository();

/** Cached account balances keyed by account id. */
async function readBalances(client: any, accountIds: number[]): Promise<Record<number, number>> {
  const rows = await client.query("SELECT id, balance FROM accounts WHERE id = ANY($1::int[])", [accountIds]);
  const map: Record<number, number> = {};
  for (const row of rows.rows) map[Number(row.id)] = Number(row.balance);
  return map;
}

describe("قيود اليومية — الإنشاء والتحقق من الاتزان", () => {
  it("يقبل قيدًا متوازنًا (مدين = دائن) ويثبّت البنود وأرصدة الحسابات", async () => {
    await withRollback(async (client) => {
      const accounts = await ensureChartOfAccounts(client);
      const reference = uniqueTag("JE-BAL");
      const balanceBefore = await readBalances(client, [accounts.cash, accounts.salesRevenue]);

      const entry = await repo.createJournalEntry(
        {
          date: "2026-10-13",
          description: "قيد اختبار متوازن",
          reference,
          source_type: "test",
          items: [
            { account_id: accounts.cash, debit: 1000, credit: 0 },
            { account_id: accounts.salesRevenue, debit: 0, credit: 1000 },
          ],
        },
        client,
      );

      expect(entry).toBeTruthy();
      expect(entry.id).toBeGreaterThan(0);
      expect(Number(entry.total_debit)).toBe(1000);
      expect(Number(entry.total_credit)).toBe(1000);
      expect(entry.item_ids).toHaveLength(2);

      const items = await client.query(
        "SELECT debit, credit FROM journal_items WHERE journal_entry_id = $1 ORDER BY id",
        [entry.id],
      );
      expect(items.rows).toHaveLength(2);
      const debitSum = items.rows.reduce((sum: number, row: any) => sum + Number(row.debit), 0);
      const creditSum = items.rows.reduce((sum: number, row: any) => sum + Number(row.credit), 0);
      expect(debitSum).toBe(creditSum);
      expect(debitSum).toBe(1000);

      // Assert the movement this entry caused, not an absolute balance, so the
      // suite stays correct whatever else lives in the shared test database.
      const balanceAfter = await readBalances(client, [accounts.cash, accounts.salesRevenue]);
      expect(balanceAfter[accounts.cash] - balanceBefore[accounts.cash]).toBe(1000);
      expect(balanceAfter[accounts.salesRevenue] - balanceBefore[accounts.salesRevenue]).toBe(-1000);
    });
  });

  it("يرفض قيدًا غير متوازن ولا يترك أي أثر في قاعدة البيانات", async () => {
    await withRollback(async (client) => {
      const accounts = await ensureChartOfAccounts(client);
      const reference = uniqueTag("JE-UNBAL");

      await expect(
        repo.createJournalEntry(
          {
            date: "2026-10-13",
            description: "قيد اختبار غير متوازن",
            reference,
            source_type: "test",
            items: [
              { account_id: accounts.cash, debit: 1000, credit: 0 },
              { account_id: accounts.salesRevenue, debit: 0, credit: 700 },
            ],
          },
          client,
        ),
      ).rejects.toThrow(/غير متزن/);

      const persisted = await client.query("SELECT id FROM journal_entries WHERE reference = $1", [reference]);
      expect(persisted.rows).toHaveLength(0);
    });
  });

  it("يرفض قيدًا بمبلغ صفر أو بدون بنود", async () => {
    await withRollback(async (client) => {
      const accounts = await ensureChartOfAccounts(client);

      await expect(
        repo.createJournalEntry(
          {
            date: "2026-10-13",
            description: "قيد صفري",
            reference: uniqueTag("JE-ZERO"),
            items: [
              { account_id: accounts.cash, debit: 0, credit: 0 },
              { account_id: accounts.salesRevenue, debit: 0, credit: 0 },
            ],
          },
          client,
        ),
      ).rejects.toThrow(/أكبر من صفر/);

      await expect(
        repo.createJournalEntry(
          { date: "2026-10-13", description: "قيد بلا بنود", reference: uniqueTag("JE-EMPTY"), items: [] },
          client,
        ),
      ).rejects.toThrow(/بنود/);
    });
  });

  it("يرفض بندًا بحساب غير صالح", async () => {
    await withRollback(async (client) => {
      const accounts = await ensureChartOfAccounts(client);

      await expect(
        repo.createJournalEntry(
          {
            date: "2026-10-13",
            description: "بند بحساب غير محدد",
            reference: uniqueTag("JE-NOACC"),
            items: [
              { account_id: null, debit: 500, credit: 0 },
              { account_id: accounts.salesRevenue, debit: 0, credit: 500 },
            ],
          },
          client,
        ),
      ).rejects.toThrow(/حساب غير محدد/);
    });
  });
});
