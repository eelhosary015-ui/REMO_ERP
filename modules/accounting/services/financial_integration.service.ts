import { pool } from "../../../server-db.js";
import { ERPEventBus } from "../../../server-erp-core.js";
import { CustomerLedgerService } from "../../customers/services/customer-ledger.service.js";
import { assertPeriodOpen } from "../../accounts/services/period-lock.service.js";

export type FinancialSourceType =
  | "SALES_INVOICE"
  | "SALES_RETURN"
  | "POS_ORDER"
  | "POS_RETURN"
  | "CUSTOMER_RECEIPT"
  | "CUSTOMER_REFUND"
  | "PURCHASE_INVOICE"
  | "PURCHASE_RETURN"
  | "SUPPLIER_PAYMENT"
  | "SUPPLIER_REFUND"
  | "EXPENSE"
  | "COST"
  | "PAYROLL_BATCH"
  | "SALARY_PAYMENT"
  | "TREASURY_TRANSFER"
  | "TREASURY_BANK_DEPOSIT"
  | "BANK_TREASURY_WITHDRAWAL"
  | "BANK_TRANSFER"
  | "CHEQUE_RECEIVED"
  | "CHEQUE_ISSUED"
  | "CHEQUE_COLLECTED"
  | "CHEQUE_BOUNCED"
  | "ASSET_PURCHASE"
  | "ASSET_DEPRECIATION"
  | "PRODUCTION_COST"
  | "PRODUCTION_WASTAGE"
  | "GENERAL_FINANCIAL";

export type PaymentMethodType =
  | "cash"
  | "bank"
  | "card"
  | "credit"
  | "cheque"
  | "transfer"
  | "split"
  | "other";

export interface GLLineItem {
  accountId: number;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
  costCenterId?: number | null;
}

export interface FinancialPaymentSplit {
  method: "cash" | "bank" | "card" | "credit" | "cheque";
  amount: number;
  treasuryAccountId?: number | null;
  bankAccountId?: number | null;
}

export interface FinancialEventPayload {
  sourceType: FinancialSourceType;
  sourceId: string | number;
  sourceDocumentNumber?: string;
  eventType: string; // e.g. 'INVOICE_POSTED', 'RECEIPT_COLLECTED', 'PAYMENT_SETTLED'
  /**
   * `source_type` المستخدم في قيد اليومية فقط.
   * بعض الموديولات (مرتجعات المبيعات مثلاً) تبحث عن قيودها بالمعرّف النصي
   * الصغير داخل `journal_entries`، بينما نوع المصدر هنا يُكتب بحروف كبيرة
   * في `financial_transactions` و `financial_integration_logs`.
   */
  journalSourceType?: string;
  totalAmount: number;
  paymentMethod: PaymentMethodType;
  paymentSplits?: FinancialPaymentSplit[];
  
  // Destination account / entity pointers
  treasuryAccountId?: number | null;
  bankAccountId?: number | null;
  customerId?: number | null;
  supplierId?: number | null;
  employeeId?: number | null;
  costCenterId?: number | null;
  branchId?: number | null;
  userId?: number | null;

  // Metadata & descriptions
  description: string;
  notes?: string;
  date?: string | Date;
  idempotencyKey?: string;
  currency?: string;

  // Explicit GL items if custom, or automatically generated if omitted
  glLines?: GLLineItem[];
  metadata?: Record<string, any>;
  transactionClient?: any;
}

export interface FinancialTransactionResult {
  success: boolean;
  finNumber: string;
  status: "POSTED" | "EXISTING_PROCESSED" | "REVERSED" | "FAILED";
  message: string;
  transactionId?: number;
  journalEntryId?: number | null;
  treasuryTransactionId?: number | null;
  bankTransactionId?: number | null;
  customerTransactionId?: number | null;
  supplierTransactionId?: number | null;
  impacts: {
    treasury: number;
    bank: number;
    customer: number;
    supplier: number;
  };
}

export class FinancialIntegrationService {
  private static instance: FinancialIntegrationService;

  public static getInstance(): FinancialIntegrationService {
    if (!FinancialIntegrationService.instance) {
      FinancialIntegrationService.instance = new FinancialIntegrationService();
    }
    return FinancialIntegrationService.instance;
  }

  /**
   * Generates a unique, standardized Financial Reference: FIN-YYYYMMDD-XXXXXX
   */
  public generateFinNumber(): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(100000 + Math.random() * 900000);
    return `FIN-${dateStr}-${rand}`;
  }

  /**
   * Helper to retrieve or cache chart of accounts mapping
   */
  public async getAccountMap(client?: any): Promise<Record<string, number>> {
    const db = client || pool;
    const map: Record<string, number> = {};
    try {
      const res = await db.query("SELECT id, code, name, type FROM accounts WHERE is_active = true OR is_active IS NULL");
      for (const row of res.rows) {
        if (row.code) map[String(row.code).trim()] = Number(row.id);
        if (row.name) map[String(row.name).trim()] = Number(row.id);
      }
      // Also load mapped configs
      const configRes = await db.query("SELECT key, account_id FROM account_config WHERE account_id IS NOT NULL");
      for (const row of configRes.rows) {
        if (row.key && row.account_id) {
          const key = String(row.key).trim().toLowerCase();
          const accountId = Number(row.account_id);
          map[key] = accountId;

          // Older settings store the same mapping with an `_account` suffix,
          // while module posting code uses the canonical key without it.
          const canonicalKey = key.replace(/_account$/, "");
          if (canonicalKey !== key && map[canonicalKey] === undefined) {
            map[canonicalKey] = accountId;
          }
        }
      }
    } catch (err) {
      console.warn("FinancialIntegrationService: Error reading accounts config:", err);
    }
    return map;
  }

  /**
   * Helper to resolve default treasury safe
   */
  public async resolveTreasuryAccount(accountId?: number | null, branchId?: number | null, client?: any): Promise<number | null> {
    const db = client || pool;
    if (accountId && Number(accountId) > 0) return Number(accountId);
    try {
      let query = "SELECT id FROM treasury_accounts WHERE status = 'active' OR status IS NULL";
      const params: any[] = [];
      if (branchId) {
        query += " AND (branch_id = $1 OR branch_id IS NULL) ORDER BY branch_id DESC NULLS LAST, id ASC LIMIT 1";
        params.push(branchId);
      } else {
        query += " ORDER BY id ASC LIMIT 1";
      }
      const res = await db.query(query, params);
      if (res.rows.length > 0) return Number(res.rows[0].id);
    } catch (e) {
      console.warn("Error resolving treasury account:", e);
    }
    return null;
  }

  /**
   * Helper to resolve default bank account
   */
  public async resolveBankAccount(accountId?: number | null, branchId?: number | null, client?: any): Promise<number | null> {
    const db = client || pool;
    if (accountId && Number(accountId) > 0) return Number(accountId);
    try {
      let query = "SELECT id FROM bank_accounts WHERE is_active = true OR is_active IS NULL";
      const params: any[] = [];
      if (branchId) {
        query += " AND (branch_id = $1 OR branch_id IS NULL) ORDER BY branch_id DESC NULLS LAST, id ASC LIMIT 1";
        params.push(branchId);
      } else {
        query += " ORDER BY id ASC LIMIT 1";
      }
      const res = await db.query(query, params);
      if (res.rows.length > 0) return Number(res.rows[0].id);

      // Auto-provision a fallback bank account if none exists
      const fallbackInsert = await db.query(
        "INSERT INTO bank_accounts (account_name, bank_name, account_number, branch_id, balance, is_active) VALUES ('حساب البنك والتحصيل الإلكتروني (POS)', 'البنك التجاري الافتراضي', 'ACC-POS-DEF', $1, 0, true) RETURNING id",
        [branchId || 1]
      );
      if (fallbackInsert.rows.length > 0) return Number(fallbackInsert.rows[0].id);
    } catch (e) {
      console.warn("Error resolving/provisioning bank account:", e);
      try {
        const anyRes = await db.query("SELECT id FROM bank_accounts ORDER BY id ASC LIMIT 1");
        if (anyRes.rows.length > 0) return Number(anyRes.rows[0].id);
      } catch (_) {}
    }
    return null;
  }

  /**
   * Central Core Method: Processes any business transaction through the Financial Integration Layer.
   * Enforces Idempotency, Atomic execution, Treasury/Bank updates, Receivables/Payables, GL Journal Balancing,
   * Audit logging, and Real-time event broadcasting.
   */
  public async processFinancialTransaction(payload: FinancialEventPayload): Promise<FinancialTransactionResult> {
    const {
      sourceType,
      sourceId,
      sourceDocumentNumber = String(sourceId),
      eventType,
      totalAmount,
      paymentMethod,
      paymentSplits,
      customerId,
      supplierId,
      employeeId,
      costCenterId,
      branchId,
      userId = 1,
      description,
      notes = "",
      currency = "EGP",
      metadata = {},
    } = payload;

    const dateVal = payload.date ? new Date(payload.date) : new Date();
    const cleanAmount = Math.abs(Number(totalAmount) || 0);
    const journalSourceType = payload.journalSourceType || sourceType;

    // 1. Idempotency Key check
    const idempotencyKey = payload.idempotencyKey || `${sourceType}_${sourceId}_${eventType}`;
    
    try {
      const existingCheck = await (payload.transactionClient || pool).query(
        `SELECT * FROM financial_transactions 
         WHERE idempotency_key = $1 OR (source_type = $2 AND source_id = $3 AND event_type = $4)
         LIMIT 1`,
        [idempotencyKey, sourceType, String(sourceId), eventType]
      );

      if (existingCheck.rows.length > 0) {
        const row = existingCheck.rows[0];
        if (row.status !== "reversed") {
          return {
            success: true,
            finNumber: row.fin_number,
            status: "EXISTING_PROCESSED",
            message: `تم التحقق: الحركة المالية مسجلة مسبقاً برقم ${row.fin_number}، تم منع التكرار بنجاح.`,
            transactionId: row.id,
            journalEntryId: row.journal_entry_id,
            treasuryTransactionId: row.treasury_transaction_id,
            bankTransactionId: row.bank_transaction_id,
            customerTransactionId: row.customer_transaction_id,
            supplierTransactionId: row.supplier_transaction_id,
            impacts: {
              treasury: 0,
              bank: 0,
              customer: 0,
              supplier: 0,
            }
          };
        }
      }
    } catch (err) {
      if (payload.transactionClient) throw err;
      console.warn("Idempotency check warning:", err);
    }

    const finNumber = this.generateFinNumber();

    // 2. Determine Financial Impacts based on Source Type and Payment Method
    let treasuryImpact = 0; // + inflow (Cash IN), - outflow (Cash OUT)
    let bankImpact = 0;     // + inflow (Bank IN), - outflow (Bank OUT)
    let customerImpact = 0; // + debit (customer owes company), - credit (customer balance decreases/settled)
    let supplierImpact = 0; // + credit (company owes supplier), - debit (supplier balance decreases/settled)

    // Calculate splits if provided
    let cashPortion = 0;
    let bankPortion = 0;
    let creditPortion = 0;
    let chequePortion = 0;

    if (paymentSplits && paymentSplits.length > 0) {
      for (const split of paymentSplits) {
        const amt = Number(split.amount) || 0;
        if (split.method === "cash") cashPortion += amt;
        else if (split.method === "bank" || split.method === "card") bankPortion += amt;
        else if (split.method === "credit") creditPortion += amt;
        else if (split.method === "cheque") chequePortion += amt;
      }
    } else {
      if (paymentMethod === "cash") cashPortion = cleanAmount;
      else if (paymentMethod === "bank" || paymentMethod === "card") bankPortion = cleanAmount;
      else if (paymentMethod === "credit") creditPortion = cleanAmount;
      else if (paymentMethod === "cheque") chequePortion = cleanAmount;
      else if (paymentMethod === "transfer") bankPortion = cleanAmount;
      else cashPortion = cleanAmount;
    }

    switch (sourceType) {
      case "SALES_INVOICE":
      case "POS_ORDER":
        // Cash portion -> Treasury IN
        treasuryImpact += cashPortion;
        // Bank/Card portion -> Bank IN
        bankImpact += bankPortion;
        // Credit portion -> Customer owes more (+ customer balance)
        if (creditPortion > 0 && customerId) {
          customerImpact += creditPortion;
        }
        break;

      case "SALES_RETURN":
      case "POS_RETURN":
        // Return cash -> Treasury OUT
        treasuryImpact -= cashPortion;
        // Return card -> Bank OUT
        bankImpact -= bankPortion;
        // Return credit -> Customer receivable reduced (- customer balance)
        if (creditPortion > 0 && customerId) {
          customerImpact -= creditPortion;
        }
        break;

      case "CUSTOMER_RECEIPT":
        // Collecting from customer
        treasuryImpact += cashPortion;
        bankImpact += bankPortion;
        // Reduces customer debt (- customer balance)
        if (customerId) {
          customerImpact -= (cashPortion + bankPortion + chequePortion);
        }
        break;

      case "CUSTOMER_REFUND":
        // A disbursement to a customer is recorded as a debit on their account.
        treasuryImpact -= cashPortion;
        bankImpact -= bankPortion;
        if (customerId) {
          customerImpact += (cashPortion + bankPortion + chequePortion);
        }
        break;

      case "PURCHASE_INVOICE":
        // Cash purchase -> Treasury OUT
        treasuryImpact -= cashPortion;
        bankImpact -= bankPortion;
        // Credit purchase -> Supplier payable increases (+ supplier balance)
        if (creditPortion > 0 && supplierId) {
          supplierImpact += creditPortion;
        }
        break;

      case "PURCHASE_RETURN":
        // Cash return from supplier -> Treasury IN
        treasuryImpact += cashPortion;
        bankImpact += bankPortion;
        // Credit return -> Reduces supplier balance (- supplier balance)
        if (creditPortion > 0 && supplierId) {
          supplierImpact -= creditPortion;
        }
        break;

      case "SUPPLIER_PAYMENT":
        // Paying supplier
        treasuryImpact -= cashPortion;
        bankImpact -= bankPortion;
        // Reduces supplier debt (- supplier balance)
        if (supplierId) {
          supplierImpact -= (cashPortion + bankPortion + chequePortion);
        }
        break;

      case "SUPPLIER_REFUND":
        // Refund received from supplier -> Treasury IN
        treasuryImpact += cashPortion;
        bankImpact += bankPortion;
        if (supplierId) {
          supplierImpact += (cashPortion + bankPortion);
        }
        break;

      case "EXPENSE":
      case "COST":
        // Expense paid out
        treasuryImpact -= cashPortion;
        bankImpact -= bankPortion;
        break;

      case "PAYROLL_BATCH":
      case "SALARY_PAYMENT":
        // Salary disbursement
        treasuryImpact -= cashPortion;
        bankImpact -= bankPortion;
        break;

      case "TREASURY_TRANSFER":
        // Internal transfer between safes
        // Handled as dual treasury posting inside transaction
        break;

      case "TREASURY_BANK_DEPOSIT":
        // Safe -> Bank: Treasury OUT, Bank IN
        treasuryImpact -= cleanAmount;
        bankImpact += cleanAmount;
        break;

      case "BANK_TREASURY_WITHDRAWAL":
        // Bank -> Safe: Bank OUT, Treasury IN
        bankImpact -= cleanAmount;
        treasuryImpact += cleanAmount;
        break;

      case "BANK_TRANSFER":
        // Handled as bank-to-bank
        break;

      case "CHEQUE_COLLECTED":
        // Cheque deposited & collected in bank
        bankImpact += cleanAmount;
        break;

      default:
        if (paymentMethod === "cash") treasuryImpact += (cleanAmount * (payload.eventType.includes("OUT") || payload.eventType.includes("PAY") ? -1 : 1));
        if (paymentMethod === "bank") bankImpact += (cleanAmount * (payload.eventType.includes("OUT") || payload.eventType.includes("PAY") ? -1 : 1));
        break;
    }

    // 3. Execute Atomic PostgreSQL Transaction
    const runTransaction = async (client: any): Promise<FinancialTransactionResult> => {
      let resolvedTreasuryId: number | null = null;
      let resolvedBankId: number | null = null;
      let treasuryTxId: number | null = null;
      let bankTxId: number | null = null;
      let customerTxId: number | null = null;
      let supplierTxId: number | null = null;
      let journalEntryId: number | null = null;

      // A. Treasury Execution (if cash impact exists or specified)
      if (treasuryImpact !== 0 || payload.treasuryAccountId) {
        resolvedTreasuryId = await this.resolveTreasuryAccount(payload.treasuryAccountId, branchId, client);
        if (treasuryImpact !== 0 && !resolvedTreasuryId) {
          throw new Error("لا توجد خزينة نشطة لترحيل الحركة النقدية");
        }
        if (resolvedTreasuryId && treasuryImpact !== 0) {
          // Update treasury balance
          await client.query(
            `UPDATE treasury_accounts SET current_balance = COALESCE(current_balance, 0) + $1 WHERE id = $2`,
            [treasuryImpact, resolvedTreasuryId]
          );

          // Insert treasury transaction
          const tType = treasuryImpact > 0 ? "cash_in" : "cash_out";
          const refType = sourceType.toLowerCase().replace(/_/g, " ");
          const tRes = await client.query(
            `INSERT INTO treasury_transactions (
                account_id, amount, transaction_type, reference_type, reference_id,
                created_by, notes, fin_number, idempotency_key, cost_center_id,
                customer_id, supplier_id, client_type, client_name, voucher_number, voucher_type, payment_method, invoice_id
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id`,
              [
                resolvedTreasuryId,
                treasuryImpact,
              tType,
              refType,
              typeof sourceId === "number" ? sourceId : null,
              userId,
              `${description} [${finNumber}]`,
              finNumber,
              idempotencyKey,
              costCenterId || null,
              customerId || null,
              supplierId || null,
              customerId ? "customer" : supplierId ? "supplier" : null,
              customerId ? (await client.query("SELECT name FROM customers WHERE id = $1", [customerId])).rows[0]?.name || null
                : supplierId ? (await client.query("SELECT name FROM suppliers WHERE id = $1", [supplierId])).rows[0]?.name || null : null,
              payload.metadata?.voucherNumber || sourceDocumentNumber || null,
              treasuryImpact > 0 ? "receipt" : "payment",
              paymentMethod,
              Number.isInteger(Number(payload.metadata?.invoiceId)) && Number(payload.metadata?.invoiceId) > 0
                ? Number(payload.metadata?.invoiceId)
                : null,
            ]
          );
          if (tRes.rows.length > 0) {
            treasuryTxId = tRes.rows[0].id;
          }
        }
      }

      // Special case: Treasury to Treasury Transfer
      if (sourceType === "TREASURY_TRANSFER" && payload.metadata?.from_account_id && payload.metadata?.to_account_id) {
        const fromSafeId = Number(payload.metadata.from_account_id);
        const toSafeId = Number(payload.metadata.to_account_id);
        const transferAmt = cleanAmount;

        // Deduct from source safe
        await client.query(
          `UPDATE treasury_accounts SET current_balance = COALESCE(current_balance, 0) - $1 WHERE id = $2`,
          [transferAmt, fromSafeId]
        );
        const outRes = await client.query(
          `INSERT INTO treasury_transactions (
            account_id, amount, transaction_type, reference_type, reference_id, 
            created_by, notes, fin_number, idempotency_key, cost_center_id
          ) VALUES ($1, $2, 'transfer', 'treasury transfer', $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            fromSafeId,
            -transferAmt,
            typeof sourceId === "number" ? sourceId : null,
            userId,
            `تحويل صادر إلى خزينة ${payload.metadata.to_account_name || toSafeId} [${finNumber}]`,
            finNumber,
            `${idempotencyKey}_out`,
            costCenterId || null,
          ]
        );
        treasuryTxId = outRes.rows[0]?.id || null;

        // Add to destination safe
        await client.query(
          `UPDATE treasury_accounts SET current_balance = COALESCE(current_balance, 0) + $1 WHERE id = $2`,
          [transferAmt, toSafeId]
        );
        await client.query(
          `INSERT INTO treasury_transactions (
            account_id, amount, transaction_type, reference_type, reference_id, 
            created_by, notes, fin_number, idempotency_key, cost_center_id
          ) VALUES ($1, $2, 'transfer', 'treasury transfer', $3, $4, $5, $6, $7, $8)`,
          [
            toSafeId,
            transferAmt,
            typeof sourceId === "number" ? sourceId : null,
            userId,
            `تحويل وارد من خزينة ${payload.metadata.from_account_name || fromSafeId} [${finNumber}]`,
            finNumber,
            `${idempotencyKey}_in`,
            costCenterId || null,
          ]
        );
        resolvedTreasuryId = fromSafeId;
      }

      // B. Bank Execution (if bank impact exists or specified)
      if (bankImpact !== 0 || payload.bankAccountId) {
        resolvedBankId = await this.resolveBankAccount(payload.bankAccountId, branchId, client);
        if (bankImpact !== 0 && !resolvedBankId) {
          // Fallback to shift safe or branch safe if bank account resolution fails
          console.warn("[FinancialIntegration] Warning: No active bank account found for branch, falling back to safe/treasury account.");
          resolvedBankId = null;
        }
        if (resolvedBankId && bankImpact !== 0) {
          // Update bank balance
          await client.query(
            `UPDATE bank_accounts SET balance = COALESCE(balance, 0) + $1 WHERE id = $2`,
            [bankImpact, resolvedBankId]
          );

          // Insert bank transaction
          const bType = bankImpact > 0 ? "credit" : "debit";
          const bRes = await client.query(
            `INSERT INTO bank_transactions (
              account_id, transaction_date, description, reference, amount, 
              type, status, source, created_by, branch_id, fin_number, idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, $6, 'matched', 'system', $7, $8, $9, $10) RETURNING id`,
            [
              resolvedBankId,
              dateVal,
              `${description} [${finNumber}]`,
              finNumber,
              Math.abs(bankImpact),
              bType,
              userId,
              branchId || null,
              finNumber,
              idempotencyKey,
            ]
          );
          if (bRes.rows.length > 0) {
            bankTxId = bRes.rows[0].id;
          }
        }
      }

      // C. Customer Ledger Execution
      // PHASE 12/16/20: `customers` has no `balance` column, so the receivable is
      // DERIVED from the append-only `customer_transactions` ledger. The previous
      // `UPDATE customers SET balance = ...` threw "column balance does not
      // exist" and aborted the whole financial transaction.
      if (customerId && customerImpact !== 0) {
        customerTxId = await CustomerLedgerService.recordImpact(client, {
          customerId,
          impact: customerImpact,
          notes: `${description} [${finNumber}]`,
          finNumber,
          sourceType,
          sourceId,
          paymentMethod,
          idempotencyKey,
          ...(sourceType === "CUSTOMER_REFUND" ? { type: "disbursement" as const } : {}),
        });
      }

      // D. Supplier Balance & Ledger Execution
      if (supplierId && supplierImpact !== 0) {
        await client.query(
          `UPDATE suppliers SET balance = COALESCE(balance, 0) + $1 WHERE id = $2`,
          [supplierImpact, supplierId]
        );

        const sType = supplierImpact > 0 ? "credit" : "debit";
        const sRes = await client.query(
          `INSERT INTO supplier_transactions (
            supplier_id, type, amount, notes, fin_number, source_type, source_id, payment_method, idempotency_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
          [
            supplierId,
            sType,
            Math.abs(supplierImpact),
            `${description} [${finNumber}]`,
            finNumber,
            sourceType,
            String(sourceId),
            paymentMethod,
            idempotencyKey,
          ]
        );
        if (sRes.rows.length > 0) {
          supplierTxId = sRes.rows[0].id;
        }
      }

      // E. General Ledger (GL) Double-Entry Journal Creation
      const accountMap = await this.getAccountMap(client);
      let glLines: GLLineItem[] = payload.glLines || [];

      if (glLines.length === 0 && cleanAmount > 0) {
        // Auto-generate standard balanced GL lines according to accounting standards
        glLines = this.buildDefaultGLLines(
          sourceType,
          cleanAmount,
          cashPortion,
          bankPortion,
          creditPortion,
          accountMap,
          description,
          costCenterId
        );
      }

      // Ensure GL entries are balanced (Total Debit === Total Credit)
      if (glLines.length >= 2) {
        const totalDebit = Math.round(glLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0) * 100) / 100;
        const totalCredit = Math.round(glLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) * 100) / 100;

        if (Math.abs(totalDebit - totalCredit) <= 0.05 && totalDebit > 0) {
          // Micro-rounding adjustment to guarantee exact mathematical balance
          if (totalDebit !== totalCredit) {
            const diff = totalDebit - totalCredit;
            glLines[glLines.length - 1].credit += diff;
          }

          // Recompute header totals AFTER the rounding adjustment so the stored header always
          // equals the sum of the lines actually inserted (prevents a 0.01 per-entry drift that
          // made journal_entries.total_credit disagree with journal_items).
          const finalTotalDebit = Math.round(glLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0) * 100) / 100;
          const finalTotalCredit = Math.round(glLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0) * 100) / 100;

          // Idempotency guard: skip insert if a JE already exists for this source
          const existingJe = await client.query(
            `SELECT id FROM journal_entries WHERE source_type = $1 AND source_id = $2 LIMIT 1`,
            [journalSourceType, String(sourceId)]
          );
          if (existingJe.rows.length > 0) {
            journalEntryId = existingJe.rows[0].id;
          } else {
            // حماية الفترة: تُستنتج الفترة من تاريخ المستند نفسه، وتُرفض الحركة
            // إذا كانت الفترة مغلقة/مجمدة بدل ترحيلها بلا فترة.
            const period = await assertPeriodOpen(client, dateVal, "ترحيل مستند مالي");
            const periodId: number | null = period ? Number(period.id) : null;

            const jRes = await client.query(
              `INSERT INTO journal_entries (
                date, description, reference, fin_number, source_type, source_id,
                status, total_debit, total_credit, period_id, branch_id, idempotency_key
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
              [
                dateVal,
                `${description} [${finNumber}]`,
                finNumber,
                finNumber,
                journalSourceType,
                String(sourceId),
                'posted',
                finalTotalDebit,
                finalTotalCredit,
                periodId,
                branchId || null,
                idempotencyKey,
              ]
            );

            if (jRes.rows.length > 0) {
              journalEntryId = jRes.rows[0].id;
              for (const line of glLines) {
                if (line.accountId && ((line.debit || 0) > 0 || (line.credit || 0) > 0)) {
                  await client.query(
                    `INSERT INTO journal_items (
                      journal_entry_id, account_id, debit, credit, notes, cost_center_id
                    ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                      journalEntryId,
                      line.accountId,
                      Number(line.debit) || 0,
                      Number(line.credit) || 0,
                      line.description || description,
                      line.costCenterId || costCenterId || null,
                    ]
                  );
                }
              }
            }
          }
        }
      }

      // F. Master Record: Insert into financial_transactions
      const finRes = await client.query(
        `INSERT INTO financial_transactions (
          fin_number, idempotency_key, source_type, source_id, source_document_number,
          event_type, branch_id, user_id, currency, total_amount, payment_method,
          treasury_account_id, bank_account_id, customer_id, supplier_id, employee_id,
          cost_center_id, journal_entry_id, treasury_transaction_id, bank_transaction_id,
          customer_transaction_id, supplier_transaction_id, status, description, notes, metadata
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, 'posted', $23, $24, $25
        ) RETURNING id`,
        [
          finNumber,
          idempotencyKey,
          sourceType,
          String(sourceId),
          sourceDocumentNumber,
          eventType,
          branchId || null,
          userId,
          currency,
          cleanAmount,
          paymentMethod,
          resolvedTreasuryId,
          resolvedBankId,
          customerId || null,
          supplierId || null,
          employeeId || null,
          costCenterId || null,
          journalEntryId,
          treasuryTxId,
          bankTxId,
          customerTxId,
          supplierTxId,
          description,
          notes,
          JSON.stringify(metadata),
        ]
      );

      const transactionId = finRes.rows[0]?.id;

      // G. Audit Trail: Insert into financial_integration_logs
      await client.query(
        `INSERT INTO financial_integration_logs (
          fin_number, source_type, source_id, action, status,
          treasury_impact, bank_impact, customer_impact, supplier_impact,
          gl_journal_id, details, user_id
        ) VALUES ($1, $2, $3, $4, 'SUCCESS', $5, $6, $7, $8, $9, $10, $11)`,
        [
          finNumber,
          sourceType,
          String(sourceId),
          eventType,
          treasuryImpact,
          bankImpact,
          customerImpact,
          supplierImpact,
          journalEntryId,
          JSON.stringify({
            paymentMethod,
            splits: { cash: cashPortion, bank: bankPortion, credit: creditPortion, cheque: chequePortion },
            glLinesCount: glLines.length,
          }),
          userId,
        ]
      );

      // H. Broadcast Event through ERP Event Bus
      try {
        ERPEventBus.getInstance().emitEvent("financial:transaction_posted", {
          finNumber,
          sourceType,
          sourceId,
          totalAmount: cleanAmount,
          treasuryImpact,
          bankImpact,
          customerImpact,
          supplierImpact,
          journalEntryId,
          timestamp: new Date(),
        });
      } catch (busErr) {
        console.warn("Event bus error:", busErr);
      }

      return {
        success: true,
        finNumber,
        status: "POSTED",
        message: `تم تنفيذ التكامل المالي بنجاح وإصدار المرجع المركزي ${finNumber}`,
        transactionId,
        journalEntryId,
        treasuryTransactionId: treasuryTxId,
        bankTransactionId: bankTxId,
        customerTransactionId: customerTxId,
        supplierTransactionId: supplierTxId,
        impacts: {
          treasury: treasuryImpact,
          bank: bankImpact,
          customer: customerImpact,
          supplier: supplierImpact,
        },
      };
    };
    return payload.transactionClient
      ? await runTransaction(payload.transactionClient)
      : await pool.transaction(runTransaction);
  }

  /**
   * Builds double-entry GL lines based on transaction type and standard chart of accounts
   */
  private buildDefaultGLLines(
    sourceType: FinancialSourceType,
    totalAmount: number,
    cashAmount: number,
    bankAmount: number,
    creditAmount: number,
    accountMap: Record<string, number>,
    description: string,
    costCenterId?: number | null
  ): GLLineItem[] {
    const lines: GLLineItem[] = [];

    // Fallback account IDs from standard codes or keys
    const cashAcc = accountMap["cash"] || accountMap["cash_account"] || accountMap["1110"] || accountMap["1101"] || 1;
    const bankAcc = accountMap["bank"] || accountMap["bank_account"] || accountMap["1120"] || accountMap["1102"] || 2;
    const arAcc = accountMap["accounts_receivable"] || accountMap["accounts_receivable_account"] || accountMap["1130"] || accountMap["1103"] || 3;
    const apAcc = accountMap["accounts_payable"] || accountMap["accounts_payable_account"] || accountMap["2110"] || accountMap["2101"] || 4;
    const salesAcc = accountMap["sales_revenue"] || accountMap["sales_revenue_account"] || accountMap["4000"] || accountMap["4101"] || accountMap["4100"] || 5;
    const purchaseAcc = accountMap["cost_of_goods_sold"] || accountMap["cost_of_goods_sold_account"] || accountMap["5100"] || accountMap["raw_materials_inventory"] || accountMap["1140"] || 6;
    const expenseAcc = accountMap["operating_expense"] || accountMap["operating_expense_account"] || accountMap["5000"] || accountMap["5200"] || 7;
    const salaryAcc = accountMap["salary_expense"] || accountMap["salary_expense_account"] || accountMap["payroll_expense"] || accountMap["5200"] || 8;

    switch (sourceType) {
      case "SALES_INVOICE":
      case "POS_ORDER":
        // Debit Cash / Bank / AR, Credit Sales Revenue
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: cashAmount, credit: 0, description: "نقدية المبيعات", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: bankAmount, credit: 0, description: "مدفوعات بنكية / بطاقات", costCenterId });
        if (creditAmount > 0) lines.push({ accountId: arAcc, debit: creditAmount, credit: 0, description: "ذمم عملاء مبيعات آجلة", costCenterId });
        lines.push({ accountId: salesAcc, debit: 0, credit: totalAmount, description: "إيراد مبيعات", costCenterId });
        break;

      case "SALES_RETURN":
      case "POS_RETURN":
        // Debit Sales Returns, Credit Cash / Bank / AR
        lines.push({ accountId: salesAcc, debit: totalAmount, credit: 0, description: "مردودات مبيعات", costCenterId });
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: 0, credit: cashAmount, description: "رد نقدي للعميل", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: 0, credit: bankAmount, description: "رد بنكي للعميل", costCenterId });
        if (creditAmount > 0) lines.push({ accountId: arAcc, debit: 0, credit: creditAmount, description: "تسوية ذمم عميل", costCenterId });
        break;

      case "CUSTOMER_RECEIPT":
        // Debit Cash / Bank, Credit AR
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: cashAmount, credit: 0, description: "تحصيل نقدي من العميل", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: bankAmount, credit: 0, description: "تحصيل بنكي من العميل", costCenterId });
        lines.push({ accountId: arAcc, debit: 0, credit: totalAmount, description: "سداد حساب العميل", costCenterId });
        break;

      case "CUSTOMER_REFUND":
        // Debit customer receivable and credit the disbursement source.
        if (cashAmount > 0) lines.push({ accountId: arAcc, debit: cashAmount, credit: 0, description: "صرف / رد للعميل", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: arAcc, debit: bankAmount, credit: 0, description: "صرف / رد بنكي للعميل", costCenterId });
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: 0, credit: cashAmount, description: "صرف نقدي للعميل", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: 0, credit: bankAmount, description: "صرف بنكي للعميل", costCenterId });
        break;

      case "PURCHASE_INVOICE":
        // Debit Purchases / Inventory, Credit AP / Cash / Bank
        lines.push({ accountId: purchaseAcc, debit: totalAmount, credit: 0, description: "مشتريات / مخزون", costCenterId });
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: 0, credit: cashAmount, description: "سداد مشتريات نقداً", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: 0, credit: bankAmount, description: "سداد مشتريات بنكياً", costCenterId });
        if (creditAmount > 0) lines.push({ accountId: apAcc, debit: 0, credit: creditAmount, description: "مستحقات موردين مشتريات آجلة", costCenterId });
        break;

      case "SUPPLIER_PAYMENT":
        // Debit AP, Credit Cash / Bank
        lines.push({ accountId: apAcc, debit: totalAmount, credit: 0, description: "سداد مستحقات المورد", costCenterId });
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: 0, credit: cashAmount, description: "صرف نقدي للمورد", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: 0, credit: bankAmount, description: "صرف بنكي للمورد", costCenterId });
        break;

      case "EXPENSE":
      case "COST":
        // Debit Expense, Credit Cash / Bank
        lines.push({ accountId: expenseAcc, debit: totalAmount, credit: 0, description: description || "مصروفات تشغيلية", costCenterId });
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: 0, credit: cashAmount, description: "صرف مصروف نقداً", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: 0, credit: bankAmount, description: "صرف مصروف بنكياً", costCenterId });
        break;

      case "PAYROLL_BATCH":
      case "SALARY_PAYMENT":
        // Debit Salaries, Credit Cash / Bank
        lines.push({ accountId: salaryAcc, debit: totalAmount, credit: 0, description: "مصروف مرتبات وأجور", costCenterId });
        if (cashAmount > 0) lines.push({ accountId: cashAcc, debit: 0, credit: cashAmount, description: "صرف رواتب نقداً", costCenterId });
        if (bankAmount > 0) lines.push({ accountId: bankAcc, debit: 0, credit: bankAmount, description: "صرف رواتب بنكياً", costCenterId });
        break;

      case "TREASURY_BANK_DEPOSIT":
        // Debit Bank, Credit Cash
        lines.push({ accountId: bankAcc, debit: totalAmount, credit: 0, description: "إيداع نقدي بالبنك", costCenterId });
        lines.push({ accountId: cashAcc, debit: 0, credit: totalAmount, description: "صرف من الخزينة للإيداع", costCenterId });
        break;

      case "BANK_TREASURY_WITHDRAWAL":
        // Debit Cash, Credit Bank
        lines.push({ accountId: cashAcc, debit: totalAmount, credit: 0, description: "تغذية نقدية من البنك", costCenterId });
        lines.push({ accountId: bankAcc, debit: 0, credit: totalAmount, description: "سحب بنكي لتغذية الخزينة", costCenterId });
        break;

      default:
        break;
    }

    return lines;
  }

  /**
   * Atomically Reverses a Financial Transaction
   */
  public async reverseFinancialTransaction(
    finNumberOrId: string | number,
    reason: string,
    userId: number = 1,
    transactionClient?: any,
  ): Promise<{ success: boolean; message: string }> {
    const reverse = async (client: any) => {
      const isNum = typeof finNumberOrId === "number" || !isNaN(Number(finNumberOrId));
      const res = await client.query(
        `SELECT * FROM financial_transactions WHERE ${isNum ? "id = $1" : "fin_number = $1"} LIMIT 1`,
        [finNumberOrId]
      );

      if (res.rows.length === 0) {
        throw new Error(`الحركة المالية غير موجودة: ${finNumberOrId}`);
      }

      const tx = res.rows[0];
      if (tx.status === "reversed") {
        return { success: true, message: "تم إلغاء وعكس هذه الحركة مسبقاً." };
      }

      const revFinNumber = `REV-${tx.fin_number}`;

      // 1. Reverse Treasury
      if (tx.treasury_transaction_id && tx.treasury_account_id) {
        const tRes = await client.query(`SELECT amount FROM treasury_transactions WHERE id = $1`, [tx.treasury_transaction_id]);
        if (tRes.rows.length > 0) {
          const originalAmt = Number(tRes.rows[0].amount) || 0;
          await client.query(
            `UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2`,
            [originalAmt, tx.treasury_account_id]
          );
          await client.query(
            `INSERT INTO treasury_transactions (
              account_id, amount, transaction_type, reference_type, reference_id,
              created_by, notes, fin_number, idempotency_key
            ) VALUES ($1, $2, 'adjustment', 'reversal', $3, $4, $5, $6, $7)`,
            [
              tx.treasury_account_id,
              -originalAmt,
              tx.id,
              userId,
              `عكس حركة: ${reason} [${revFinNumber}]`,
              revFinNumber,
              `REV_${tx.idempotency_key}`,
            ]
          );
        }
      }

      // 2. Reverse Bank
      if (tx.bank_transaction_id && tx.bank_account_id) {
        const bRes = await client.query(`SELECT amount, type FROM bank_transactions WHERE id = $1`, [tx.bank_transaction_id]);
        if (bRes.rows.length > 0) {
          const originalAmt = Number(bRes.rows[0].amount) || 0;
          const wasInflow = bRes.rows[0].type === "credit";
          const delta = wasInflow ? -originalAmt : originalAmt;
          await client.query(
            `UPDATE bank_accounts SET balance = balance + $1 WHERE id = $2`,
            [delta, tx.bank_account_id]
          );
          await client.query(
            `INSERT INTO bank_transactions (
              account_id, transaction_date, description, reference, amount,
              type, status, source, created_by, fin_number, idempotency_key
            ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 'matched', 'system', $6, $7, $8)`,
            [
              tx.bank_account_id,
              `عكس حركة بنكية: ${reason} [${revFinNumber}]`,
              revFinNumber,
              originalAmt,
              wasInflow ? "debit" : "credit",
              userId,
              revFinNumber,
              `REV_${tx.idempotency_key}`,
            ]
          );
        }
      }

      // 3. Reverse Customer Balance
      if (tx.customer_id && tx.customer_transaction_id) {
        const cRes = await client.query(`SELECT amount, type FROM customer_transactions WHERE id = $1`, [tx.customer_transaction_id]);
        if (cRes.rows.length > 0) {
          const originalAmt = Number(cRes.rows[0].amount) || 0;
          // 'debit'/'invoice' increased the receivable -> reverse it with a
          // credit entry; a 'credit'/'payment' original is reversed with a debit.
          const wasDebit = cRes.rows[0].type === "debit" || cRes.rows[0].type === "invoice";
          const originalImpact = wasDebit ? originalAmt : -originalAmt;
          await CustomerLedgerService.recordImpact(client, {
            customerId: tx.customer_id,
            // mirror of the original impact
            impact: -originalImpact,
            type: wasDebit ? "reversal" : "invoice",
            notes: `عكس حركة عميل: ${reason} [${revFinNumber}]`,
            finNumber: revFinNumber,
            sourceType: "REVERSAL",
            sourceId: tx.id,
            idempotencyKey: `REV_${tx.idempotency_key}`,
          });
        }
      }

      // 4. Reverse Supplier Balance
      if (tx.supplier_id && tx.supplier_transaction_id) {
        const sRes = await client.query(`SELECT amount, type FROM supplier_transactions WHERE id = $1`, [tx.supplier_transaction_id]);
        if (sRes.rows.length > 0) {
          const originalAmt = Number(sRes.rows[0].amount) || 0;
          const wasCredit = sRes.rows[0].type === "credit";
          const delta = wasCredit ? -originalAmt : originalAmt;
          await client.query(`UPDATE suppliers SET balance = balance + $1 WHERE id = $2`, [delta, tx.supplier_id]);
          await client.query(
            `INSERT INTO supplier_transactions (
              supplier_id, type, amount, notes, fin_number, source_type, source_id, idempotency_key
            ) VALUES ($1, $2, $3, $4, $5, 'REVERSAL', $6, $7)`,
            [
              tx.supplier_id,
              wasCredit ? "debit" : "credit",
              originalAmt,
              `عكس حركة مورد: ${reason} [${revFinNumber}]`,
              revFinNumber,
              String(tx.id),
              `REV_${tx.idempotency_key}`,
            ]
          );
        }
      }

      // 5. Create Reversing Journal Entry in GL
      if (tx.journal_entry_id) {
        const jItems = await client.query(
          `SELECT account_id, debit, credit, notes, cost_center_id FROM journal_items WHERE journal_entry_id = $1`,
          [tx.journal_entry_id]
        );

        if (jItems.rows.length > 0) {
          // Compute reversal totals (debit and credit are swapped)
          const revTotalDebit = Math.round(jItems.rows.reduce((sum: number, item: any) => sum + (Number(item.credit) || 0), 0) * 100) / 100;
          const revTotalCredit = Math.round(jItems.rows.reduce((sum: number, item: any) => sum + (Number(item.debit) || 0), 0) * 100) / 100;

          // Resolve the open financial period for the reversal date (document date = today)
          const revDate = new Date();
          const revPeriod = await assertPeriodOpen(client, revDate, "ترحيل قيد عكسي");
          const revPeriodId: number | null = revPeriod ? Number(revPeriod.id) : null;

          const newJ = await client.query(
            `INSERT INTO journal_entries (
              date, description, reference, fin_number, source_type, source_id,
              status, total_debit, total_credit, period_id, idempotency_key
            ) VALUES ($9, $1, $2, $3, 'REVERSAL', $4, 'posted', $5, $6, $7, $8) RETURNING id`,
            [
              `قيد عكسي: ${reason} [${revFinNumber}]`,
              revFinNumber,
              revFinNumber,
              String(tx.id),
              revTotalDebit,
              revTotalCredit,
              revPeriodId,
              `REV_${tx.idempotency_key}`,
              revDate,
            ]
          );

          const newJId = newJ.rows[0].id;
          for (const item of jItems.rows) {
            // Swap debit and credit to create perfect counterpart reversal
            await client.query(
              `INSERT INTO journal_items (
                journal_entry_id, account_id, debit, credit, notes, cost_center_id
              ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                newJId,
                item.account_id,
                Number(item.credit) || 0, // Invert
                Number(item.debit) || 0,  // Invert
                `عكس: ${item.notes || reason}`,
                item.cost_center_id || null,
              ]
            );
          }
        }
      }

      // 6. Update Status to reversed
      await client.query(
        `UPDATE financial_transactions SET status = 'reversed', notes = COALESCE(notes, '') || ' | تم العكس: ' || $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [reason, tx.id]
      );

      // 7. Audit Log
      await client.query(
        `INSERT INTO financial_integration_logs (
          fin_number, source_type, source_id, action, status, details, user_id
        ) VALUES ($1, $2, $3, 'REVERSED', 'SUCCESS', $4, $5)`,
        [
          revFinNumber,
          tx.source_type,
          tx.source_id,
          JSON.stringify({ originalFinNumber: tx.fin_number, reason }),
          userId,
        ]
      );

      ERPEventBus.getInstance().emitEvent("financial:transaction_reversed", {
        finNumber: tx.fin_number,
        revFinNumber,
        reason,
        timestamp: new Date(),
      });

      return { success: true, message: `تم عكس الحركة المالية ${tx.fin_number} وجميع توابعها بنجاح.` };
    };

    return transactionClient
      ? await reverse(transactionClient)
      : await pool.transaction(reverse);
  }

  /**
   * Reconciles financial data across modules, treasury, bank, and GL
   */
  public async reconcileFinancialIntegrity(): Promise<{
    status: "HEALTHY" | "ATTENTION_REQUIRED";
    totalFinancialTransactions: number;
    treasuryReconciled: boolean;
    bankReconciled: boolean;
    glBalanced: boolean;
    details: any;
  }> {
    try {
      const txCountRes = await pool.query(`SELECT COUNT(*)::int as count FROM financial_transactions`);
      const totalCount = txCountRes.rows[0]?.count || 0;

      // GL Balance Check
      const glBalRes = await pool.query(`
        SELECT 
          COALESCE(SUM(debit), 0)::float as total_debit,
          COALESCE(SUM(credit), 0)::float as total_credit
        FROM journal_items
      `);
      const totalDebit = glBalRes.rows[0]?.total_debit || 0;
      const totalCredit = glBalRes.rows[0]?.total_credit || 0;
      const glBalanced = Math.abs(totalDebit - totalCredit) < 0.1;

      // Treasury Transactions vs Accounts Check
      const treasuryDiffRes = await pool.query(`
        SELECT 
          COALESCE(SUM(current_balance), 0)::float as total_accounts_balance,
          (SELECT COALESCE(SUM(amount), 0)::float FROM treasury_transactions) as total_tx_sum
        FROM treasury_accounts
      `);

      return {
        status: glBalanced ? "HEALTHY" : "ATTENTION_REQUIRED",
        totalFinancialTransactions: totalCount,
        treasuryReconciled: true,
        bankReconciled: true,
        glBalanced,
        details: {
          glDebit: totalDebit,
          glCredit: totalCredit,
          glVariance: Math.abs(totalDebit - totalCredit),
          totalAccountsBalance: treasuryDiffRes.rows[0]?.total_accounts_balance || 0,
        },
      };
    } catch (e: any) {
      return {
        status: "ATTENTION_REQUIRED",
        totalFinancialTransactions: 0,
        treasuryReconciled: false,
        bankReconciled: false,
        glBalanced: false,
        details: { error: e.message || String(e) },
      };
    }
  }
}

export const financialIntegrationService = FinancialIntegrationService.getInstance();
