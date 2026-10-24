import { erpPool } from "../server-erp-core.js";
import { InvoiceService } from "../modules/sales/services/invoice.service.js";
import { isCreditPaymentMethod } from "../modules/sales/utils/payment-method.js";

interface RepairCandidate {
  id: number;
  invoice_no: string;
  order_id: number;
  order_no: string;
  order_payment_method: string;
  paid_amount: string | number;
  net_amount: string | number;
  financial_id: number | null;
  customer_transaction_id: number | null;
  treasury_transaction_id: number | null;
  bank_transaction_id: number | null;
}

const repairInvoices = new InvoiceService();
const applyChanges = process.argv.includes("--apply");

async function main(): Promise<void> {
  const result = await erpPool.query(
    `SELECT i.id, i.invoice_no, i.order_id, o.order_no,
            o.payment_method AS order_payment_method,
            i.paid_amount, i.net_amount,
            ft.id AS financial_id,
            ft.customer_transaction_id,
            ft.treasury_transaction_id,
            ft.bank_transaction_id
       FROM sales_invoices i
       JOIN erp_sales_orders o ON o.id = i.order_id
       LEFT JOIN LATERAL (
         SELECT id, customer_transaction_id, treasury_transaction_id, bank_transaction_id
           FROM financial_transactions
          WHERE source_type = 'SALES_INVOICE'
            AND source_id = i.id::text
            AND event_type = 'INVOICE_POSTED'
            AND status <> 'reversed'
          ORDER BY id DESC
          LIMIT 1
       ) ft ON true
      WHERE i.is_posted = true
        AND i.net_amount > 0
        AND i.paid_amount >= i.net_amount - 0.01
        AND (o.payment_method ILIKE '%جل%' OR o.payment_method ILIKE '%credit%')
      ORDER BY i.id`,
  );
  const candidates = (result.rows as RepairCandidate[]).filter((invoice) =>
    isCreditPaymentMethod(invoice.order_payment_method),
  );

  console.log(
    `${applyChanges ? "وضع التطبيق" : "معاينة فقط"}: عدد الفواتير المطابقة = ${candidates.length}`,
  );
  for (const invoice of candidates) {
    const canReverseCashPosting =
      Boolean(invoice.financial_id) &&
      !invoice.customer_transaction_id &&
      Boolean(invoice.treasury_transaction_id || invoice.bank_transaction_id);
    console.log(
      `فاتورة ${invoice.invoice_no} / أمر ${invoice.order_no} / ${Number(invoice.net_amount).toFixed(2)} ج.م — ${
        canReverseCashPosting
          ? "مؤهلة للتصحيح"
          : "تحتاج مراجعة: لم يُعثر على ترحيل نقدي قابل للعكس بأمان"
      }`,
    );
  }

  if (!applyChanges) {
    console.log("لم تتغير البيانات. راجع القائمة ثم أعد التشغيل مع --apply للتنفيذ.");
    return;
  }

  let repairedCount = 0;
  let skippedCount = 0;
  const failures: Array<{ invoiceNo: string; error: string }> = [];
  for (const invoice of candidates) {
    try {
      const outcome = await repairInvoices.repairMispostedCreditOrderInvoice(invoice.id);
      if (outcome.repaired) {
        repairedCount += 1;
        console.log(`تم تصحيح الفاتورة ${invoice.invoice_no}`);
      } else {
        skippedCount += 1;
        console.warn(`تُركت الفاتورة ${invoice.invoice_no}: ${outcome.reason}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ invoiceNo: invoice.invoice_no, error: message });
      console.error(`فشل تصحيح الفاتورة ${invoice.invoice_no}: ${message}`);
    }
  }

  console.log(
    `انتهى التصحيح: ${repairedCount} تم تصحيحها، ${skippedCount} تم تجاوزها، ${failures.length} فشل.`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("تعذر تشغيل إصلاح الفواتير الآجلة:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (typeof erpPool.end === "function") await erpPool.end();
  });
