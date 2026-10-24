import { describe, it, expect, afterAll } from "vitest";
import { ReturnService } from "../../modules/sales/services/return.service.js";
import { moveStock } from "../../modules/warehouses/services/inventory.service.js";
import { CustomerLedgerService } from "../../modules/customers/services/customer-ledger.service.js";
import {
  ensureChartOfAccounts,
  ensureCustomer,
  ensureIngredient,
  ensureTreasuryAccount,
  ensureUser,
  ensureWarehouse,
  uniqueTag,
  withCommit,
} from "../helpers/testDb.js";

const service = new ReturnService();

const createdReturnIds: number[] = [];
const stockFixtures: Array<{ warehouseId: number; ingredientId: number }> = [];

function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

async function treasuryBalance(): Promise<number> {
  return withCommit(async (client) => {
    const rows = await client.query(
      "SELECT COALESCE(SUM(current_balance), 0) AS balance FROM treasury_accounts WHERE status = 'active'",
    );
    return Number(rows.rows[0].balance);
  });
}

async function cleanupReturns(): Promise<void> {
  if (!createdReturnIds.length) return;
  const ids = [...createdReturnIds];
  const idStrings = ids.map(String);
  await withCommit(async (client) => {
    // Undo the treasury movements before deleting them so balances stay honest.
    const treasuryRows = await client.query(
      "SELECT account_id, amount FROM treasury_transactions WHERE reference_type = 'sales return' AND reference_id = ANY($1::int[])",
      [ids],
    );
    for (const row of treasuryRows.rows) {
      await client.query(
        "UPDATE treasury_accounts SET current_balance = COALESCE(current_balance, 0) - $1 WHERE id = $2",
        [row.amount, row.account_id],
      );
    }
    await client.query(
      "DELETE FROM treasury_transactions WHERE reference_type = 'sales return' AND reference_id = ANY($1::int[])",
      [ids],
    );
    await client.query(
      "DELETE FROM customer_transactions WHERE source_type = 'SALES_RETURN' AND source_id = ANY($1::text[])",
      [idStrings],
    );
    await client.query(
      "DELETE FROM financial_integration_logs WHERE source_type = 'SALES_RETURN' AND source_id = ANY($1::text[])",
      [idStrings],
    );
    await client.query(
      "DELETE FROM financial_transactions WHERE source_type = 'SALES_RETURN' AND source_id = ANY($1::text[])",
      [idStrings],
    );
    await client.query(
      `DELETE FROM journal_items WHERE journal_entry_id IN (
         SELECT id FROM journal_entries WHERE source_type = 'sales_return' AND source_id = ANY($1::int[])
       )`,
      [ids],
    );
    await client.query(
      "DELETE FROM journal_entries WHERE source_type = 'sales_return' AND source_id = ANY($1::int[])",
      [ids],
    );
    await client.query("DELETE FROM sales_return_items WHERE return_id = ANY($1::int[])", [ids]);
    await client.query("DELETE FROM sales_returns WHERE id = ANY($1::int[])", [ids]);
    for (const refType of ["sales_return"]) {
      await client.query(
        `DELETE FROM inventory_stock_ledger WHERE ref_type = $1 AND ref_id = ANY($2::int[])`,
        [refType, ids],
      );
      await client.query(
        `DELETE FROM inventory_movements WHERE ref_type = $1 AND ref_id = ANY($2::int[])`,
        [refType, ids],
      );
      await client.query(
        `DELETE FROM inventory_transactions WHERE reference_type = $1 AND reference_id = ANY($2::int[])`,
        [refType, ids],
      );
    }
    for (const fixture of stockFixtures) {
      await client.query(
        `DELETE FROM inventory_stock_ledger WHERE warehouse_id = $1 AND ingredient_id = $2`,
        [fixture.warehouseId, fixture.ingredientId],
      );
      await client.query(
        `DELETE FROM inventory_movements WHERE warehouse_id = $1 AND ingredient_id = $2`,
        [fixture.warehouseId, fixture.ingredientId],
      );
      await client.query(
        `DELETE FROM inventory_transactions WHERE warehouse_id = $1 AND ingredient_id = $2`,
        [fixture.warehouseId, fixture.ingredientId],
      );
      await client.query("DELETE FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2", [
        fixture.warehouseId,
        fixture.ingredientId,
      ]);
      await client.query("UPDATE ingredients SET current_stock = 0, avg_cost = 0, cost = 0 WHERE id = $1", [
        fixture.ingredientId,
      ]);
    }
  });
  createdReturnIds.length = 0;
  stockFixtures.length = 0;
}

afterAll(cleanupReturns);

/** Seeds everything a posted return needs: accounts, treasury, customer, stock. */
async function seedReturnFixtures(tag: string) {
  const seeded = await withCommit(async (client) => {
    const accounts = await ensureChartOfAccounts(client);
    await ensureUser(client);
    const treasuryAccountId = await ensureTreasuryAccount(client, uniqueTag("TREASURY"));
    const customerId = await ensureCustomer(client, tag);
    const warehouseId = await ensureWarehouse(client, uniqueTag("WH"));
    const ingredientId = await ensureIngredient(client, uniqueTag("ITEM"));
    return { accounts, treasuryAccountId, customerId, warehouseId, ingredientId };
  });

  // Stock in the warehouse at a known cost so the return can value what comes back.
  await withCommit(async (client) => {
    await moveStock(client, {
      warehouse_id: seeded.warehouseId,
      ingredient_id: seeded.ingredientId,
      delta: 10,
      ref_type: "goods_receipt",
      ref_id: 900001,
      unit_cost: 30,
    });
  });

  stockFixtures.push({ warehouseId: seeded.warehouseId, ingredientId: seeded.ingredientId });
  return seeded;
}

function returnPayload(seeded: Awaited<ReturnType<typeof seedReturnFixtures>>, tag: string, refundMethod: string) {
  return {
    invoiceId: undefined,
    customerId: seeded.customerId,
    customerName: tag,
    date: today(),
    reason: "منتج تالف",
    returnType: "مرتجع نقدي",
    refundMethod,
    salesRep: "مندوب اختبار",
    warehouseId: seeded.warehouseId,
    branchId: 1,
    status: "معتمد",
    itemsTotal: 100,
    taxTotal: 10,
    discountTotal: 0,
    expenses: 0,
    grandTotal: 110,
    items: [
      {
        itemCode: "ITEM-RET",
        itemName: `${tag}-صنف مرتجع`,
        unit: "قطعة",
        qtyInvoiced: 5,
        qtyReturned: 2,
        price: 50,
        discount: 0,
        taxRate: 10,
        total: 100,
        ingredientId: seeded.ingredientId,
      },
    ],
  } as any;
}

describe("مرتجع المبيعات — الخزينة والقيود ورد المخزون", () => {
  it("الاسترداد النقدي: يخرج المبلغ من الخزينة ويُرحَّل قيد متوازن ويُعاد المخزون", async () => {
    const tag = uniqueTag("RETCASH");
    const seeded = await seedReturnFixtures(tag);

    const treasuryBefore = await treasuryBalance();
    const receivableBefore = await CustomerLedgerService.getReceivable(seeded.customerId);

    const doc = await service.createReturn(returnPayload(seeded, tag, "رد نقدي"));
    createdReturnIds.push(Number(doc.id));

    expect(Number(doc.id)).toBeGreaterThan(0);
    expect(doc.journalEntryId).toBeTruthy();
    expect(doc.treasuryTransactionId).toBeTruthy();
    expect(doc.finNumber).toBeTruthy();

    // 1. الخزينة تأثرت فعليًا بخرج المبلغ.
    expect(treasuryBefore - (await treasuryBalance())).toBe(110);

    const treasury = await withCommit(async (client) =>
      client.query("SELECT transaction_type, amount, voucher_number FROM treasury_transactions WHERE id = $1", [
        doc.treasuryTransactionId,
      ]),
    );
    expect(treasury.rows).toHaveLength(1);
    expect(treasury.rows[0].transaction_type).toBe("cash_out");
    expect(Number(treasury.rows[0].amount)).toBe(-110);
    expect(treasury.rows[0].voucher_number).toBe(doc.returnNo);

    // 2. القيد المحاسبي مرتبط بالمرتجع ومتوازن.
    const journal = await withCommit(async (client) =>
      client.query(
        `SELECT je.id, je.total_debit, je.total_credit
           FROM journal_entries je
          WHERE je.source_type = 'sales_return' AND je.source_id = $1`,
        [doc.id],
      ),
    );
    expect(journal.rows).toHaveLength(1);
    expect(Number(journal.rows[0].total_debit)).toBe(Number(journal.rows[0].total_credit));
    expect(Number(journal.rows[0].total_debit)).toBe(170);

    const lines = await withCommit(async (client) =>
      client.query("SELECT account_id, debit, credit FROM journal_items WHERE journal_entry_id = $1", [
        journal.rows[0].id,
      ]),
    );
    const debitSum = lines.rows.reduce((sum: number, row: any) => sum + Number(row.debit), 0);
    const creditSum = lines.rows.reduce((sum: number, row: any) => sum + Number(row.credit), 0);
    expect(debitSum).toBe(creditSum);
    // مردودات المبيعات مدين 100 + ضريبة مدين 10 + مخزون مدين 60 مقابل خزينة دائن 110 وتكلفة مبيعات دائن 60.
    expect(lines.rows.some((line: any) => Number(line.account_id) === seeded.accounts.cash && Number(line.credit) === 110)).toBe(true);
    expect(lines.rows.some((line: any) => Number(line.account_id) === seeded.accounts.taxPayable && Number(line.debit) === 10)).toBe(true);
    expect(lines.rows.some((line: any) => Number(line.account_id) === seeded.accounts.inventory && Number(line.debit) === 60)).toBe(true);
    expect(lines.rows.some((line: any) => Number(line.account_id) === seeded.accounts.cogs && Number(line.credit) === 60)).toBe(true);

    // 3. حركة مالية مركزية واحدة ومرجع FIN.
    const financial = await withCommit(async (client) =>
      client.query(
        "SELECT fin_number, journal_entry_id, treasury_transaction_id FROM financial_transactions WHERE source_type = 'SALES_RETURN' AND source_id = $1",
        [String(doc.id)],
      ),
    );
    expect(financial.rows).toHaveLength(1);
    expect(Number(financial.rows[0].journal_entry_id)).toBe(Number(doc.journalEntryId));
    expect(Number(financial.rows[0].treasury_transaction_id)).toBe(Number(doc.treasuryTransactionId));

    // 4. البضاعة عادت للمخزن ولم يتغير رصيد العميل في استرداد نقدي.
    const stock = await withCommit(async (client) =>
      client.query("SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2", [
        seeded.warehouseId,
        seeded.ingredientId,
      ]),
    );
    expect(Number(stock.rows[0].quantity)).toBe(12);
    expect(Number(doc.totalCost)).toBe(60);
    expect(await CustomerLedgerService.getReceivable(seeded.customerId)).toBe(receivableBefore);
  }, 60_000);

  it("الإشعار الدائن: يخفّض رصيد العميل ولا يمسّ الخزينة", async () => {
    const tag = uniqueTag("RETCREDIT");
    const seeded = await seedReturnFixtures(tag);

    const treasuryBefore = await treasuryBalance();
    const receivableBefore = await CustomerLedgerService.getReceivable(seeded.customerId);

    const doc = await service.createReturn(returnPayload(seeded, tag, "إشعار دائن للعميل"));
    createdReturnIds.push(Number(doc.id));

    expect(doc.journalEntryId).toBeTruthy();
    expect(doc.treasuryTransactionId).toBeFalsy();
    expect(await treasuryBalance()).toBe(treasuryBefore);

    const ledger = await withCommit(async (client) =>
      client.query(
        "SELECT type, amount FROM customer_transactions WHERE source_type = 'SALES_RETURN' AND source_id = $1",
        [String(doc.id)],
      ),
    );
    expect(ledger.rows).toHaveLength(1);
    expect(ledger.rows[0].type).toBe("payment");
    expect(Number(ledger.rows[0].amount)).toBe(110);
    expect(receivableBefore - (await CustomerLedgerService.getReceivable(seeded.customerId))).toBe(110);

    const journal = await withCommit(async (client) =>
      client.query(
        `SELECT total_debit, total_credit FROM journal_entries WHERE source_type = 'sales_return' AND source_id = $1`,
        [doc.id],
      ),
    );
    expect(journal.rows).toHaveLength(1);
    expect(Number(journal.rows[0].total_debit)).toBe(Number(journal.rows[0].total_credit));

    const stock = await withCommit(async (client) =>
      client.query("SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2", [
        seeded.warehouseId,
        seeded.ingredientId,
      ]),
    );
    expect(Number(stock.rows[0].quantity)).toBe(12);
  }, 60_000);

  it("المسودة لا تُرحَّل، والاعتماد يرحّل مرة واحدة فقط، ورقم المرتجع لا يتكرر", async () => {
    const tag = uniqueTag("RETIDEM");
    const seeded = await seedReturnFixtures(tag);
    const ids: number[] = [];

    const treasuryBefore = await treasuryBalance();

    // 1. المسودة لا تمس المخزون ولا الخزينة ولا القيود.
    const draft = await service.createReturn({
      ...returnPayload(seeded, tag, "رد نقدي"),
      status: "مسودة",
    } as any);
    ids.push(Number(draft.id));
    createdReturnIds.push(Number(draft.id));
    expect(draft.journalEntryId).toBeFalsy();
    expect(await treasuryBalance()).toBe(treasuryBefore);

    const draftStock = await withCommit(async (client) =>
      client.query("SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2", [
        seeded.warehouseId,
        seeded.ingredientId,
      ]),
    );
    expect(Number(draftStock.rows[0].quantity)).toBe(10);

    // 2. الاعتماد يرحّل الأثر مرة واحدة.
    const approved = await service.updateReturn(Number(draft.id), {
      ...returnPayload(seeded, tag, "رد نقدي"),
      id: Number(draft.id),
      returnNo: draft.returnNo,
      status: "معتمد",
    } as any);
    expect(approved.journalEntryId).toBeTruthy();
    expect(treasuryBefore - (await treasuryBalance())).toBe(110);

    // 3. إعادة إرسال نفس المرتجع لا تضيف قيدًا أو حركة خزينة ثانية.
    await service.updateReturn(Number(draft.id), {
      ...returnPayload(seeded, tag, "رد نقدي"),
      id: Number(draft.id),
      returnNo: draft.returnNo,
      status: "معتمد",
    } as any);

    // 4. رقم المرتجع يُصدر من الخادم: إرسال رقم مستخدم مسبقًا لا يسبب تكرارًا.
    const again = await service.createReturn({
      ...returnPayload(seeded, tag, "رد نقدي"),
      returnNo: draft.returnNo,
      status: "معتمد",
    } as any);
    ids.push(Number(again.id));
    createdReturnIds.push(Number(again.id));
    expect(again.returnNo).not.toBe(draft.returnNo);

    const counts = await withCommit(async (client) => {
      const journals = await client.query(
        "SELECT count(*)::int AS count FROM journal_entries WHERE source_type = 'sales_return' AND source_id = ANY($1::int[])",
        [ids],
      );
      const treasuryRows = await client.query(
        "SELECT count(*)::int AS count FROM treasury_transactions WHERE reference_type = 'sales return' AND reference_id = ANY($1::int[])",
        [ids],
      );
      return {
        journals: Number(journals.rows[0].count),
        treasuryRows: Number(treasuryRows.rows[0].count),
      };
    });

    // مستندان فقط، ولكل مستند قيد واحد وحركة خزينة واحدة.
    expect(counts.journals).toBe(2);
    expect(counts.treasuryRows).toBe(2);
    expect(treasuryBefore - (await treasuryBalance())).toBe(220);
  }, 60_000);
});
