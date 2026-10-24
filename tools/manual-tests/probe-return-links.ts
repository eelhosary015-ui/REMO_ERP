/**
 * One-off read-only probe: checks how the sales-return read paths now resolve the
 * source invoice number and its sales order against the live database.
 * Run with: npx tsx tools/manual-tests/probe-return-links.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ quiet: true });

const { default: pgModule } = await import("pg");
const pg = (pgModule as any).default ?? pgModule;
(globalThis as any).__remoPgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 15_000,
});
process.env.DISABLE_BACKGROUND_JOBS = "true";

const { ReturnService } = await import("../../modules/sales/services/return.service.js");
const service = new ReturnService();

const returns = await service.getReturns();
console.log(
  "RETURNS:",
  JSON.stringify(
    returns.map((r: any) => ({
      id: r.id,
      returnNo: r.returnNo,
      invoiceId: r.invoiceId,
      invoiceNo: r.invoiceNo,
      orderNo: r.orderNo,
      refundMethod: r.refundMethod,
      journalEntryId: r.journalEntryId,
      treasuryTransactionId: r.treasuryTransactionId,
      finNumber: r.finNumber,
    })),
    null,
    1,
  ),
);

const eligible = await service.getEligibleInvoices();
console.log(
  "ELIGIBLE:",
  JSON.stringify(
    eligible.map((i: any) => ({ id: i.id, invoiceNo: i.invoiceNo, orderNo: i.orderNo, remaining: i.totalQtyRemaining })),
  ),
);

const details = await service.getInvoiceReturnDetails(19);
console.log(
  "DETAILS 19:",
  JSON.stringify({
    invoiceNo: details.invoice.invoiceNo,
    orderNo: details.invoice.orderNo,
    paymentMethod: details.invoice.paymentMethod,
    paidAmount: details.invoice.paidAmount,
    item: details.items[0]?.itemName,
    previouslyReturned: details.items[0]?.qtyPreviouslyReturned,
  }),
);

await (globalThis as any).__remoPgPool.end();
