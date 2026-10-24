import { describe, it, expect, afterAll } from "vitest";
import { InvoiceService } from "../../modules/sales/services/invoice.service.js";
import { moveStock } from "../../modules/warehouses/services/inventory.service.js";
import { financialIntegrationService } from "../../modules/accounting/services/financial_integration.service.js";
import { CustomerLedgerService } from "../../modules/customers/services/customer-ledger.service.js";
import { ensureSalesPostingAccounts } from "../../server-db-init.js";
import {
  ensureChartOfAccounts,
  ensureCustomer,
  ensureIngredient,
  ensureTreasuryAccount,
  ensureUser,
  ensureWarehouse,
  uniqueTag,
  withCommit,
  withRollback,
} from "../helpers/testDb.js";

const service = new InvoiceService();
const createdInvoiceIds: number[] = [];
const createdStockFixtures: Array<{ invoiceId: number; warehouseId: number; ingredientId: number }> = [];
const createdSalesProductIds: number[] = [];
const createdIngredientIds: number[] = [];

/** Local (server) calendar day — computed independently of the code under test. */
function today(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Remove everything an issued invoice left behind so reruns stay deterministic. */
async function cleanupInvoice(invoiceId: number): Promise<void> {
  await withCommit(async (client) => {
    const financialTransactions = await client.query(
      `SELECT fin_number, treasury_transaction_id, bank_transaction_id, customer_transaction_id
         FROM financial_transactions
        WHERE source_type = 'SALES_INVOICE' AND source_id = $1`,
      [String(invoiceId)],
    );
    const treasuryTransactionIds = financialTransactions.rows
      .map((row: any) => Number(row.treasury_transaction_id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    if (treasuryTransactionIds.length) {
      const treasuryRows = await client.query(
        "SELECT account_id, amount FROM treasury_transactions WHERE id = ANY($1::int[])",
        [treasuryTransactionIds],
      );
      for (const row of treasuryRows.rows) {
        await client.query(
          "UPDATE treasury_accounts SET current_balance = COALESCE(current_balance, 0) - $1 WHERE id = $2",
          [row.amount, row.account_id],
        );
      }
      await client.query("DELETE FROM treasury_transactions WHERE id = ANY($1::int[])", [treasuryTransactionIds]);
    }

    const bankTransactionIds = financialTransactions.rows
      .map((row: any) => Number(row.bank_transaction_id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    if (bankTransactionIds.length) {
      const bankRows = await client.query(
        "SELECT account_id, amount, type FROM bank_transactions WHERE id = ANY($1::int[])",
        [bankTransactionIds],
      );
      for (const row of bankRows.rows) {
        const reverseAmount = row.type === "credit" ? -Number(row.amount) : Number(row.amount);
        await client.query(
          "UPDATE bank_accounts SET balance = COALESCE(balance, 0) + $1 WHERE id = $2",
          [reverseAmount, row.account_id],
        );
      }
      await client.query("DELETE FROM bank_transactions WHERE id = ANY($1::int[])", [bankTransactionIds]);
    }

    const customerTransactionIds = financialTransactions.rows
      .map((row: any) => Number(row.customer_transaction_id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    if (customerTransactionIds.length) {
      await client.query("DELETE FROM customer_transactions WHERE id = ANY($1::int[])", [customerTransactionIds]);
    }
    const finNumbers = financialTransactions.rows.map((row: any) => row.fin_number).filter(Boolean);
    if (finNumbers.length) {
      await client.query("DELETE FROM customer_transactions WHERE fin_number = ANY($1::text[])", [finNumbers]);
      await client.query("DELETE FROM financial_integration_logs WHERE fin_number = ANY($1::text[])", [finNumbers]);
    }
    await client.query(
      "DELETE FROM financial_transactions WHERE source_type = 'SALES_INVOICE' AND source_id = $1",
      [String(invoiceId)],
    );

    const entries = await client.query(
      "SELECT id FROM journal_entries WHERE source_type = 'SALES_INVOICE' AND source_id = $1",
      [invoiceId],
    );
    for (const entry of entries.rows) {
      // No `accounts.balance` revert here: this posting path never updates that
      // cache column (see the known-behaviour test at the bottom of this file),
      // so subtracting would corrupt the cached balance instead of restoring it.
      await client.query("DELETE FROM journal_items WHERE journal_entry_id = $1", [entry.id]);
    }
    await client.query("DELETE FROM journal_entries WHERE source_type = 'SALES_INVOICE' AND source_id = $1", [invoiceId]);
    await client.query("DELETE FROM sales_invoice_items WHERE invoice_id = $1", [invoiceId]);
    await client.query("DELETE FROM sales_invoices WHERE id = $1", [invoiceId]);
    await client.query("DELETE FROM inventory_stock_ledger WHERE ref_type = 'sales_invoice' AND ref_id = $1", [invoiceId]);
    await client.query("DELETE FROM inventory_movements WHERE ref_type = 'sales_invoice' AND ref_id = $1", [invoiceId]);
    await client.query(
      "DELETE FROM inventory_transactions WHERE reference_type = 'sales_invoice' AND reference_id = $1",
      [invoiceId],
    );

    const stockFixture = createdStockFixtures.find((fixture) => fixture.invoiceId === invoiceId);
    if (stockFixture) {
      await client.query(
        `DELETE FROM inventory_stock_ledger
          WHERE warehouse_id = $1 AND ingredient_id = $2 AND ref_id = $3
            AND ref_type IN ('sales_invoice', 'goods_receipt')`,
        [stockFixture.warehouseId, stockFixture.ingredientId, invoiceId],
      );
      await client.query(
        `DELETE FROM inventory_movements
          WHERE warehouse_id = $1 AND ingredient_id = $2 AND ref_id = $3
            AND ref_type IN ('sales_invoice', 'goods_receipt')`,
        [stockFixture.warehouseId, stockFixture.ingredientId, invoiceId],
      );
      await client.query(
        `DELETE FROM inventory_transactions
          WHERE warehouse_id = $1 AND ingredient_id = $2 AND reference_id = $3
            AND reference_type IN ('sales_invoice', 'goods_receipt')`,
        [stockFixture.warehouseId, stockFixture.ingredientId, invoiceId],
      );
      await client.query(
        "DELETE FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
        [stockFixture.warehouseId, stockFixture.ingredientId],
      );
      await client.query(
        "UPDATE ingredients SET current_stock = 0, avg_cost = 0, cost = 0 WHERE id = $1",
        [stockFixture.ingredientId],
      );
    }
  });
}

afterAll(async () => {
  for (const id of createdInvoiceIds) await cleanupInvoice(id);
  await withCommit(async (client) => {
    if (createdSalesProductIds.length) {
      await client.query("DELETE FROM sales_products WHERE id = ANY($1::int[])", [createdSalesProductIds]);
    }
    if (createdIngredientIds.length) {
      await client.query("DELETE FROM ingredients WHERE id = ANY($1::int[])", [createdIngredientIds]);
    }
  });
});

/** Net movement recorded in the GL for one account (debit - credit). */
async function ledgerNet(accountIds: number[]): Promise<Record<string, number>> {
  return withCommit(async (client) => {
    const rows = await client.query(
      "SELECT account_id, COALESCE(SUM(debit - credit), 0) AS net FROM journal_items WHERE account_id = ANY($1::int[]) GROUP BY account_id",
      [accountIds],
    );
    const map: Record<string, number> = {};
    for (const row of rows.rows) map[String(row.account_id)] = Number(row.net);
    return map;
  });
}

async function treasuryBalance(): Promise<number> {
  return withCommit(async (client) => {
    const rows = await client.query(
      "SELECT COALESCE(SUM(current_balance), 0) AS balance FROM treasury_accounts WHERE status = 'active'",
    );
    return Number(rows.rows[0].balance);
  });
}

describe("إصدار فاتورة مبيعات — المستند والقيود والأرصدة", () => {
  it("يسجل سند صرف العميل في دفتره والخزينة والقيد العام مرة واحدة", async () => {
    const tag = uniqueTag("CUSTOMER_DISBURSEMENT");
    await withRollback(async (client) => {
      const accounts = await ensureChartOfAccounts(client);
      const customerId = await ensureCustomer(client, tag);
      const treasuryAccountId = await ensureTreasuryAccount(client, uniqueTag("TREASURY"));

      const result = await financialIntegrationService.processFinancialTransaction({
        sourceType: "CUSTOMER_REFUND",
        sourceId: 202600001,
        eventType: "CUSTOMER_DISBURSED",
        totalAmount: 75,
        paymentMethod: "cash",
        paymentSplits: [{ method: "cash", amount: 75 }],
        treasuryAccountId,
        customerId,
        description: `صرف للعميل ${tag}`,
        idempotencyKey: `TEST_CUSTOMER_DISBURSEMENT_${tag}`,
        transactionClient: client,
      });
      const retry = await financialIntegrationService.processFinancialTransaction({
        sourceType: "CUSTOMER_REFUND",
        sourceId: 202600001,
        eventType: "CUSTOMER_DISBURSED",
        totalAmount: 75,
        paymentMethod: "cash",
        paymentSplits: [{ method: "cash", amount: 75 }],
        treasuryAccountId,
        customerId,
        description: `صرف للعميل ${tag}`,
        idempotencyKey: `TEST_CUSTOMER_DISBURSEMENT_${tag}`,
        transactionClient: client,
      });

      expect(result.success).toBe(true);
      expect(result.customerTransactionId).toBeTruthy();
      expect(result.treasuryTransactionId).toBeTruthy();
      expect(result.journalEntryId).toBeTruthy();
      expect(retry.status).toBe("EXISTING_PROCESSED");
      expect(retry.customerTransactionId).toBe(result.customerTransactionId);

      const customerLedger = await client.query(
        "SELECT type, amount FROM customer_transactions WHERE id = $1",
        [result.customerTransactionId],
      );
      expect(customerLedger.rows).toHaveLength(1);
      expect(customerLedger.rows[0].type).toBe("disbursement");
      expect(Number(customerLedger.rows[0].amount)).toBe(75);

      const treasury = await client.query(
        "SELECT transaction_type, amount FROM treasury_transactions WHERE id = $1",
        [result.treasuryTransactionId],
      );
      expect(treasury.rows).toHaveLength(1);
      expect(treasury.rows[0].transaction_type).toBe("cash_out");
      expect(Number(treasury.rows[0].amount)).toBe(-75);

      const journal = await client.query(
        "SELECT total_debit, total_credit FROM journal_entries WHERE id = $1",
        [result.journalEntryId],
      );
      expect(Number(journal.rows[0].total_debit)).toBe(75);
      expect(Number(journal.rows[0].total_credit)).toBe(75);

      const lines = await client.query(
        "SELECT account_id, debit, credit FROM journal_items WHERE journal_entry_id = $1",
        [result.journalEntryId],
      );
      expect(lines.rows).toHaveLength(2);
      expect(lines.rows.some((line: any) => Number(line.account_id) === accounts.receivable && Number(line.debit) === 75)).toBe(true);
      expect(lines.rows.some((line: any) => Number(line.account_id) === accounts.cash && Number(line.credit) === 75)).toBe(true);
    });
  });

  it("ينشئ ويربط الحسابات الناقصة عند وجود دليل حسابات جزئي", async () => {
    await withRollback(async (client) => {
      const accounts = await ensureChartOfAccounts(client);
      await client.query(
        "UPDATE account_config SET account_id = NULL WHERE key IN ('sales_revenue', 'cost_of_goods_sold', 'accounts_receivable', 'tax_payable')",
      );

      await ensureSalesPostingAccounts(client);
      const map = await financialIntegrationService.getAccountMap(client);

      expect(map.sales_revenue).toBeGreaterThan(0);
      expect(map.cost_of_goods_sold).toBeGreaterThan(0);
      expect(map.accounts_receivable).toBeGreaterThan(0);
      expect(map.tax_payable).toBeGreaterThan(0);
      expect(map.inventory_asset).toBe(accounts.inventory);
      expect(map.cost_of_goods_sold).not.toBe(map.inventory_asset);
    });
  });

  it("يحل مفاتيح حسابات المخزون والتكلفة القديمة المنتهية بـ _account", async () => {
    await withRollback(async (client) => {
      const accounts = await ensureChartOfAccounts(client);
      await client.query(
        `INSERT INTO account_config (key, account_id, updated_at)
         VALUES ('cost_of_goods_sold_account', $1, NOW()), ('inventory_asset_account', $2, NOW())
         ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = NOW()`,
        [accounts.cogs, accounts.inventory],
      );

      const map = await financialIntegrationService.getAccountMap(client);
      expect(map.cost_of_goods_sold).toBe(accounts.cogs);
      expect(map.inventory_asset).toBe(accounts.inventory);
    });
  });

  it("فاتورة نقدية معتمدة: تُحفظ بتاريخها وتُرحَّل بقيد متوازن يشغل الصندوق والخزينة", async () => {
    const tag = uniqueTag("CUST");

    const { customerId, accounts } = await withCommit(async (client) => {
      const seeded = await ensureChartOfAccounts(client);
      await ensureUser(client);
      await ensureTreasuryAccount(client, uniqueTag("TREASURY"));
      const created = await ensureCustomer(client, tag);
      return { customerId: created, accounts: seeded };
    });

    const accountsTracked = [accounts.cash, accounts.receivable, accounts.salesRevenue, accounts.taxPayable];
    const netBefore = await ledgerNet(accountsTracked);
    const treasuryBefore = await treasuryBalance();

    const invoice = await service.createInvoice({
      customerId,
      customerName: tag,
      date: today(),
      paymentMethod: "نقدي",
      status: "معتمدة",
      items: [
        { name: `${tag}-خدمة`, qty: 2, price: 500, discountPercent: 0, vatPercent: 15, total: 1150, itemType: "product" },
      ],
      paidAmount: 1150,
      subtotal: 1000,
      taxTotal: 150,
      netAmount: 1150,
    } as any);

    createdInvoiceIds.push(Number(invoice.id));

    expect(Number(invoice.id)).toBeGreaterThan(0);
    expect(Number(invoice.netAmount)).toBe(1150);
    expect(invoice.date).toBe(today());

    const stored = await withCommit(async (client) =>
      client.query("SELECT to_char(date, 'YYYY-MM-DD') AS day, net_amount FROM sales_invoices WHERE id = $1", [
        invoice.id,
      ]),
    );
    expect(stored.rows[0].day).toBe(today());
    expect(Number(stored.rows[0].net_amount)).toBe(1150);

    const entry = await withCommit(async (client) =>
      client.query(
        "SELECT id, to_char(date, 'YYYY-MM-DD') AS day, total_debit, total_credit FROM journal_entries WHERE source_type = 'SALES_INVOICE' AND source_id = $1 ORDER BY id DESC LIMIT 1",
        [invoice.id],
      ),
    );
    expect(entry.rows).toHaveLength(1);
    const journal = entry.rows[0];
    expect(journal.day).toBe(invoice.date);
    expect(Number(journal.total_debit)).toBe(Number(journal.total_credit));
    expect(Number(journal.total_debit)).toBe(1150);

    const lines = await withCommit(async (client) =>
      client.query("SELECT account_id, debit, credit FROM journal_items WHERE journal_entry_id = $1", [journal.id]),
    );
    const debitSum = lines.rows.reduce((sum: number, row: any) => sum + Number(row.debit), 0);
    const creditSum = lines.rows.reduce((sum: number, row: any) => sum + Number(row.credit), 0);
    expect(debitSum).toBe(creditSum);

    const netAfter = await ledgerNet(accountsTracked);
    expect((netAfter[String(accounts.cash)] ?? 0) - (netBefore[String(accounts.cash)] ?? 0)).toBe(1150);
    expect((netBefore[String(accounts.salesRevenue)] ?? 0) - (netAfter[String(accounts.salesRevenue)] ?? 0)).toBe(1000);
    expect((netBefore[String(accounts.taxPayable)] ?? 0) - (netAfter[String(accounts.taxPayable)] ?? 0)).toBe(150);
    expect(netAfter[String(accounts.receivable)] ?? 0).toBe(netBefore[String(accounts.receivable)] ?? 0);

    expect((await treasuryBalance()) - treasuryBefore).toBe(1150);
  }, 60_000);

  it("فاتورة آجلة: يُقيَّد المبلغ على ذمم العملاء لا على الصندوق أو الخزينة", async () => {
    const tag = uniqueTag("CUSTC");

    const { customerId, accounts } = await withCommit(async (client) => {
      const seeded = await ensureChartOfAccounts(client);
      await ensureUser(client);
      await ensureTreasuryAccount(client, uniqueTag("TREASURY"));
      const created = await ensureCustomer(client, tag);
      return { customerId: created, accounts: seeded };
    });

    const accountsTracked = [accounts.cash, accounts.receivable, accounts.salesRevenue];
    const netBefore = await ledgerNet(accountsTracked);
    const treasuryBefore = await treasuryBalance();

    const invoice = await service.createInvoice({
      customerName: tag,
      date: today(),
      paymentMethod: "آجل",
      status: "غير مدفوعة",
      items: [
        { name: `${tag}-خدمة`, qty: 1, price: 400, discountPercent: 0, vatPercent: 0, total: 400, itemType: "product" },
      ],
      paidAmount: 0,
      subtotal: 400,
      taxTotal: 0,
      netAmount: 400,
    } as any);

    createdInvoiceIds.push(Number(invoice.id));

    expect(invoice.isPosted).toBe(true);
    expect(Number(invoice.customerId)).toBe(customerId);
    const netAfter = await ledgerNet(accountsTracked);
    expect((netAfter[String(accounts.receivable)] ?? 0) - (netBefore[String(accounts.receivable)] ?? 0)).toBe(400);
    expect(netAfter[String(accounts.cash)] ?? 0).toBe(netBefore[String(accounts.cash)] ?? 0);
    expect((netBefore[String(accounts.salesRevenue)] ?? 0) - (netAfter[String(accounts.salesRevenue)] ?? 0)).toBe(400);
    expect(await treasuryBalance()).toBe(treasuryBefore);

    const entry = await withCommit(async (client) =>
      client.query(
        "SELECT id, total_debit, total_credit FROM journal_entries WHERE source_type = 'SALES_INVOICE' AND source_id = $1 ORDER BY id DESC LIMIT 1",
        [invoice.id],
      ),
    );
    expect(entry.rows).toHaveLength(1);
    expect(Number(entry.rows[0].total_debit)).toBe(400);
    expect(Number(entry.rows[0].total_debit)).toBe(Number(entry.rows[0].total_credit));

    const customerTx = await withCommit(async (client) =>
      client.query(
        `SELECT customer_id, type, amount
           FROM customer_transactions
          WHERE source_type = 'SALES_INVOICE' AND source_id = $1`,
        [String(invoice.id)],
      ),
    );
    expect(customerTx.rows).toHaveLength(1);
    expect(Number(customerTx.rows[0].customer_id)).toBe(customerId);
    expect(customerTx.rows[0].type).toBe("invoice");
    expect(Number(customerTx.rows[0].amount)).toBe(400);
    expect(await CustomerLedgerService.getReceivable(customerId)).toBeGreaterThanOrEqual(400);
  }, 60_000);

  it("يعيد ترحيل فاتورة قديمة ذات حركة مخزون محفوظة دون خصم المخزون مرتين", async () => {
    const tag = uniqueTag("RETRY");
    const { customerId, accounts, warehouseId, ingredientId } = await withCommit(async (client) => {
      const seeded = await ensureChartOfAccounts(client);
      await ensureUser(client);
      await ensureTreasuryAccount(client, uniqueTag("TREASURY"));
      const createdCustomer = await ensureCustomer(client, tag);
      const createdWarehouse = await ensureWarehouse(client, uniqueTag("WH"));
      const createdIngredient = await ensureIngredient(client, uniqueTag("ITEM"));
      return {
        customerId: createdCustomer,
        accounts: seeded,
        warehouseId: createdWarehouse,
        ingredientId: createdIngredient,
      };
    });

    const invoice = await service.createInvoice({
      customerId,
      customerName: tag,
      date: today(),
      warehouseId,
      paymentMethod: "نقدي",
      status: "مسودة",
      paidAmount: 200,
      items: [
        {
          name: `${tag}-مخزون`,
          ingredientId,
          itemType: "inventory_item",
          qty: 2,
          price: 100,
          unitCost: 25,
          total: 200,
        },
      ],
    } as any);
    createdInvoiceIds.push(Number(invoice.id));
    createdStockFixtures.push({ invoiceId: Number(invoice.id), warehouseId, ingredientId });

    await withCommit(async (client) => {
      await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: 10,
        ref_type: "goods_receipt",
        ref_id: Number(invoice.id),
        unit_cost: 25,
      });
      await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: -2,
        ref_type: "sales_invoice",
        ref_id: Number(invoice.id),
      });
    });

    const firstRetry = await service.postInvoice(Number(invoice.id));
    const secondRetry = await service.postInvoice(Number(invoice.id));
    const { stock, finance, journalCount, treasuryCount } = await withCommit(async (client) => {
      const stockRows = await client.query(
        "SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
        [warehouseId, ingredientId],
      );
      const financeRows = await client.query(
        `SELECT count(*)::int AS count FROM financial_transactions
          WHERE source_type = 'SALES_INVOICE' AND source_id = $1`,
        [String(invoice.id)],
      );
      const journalRows = await client.query(
        `SELECT count(*)::int AS count FROM journal_entries
          WHERE source_type = 'SALES_INVOICE' AND source_id = $1`,
        [String(invoice.id)],
      );
      const treasuryRows = await client.query(
        `SELECT count(*)::int AS count FROM treasury_transactions
          WHERE reference_type = 'sales invoice' AND reference_id = $1`,
        [invoice.id],
      );
      return {
        stock: Number(stockRows.rows[0].quantity),
        finance: Number(financeRows.rows[0].count),
        journalCount: Number(journalRows.rows[0].count),
        treasuryCount: Number(treasuryRows.rows[0].count),
      };
    });

    expect(firstRetry.isPosted).toBe(true);
    expect(secondRetry.journalEntryId).toBe(firstRetry.journalEntryId);
    expect(stock).toBe(8);
    expect(finance).toBe(1);
    expect(journalCount).toBe(1);
    expect(treasuryCount).toBe(1);
    expect(Number(firstRetry.totalCost)).toBe(50);
    expect(accounts.inventory).toBeGreaterThan(0);
  }, 60_000);

  it("يستكمل ترحيل فاتورة قديمة معتمدة ومخصومة مخزونياً دون تكرار الخصم", async () => {
    const tag = uniqueTag("LEGACY");
    const { customerId, warehouseId, ingredientId } = await withCommit(async (client) => {
      await ensureChartOfAccounts(client);
      await ensureUser(client);
      await ensureTreasuryAccount(client, uniqueTag("TREASURY"));
      const createdCustomer = await ensureCustomer(client, tag);
      const createdWarehouse = await ensureWarehouse(client, uniqueTag("WH"));
      const createdIngredient = await ensureIngredient(client, uniqueTag("ITEM"));
      return { customerId: createdCustomer, warehouseId: createdWarehouse, ingredientId: createdIngredient };
    });

    const invoice = await service.createInvoice({
      customerId,
      customerName: tag,
      date: today(),
      warehouseId,
      paymentMethod: "نقدي",
      status: "مسودة",
      paidAmount: 200,
      items: [
        {
          name: `${tag}-مخزون`,
          ingredientId,
          itemType: "inventory_item",
          qty: 2,
          price: 100,
          unitCost: 25,
          total: 200,
        },
      ],
    } as any);
    createdInvoiceIds.push(Number(invoice.id));
    createdStockFixtures.push({ invoiceId: Number(invoice.id), warehouseId, ingredientId });

    await withCommit(async (client) => {
      await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: 10,
        ref_type: "goods_receipt",
        ref_id: Number(invoice.id),
        unit_cost: 25,
      });
      await moveStock(client, {
        warehouse_id: warehouseId,
        ingredient_id: ingredientId,
        delta: -2,
        ref_type: "sales_invoice",
        ref_id: Number(invoice.id),
      });
      await client.query(
        `UPDATE sales_invoices
            SET is_posted = true, status = 'مدفوعة', posted_at = NOW()
          WHERE id = $1`,
        [invoice.id],
      );
    });

    const posted = await service.postInvoice(Number(invoice.id));
    const result = await withCommit(async (client) => {
      const stock = await client.query(
        "SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
        [warehouseId, ingredientId],
      );
      const transactions = await client.query(
        `SELECT journal_entry_id, treasury_transaction_id
           FROM financial_transactions
          WHERE source_type = 'SALES_INVOICE' AND source_id = $1`,
        [String(invoice.id)],
      );
      return { quantity: Number(stock.rows[0].quantity), transactions: transactions.rows };
    });

    expect(posted.journalEntryId).toBeTruthy();
    expect(result.quantity).toBe(8);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].journal_entry_id).toBe(posted.journalEntryId);
    expect(result.transactions[0].treasury_transaction_id).toBeTruthy();
  }, 60_000);

  /**
   * Regression: a sales order is invoiced with `itemId = ingredientId` and no sales-product
   * identity. `sales_products.id` and `ingredients.id` are independent sequences, so resolving
   * that bare id against sales_products renamed the sold line after an unrelated sales product
   * and pointed it at that product's master inventory item.
   */
  it("يحفظ اسم وكود الصنف المخزني المباع دون استبداله بمنتج مبيعات يملك نفس الرقم", async () => {
    const tag = uniqueTag("SHAREDID");

    const { customerId, warehouseId, ingredientId } = await withCommit(async (client) => {
      await ensureChartOfAccounts(client);
      await ensureUser(client);
      await ensureTreasuryAccount(client, uniqueTag("TREASURY"));
      const customer = await ensureCustomer(client, tag);
      const warehouse = await ensureWarehouse(client, uniqueTag("WH"));

      // Pick an id free in both tables so the ingredient and the sales product share it.
      const free = await client.query(
        `SELECT GREATEST(
           (SELECT COALESCE(MAX(id), 0) FROM ingredients),
           (SELECT COALESCE(MAX(id), 0) FROM sales_products)
         ) + 1 AS free_id`,
      );
      const sharedId = Number(free.rows[0].free_id);

      await client.query(
        `INSERT INTO ingredients (id, name, code, unit, cost, current_stock, is_active, is_stock_item)
         VALUES ($1, $2, $3, 'متر', 0, 0, true, 1)`,
        [sharedId, `${tag}-قماش`, `ING-${tag}`],
      );
      createdIngredientIds.push(sharedId);
      // An explicit id does not advance the sequence; move it forward before inserting again.
      await client.query(
        "SELECT setval('ingredients_id_seq', GREATEST((SELECT last_value FROM ingredients_id_seq), (SELECT COALESCE(MAX(id), 0) FROM ingredients)))",
      );

      const otherIngredientId = await ensureIngredient(client, uniqueTag("OTHER"));
      createdIngredientIds.push(otherIngredientId);
      await client.query(
        `INSERT INTO sales_products (id, name, code, master_item_id, inventory_item_id)
         VALUES ($1, $2, $3, $4, $4)`,
        [sharedId, `${tag}-منتج-مبيعات`, `FIN-${tag}`, otherIngredientId],
      );
      createdSalesProductIds.push(sharedId);
      await client.query(
        "SELECT setval('sales_products_id_seq', GREATEST((SELECT last_value FROM sales_products_id_seq), (SELECT COALESCE(MAX(id), 0) FROM sales_products)))",
      );

      return { customerId: customer, warehouseId: warehouse, ingredientId: sharedId };
    });

    // Same shape the sales-order → invoice path builds: no salesProductId/itemType.
    const invoice = await service.createInvoice({
      customerId,
      customerName: tag,
      date: today(),
      warehouseId,
      paymentMethod: "آجل",
      status: "مسودة",
      items: [
        {
          itemId: ingredientId,
          ingredientId,
          itemCode: `ING-${tag}`,
          itemName: `${tag}-قماش`,
          name: `${tag}-قماش`,
          code: `ING-${tag}`,
          qty: 1,
          price: 100,
          discountPercent: 0,
          vatPercent: 0,
          total: 100,
        },
      ],
    } as any);
    createdInvoiceIds.push(Number(invoice.id));

    const stored = await withCommit(async (client) =>
      client.query(
        "SELECT name, code, ingredient_id, product_id FROM sales_invoice_items WHERE invoice_id = $1",
        [invoice.id],
      ),
    );

    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].name).toBe(`${tag}-قماش`);
    expect(stored.rows[0].code).toBe(`ING-${tag}`);
    expect(Number(stored.rows[0].ingredient_id)).toBe(ingredientId);
    expect(stored.rows[0].product_id).toBeNull();
  }, 60_000);

  /**
   * KNOWN BEHAVIOUR (recorded, not fixed): the financial-integration path writes
   * journal_entries / journal_items but never refreshes the `accounts.balance`
   * cache column, so the cached balance drifts away from the ledger. Only the
   * manual journal-entry path keeps `accounts.balance` up to date.
   */
  it.fails("سلوك معروف: يُحدَّث رصيد الحساب المخزَّن (accounts.balance) بعد ترحيل الفاتورة", async () => {
    const tag = uniqueTag("CUSTB");

    const { customerId, accounts } = await withCommit(async (client) => {
      const seeded = await ensureChartOfAccounts(client);
      await ensureUser(client);
      const created = await ensureCustomer(client, tag);
      return { customerId: created, accounts: seeded };
    });

    const balanceOf = async (accountId: number): Promise<number> =>
      withCommit(async (client) => {
        const rows = await client.query("SELECT balance FROM accounts WHERE id = $1", [accountId]);
        return Number(rows.rows[0].balance);
      });

    const before = await balanceOf(accounts.receivable);

    const invoice = await service.createInvoice({
      customerName: tag,
      date: today(),
      paymentMethod: "آجل",
      status: "معتمدة",
      items: [
        { name: `${tag}-خدمة`, qty: 1, price: 250, discountPercent: 0, vatPercent: 0, total: 250, itemType: "product" },
      ],
      paidAmount: 0,
      subtotal: 250,
      taxTotal: 0,
      netAmount: 250,
    } as any);

    createdInvoiceIds.push(Number(invoice.id));

    expect((await balanceOf(accounts.receivable)) - before).toBe(250);
  }, 60_000);
});
