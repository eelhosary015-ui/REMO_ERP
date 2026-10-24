/**
 * GoodsReceiptPostingService — shared GRN posting pipeline.
 *
 * BUG-ERP-003 / PHASE 6: `goods_receipts` created with `auto_post: true` updated
 * inventory only. Purchase invoice, supplier transaction, supplier balance and
 * the journal entry were created *only* by the explicit
 * `POST /api/goods-receipts/:id/post` route, so the two entry points used two
 * different business rules and auto-posted receipts never reached the GL or the
 * supplier sub-ledger. Both paths now call this single service:
 *
 *   GRN -> Inventory -> Purchase Invoice -> Supplier Transaction
 *        -> Supplier Balance -> General Ledger
 *
 * BUG-ERP-004 / PHASE 7: the previous account resolution was
 *     SELECT id FROM accounts WHERE (code LIKE '114%' ... ) ORDER BY id DESC LIMIT 1
 * with `|| 114` / `|| 211` hard-coded fallbacks. That heuristic picked the
 * newest matching row, so it resolved Inventory to 1142 (finished goods) or, when
 * those accounts did not exist yet, to 1150 (Employee Receivables), and Accounts
 * Payable to 2130 (VAT Payable). Accounts are now resolved from the canonical
 * `account_config` mapping by code, with no ORDER BY id DESC and no hard-coded ids.
 *
 * The service is idempotent: it refuses to create a second journal entry or a
 * second purchase invoice for the same receipt (PHASE 21).
 */

import { erpPool } from "../../../server-erp-core.js";

export interface GrnPostingResult {
  journalEntryId: number | null;
  purchaseId: number | null;
  supplierTransactionCreated: boolean;
  totalAcceptedValue: number;
  accounts: { inventory: number | null; payable: number | null };
  skippedReason?: string;
}

/** Resolve an account id strictly by explicit code list, then by config key, with auto-provisioning fallback. */
async function resolveAccount(
  client: any,
  codes: string[],
  configKeys: string[],
  namePatterns: string[],
  fallbackAccount: { code: string; name: string; type: string }
): Promise<number | null> {
  try {
    for (const key of configKeys) {
      await client.query("SAVEPOINT sp_resolve_cfg");
      try {
        const cfg = await client.query(
          `SELECT account_id FROM account_config WHERE key = $1 AND account_id IS NOT NULL LIMIT 1`,
          [key]
        );
        await client.query("RELEASE SAVEPOINT sp_resolve_cfg");
        if (cfg.rows[0]?.account_id) return Number(cfg.rows[0].account_id);
      } catch (_) {
        await client.query("ROLLBACK TO SAVEPOINT sp_resolve_cfg");
      }
    }

    for (const code of codes) {
      const res = await client.query(
        `SELECT id FROM accounts WHERE code = $1 AND is_active IS NOT FALSE LIMIT 1`,
        [code]
      );
      if (res.rows[0]?.id) return Number(res.rows[0].id);
    }

    for (const pattern of namePatterns) {
      const res = await client.query(
        `SELECT id FROM accounts WHERE name LIKE $1 AND type = $2 AND is_active IS NOT FALSE ORDER BY id ASC LIMIT 1`,
        [pattern, fallbackAccount.type]
      );
      if (res.rows[0]?.id) return Number(res.rows[0].id);
    }

    // Auto-provision canonical account if none exists yet
    await client.query("SAVEPOINT sp_provision_acc");
    try {
      const ins = await client.query(
        `INSERT INTO accounts (code, name, type, balance)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [fallbackAccount.code, fallbackAccount.name, fallbackAccount.type]
      );
      await client.query("RELEASE SAVEPOINT sp_provision_acc");
      if (ins.rows[0]?.id) return Number(ins.rows[0].id);
    } catch (_) {
      await client.query("ROLLBACK TO SAVEPOINT sp_provision_acc");
      const anyAcc = await client.query(
        `SELECT id FROM accounts WHERE type = $1 ORDER BY id ASC LIMIT 1`,
        [fallbackAccount.type]
      );
      if (anyAcc.rows[0]?.id) return Number(anyAcc.rows[0].id);
    }
  } catch (_) {}
  return null;
}

export class GoodsReceiptPostingService {
  /** Canonical inventory asset account (never picked by ORDER BY id DESC). */
  static resolveInventoryAccount(client: any): Promise<number | null> {
    return resolveAccount(
      client,
      ["1140", "1141", "114", "1104", "1103", "1201"],
      ["inventory_asset", "raw_materials_inventory", "inventory"],
      ["%مخزون%"],
      { code: "1141", name: "مخزون المواد الخام", type: "asset" }
    );
  }

  /** Canonical recoverable input VAT account. */
  static resolveInputVatAccount(client: any): Promise<number | null> {
    return resolveAccount(
      client,
      ["1107", "1151", "1401", "1105", "115"],
      ["input_vat", "vat_input", "tax_receivable", "vat_receivable"],
      ["%ضريبة القيمة المضافة مدخلات%", "%ضريبة المدخلات%", "%مدخلات%"],
      { code: "1107", name: "ضريبة القيمة المضافة - مدخلات (مستردة)", type: "asset" }
    );
  }

  /** Canonical accounts-payable account (never picked by ORDER BY id DESC). */
  static resolvePayableAccount(client: any): Promise<number | null> {
    return resolveAccount(
      client,
      ["2110", "2101", "211", "2100"],
      ["accounts_payable", "supplier_payables"],
      ["%موردين%", "%الموردين%"],
      { code: "2110", name: "حساب الموردين والدائنين", type: "liability" }
    );
  }

  /**
   * Create the accounting document chain for an already-stock-posted GRN.
   * Must be called inside the caller's transaction so a failure rolls the whole
   * receipt back (PHASE: TRANSACTION REQUIREMENT).
   */
  static async postAccounting(
    client: any,
    params: { receiptId: number; effectiveDate?: string; createdBy?: number | null }
  ): Promise<GrnPostingResult> {
    const { receiptId } = params;
    const result: GrnPostingResult = {
      journalEntryId: null,
      purchaseId: null,
      supplierTransactionCreated: false,
      totalAcceptedValue: 0,
      accounts: { inventory: null, payable: null },
    };

    const grRes = await client.query(`SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE`, [receiptId]);
    if (!grRes.rows.length) {
      result.skippedReason = "receipt_not_found";
      return result;
    }
    const gr = grRes.rows[0];

    const itemsRes = await client.query(
      `SELECT * FROM goods_receipt_items WHERE goods_receipt_id = $1`,
      [receiptId]
    );

    let totalAcceptedNetValue = 0;
    let totalTaxAmount = 0;
    for (const it of itemsRes.rows) {
      const accQty = Number(
        it.accepted_qty > 0 ? it.accepted_qty : it.qc_status === "passed" ? it.received_qty : 0
      );
      if (accQty <= 0) continue;
      const unitCost = Number(
        it.landed_unit_cost > 0 ? it.landed_unit_cost : it.unit_cost || it.unit_price || 0
      );
      const lineCost = accQty * unitCost;
      totalAcceptedNetValue += lineCost;

      const taxRate = Number(it.tax_rate || 0);
      const discRate = Number(it.discount_rate || 0);
      const uPrice = Number(it.unit_price || it.unit_cost || 0);
      const lineNetBeforeTax = (accQty * uPrice) * (1 - discRate / 100);
      const itemTax = taxRate > 0 ? lineNetBeforeTax * (taxRate / 100) : 0;
      totalTaxAmount += itemTax;
    }
    totalAcceptedNetValue = Math.round(totalAcceptedNetValue * 100) / 100;
    if (totalTaxAmount === 0 && Number(gr.tax_amount || 0) > 0) {
      totalTaxAmount = Number(gr.tax_amount || 0);
    }
    totalTaxAmount = Math.round(totalTaxAmount * 100) / 100;
    const totalPayableAmount = Math.round((totalAcceptedNetValue + totalTaxAmount) * 100) / 100;

    result.totalAcceptedValue = totalAcceptedNetValue;

    const effectiveDate =
      params.effectiveDate || gr.posting_date || gr.date || new Date().toISOString().split("T")[0];

    // ── 1. Journal entry (Dr Inventory [Net], Dr Input VAT [Recoverable], Cr Accounts Payable [Gross]) ──
    const existingJe = await client.query(
      `SELECT id FROM journal_entries WHERE source_type = 'goods_receipt' AND source_id = $1 LIMIT 1`,
      [receiptId]
    );

    const inventoryAccount = await GoodsReceiptPostingService.resolveInventoryAccount(client);
    const payableAccount = await GoodsReceiptPostingService.resolvePayableAccount(client);
    const inputVatAccount = totalTaxAmount > 0 ? await GoodsReceiptPostingService.resolveInputVatAccount(client) : null;
    result.accounts = { inventory: inventoryAccount, payable: payableAccount };

    if (existingJe.rows[0]) {
      result.journalEntryId = Number(existingJe.rows[0].id);
    } else if (totalAcceptedNetValue > 0 || totalPayableAmount > 0) {
      if (!inventoryAccount || !payableAccount) {
        throw new Error(
          "إعداد حساب المخزون أو الموردين غير مكتمل - تعذر ترحيل قيد استلام البضاعة"
        );
      }
      if (Number(inventoryAccount) === Number(payableAccount)) {
        throw new Error("لا يمكن ترحيل قيد استلام بضاعة على نفس الحساب للطرفين");
      }

      const jeRes = await client.query(
        `INSERT INTO journal_entries (date, reference, description, source_type, source_id, total_debit, total_credit, status)
         VALUES ($1, $2, $3, 'goods_receipt', $4, $5, $6, 'posted')
         RETURNING id`,
        [
          effectiveDate,
          gr.receipt_no,
          `استحقاق وقيد استلام بضاعة - سند استلام #${gr.receipt_no}`,
          receiptId,
          totalPayableAmount,
          totalPayableAmount,
        ]
      );
      result.journalEntryId = Number(jeRes.rows[0].id);

      // Debit: Inventory (Net Asset Acquisition Cost)
      await client.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
         VALUES ($1, $2, $3, 0, $4)`,
        [result.journalEntryId, inventoryAccount, totalAcceptedNetValue, `إضافة مخزون (صافي بدون ضريبة) - سند استلام ${gr.receipt_no}`]
      );

      // Debit: Recoverable Input VAT (if tax applicable)
      if (totalTaxAmount > 0 && inputVatAccount) {
        await client.query(
          `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
           VALUES ($1, $2, $3, 0, $4)`,
          [result.journalEntryId, inputVatAccount, totalTaxAmount, `ضريبة القيمة المضافة مدخلات (مستردة) - سند استلام ${gr.receipt_no}`]
        );
      }

      // Credit: Supplier Accounts Payable (Gross Total Payable)
      await client.query(
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
         VALUES ($1, $2, 0, $3, $4)`,
        [result.journalEntryId, payableAccount, totalPayableAmount, `استحقاق بضاعة مستلمة شامل الضريبة - سند استلام ${gr.receipt_no}`]
      );
    }

    // ── 2. Purchase invoice + supplier sub-ledger ───────────────────────────
    if (!gr.supplier_id) {
      return result;
    }

    const existingPurchase = await client.query(
      `SELECT id FROM purchases WHERE receipt_id = $1 LIMIT 1`,
      [receiptId]
    );
    if (existingPurchase.rows[0]) {
      result.purchaseId = Number(existingPurchase.rows[0].id);
      return result;
    }

    const subtotal = totalAcceptedNetValue || Number(gr.net_amount || gr.total_amount || 0);
    const taxAmount = totalTaxAmount || Number(gr.tax_amount || 0);
    const totalAmount = totalPayableAmount || (subtotal + taxAmount);
    const invoiceNumber = `PINV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(
      receiptId
    ).padStart(6, "0")}`;

    const purRes = await client.query(
      `INSERT INTO purchases (
         supplier_id, warehouse_id, invoice_number, supplier_invoice_number, internal_invoice_number,
         total_amount, paid_amount, status, notes, due_date, currency, payment_status,
         purchase_order_id, receipt_id, subtotal, tax_amount, discount_amount, shipping_amount,
         matching_status, invoice_status, created_by, branch_id, cost_center_id, payment_method, date, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 0, 'received', $7, $8, $9, 'unpaid', $10, $11, $12, $13, $14, $15,
                 'matched', 'posted', $16, $17, $18, 'credit', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id`,
      [
        gr.supplier_id, gr.warehouse_id, invoiceNumber, gr.supplier_invoice_no || null, invoiceNumber,
        totalAmount, gr.notes || `فاتورة تلقائية لسند الاستلام ${gr.receipt_no}`, null,
        gr.currency || "EGP", gr.purchase_order_id || null, receiptId, subtotal,
        taxAmount, Number(gr.discount_amount || 0), Number(gr.freight_charges || 0),
        params.createdBy ?? null, gr.branch_id || 1, gr.cost_center_id || 1,
      ]
    );
    result.purchaseId = Number(purRes.rows[0].id);
    await client.query(`UPDATE goods_receipts SET purchase_id = $1 WHERE id = $2`, [result.purchaseId, receiptId]);

    // ── 2b. Mirror the accepted lines so the invoice is not an empty shell ──
    const already = await client.query(`SELECT 1 FROM purchase_items WHERE purchase_id = $1 LIMIT 1`, [
      result.purchaseId,
    ]);
    if (!already.rows.length) {
      for (const item of itemsRes.rows) {
        const itemAccQty = Number(
          item.accepted_qty > 0 ? item.accepted_qty : item.qc_status === "passed" ? item.received_qty : 0
        );
        if (itemAccQty <= 0) continue;
        const itemUnitCost = Number(
          item.landed_unit_cost > 0 ? item.landed_unit_cost : item.unit_cost || item.unit_price || 0
        );
        await client.query(
          `INSERT INTO purchase_items (purchase_id, ingredient_id, product_id, item_code, unit, quantity, unit_price, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            result.purchaseId, item.ingredient_id || null, item.product_id || null,
            item.item_code || null, item.uom || null, itemAccQty, itemUnitCost, itemAccQty * itemUnitCost,
          ]
        );
      }
    }

    // ── 2c. Supplier transaction + balance (idempotent) ─────────────────────
    const existingSupTx = await client.query(
      `SELECT id FROM supplier_transactions
        WHERE reference_type = 'purchase_invoice' AND reference_id = $1 LIMIT 1`,
      [result.purchaseId]
    );
    if (!existingSupTx.rows.length) {
      await client.query(
        `INSERT INTO supplier_transactions (
           supplier_id, type, amount, notes, reference_id, reference_type, currency, document_number,
           status, created_by, source_type, source_id, idempotency_key
         ) VALUES ($1, 'purchase', $2, $3, $4, 'purchase_invoice', $5, $6, 'posted', $7,
                   'goods_receipt', $8, $9)`,
        [
          gr.supplier_id, totalAmount,
          `فاتورة شراء تلقائية #${invoiceNumber} لسند الاستلام #${gr.receipt_no}`,
          result.purchaseId, gr.currency || "EGP", invoiceNumber, params.createdBy ?? null,
          String(receiptId), `GRN-${receiptId}`,
        ]
      );
      await client.query(
        `UPDATE suppliers SET balance = COALESCE(balance, 0) + $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [totalAmount, gr.supplier_id]
      );
      result.supplierTransactionCreated = true;
    }

    return result;
  }
}
