/**
 * Canonical Customer Ledger Service (BUG-ERP-008 / PHASE 12 / PHASE 16 / PHASE 20)
 *
 * Single source of truth for how a customer's receivable balance is represented.
 *
 * The real PostgreSQL `customers` table has NO `balance` / `current_balance`
 * column. Historically several writers did
 *     `UPDATE customers SET balance = COALESCE(balance,0) + $1`
 * which either threw ("column does not exist") or silently diverged from the
 * ledger. Receivable is therefore *derived* from `customer_transactions`, which
 * is the append-only ledger, and `customers.total_orders` / `total_spent` /
 * `last_order_date` remain display aggregates only.
 *
 * Canonical `customer_transactions.type` values:
 *   - 'invoice'      -> DEBIT  (increases what the customer owes)
 *   - 'payment'      -> CREDIT (reduces what the customer owes)
 *   - 'adjustment'   -> signed manual correction (amount carries the sign)
 *   - 'reversal'     -> CREDIT (undoes a previously posted debit)
 *
 * Legacy synonyms ('debit'/'credit') are still tolerated when *reading* so that
 * rows written by older code keep reconciling, but nothing new writes them.
 */

import { erpPool } from "../../../server-erp-core.js";

export type CustomerTxType = "invoice" | "payment" | "disbursement" | "adjustment" | "reversal";

/** A positive impact increases the customer receivable (debit). */
export function canonicalTypeForImpact(impact: number): CustomerTxType {
  return impact > 0 ? "invoice" : "payment";
}

/** SQL fragment: signed receivable contribution of a `type` value. */
export const CUSTOMER_RECEIVABLE_SQL = `
  CASE
    WHEN type IN ('invoice', 'debit', 'disbursement') THEN amount
    WHEN type IN ('payment', 'credit')           THEN -amount
    WHEN type =  'reversal'                      THEN -amount
    WHEN type =  'adjustment'                    THEN  amount
    ELSE 0
  END`;

export class CustomerLedgerService {
  /** Derived receivable for one customer (never a stored denormalised column). */
  static async getReceivable(customerId: number, runner: any = erpPool): Promise<number> {
    const { rows } = await runner.query(
      `SELECT COALESCE(SUM(${CUSTOMER_RECEIVABLE_SQL}), 0)::numeric(14,2) AS balance
         FROM customer_transactions WHERE customer_id = $1`,
      [customerId]
    );
    return Number(rows[0]?.balance ?? 0);
  }

  /** Derived receivables for every customer, keyed by customer id. */
  static async getReceivables(runner: any = erpPool): Promise<Record<number, number>> {
    const { rows } = await runner.query(
      `SELECT customer_id, COALESCE(SUM(${CUSTOMER_RECEIVABLE_SQL}), 0)::numeric(14,2) AS balance
         FROM customer_transactions GROUP BY customer_id`
    );
    const out: Record<number, number> = {};
    for (const r of rows) out[Number(r.customer_id)] = Number(r.balance);
    return out;
  }

  /**
   * Append a signed impact to the ledger. `impact > 0` = customer owes more.
   * Always used inside a caller-owned transaction so it can roll back with its
   * document. Idempotency is delegated to the caller's `idempotencyKey`
   * (customer_transactions has a dedicated placeholder-free unique path via
   * `idempotency_key` checked by the writers that need it).
   */
  static async recordImpact(
    client: any,
    params: {
      customerId: number;
      impact: number;
      notes?: string | null;
      finNumber?: string | null;
      sourceType?: string | null;
      sourceId?: string | number | null;
      paymentMethod?: string | null;
      idempotencyKey?: string | null;
      type?: CustomerTxType;
    }
  ): Promise<number | null> {
    const {
      customerId,
      impact,
      notes = null,
      finNumber = null,
      sourceType = null,
      sourceId = null,
      paymentMethod = null,
      idempotencyKey = null,
    } = params;
    if (!customerId || impact === 0) return null;

    const type = params.type ?? canonicalTypeForImpact(impact);
    const res = await client.query(
      `INSERT INTO customer_transactions
         (customer_id, type, amount, notes, fin_number, source_type, source_id, payment_method, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        customerId,
        type,
        Math.abs(impact),
        notes,
        finNumber,
        sourceType,
        sourceId === null ? null : String(sourceId),
        paymentMethod,
        idempotencyKey,
      ]
    );
    return res.rows[0]?.id ?? null;
  }

  /** Refresh the display aggregates kept on `customers` (never the receivable). */
  static async touchAggregates(
    client: any,
    customerId: number,
    opts: { spentDelta?: number; orderDelta?: number; touchLastOrder?: boolean } = {}
  ): Promise<void> {
    const sets: string[] = [];
    const vals: any[] = [];
    if (opts.spentDelta) {
      vals.push(opts.spentDelta);
      sets.push(`total_spent = COALESCE(total_spent, 0) + $${vals.length}`);
    }
    if (opts.orderDelta) {
      vals.push(opts.orderDelta);
      sets.push(`total_orders = COALESCE(total_orders, 0) + $${vals.length}`);
    }
    if (opts.touchLastOrder) sets.push(`last_order_date = CURRENT_TIMESTAMP`);
    if (!sets.length) return;
    vals.push(customerId);
    await client.query(`UPDATE customers SET ${sets.join(", ")} WHERE id = $${vals.length}`, vals);
  }
}
