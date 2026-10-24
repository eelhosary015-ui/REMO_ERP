import { Router } from "express";
import { pool } from "../../server-db.js";
import { authenticateToken } from "../system/system_api.routes.js";
import { upload } from "../../server.js";
import { getAccountConfig, getOpenPeriod, postSupplierPaymentEntry } from "../accounts/services/auto-posting.service.js";
import { AccountRepository } from "../accounts/repositories/account.repository.js";
import { financialIntegrationService } from "./services/financial_integration.service.js";
import { generateTreasuryVoucherNumber } from "./services/treasury-voucher.service.js";
import { periodGuardMiddleware } from "../accounts/services/period-guard.middleware.js";

const router = Router();
router.use(periodGuardMiddleware);

/**
 * إنشاء قيد محاسبي لسند خزينة داخل نفس معاملة السند.
 * idempotent على (source_type='treasury_voucher', source_id=voucherId).
 * يعيد صف القيد إن وُجد أو أُنشئ.
 */
async function postVoucherGlEntry(client: any, opts: {
  voucherId: number;
  voucherNumber: string;
  amount: number;
  transactionType: string;
  paymentMethod?: string;
  date: Date | string;
  partyName: string;
  userId?: number | null;
  branchId?: number | null;
  supplierId?: number | null;
  customerId?: number | null;
  employeeId?: number | null;
  expenseAccountId?: number | null;
  costCenterId?: number | null;
}): Promise<any> {
  const existing = await client.query(
    "SELECT id, reference FROM journal_entries WHERE source_type = 'treasury_voucher' AND source_id = $1 ORDER BY id LIMIT 1",
    [opts.voucherId],
  );
  if (existing.rows[0]) return existing.rows[0];

  const amount = Math.abs(Number(opts.amount));
  if (!amount) return null;

  const config: any = await getAccountConfig();
  const isInflow = opts.transactionType === 'cash_in' || (opts.transactionType === 'adjustment' && Number(opts.amount) > 0);
  const cashAccount = Number(opts.paymentMethod && opts.paymentMethod !== 'cash' ? (config.bank || config.cash) : config.cash);
  if (!cashAccount) return null;

  let counter = 0;
  if (opts.supplierId) counter = Number(config.accounts_payable || 0);
  else if (opts.customerId) counter = Number(config.accounts_receivable || 0);
  else if (opts.employeeId) counter = Number(config.employee_advances || config.accounts_receivable || 0);
  else if (opts.expenseAccountId) counter = Number(opts.expenseAccountId);
  else counter = Number(config.cost_expense || config.other_expense || config.accounts_payable || 0);

  if (!counter || counter === cashAccount) return null;

  const repo = new AccountRepository();
  return repo.createJournalEntry({
    date: opts.date,
    description: `سند ${isInflow ? 'قبض' : 'صرف'} ${opts.voucherNumber} — ${opts.partyName}`,
    reference: opts.voucherNumber,
    source_type: 'treasury_voucher',
    source_id: opts.voucherId,
    status: 'posted',
    created_by: opts.userId ?? null,
    branch_id: opts.branchId ?? null,
    items: [
      { account_id: cashAccount, debit: isInflow ? amount : 0, credit: isInflow ? 0 : amount, notes: `خزينة/بنك — سند ${opts.voucherNumber}` },
      { account_id: counter, debit: isInflow ? 0 : amount, credit: isInflow ? amount : 0, notes: `الطرف المقابل — سند ${opts.voucherNumber}`, cost_center_id: opts.costCenterId ?? null },
    ],
  }, client);
}

// Help Helper: Log Audit Trail
async function logAudit(client: any, transactionId: number | null, accountId: number | null, actionType: string, oldValues: any, newValues: any, userId: number, ip: string = "") {
  try {
    await client.query(
      `INSERT INTO treasury_audit_logs (transaction_id, account_id, action_type, old_values, new_values, user_id, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [transactionId, accountId, actionType, JSON.stringify(oldValues), JSON.stringify(newValues), userId, ip]
    );
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

// 1. DASHBOARD STATISTICS
router.get("/api/treasury/dashboard", authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Total balance, accounts stats
    const balanceRes = await pool.query(`
      SELECT 
        COALESCE(SUM(current_balance), 0)::float as total_balance,
        COALESCE(SUM(CASE WHEN type = 'cash' THEN current_balance ELSE 0 END), 0)::float as cash_balance,
        COALESCE(SUM(CASE WHEN type = 'bank' THEN current_balance ELSE 0 END), 0)::float as bank_balance,
        COALESCE(SUM(CASE WHEN type = 'petty_cash' THEN current_balance ELSE 0 END), 0)::float as petty_cash_balance
      FROM treasury_accounts
      WHERE status = 'active'
    `);
    
    // Daily flows
    const flowRes = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 AND transaction_type != 'transfer' THEN amount ELSE 0 END), 0)::float as daily_receipts,
        COALESCE(SUM(CASE WHEN amount < 0 AND transaction_type != 'transfer' THEN ABS(amount) ELSE 0 END), 0)::float as daily_payments,
        COALESCE(SUM(CASE WHEN transaction_type = 'transfer' THEN ABS(amount)/2.0 ELSE 0 END), 0)::float as daily_transfers,
        COUNT(*)::integer as daily_count
      FROM treasury_transactions
      WHERE created_at::date = $1 AND status = 'approved'
    `, [today]);

    // High and Low accounts
    const limitsRes = await pool.query(`
      SELECT name, current_balance::float as balance, min_balance_limit::float as min_limit, max_balance_limit::float as max_limit
      FROM treasury_accounts
      WHERE status = 'active'
    `);

    let highestSafe = { name: "-", balance: 0 };
    let lowestSafe = { name: "-", balance: 0 };
    const alerts: any[] = [];

    if (limitsRes.rows.length > 0) {
      // Find highest/lowest
      const sorted = [...limitsRes.rows].sort((a, b) => b.balance - a.balance);
      highestSafe = { name: sorted[0].name, balance: sorted[0].balance };
      lowestSafe = { name: sorted[sorted.length - 1].name, balance: sorted[sorted.length - 1].balance };

      // Generate alerts
      for (const row of limitsRes.rows) {
        if (row.min_limit > 0 && row.balance < row.min_limit) {
          alerts.push({
            type: "warning_low",
            message: `تنبيه: رصيد الخزينة "${row.name}" (${row.balance.toLocaleString()} ج.م) أقل من الحد الأدنى المسموح به (${row.min_limit.toLocaleString()} ج.م)`
          });
        }
        if (row.max_limit > 0 && row.balance > row.max_limit) {
          alerts.push({
            type: "warning_high",
            message: `تنبيه: رصيد الخزينة "${row.name}" (${row.balance.toLocaleString()} ج.م) تجاوز الحد الأقصى المسموح به (${row.max_limit.toLocaleString()} ج.م)`
          });
        }
      }
    }

    // Last 5 transactions
    const lastTxRes = await pool.query(`
      SELECT t.*, a.name as account_name, u.username as user_name
      FROM treasury_transactions t
      JOIN treasury_accounts a ON t.account_id = a.id
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `);

    // Chart Data (Last 7 days flows)
    const chartRes = await pool.query(`
      SELECT 
        created_at::date as date_label,
        COALESCE(SUM(CASE WHEN amount > 0 AND transaction_type != 'transfer' THEN amount ELSE 0 END), 0)::float as inflows,
        COALESCE(SUM(CASE WHEN amount < 0 AND transaction_type != 'transfer' THEN ABS(amount) ELSE 0 END), 0)::float as outflows
      FROM treasury_transactions
      WHERE created_at >= NOW() - INTERVAL '7 days' AND status = 'approved'
      GROUP BY created_at::date
      ORDER BY created_at::date ASC
    `);

    res.json({
      summary: balanceRes.rows[0],
      daily: flowRes.rows[0],
      highestSafe,
      lowestSafe,
      alerts,
      latestTransactions: lastTxRes.rows,
      chartData: chartRes.rows
    });
  } catch (error) {
    console.error("Dashboard statistics error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard statistics" });
  }
});

// 2. TREASURY ACCOUNTS CRUD & MANAGEMENT
router.get("/api/treasury/accounts", authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT t.*, b.name as branch_name, u.username as responsible_user_name, p.name as parent_name
      FROM treasury_accounts t 
      LEFT JOIN branches b ON t.branch_id = b.id 
      LEFT JOIN users u ON t.responsible_user_id = u.id
      LEFT JOIN treasury_accounts p ON t.parent_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (t.name ILIKE $${params.length})`;
    }
    query += ` ORDER BY t.is_main DESC, t.created_at DESC`;
    const accounts = (await pool.query(query, params)).rows;
    res.json(accounts);
  } catch (error) {
    console.error("Fetch accounts error:", error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

router.post("/api/treasury/accounts", authenticateToken, async (req, res) => {
  const { name, type, currency, branch_id, opening_balance, min_balance_limit, max_balance_limit, responsible_user_id, is_main, parent_id, status } = req.body;
  const userId = (req as any).user?.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const parsedOpening = parseFloat(opening_balance) || 0;
    const result = await client.query(
      `INSERT INTO treasury_accounts 
       (name, type, currency, current_balance, opening_balance, min_balance_limit, max_balance_limit, responsible_user_id, is_main, parent_id, branch_id, status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [
        name, 
        type, 
        currency || 'EGP', 
        parsedOpening, 
        parsedOpening, 
        parseFloat(min_balance_limit) || 0, 
        parseFloat(max_balance_limit) || 0, 
        responsible_user_id ? parseInt(responsible_user_id) : null,
        !!is_main,
        parent_id ? parseInt(parent_id) : null,
        branch_id ? parseInt(branch_id) : null,
        status || 'active'
      ]
    );

    const newAccount = result.rows[0];

    // Log Opening Transaction if greater than zero
    if (parsedOpening > 0) {
      await client.query(
        `INSERT INTO treasury_transactions 
         (account_id, amount, transaction_type, reference_type, notes, created_by, status, voucher_type, balance_before, balance_after) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [newAccount.id, parsedOpening, 'adjustment', 'general', 'رصيد افتتاحي عند التأسيس', userId, 'approved', 'receipt', 0, parsedOpening]
      );
    }

    await logAudit(client, null, newAccount.id, "create_account", null, newAccount, userId);
    await client.query("COMMIT");
    res.json(newAccount);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create account error:", error);
    res.status(500).json({ error: "Failed to create treasury account" });
  } finally {
    client.release();
  }
});

router.put("/api/treasury/accounts/:id", authenticateToken, async (req, res) => {
  const { name, type, currency, min_balance_limit, max_balance_limit, responsible_user_id, is_main, parent_id, branch_id, status } = req.body;
  const userId = (req as any).user?.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const oldAccount = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1", [req.params.id])).rows[0];
    if (!oldAccount) throw new Error("Account not found");

    const result = await client.query(
      `UPDATE treasury_accounts 
       SET name = $1, type = $2, currency = $3, min_balance_limit = $4, max_balance_limit = $5, 
           responsible_user_id = $6, is_main = $7, parent_id = $8, branch_id = $9, status = $10 
       WHERE id = $11 RETURNING *`,
      [
        name, 
        type, 
        currency || 'EGP', 
        parseFloat(min_balance_limit) || 0, 
        parseFloat(max_balance_limit) || 0, 
        responsible_user_id ? parseInt(responsible_user_id) : null,
        !!is_main,
        parent_id ? parseInt(parent_id) : null,
        branch_id ? parseInt(branch_id) : null,
        status || 'active',
        req.params.id
      ]
    );

    const updated = result.rows[0];
    await logAudit(client, null, updated.id, "update_account", oldAccount, updated, userId);
    await client.query("COMMIT");
    res.json(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update account error:", error);
    res.status(500).json({ error: "Failed to update account" });
  } finally {
    client.release();
  }
});

router.post("/api/treasury/accounts/:id/reset", authenticateToken, async (req, res) => {
  const userId = (req as any).user?.id;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const account = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1", [req.params.id])).rows[0];
    if (!account) throw new Error("Account not found");

    const amount = Number(account.current_balance);
    if (amount !== 0) {
      // Create adjustment transaction to clear balance
      await client.query(
        `INSERT INTO treasury_transactions 
        (account_id, amount, transaction_type, reference_type, created_by, notes, status, balance_before, balance_after) 
        VALUES ($1, $2, 'adjustment', 'general', $3, 'تصفير وإعادة ضبط رصيد الخزينة', 'approved', $4, 0)`,
        [req.params.id, -amount, userId, amount]
      );
    }
    
    // Reset balance
    await client.query("UPDATE treasury_accounts SET current_balance = 0 WHERE id = $1", [req.params.id]);
    
    await logAudit(client, null, account.id, "reset_balance", { balance: amount }, { balance: 0 }, userId);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reset account error:", error);
    res.status(500).json({ error: "Failed to reset account" });
  } finally {
    client.release();
  }
});

// 3. DETAILED REPORTS
router.get("/api/treasury/reports/detailed", authenticateToken, async (req, res) => {
  const { accountId, startDate, endDate, transactionType, status, branchId } = req.query;
  try {
    let query = `
      SELECT t.*, u.username as user_name, c.name as cost_center_name, a.name as account_name, a.type as account_type, b.name as branch_name
      FROM treasury_transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN cost_centers c ON t.cost_center_id = c.id
      LEFT JOIN treasury_accounts a ON t.account_id = a.id
      LEFT JOIN branches b ON a.branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (accountId && accountId !== 'all') {
      params.push(accountId);
      query += ` AND t.account_id = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      query += ` AND t.created_at >= LEFT($${params.length}::text, 10)::date`;
    }
    if (endDate) {
      params.push(endDate);
      query += ` AND t.created_at < (LEFT($${params.length}::text, 10)::date + INTERVAL '1 day')`;
    }
    if (transactionType && transactionType !== 'all') {
      params.push(transactionType);
      query += ` AND t.transaction_type = $${params.length}`;
    }
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    if (branchId && branchId !== 'all') {
      params.push(branchId);
      query += ` AND a.branch_id = $${params.length}`;
    }

    query += ` ORDER BY t.created_at DESC`;
    
    const transactions = (await pool.query(query, params)).rows;
    res.json(transactions);
  } catch (error) {
    console.error("Fetch detailed report error:", error);
    res.status(500).json({ error: "Failed to fetch report data" });
  }
});

// Help Helper: Ensure Treasury Transactions Columns
const ensureTreasuryColumns = async () => {
  const extraCols = [
    "supplier_id INTEGER",
    "customer_id INTEGER",
    "employee_id INTEGER",
    "invoice_id INTEGER",
    "expense_account_id INTEGER"
  ];
  for (const col of extraCols) {
    try {
      await pool.query(`ALTER TABLE treasury_transactions ADD COLUMN IF NOT EXISTS ${col};`);
    } catch (e) {}
  }
};
ensureTreasuryColumns().catch(() => {});

// 4. TRANSACTION INDEX & DETAILED ACTIONS
router.get("/api/treasury/transactions/:accountId", authenticateToken, async (req, res) => {
  const { status, type, search, startDate, endDate, branchId, userId } = req.query as any;
  const accountId = req.params.accountId;
  try {
    let query = `
      SELECT t.*, 
             u.username as user_name, 
             c.name as cost_center_name, 
             a.name as account_name, 
             a.currency as account_currency, 
             b.name as branch_name,
             sup.name as supplier_name,
             sup.supplier_code as supplier_code,
             sup.phone as supplier_phone,
             cust.name as customer_name,
             cust.phone as customer_phone,
             emp.name as employee_name,
             p.invoice_number as purchase_invoice_number,
             si.invoice_no as sales_invoice_number
      FROM treasury_transactions t
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN cost_centers c ON t.cost_center_id = c.id
      LEFT JOIN treasury_accounts a ON t.account_id = a.id
      LEFT JOIN branches b ON a.branch_id = b.id
      LEFT JOIN suppliers sup ON t.supplier_id = sup.id
      LEFT JOIN customers cust ON t.customer_id = cust.id
      LEFT JOIN employees emp ON t.employee_id = emp.id
      LEFT JOIN purchases p ON t.invoice_id = p.id AND t.client_type = 'supplier'
      LEFT JOIN sales_invoices si ON t.invoice_id = si.id AND t.client_type = 'customer'
      WHERE 1=1
    `;
    const params: any[] = [];

    if (accountId && accountId !== 'all' && !isNaN(Number(accountId))) {
      params.push(Number(accountId));
      query += ` AND t.account_id = $${params.length}`;
    }
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    if (type && type !== 'all') {
      params.push(type);
      query += ` AND t.transaction_type = $${params.length}`;
    }
    if (branchId && branchId !== 'all' && !isNaN(Number(branchId))) {
      params.push(Number(branchId));
      query += ` AND a.branch_id = $${params.length}`;
    }
    if (userId && userId !== 'all' && !isNaN(Number(userId))) {
      params.push(Number(userId));
      query += ` AND t.created_by = $${params.length}`;
    }
    if (startDate) {
      params.push(`${startDate} 00:00:00`);
      query += ` AND t.created_at >= $${params.length}::timestamp`;
    }
    if (endDate) {
      params.push(`${endDate} 23:59:59`);
      query += ` AND t.created_at <= $${params.length}::timestamp`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (t.notes ILIKE $${params.length} OR t.voucher_number ILIKE $${params.length} OR t.client_name ILIKE $${params.length} OR p.invoice_number ILIKE $${params.length} OR si.invoice_no ILIKE $${params.length})`;
    }

    query += ` ORDER BY t.created_at DESC`;
    const transactions = (await pool.query(query, params)).rows;
    res.json(transactions);
  } catch (error: any) {
    console.error("Fetch transactions error:", error);
    res.status(500).json({ error: "Failed to fetch transactions", message: error.message });
  }
});

// 5. TRANSACTION POSTING / VOUCHERS / TRANSFERS
router.post("/api/treasury/transactions", authenticateToken, (upload.single('attachment') as any), async (req, res) => {
  const { 
    account_id, 
    amount, 
    transaction_type, 
    reference_type, 
    reference_id, 
    notes, 
    cost_center_id, 
    target_account_id,
    voucher_type, // 'receipt', 'payment'
    tax_amount,
    discount_amount,
    payment_method, // 'cash', 'bank', 'check', 'electronic'
    client_type,
    client_name,
    supplier_id,
    customer_id,
    employee_id,
    invoice_id,
    expense_account_id
  } = req.body;
  
  const attachment_url = req.file ? `/uploads/${req.file.filename}` : null;
  const userId = (req as any).user?.id || null;
  const idempotencyKey = String(req.get("Idempotency-Key") || req.body?.idempotency_key || "").trim();

  if (idempotencyKey.length > 255) {
    return res.status(400).json({ error: "مفتاح منع التكرار أطول من المسموح" });
  }

  // Collected during the cash_out / supplier branch and used to post the GL entry
  // once the treasury transaction is committed (kept out of the DB transaction).
  let glSupplierPayment: { supplierId: number; amount: number; name?: string; transactionId: number } | null = null;
  let customerReceiptResult: {
    treasuryTransactionId?: number;
    bankTransactionId?: number;
    journalEntryId?: number | null;
  } | null = null;
  
  // Safe amount parsing (handle strings with commas, negative signs, etc.)
  const rawNum = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '').trim()) : Number(amount);
  const parsedAmount = Math.abs(rawNum);
  const parsedTax = parseFloat(String(tax_amount || 0).replace(/,/g, '')) || 0;
  const parsedDiscount = parseFloat(String(discount_amount || 0).replace(/,/g, '')) || 0;

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: "المبلغ غير صالح، يرجى إدخال قيمة عددية أكبر من صفر" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let lastVoucherJournalEntryId: number | null = null;

    if (idempotencyKey) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [idempotencyKey]);
      const existing = await client.query(
        `SELECT id, 'treasury' AS source
           FROM treasury_transactions
          WHERE idempotency_key = $1 AND created_by IS NOT DISTINCT FROM $2
         UNION ALL
         SELECT id, 'bank' AS source
           FROM bank_transactions
          WHERE idempotency_key = $1 AND created_by IS NOT DISTINCT FROM $2
         LIMIT 1`,
        [idempotencyKey, userId],
      );

      if (existing.rows.length > 0) {
        const priorTransaction = existing.rows[0];
        await client.query("COMMIT");
        return res.json({
          success: true,
          duplicate: true,
          treasury_transaction_id: priorTransaction.source === "treasury" ? priorTransaction.id : null,
          bank_transaction_id: priorTransaction.source === "bank" ? priorTransaction.id : null,
        });
      }
    }
    
    // Check if Account exists
    const account = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1", [account_id])).rows[0];
    if (!account) {
      throw new Error("الحساب المرسل غير موجود بالخلفية");
    }

    if (account.status !== 'active') {
      throw new Error("لا يمكن تنفيذ عمليات على خزينة موقوفة");
    }

    // Check if date is locked by daily closing
    const today = new Date().toISOString().split('T')[0];
    const isClosed = (await client.query(
      "SELECT id FROM treasury_daily_closings WHERE account_id = $1 AND created_at::date = $2 AND status = 'closed'", 
      [account_id, today]
    )).rows.length > 0;

    if (isClosed) {
      throw new Error("اليومية مغلقة بالفعل لهذه الخزينة اليوم. يجب إعادة فتحها أولاً بصلاحيات إدارية.");
    }

    // Resolve entities if not provided by ID
    let resolvedSupplierId = supplier_id ? parseInt(String(supplier_id), 10) : null;
    let resolvedCustomerId = customer_id ? parseInt(String(customer_id), 10) : null;
    let resolvedEmployeeId = employee_id ? parseInt(String(employee_id), 10) : null;
    let resolvedInvoiceId = invoice_id ? parseInt(String(invoice_id), 10) : null;
    let effectiveClientName = client_name?.trim() || '';

    if (!resolvedSupplierId && client_type === 'supplier' && effectiveClientName) {
      const sRes = await client.query("SELECT id, name FROM suppliers WHERE name ILIKE $1 OR supplier_code ILIKE $1 LIMIT 1", [effectiveClientName]);
      if (sRes.rows.length > 0) {
        resolvedSupplierId = sRes.rows[0].id;
        effectiveClientName = sRes.rows[0].name;
      }
    } else if (resolvedSupplierId && !effectiveClientName) {
      const sRes = await client.query("SELECT id, name FROM suppliers WHERE id = $1", [resolvedSupplierId]);
      if (sRes.rows.length > 0) effectiveClientName = sRes.rows[0].name;
    }

    if (!resolvedCustomerId && client_type === 'customer' && effectiveClientName) {
      const cRes = await client.query("SELECT id, name FROM customers WHERE name ILIKE $1 OR phone ILIKE $1 LIMIT 1", [effectiveClientName]);
      if (cRes.rows.length > 0) {
        resolvedCustomerId = cRes.rows[0].id;
        effectiveClientName = cRes.rows[0].name;
      }
    } else if (resolvedCustomerId && !effectiveClientName) {
      const cRes = await client.query("SELECT id, name FROM customers WHERE id = $1", [resolvedCustomerId]);
      if (cRes.rows.length > 0) effectiveClientName = cRes.rows[0].name;
    }

    if (!resolvedEmployeeId && client_type === 'employee' && effectiveClientName) {
      const eRes = await client.query("SELECT id, name FROM employees WHERE name ILIKE $1 LIMIT 1", [effectiveClientName]);
      if (eRes.rows.length > 0) {
        resolvedEmployeeId = eRes.rows[0].id;
        effectiveClientName = eRes.rows[0].name;
      }
    } else if (resolvedEmployeeId && !effectiveClientName) {
      const eRes = await client.query("SELECT id, name FROM employees WHERE id = $1", [resolvedEmployeeId]);
      if (eRes.rows.length > 0) effectiveClientName = eRes.rows[0].name;
    }

    // If transfer between accounts
    if (transaction_type === 'transfer' && target_account_id) {
      const targetAccount = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1", [target_account_id])).rows[0];
      if (!targetAccount) {
        throw new Error("الحساب المستهدف غير موجود");
      }
      if (targetAccount.status !== 'active') {
        throw new Error("الحساب المستهدف موقوف حالياً");
      }

      // Check balance limit
      if (Number(account.current_balance) < parsedAmount) {
        const negRes = await client.query("SELECT value FROM treasury_settings WHERE key = 'allow_negative_balance'");
        const lastRow = negRes.rows.length > 0 ? negRes.rows[negRes.rows.length - 1] : null;
        const allowNeg = lastRow ? lastRow.value !== 'false' : true;
        if (!allowNeg) {
          throw new Error(`عذراً، رصيد الخزينة الحالية غير كافي لإجراء التحويل المالي (${account.current_balance} ج.م)`);
        }
      }

      // Sequential auto voucher number for Transfer
      const year = new Date().getFullYear();
      const voucherNum = await generateTreasuryVoucherNumber(client, "transfer", year);

      // Source Account Outflow (Negative Amount)
      const srcBalanceBefore = Number(account.current_balance);
      const srcBalanceAfter = srcBalanceBefore - parsedAmount;
      
      const srcTx = await client.query(
        `INSERT INTO treasury_transactions 
         (account_id, amount, transaction_type, reference_type, reference_id, notes, created_by, cost_center_id, attachment_url, 
          status, voucher_number, voucher_type, tax_amount, discount_amount, payment_method, client_type, client_name, balance_before, balance_after, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
        [
          account_id, -parsedAmount, 'transfer', reference_type || 'general', reference_id || null, 
          notes || `تحويل صادر إلى ${targetAccount.name}`, userId, cost_center_id || null, attachment_url,
          'approved', voucherNum, 'payment', parsedTax, parsedDiscount, payment_method || 'cash', client_type || 'other', effectiveClientName || targetAccount.name,
          srcBalanceBefore, srcBalanceAfter, idempotencyKey || null
        ]
      );

      await client.query(`UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2`, [parsedAmount, account_id]);

      // Target Account Inflow (Positive Amount)
      const tgtBalanceBefore = Number(targetAccount.current_balance);
      const tgtBalanceAfter = tgtBalanceBefore + parsedAmount;

      const tgtTx = await client.query(
        `INSERT INTO treasury_transactions 
         (account_id, amount, transaction_type, reference_type, reference_id, notes, created_by, cost_center_id, attachment_url, 
          status, voucher_number, voucher_type, tax_amount, discount_amount, payment_method, client_type, client_name, balance_before, balance_after, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
        [
          target_account_id, parsedAmount, 'transfer', reference_type || 'general', reference_id || null, 
          notes || `تحويل وارد من ${account.name}`, userId, cost_center_id || null, attachment_url,
          'approved', voucherNum, 'receipt', parsedTax, parsedDiscount, payment_method || 'cash', client_type || 'other', effectiveClientName || account.name,
          tgtBalanceBefore, tgtBalanceAfter, idempotencyKey || null
        ]
      );

      await client.query(`UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [parsedAmount, target_account_id]);

      await logAudit(client, srcTx.rows[0].id, account_id, "transfer_out", null, srcTx.rows[0], userId);
      await logAudit(client, tgtTx.rows[0].id, target_account_id, "transfer_in", null, tgtTx.rows[0], userId);

    } else {
      // Standard transaction (Cash In, Cash Out, Adjustment)
      let sign = 1;
      let calculatedVType = voucher_type || (transaction_type === 'cash_in' ? 'receipt' : 'payment');

      if (transaction_type === 'cash_out' || calculatedVType === 'payment') {
        sign = -1;
      }

      const netDelta = sign * parsedAmount;
      const balanceBefore = Number(account.current_balance);
      const balanceAfter = balanceBefore + netDelta;

      if (netDelta < 0 && balanceBefore < parsedAmount) {
        const negRes = await client.query("SELECT value FROM treasury_settings WHERE key = 'allow_negative_balance'");
        const lastRow = negRes.rows.length > 0 ? negRes.rows[negRes.rows.length - 1] : null;
        const allowNeg = lastRow ? lastRow.value !== 'false' : true;
        if (!allowNeg) {
          throw new Error(`عذراً، رصيد الخزينة غير كافي لإجراء عملية الصرف الحالية (${account.current_balance} ج.م)`);
        }
      }

      // Generate Auto Sequential Voucher No
      const year = new Date().getFullYear();
      const voucherNum = await generateTreasuryVoucherNumber(client, calculatedVType, year);

      const isCustomerReceipt =
        Boolean(resolvedCustomerId) && calculatedVType === "receipt" && transaction_type === "cash_in";
      const isCustomerDisbursement =
        Boolean(resolvedCustomerId) && calculatedVType === "payment" && transaction_type === "cash_out";
      if (isCustomerReceipt || isCustomerDisbursement) {
        const financialMethod = payment_method === "cash" ? "cash" : "bank";
        const voucherSequence = Number(voucherNum.slice(voucherNum.lastIndexOf("-") + 1));
        const financialSourceId = year * 100_000 + voucherSequence;
        let invoice: any = null;
        if (isCustomerReceipt && resolvedInvoiceId) {
          const invoiceRes = await client.query(
            `SELECT id, invoice_no, order_id, net_amount, paid_amount
               FROM sales_invoices
              WHERE id = $1 AND customer_id = $2 AND is_posted = true
              FOR UPDATE`,
            [resolvedInvoiceId, resolvedCustomerId],
          );
          invoice = invoiceRes.rows[0];
          if (!invoice) {
            throw new Error("فاتورة العميل المحددة غير موجودة أو غير مرحلة");
          }
          const remaining = Math.max(0, Number(invoice.net_amount) - Number(invoice.paid_amount));
          if (parsedAmount > remaining + 0.01) {
            throw new Error(`مبلغ السداد أكبر من المتبقي على الفاتورة (${remaining.toFixed(2)} ج.م)`);
          }
        }

        const receipt = await financialIntegrationService.processFinancialTransaction({
          sourceType: isCustomerReceipt ? "CUSTOMER_RECEIPT" : "CUSTOMER_REFUND",
          sourceId: financialSourceId,
          sourceDocumentNumber: invoice?.invoice_no || voucherNum,
          eventType: isCustomerReceipt ? "RECEIPT_COLLECTED" : "CUSTOMER_DISBURSED",
          totalAmount: parsedAmount,
          paymentMethod: payment_method || "cash",
          paymentSplits: [{ method: financialMethod, amount: parsedAmount }],
          treasuryAccountId: financialMethod === "cash" ? Number(account_id) : undefined,
          customerId: resolvedCustomerId,
          branchId: Number(account.branch_id) || undefined,
          userId: userId || undefined,
          description: `${isCustomerReceipt ? "تحصيل من العميل" : "صرف للعميل"} ${effectiveClientName} — سند ${voucherNum}`,
          notes: notes || "",
          idempotencyKey: `TREASURY_CUSTOMER_${isCustomerReceipt ? "RECEIPT" : "DISBURSEMENT"}_${voucherNum}`,
          transactionClient: client,
          metadata: {
            voucherNumber: voucherNum,
            invoiceId: isCustomerReceipt ? resolvedInvoiceId || null : null,
            paymentMethod: payment_method || "cash",
          },
        });
        if (
          !receipt.success ||
          !(receipt.treasuryTransactionId || receipt.bankTransactionId) ||
          !receipt.customerTransactionId ||
          !receipt.journalEntryId
        ) {
          throw new Error(receipt.message || "لم يكتمل ترحيل حركة العميل إلى الخزينة أو البنك ودفتر العميل والحسابات العامة");
        }
        customerReceiptResult = {
          treasuryTransactionId: receipt.treasuryTransactionId || undefined,
          bankTransactionId: receipt.bankTransactionId || undefined,
          journalEntryId: receipt.journalEntryId,
        };
        if (idempotencyKey && receipt.treasuryTransactionId) {
          await client.query(
            "UPDATE treasury_transactions SET idempotency_key = $1 WHERE id = $2",
            [idempotencyKey, receipt.treasuryTransactionId],
          );
        }
        if (idempotencyKey && receipt.bankTransactionId) {
          await client.query(
            "UPDATE bank_transactions SET idempotency_key = $1 WHERE id = $2",
            [idempotencyKey, receipt.bankTransactionId],
          );
        }

        if (invoice) {
          const invoiceUpdate = await client.query(
            `UPDATE sales_invoices
                SET paid_amount = paid_amount + $1,
                    status = CASE
                      WHEN paid_amount + $1 >= net_amount - 0.01 THEN 'مدفوعة'
                      ELSE 'مدفوعة جزئياً'
                    END
              WHERE id = $2
              RETURNING order_id, paid_amount, net_amount`,
            [parsedAmount, resolvedInvoiceId],
          );
          if (invoiceUpdate.rows[0]?.order_id) {
            await client.query(
              `UPDATE erp_sales_orders
                  SET payment_status = CASE
                    WHEN $1 >= $2 - 0.01 THEN 'مسدد'
                    ELSE 'غير مسدد'
                  END
                WHERE id = $3`,
              [
                Number(invoiceUpdate.rows[0].paid_amount),
                Number(invoiceUpdate.rows[0].net_amount),
                invoiceUpdate.rows[0].order_id,
              ],
            );
          }
        }
      } else {
      const txResult = await client.query(
        `INSERT INTO treasury_transactions 
         (account_id, amount, transaction_type, reference_type, reference_id, notes, created_by, cost_center_id, attachment_url,
          status, voucher_number, voucher_type, tax_amount, discount_amount, payment_method, client_type, client_name, balance_before, balance_after,
          supplier_id, customer_id, employee_id, invoice_id, expense_account_id, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25) RETURNING *`,
        [
          account_id, netDelta, transaction_type, reference_type || (resolvedSupplierId ? 'supplier_payment' : (resolvedCustomerId ? 'customer_payment' : 'general')), 
          reference_id || resolvedInvoiceId || null, notes, userId, cost_center_id || null, attachment_url,
          'approved', voucherNum, calculatedVType, parsedTax, parsedDiscount, payment_method || 'cash', client_type || (resolvedSupplierId ? 'supplier' : (resolvedCustomerId ? 'customer' : 'other')), 
          effectiveClientName || '-',
          balanceBefore, balanceAfter,
          resolvedSupplierId, resolvedCustomerId, resolvedEmployeeId, resolvedInvoiceId, expense_account_id ? parseInt(String(expense_account_id), 10) : null,
          idempotencyKey || null
        ]
      );

      // Update account balance
      await client.query(`UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2`, [netDelta, account_id]);

      const postedTx = txResult.rows[0];

      // ── SUPPLIER INTEGRATION & BALANCE UPDATE ──
      if (resolvedSupplierId) {
        if (calculatedVType === 'payment' || transaction_type === 'cash_out') {
          // Payment to supplier reduces supplier payable balance (debt)
          await client.query(
            "UPDATE suppliers SET balance = COALESCE(balance, 0) - $1, updated_at = NOW() WHERE id = $2",
            [parsedAmount, resolvedSupplierId]
          );
          // Insert supplier transaction
          await client.query(
            `INSERT INTO supplier_transactions 
             (supplier_id, type, amount, notes, payment_method, reference_type, reference_id, currency, status, created_at)
             VALUES ($1, 'payment', $2, $3, $4, 'treasury_voucher', $5, 'EGP', 'posted', NOW())`,
            [
              resolvedSupplierId, 
              parsedAmount, 
              notes || `سند صرف نقدي رقم ${voucherNum}`, 
              payment_method || 'cash', 
              postedTx.id
            ]
          );

          // Record the supplier payment for general-ledger posting after commit
          glSupplierPayment = {
            supplierId: resolvedSupplierId,
            amount: parsedAmount,
            name: effectiveClientName,
            transactionId: postedTx.id,
          };

          // If linked to a purchase invoice, apply the payment to it WITHOUT ever
          // paying more than the invoice remaining balance. Any excess stays as an
          // on-account credit (the supplier balance below is reduced by the full amount).
          if (resolvedInvoiceId) {
            await client.query(
              `UPDATE purchases 
               SET paid_amount = LEAST(COALESCE(paid_amount, 0) + $1, total_amount),
                   payment_status = CASE 
                     WHEN LEAST(COALESCE(paid_amount, 0) + $1, total_amount) >= total_amount THEN 'paid'
                     WHEN COALESCE(paid_amount, 0) + $1 > 0 THEN 'partially_paid'
                     ELSE 'unpaid'
                   END,
                   updated_at = NOW()
               WHERE id = $2 AND supplier_id = $3`,
              [parsedAmount, resolvedInvoiceId, resolvedSupplierId]
            );
          }
        } else if (calculatedVType === 'receipt' || transaction_type === 'cash_in') {
          // Receipt/refund from supplier
          await client.query(
            "UPDATE suppliers SET balance = COALESCE(balance, 0) + $1, updated_at = NOW() WHERE id = $2",
            [parsedAmount, resolvedSupplierId]
          );
          await client.query(
            `INSERT INTO supplier_transactions 
             (supplier_id, type, amount, notes, payment_method, reference_type, reference_id, currency, status, created_at)
             VALUES ($1, 'refund', $2, $3, $4, 'treasury_voucher', $5, 'EGP', 'posted', NOW())`,
            [
              resolvedSupplierId, 
              parsedAmount, 
              notes || `سند قبض / مرتجع من مورد رقم ${voucherNum}`, 
              payment_method || 'cash', 
              postedTx.id
            ]
          );
        }
      }

      // ── CUSTOMER INTEGRATION ──
      if (resolvedCustomerId) {
        try {
          await client.query(
            `INSERT INTO customer_transactions (customer_id, type, amount, notes, timestamp)
             VALUES ($1, $2, $3, $4, NOW())`,
            [
              resolvedCustomerId, 
              calculatedVType === 'receipt' ? 'payment' : 'refund', 
              parsedAmount, 
              notes || `سند ${calculatedVType === 'receipt' ? 'قبض' : 'صرف'} رقم ${voucherNum}`
            ]
          );
        } catch (cErr) {
          console.error("Customer transaction logging error:", cErr);
        }
      }

      await logAudit(client, postedTx.id, account_id, transaction_type, null, postedTx, userId);

      // ── الترحيل المحاسبي داخل نفس المعاملة (لكل أنواع السندات) ──
      // قبل هذا الإصلاح كان الترحيل يحدث بعد COMMIT ويُبتلع فشله لسداد الموردين فقط،
      // وسندات القبض/الصرف الأخرى لم تُرحَّل إطلاقًا → خزينة محدَّثة ودفتر أستاذ ناقص.
      const glEntry = await postVoucherGlEntry(client, {
        voucherId: Number(postedTx.id),
        voucherNumber: voucherNum,
        amount: netDelta,
        transactionType: transaction_type,
        paymentMethod: payment_method || 'cash',
        date: postedTx.created_at || new Date(),
        partyName: effectiveClientName || '-',
        userId,
        branchId: account.branch_id || null,
        supplierId: resolvedSupplierId,
        customerId: resolvedCustomerId,
        employeeId: resolvedEmployeeId,
        expenseAccountId: expense_account_id ? Number(expense_account_id) : null,
        costCenterId: cost_center_id ? Number(cost_center_id) : null,
      });
      if (glEntry?.reference) {
        await client.query("UPDATE treasury_transactions SET fin_number = $1 WHERE id = $2", [glEntry.reference, postedTx.id]);
        lastVoucherJournalEntryId = Number(glEntry.id) || null;
      }
      }
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      gl_posted: true,
      treasury_transaction_id: customerReceiptResult?.treasuryTransactionId || null,
      bank_transaction_id: customerReceiptResult?.bankTransactionId || null,
      journal_entry_id: customerReceiptResult?.journalEntryId || lastVoucherJournalEntryId,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Create transaction error:", error);
    res.status(500).json({ error: error.message || "Failed to create transaction" });
  } finally {
    client.release();
  }
});

// Approve Pending Transaction (Dual Authorization Approval)
router.post("/api/treasury/transactions/:id/approve", authenticateToken, async (req, res) => {
  const userId = (req as any).user?.id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const tx = (await client.query("SELECT * FROM treasury_transactions WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!tx) throw new Error("السند غير موجود");
    if (tx.status !== 'pending_approval') {
      throw new Error(`السند حالته الحالية (${tx.status}) ولا يتطلب اعتماداً جديداً`);
    }

    const account = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [tx.account_id])).rows[0];
    if (!account) throw new Error("الحساب المالي المتعلق بالسند غير موجود");

    const amountDelta = Number(tx.amount);
    const balanceBefore = Number(account.current_balance);
    const balanceAfter = balanceBefore + amountDelta;

    // Check negative balance limit if outflow
    if (amountDelta < 0 && balanceAfter < 0) {
      const negRes = await client.query("SELECT value FROM treasury_settings WHERE key = 'allow_negative_balance'");
      const allowNeg = negRes.rows.length > 0 && negRes.rows[0].value === 'true';
      if (!allowNeg) {
        throw new Error(`عذراً، رصيد الخزينة غير كافي عند تنفيذ الاعتماد (${account.current_balance} ج.م)`);
      }
    }

    // Update account balance
    await client.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [amountDelta, tx.account_id]);

    // Update transaction status
    const result = await client.query(
      `UPDATE treasury_transactions 
       SET status = 'approved', approved_by = $1, approved_at = NOW(), balance_before = $2, balance_after = $3
       WHERE id = $4 RETURNING *`,
      [userId, balanceBefore, balanceAfter, req.params.id]
    );

    const approvedTx = result.rows[0];
    await logAudit(client, approvedTx.id, approvedTx.account_id, "approve_transaction", tx, approvedTx, userId);
    await client.query("COMMIT");

    res.json({ success: true, transaction: approvedTx, message: "تم اعتماد السند المالي وتحديث رصيد الخزينة بنجاح" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Approve transaction error:", error);
    res.status(500).json({ error: error.message || "Failed to approve transaction" });
  } finally {
    client.release();
  }
});

// Bank Reconciliation / Clearance for Uncleared Transactions
router.post("/api/treasury/transactions/:id/clear-bank", authenticateToken, async (req, res) => {
  const userId = (req as any).user?.id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const tx = (await client.query("SELECT * FROM treasury_transactions WHERE id = $1 FOR UPDATE", [req.params.id])).rows[0];
    if (!tx) throw new Error("معاملة البنك غير موجودة");
    if (tx.is_cleared) throw new Error("المعاملة مظهرة ومسواة بنكياً بالفعل");

    const account = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [tx.account_id])).rows[0];
    if (!account) throw new Error("الحساب البنكي غير موجود");

    const amountDelta = Number(tx.amount);
    // Update available balance on clear
    await client.query(
      "UPDATE treasury_accounts SET available_balance = available_balance + $1 WHERE id = $2",
      [amountDelta, tx.account_id]
    );

    const result = await client.query(
      `UPDATE treasury_transactions 
       SET is_cleared = true, cleared_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    await logAudit(client, tx.id, tx.account_id, "clear_bank_transaction", tx, result.rows[0], userId);
    await client.query("COMMIT");

    res.json({ success: true, transaction: result.rows[0], message: "تمت مطابقة المعاملة البنكية وتحديث الرصيد المتاح" });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Clear bank transaction error:", error);
    res.status(500).json({ error: error.message || "Failed to clear bank transaction" });
  } finally {
    client.release();
  }
});

// Export PostgreSQL Schema DDL for Treasury & Cash Management Module
router.get("/api/treasury/schema-ddl", authenticateToken, async (req, res) => {
  const ddl = `-- ═════════════════════════════════════════════════════════════════════════════
-- REMO PRO ERP (ريمو برو) - Treasury & Cash Management Module (PostgreSQL DDL)
-- Full Schema Definitions, Primary & Foreign Keys, Indexes, Triggers & Seed Defaults
-- ═════════════════════════════════════════════════════════════════════════════

-- 1. TREASURY ACCOUNTS TABLE (الخزائن والحسابات النقدية والبنكية والعهدة)
CREATE TABLE IF NOT EXISTS treasury_accounts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'cash', 'bank', 'petty_cash', 'custody', 'intermediate'
  currency VARCHAR(10) DEFAULT 'EGP',
  current_balance DECIMAL(15,2) DEFAULT 0.00, -- الرصيد الدفتري (Book Balance)
  available_balance DECIMAL(15,2) DEFAULT 0.00, -- الرصيد المتاح فعلياً (Available Real Balance)
  opening_balance DECIMAL(15,2) DEFAULT 0.00,
  min_balance_limit DECIMAL(15,2) DEFAULT 0.00,
  max_balance_limit DECIMAL(15,2) DEFAULT 0.00,
  account_number VARCHAR(100),
  bank_name VARCHAR(255),
  iban VARCHAR(100),
  swift_code VARCHAR(50),
  responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_main BOOLEAN DEFAULT false,
  parent_id INTEGER REFERENCES treasury_accounts(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'suspended', 'closed'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TREASURY TRANSACTIONS & VOUCHERS TABLE (سندات القبض والصرف وحركات الخزينة)
CREATE TABLE IF NOT EXISTS treasury_transactions (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES treasury_accounts(id) ON DELETE CASCADE,
  voucher_number VARCHAR(100), -- كود السند مثل REC-2026-0001 أو PAY-2026-0001
  voucher_type VARCHAR(50), -- 'receipt', 'payment', 'transfer', 'adjustment'
  amount DECIMAL(15,2) NOT NULL, -- موجب للإيداع، سالب للصرف
  transaction_type VARCHAR(50) NOT NULL, -- 'cash_in', 'cash_out', 'transfer', 'adjustment'
  payment_method VARCHAR(50) DEFAULT 'cash', -- 'cash', 'bank', 'check', 'electronic'
  client_type VARCHAR(50), -- 'customer', 'supplier', 'employee', 'cost_center', 'other'
  client_name VARCHAR(255),
  reference_type VARCHAR(50), -- 'sales', 'purchase', 'payroll', 'cost', 'custody', 'general'
  reference_id INTEGER,
  tax_amount DECIMAL(15,2) DEFAULT 0.00,
  discount_amount DECIMAL(15,2) DEFAULT 0.00,
  balance_before DECIMAL(15,2) DEFAULT 0.00,
  balance_after DECIMAL(15,2) DEFAULT 0.00,
  is_cleared BOOLEAN DEFAULT true, -- للتفرقة بين الرصيد الدفتري والمتاح بالشيكات والتحويلات تحت التسوية
  cleared_at TIMESTAMP,
  reversal_transaction_id INTEGER REFERENCES treasury_transactions(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'approved', -- 'draft', 'pending_approval', 'approved', 'canceled'
  notes TEXT,
  cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
  attachment_url TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  canceled_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. INTER-ACCOUNT TRANSFERS TABLE (التحويلات المالية البينية)
CREATE TABLE IF NOT EXISTS treasury_transfers (
  id SERIAL PRIMARY KEY,
  transfer_number VARCHAR(100) UNIQUE NOT NULL, -- TRF-2026-0001
  source_account_id INTEGER NOT NULL REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
  destination_account_id INTEGER NOT NULL REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
  source_currency VARCHAR(10) DEFAULT 'EGP',
  destination_currency VARCHAR(10) DEFAULT 'EGP',
  amount DECIMAL(15,2) NOT NULL, -- المبلغ بالعملة المصدر
  exchange_rate DECIMAL(15,6) DEFAULT 1.000000, -- سعر الصرف
  destination_amount DECIMAL(15,2) NOT NULL, -- المبلغ المحول للعملة الهدف
  fee_amount DECIMAL(15,2) DEFAULT 0.00, -- رسوم التحويل
  fee_bearing_account VARCHAR(50) DEFAULT 'source', -- 'source', 'destination', 'separate'
  cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending_approval', -- 'draft', 'pending_approval', 'approved', 'in_transit', 'completed', 'rejected', 'canceled'
  statement TEXT,
  notes TEXT,
  attachment_url TEXT,
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  received_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  received_at TIMESTAMP,
  rejection_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. DAILY CLOSINGS & RECONCILIATION TABLE (تقفيل وتسويات الخزينة والجرد اليومي)
CREATE TABLE IF NOT EXISTS treasury_daily_closings (
  id SERIAL PRIMARY KEY,
  closing_number VARCHAR(100) UNIQUE,
  account_id INTEGER NOT NULL REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
  closing_date DATE DEFAULT CURRENT_DATE,
  opening_balance DECIMAL(15,2) NOT NULL,
  receipts DECIMAL(15,2) DEFAULT 0.00,
  payments DECIMAL(15,2) DEFAULT 0.00,
  transfers_in DECIMAL(15,2) DEFAULT 0.00,
  transfers_out DECIMAL(15,2) DEFAULT 0.00,
  expected_balance DECIMAL(15,2) NOT NULL, -- الرصيد الدفتري المتوقع
  actual_balance DECIMAL(15,2) NOT NULL, -- الرصيد الفعلي المقاس للجرد
  difference DECIMAL(15,2) DEFAULT 0.00, -- الفارق (عجز / زيادة)
  difference_type VARCHAR(20) DEFAULT 'matched', -- 'shortage', 'overage', 'matched'
  denomination_200 INTEGER DEFAULT 0,
  denomination_100 INTEGER DEFAULT 0,
  denomination_50 INTEGER DEFAULT 0,
  denomination_20 INTEGER DEFAULT 0,
  denomination_10 INTEGER DEFAULT 0,
  denomination_5 INTEGER DEFAULT 0,
  denomination_1 INTEGER DEFAULT 0,
  denomination_coins DECIMAL(15,2) DEFAULT 0.00,
  action_taken TEXT,
  journal_entry_id INTEGER,
  status VARCHAR(50) DEFAULT 'closed', -- 'draft', 'closed', 'approved', 'audited'
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_by INTEGER REFERENCES users(id),
  approved_at TIMESTAMP
);

-- 5. EMPLOYEE CUSTODY MANAGEMENT TABLES (العهد والأمانات النقدية والعينية)
CREATE TABLE IF NOT EXISTS treasury_custody_types (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  category VARCHAR(50) DEFAULT 'cash', -- 'cash', 'asset', 'equipment', 'tools', 'inventory', 'vehicle', 'keys_permits', 'temporary', 'permanent'
  requires_asset BOOLEAN DEFAULT false,
  requires_inventory BOOLEAN DEFAULT false,
  requires_treasury BOOLEAN DEFAULT true,
  max_limit DECIMAL(15,2) DEFAULT 0.00,
  default_duration_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treasury_custodies (
  id SERIAL PRIMARY KEY,
  custody_number VARCHAR(100) UNIQUE,
  custody_type_id INTEGER REFERENCES treasury_custody_types(id) ON DELETE SET NULL,
  custody_type VARCHAR(50) DEFAULT 'cash', -- 'cash', 'asset', 'equipment', 'vehicle'
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  employee_name TEXT,
  employee_code TEXT,
  department TEXT,
  section TEXT,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
  account_id INTEGER REFERENCES treasury_accounts(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  issued_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  spent_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  remaining_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  returned_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(10) DEFAULT 'EGP',
  status VARCHAR(50) DEFAULT 'active', -- 'draft', 'pending_approval', 'approved', 'active', 'partially_settled', 'overdue', 'closed', 'canceled'
  request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  issue_date TIMESTAMP,
  due_date TIMESTAMP,
  notes TEXT,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. IMMUTABLE AUDIT TRAIL LOGS TABLE (سجل المتابعة والتعديلات غير القابل للحذف)
CREATE TABLE IF NOT EXISTS treasury_audit_logs (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES treasury_transactions(id) ON DELETE SET NULL,
  account_id INTEGER REFERENCES treasury_accounts(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(100)
);

-- PostgreSQL Trigger enforcing read-only immutability on treasury_audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_tampering()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit trail records are immutable and cannot be updated or deleted!';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_log_update_delete ON treasury_audit_logs;
CREATE TRIGGER trg_prevent_audit_log_update_delete
BEFORE UPDATE OR DELETE ON treasury_audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_tampering();

-- 7. SYSTEM GOVERNANCE SETTINGS TABLE (إعدادات وسياسات الرقابة والحوكمة)
CREATE TABLE IF NOT EXISTS treasury_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT
);

-- PERFORMANCE INDEXES (فهارس سرعة استعلام الأداء للمشاريع الضخمة)
CREATE INDEX IF NOT EXISTS idx_treasury_trans_account_date ON treasury_transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_trans_voucher ON treasury_transactions(voucher_number);
CREATE INDEX IF NOT EXISTS idx_treasury_transfers_status ON treasury_transfers(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_closings_account_date ON treasury_daily_closings(account_id, closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_custodies_employee ON treasury_custodies(employee_id, status);
`;

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(ddl);
});

// Transaction Edit & Cancellation
router.put("/api/treasury/transactions/:id", authenticateToken, async (req, res) => {
  const { notes, cost_center_id, status } = req.body;
  const userId = (req as any).user?.id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const oldTx = (await client.query("SELECT * FROM treasury_transactions WHERE id = $1", [req.params.id])).rows[0];
    if (!oldTx) throw new Error("Transaction not found");

    const result = await client.query(
      `UPDATE treasury_transactions SET notes = $1, cost_center_id = $2, status = $3 WHERE id = $4 RETURNING *`,
      [notes || oldTx.notes, cost_center_id ? parseInt(cost_center_id) : oldTx.cost_center_id, status || oldTx.status, req.params.id]
    );

    const updated = result.rows[0];
    await logAudit(client, updated.id, updated.account_id, "update_transaction", oldTx, updated, userId);
    
    await client.query("COMMIT");
    res.json(updated);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update transaction error:", error);
    res.status(500).json({ error: "Failed to update transaction" });
  } finally {
    client.release();
  }
});

router.post("/api/treasury/transactions/:id/cancel", authenticateToken, async (req, res) => {
  const userId = (req as any).user?.id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx = (await client.query("SELECT * FROM treasury_transactions WHERE id = $1", [req.params.id])).rows[0];
    if (!tx) throw new Error("Transaction not found");
    if (tx.status === 'canceled') throw new Error("العملية ملغاة بالفعل");

    // Reverse account balance effect
    const amountToReverse = -Number(tx.amount);
    
    const account = (await client.query("SELECT current_balance FROM treasury_accounts WHERE id = $1", [tx.account_id])).rows[0];
    if (!account) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'الحساب غير موجود' }); }
    const balanceBefore = Number(account.current_balance);
    const balanceAfter = balanceBefore + amountToReverse;

    // Reverse account
    await client.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [amountToReverse, tx.account_id]);

    // Reverse supplier balance if linked
    if (tx.supplier_id) {
      const txAmount = Math.abs(Number(tx.amount));
      if (tx.amount < 0 || tx.voucher_type === 'payment' || tx.transaction_type === 'cash_out') {
        // Payment reversal restores supplier payable debt
        await client.query("UPDATE suppliers SET balance = COALESCE(balance, 0) + $1, updated_at = NOW() WHERE id = $2", [txAmount, tx.supplier_id]);
        await client.query(
          `INSERT INTO supplier_transactions (supplier_id, type, amount, notes, reference_type, reference_id, currency, status, created_at)
           VALUES ($1, 'payment_reversal', $2, $3, 'treasury_voucher_cancel', $4, 'EGP', 'posted', NOW())`,
          [tx.supplier_id, txAmount, `إلغاء سند صرف رقم ${tx.voucher_number || tx.id}`, tx.id]
        );
        if (tx.invoice_id) {
          await client.query(
            `UPDATE purchases 
             SET paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - $1),
                 payment_status = CASE 
                   WHEN GREATEST(0, COALESCE(paid_amount, 0) - $1) = 0 THEN 'unpaid' 
                   ELSE 'partial' 
                 END,
                 updated_at = NOW()
             WHERE id = $2 AND supplier_id = $3`,
            [txAmount, tx.invoice_id, tx.supplier_id]
          );
        }
      } else if (tx.amount > 0 || tx.voucher_type === 'receipt' || tx.transaction_type === 'cash_in') {
        // Receipt reversal reduces supplier debt
        await client.query("UPDATE suppliers SET balance = COALESCE(balance, 0) - $1, updated_at = NOW() WHERE id = $2", [txAmount, tx.supplier_id]);
      }
    }

    // Update original transaction status to canceled and document reversal
    const result = await client.query(
      `UPDATE treasury_transactions 
       SET status = 'canceled', notes = CONCAT(notes, ' - تم الإلغاء بواسطة المستخدم'), balance_after = $1
       WHERE id = $2 RETURNING *`,
      [balanceAfter, req.params.id]
    );

    await logAudit(client, tx.id, tx.account_id, "cancel_transaction", tx, result.rows[0], userId);
    await client.query("COMMIT");

    // Reverse the linked general-ledger entry (if this payment had been posted to GL)
    try {
      const je = await pool.query(
        `SELECT id FROM journal_entries WHERE source_type = 'supplier_payment' AND source_id = $1 AND status <> 'canceled' ORDER BY id DESC LIMIT 1`,
        [tx.id]
      );
      if (je.rows[0]) {
        await new AccountRepository().reverseJournalEntry(je.rows[0].id, userId || 0);
      }
    } catch (glErr) {
      console.error("GL reversal for supplier payment failed (non-blocking):", glErr);
    }

    res.json({ success: true, transaction: result.rows[0] });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Cancel transaction error:", error);
    res.status(500).json({ error: error.message || "Failed to cancel transaction" });
  } finally {
    client.release();
  }
});

// 6. DAILY CLOSINGS (إقفال اليومية)
router.get("/api/treasury/closings", authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT dc.*, s.name as account_name, u.username as creator_name, app.username as approver_name
      FROM treasury_daily_closings dc
      JOIN treasury_accounts s ON dc.account_id = s.id
      JOIN users u ON dc.created_by = u.id
      LEFT JOIN users app ON dc.approved_by = app.id
      ORDER BY dc.created_at DESC
    `;
    const closings = (await pool.query(query)).rows;
    res.json(closings);
  } catch (error) {
    console.error("Fetch closings error:", error);
    res.status(500).json({ error: "Failed to fetch daily closings" });
  }
});

router.post("/api/treasury/closings", authenticateToken, async (req, res) => {
  const { account_id, actual_balance, notes } = req.body;
  const userId = (req as any).user?.id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const account = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1", [account_id])).rows[0];
    if (!account) throw new Error("Treasury account not found");

    const today = new Date().toISOString().split('T')[0];

    // Calculate flows for today for this safe
    const flowsRes = await client.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 AND transaction_type != 'transfer' THEN amount ELSE 0 END), 0)::float as receipts,
        COALESCE(SUM(CASE WHEN amount < 0 AND transaction_type != 'transfer' THEN ABS(amount) ELSE 0 END), 0)::float as payments,
        COALESCE(SUM(CASE WHEN amount > 0 AND transaction_type = 'transfer' THEN amount ELSE 0 END), 0)::float as transfers_in,
        COALESCE(SUM(CASE WHEN amount < 0 AND transaction_type = 'transfer' THEN ABS(amount) ELSE 0 END), 0)::float as transfers_out
      FROM treasury_transactions
      WHERE account_id = $1 AND created_at::date = $2 AND status = 'approved'
    `, [account_id, today]);

    const flow = flowsRes.rows[0];
    const openingBalance = Number(account.current_balance) - (flow.receipts + flow.transfers_in - flow.payments - flow.transfers_out);
    const expectedBalance = Number(account.current_balance);
    const difference = Number(actual_balance) - expectedBalance;

    const result = await client.query(`
      INSERT INTO treasury_daily_closings 
      (account_id, opening_balance, receipts, payments, transfers_in, transfers_out, expected_balance, actual_balance, difference, status, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'closed', $10, $11) RETURNING *
    `, [
      account_id, 
      openingBalance, 
      flow.receipts, 
      flow.payments, 
      flow.transfers_in, 
      flow.transfers_out, 
      expectedBalance, 
      actual_balance, 
      difference, 
      notes || "إقفال اليومية التلقائي", 
      userId
    ]);

    // If there is discrepancy, post discrepancy cash transaction to treasury_transactions to reconcile
    if (difference !== 0) {
      const voucherType = difference > 0 ? 'receipt' : 'payment';
      const typeLabel = difference > 0 ? 'تسوية فروقات جرد (زيادة)' : 'تسوية فروقات جرد (عجز)';
      const year = new Date().getFullYear();
      const voucherNum = await generateTreasuryVoucherNumber(client, voucherType, year);

      await client.query(`
        INSERT INTO treasury_transactions 
        (account_id, amount, transaction_type, notes, created_by, status, voucher_number, voucher_type, balance_before, balance_after)
        VALUES ($1, $2, 'adjustment', $3, $4, 'approved', $5, $6, $7, $8)
      `, [
        account_id, 
        difference, 
        `${typeLabel} - إغلاق اليومية`, 
        userId, 
        voucherNum, 
        voucherType, 
        expectedBalance, 
        actual_balance
      ]);

      // Reconcile account balance to actual balance
      await client.query("UPDATE treasury_accounts SET current_balance = $1 WHERE id = $2", [actual_balance, account_id]);
    }

    const closing = result.rows[0];
    await logAudit(client, null, account_id, "close_day", null, closing, userId);

    await client.query("COMMIT");
    res.json(closing);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Create closing error:", error);
    res.status(500).json({ error: error.message || "Failed to create closing" });
  } finally {
    client.release();
  }
});

router.post("/api/treasury/closings/:id/reopen", authenticateToken, async (req, res) => {
  const userId = (req as any).user?.id || null;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const closing = (await client.query("SELECT * FROM treasury_daily_closings WHERE id = $1", [req.params.id])).rows[0];
    if (!closing) throw new Error("Closing record not found");

    // Check permissions inside standard flow or allow if role is admin
    const userRole = (req as any).user?.role;
    if (userRole !== 'admin') {
      throw new Error("عذراً، لا توجد لديك صلاحيات لإعادة فتح إقفال اليوميات. يرجى مراجعة المسؤول.");
    }

    const result = await client.query(
      `UPDATE treasury_daily_closings 
       SET status = 'reopened', approved_by = $1, approved_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [userId, req.params.id]
    );

    await logAudit(client, null, closing.account_id, "reopen_day", closing, result.rows[0], userId);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Reopen closing error:", error);
    res.status(500).json({ error: error.message || "Failed to reopen closing" });
  } finally {
    client.release();
  }
});

// 7. CUSTODY & TRUST MANAGEMENT SYSTEM (نظام إدارة العهد والأمانات المؤسسي المتكامل)

// Helper: Log Custody Audit
async function logCustodyAudit(client: any, custodyId: number, actionType: string, oldStatus: string | null, newStatus: string | null, details: any, userId: number, userName: string = "المستخدم") {
  try {
    await client.query(
      `INSERT INTO treasury_custody_audit_logs (custody_id, action_type, old_status, new_status, details, user_id, user_name) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [custodyId, actionType, oldStatus, newStatus, JSON.stringify(details || {}), userId, userName]
    );
  } catch (err) {
    console.error("Custody audit log error:", err);
  }
}

// 7.1 CUSTODY TYPES CRUD
router.get(["/api/treasury/custody-types", "/api/treasury/custodies/types"], authenticateToken, async (req, res) => {
  try {
    const types = (await pool.query(`
      SELECT t.*, 
        COUNT(c.id)::integer as active_custodies_count,
        COALESCE(SUM(c.amount), 0)::float as total_active_amount
      FROM treasury_custody_types t
      LEFT JOIN treasury_custodies c ON (c.custody_type_id = t.id OR c.custody_type = t.category) AND c.status IN ('active', 'issued', 'pending_settlement')
      GROUP BY t.id
      ORDER BY t.id ASC
    `)).rows;
    res.json(types);
  } catch (error) {
    console.error("Fetch custody types error:", error);
    res.status(500).json({ error: "Failed to fetch custody types" });
  }
});

router.post("/api/treasury/custody-types", authenticateToken, async (req, res) => {
  const { code, name_ar, name_en, category, requires_asset, requires_inventory, requires_treasury, max_limit, default_duration_days, description } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO treasury_custody_types 
      (code, name_ar, name_en, category, requires_asset, requires_inventory, requires_treasury, max_limit, default_duration_days, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `, [
      code || `CUST-${Date.now().toString().slice(-4)}`,
      name_ar,
      name_en || name_ar,
      category || 'cash',
      !!requires_asset,
      !!requires_inventory,
      requires_treasury !== undefined ? !!requires_treasury : true,
      parseFloat(max_limit) || 0,
      parseInt(default_duration_days) || 30,
      description || ""
    ]);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Create custody type error:", error);
    res.status(500).json({ error: error.message || "Failed to create custody type" });
  }
});

router.put("/api/treasury/custody-types/:id", authenticateToken, async (req, res) => {
  const { name_ar, name_en, category, requires_asset, requires_inventory, requires_treasury, max_limit, default_duration_days, description, is_active } = req.body;
  try {
    const result = await pool.query(`
      UPDATE treasury_custody_types 
      SET name_ar = $1, name_en = $2, category = $3, requires_asset = $4, requires_inventory = $5, 
          requires_treasury = $6, max_limit = $7, default_duration_days = $8, description = $9, is_active = $10
      WHERE id = $11 RETURNING *
    `, [
      name_ar,
      name_en || name_ar,
      category || 'cash',
      !!requires_asset,
      !!requires_inventory,
      !!requires_treasury,
      parseFloat(max_limit) || 0,
      parseInt(default_duration_days) || 30,
      description || "",
      is_active !== undefined ? !!is_active : true,
      req.params.id
    ]);
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error("Update custody type error:", error);
    res.status(500).json({ error: error.message || "Failed to update custody type" });
  }
});

// 7.2 CUSTODY DASHBOARD METRICS & KPI
router.get(["/api/treasury/custodies-dashboard", "/api/treasury/custodies/dashboard", "/api/treasury/custodies/kpi"], authenticateToken, async (req, res) => {
  try {
    const custodies = (await pool.query(`
      SELECT c.*, e.name as employee_name, a.name as account_name
      FROM treasury_custodies c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN treasury_accounts a ON c.account_id = a.id
    `)).rows;

    const now = new Date();
    let totalCount = custodies.length;
    let activeCount = 0;
    let totalActiveAmount = 0;
    let totalSpentAmount = 0;
    let totalRemainingAmount = 0;
    let pendingApprovalCount = 0;
    let overdueCount = 0;
    let closedThisMonthCount = 0;
    let closedThisMonthAmount = 0;

    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const byCategory: Record<string, { count: number; totalAmount: number }> = {
      cash: { count: 0, totalAmount: 0 },
      asset: { count: 0, totalAmount: 0 },
      equipment: { count: 0, totalAmount: 0 },
      inventory: { count: 0, totalAmount: 0 },
      vehicle: { count: 0, totalAmount: 0 },
      temporary: { count: 0, totalAmount: 0 },
      permanent: { count: 0, totalAmount: 0 }
    };

    const overdueList: any[] = [];
    const pendingList: any[] = [];

    custodies.forEach((c: any) => {
      const amt = parseFloat(c.amount) || 0;
      const spent = parseFloat(c.spent_amount) || 0;
      const rem = parseFloat(c.remaining_amount) || Math.max(0, amt - spent);
      const cat = c.custody_type || 'cash';

      if (byCategory[cat]) {
        byCategory[cat].count++;
        byCategory[cat].totalAmount += amt;
      }

      if (['active', 'issued', 'pending_settlement'].includes(c.status)) {
        activeCount++;
        totalActiveAmount += amt;
        totalSpentAmount += spent;
        totalRemainingAmount += rem;

        // Check if overdue
        if (c.due_date) {
          const due = new Date(c.due_date);
          if (due < now) {
            overdueCount++;
            const diffDays = Math.max(1, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
            overdueList.push({
              ...c,
              overdue_days: diffDays,
              remaining_balance: rem
            });
          }
        }
      }

      if (c.status === 'pending_approval' || c.status === 'pending') {
        pendingApprovalCount++;
        pendingList.push(c);
      }

      if (c.status === 'closed' || c.status === 'cleared') {
        const closedDate = c.cleared_at || c.updated_at ? new Date(c.cleared_at || c.updated_at) : null;
        if (closedDate && closedDate.getMonth() === currentMonth && closedDate.getFullYear() === currentYear) {
          closedThisMonthCount++;
          closedThisMonthAmount += (parseFloat(c.cleared_amount) || amt);
        }
      }
    });

    res.json({
      summary: {
        total_custodies: totalCount,
        active_custodies: activeCount,
        total_active_amount: totalActiveAmount,
        total_spent_amount: totalSpentAmount,
        total_remaining_amount: totalRemainingAmount,
        pending_approval_count: pendingApprovalCount,
        overdue_count: overdueCount,
        closed_this_month_count: closedThisMonthCount,
        closed_this_month_amount: closedThisMonthAmount
      },
      byCategory,
      overdueList: overdueList.slice(0, 10),
      pendingList: pendingList.slice(0, 10)
    });
  } catch (error) {
    console.error("Custodies dashboard error:", error);
    res.status(500).json({ error: "Failed to fetch custody dashboard metrics" });
  }
});

// 7.3 CUSTODY REPORTS & ADVANCED SEARCH
router.get(["/api/treasury/custodies-reports", "/api/treasury/custodies/reports"], authenticateToken, async (req, res) => {
  try {
    const { status, category, employee_id, branch_id, cost_center_id, account_id, is_overdue, start_date, end_date, search } = req.query;
    
    let query = `
      SELECT c.*, 
        e.name as employee_name, 
        e.employee_code,
        COALESCE((SELECT name FROM hr_departments WHERE id = e.department_id), c.department) as employee_department,
        a.name as account_name,
        t.name_ar as custody_type_name,
        t.code as custody_type_code,
        b.name as branch_name,
        cc.name as cost_center_name
      FROM treasury_custodies c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN treasury_accounts a ON c.account_id = a.id
      LEFT JOIN treasury_custody_types t ON c.custody_type_id = t.id
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }
    if (category && category !== 'all') {
      params.push(category);
      query += ` AND (c.custody_type = $${params.length} OR t.category = $${params.length})`;
    }
    if (employee_id && employee_id !== 'all') {
      params.push(Number(employee_id));
      query += ` AND c.employee_id = $${params.length}`;
    }
    if (branch_id && branch_id !== 'all') {
      params.push(Number(branch_id));
      query += ` AND c.branch_id = $${params.length}`;
    }
    if (cost_center_id && cost_center_id !== 'all') {
      params.push(Number(cost_center_id));
      query += ` AND c.cost_center_id = $${params.length}`;
    }
    if (account_id && account_id !== 'all') {
      params.push(Number(account_id));
      query += ` AND c.account_id = $${params.length}`;
    }
    if (start_date) {
      params.push(start_date);
      query += ` AND c.created_at::date >= $${params.length}`;
    }
    if (end_date) {
      params.push(end_date);
      query += ` AND c.created_at::date <= $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.custody_number ILIKE $${params.length} OR c.purpose ILIKE $${params.length} OR e.name ILIKE $${params.length})`;
    }

    query += ` ORDER BY c.created_at DESC`;
    const rows = (await pool.query(query, params)).rows;

    const now = new Date();
    const enriched = rows.map((r: any) => {
      const dueDate = r.due_date ? new Date(r.due_date) : null;
      const isOverdue = Boolean(dueDate && dueDate < now && ['active', 'issued', 'pending_settlement'].includes(r.status));
      const overdueDays = isOverdue && dueDate ? Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      return {
        ...r,
        is_overdue: isOverdue,
        overdue_days: overdueDays
      };
    });

    const filtered = is_overdue === 'true' ? enriched.filter((item: any) => item.is_overdue) : enriched;

    // Totals calculations
    const totals = {
      count: filtered.length,
      total_amount: filtered.reduce((s: number, i: any) => s + (parseFloat(i.amount) || 0), 0),
      total_spent: filtered.reduce((s: number, i: any) => s + (parseFloat(i.spent_amount) || 0), 0),
      total_remaining: filtered.reduce((s: number, i: any) => s + (parseFloat(i.remaining_amount) || 0), 0),
      total_returned: filtered.reduce((s: number, i: any) => s + (parseFloat(i.returned_amount) || 0), 0)
    };

    res.json({ rows: filtered, totals });
  } catch (error) {
    console.error("Custody reports error:", error);
    res.status(500).json({ error: "Failed to generate custody report" });
  }
});

// 7.4 OVERDUE CUSTODIES
router.get("/api/treasury/custodies/overdue", authenticateToken, async (req, res) => {
  try {
    const custodies = (await pool.query(`
      SELECT c.*, 
        e.name as employee_name, 
        e.employee_code, 
        e.phone as employee_phone,
        COALESCE((SELECT name FROM hr_departments WHERE id = e.department_id), c.department) as employee_department,
        a.name as account_name,
        t.name_ar as custody_type_name
      FROM treasury_custodies c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN treasury_accounts a ON c.account_id = a.id
      LEFT JOIN treasury_custody_types t ON c.custody_type_id = t.id
      WHERE c.status IN ('active', 'issued', 'pending_settlement') AND c.due_date < NOW()
      ORDER BY c.due_date ASC
    `)).rows;

    const now = new Date();
    const enriched = custodies.map((c: any) => {
      const due = new Date(c.due_date);
      const overdueDays = Math.max(1, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        ...c,
        is_overdue: true,
        overdue_days: overdueDays
      };
    });

    res.json(enriched);
  } catch (error) {
    console.error("Fetch overdue custodies error:", error);
    res.status(500).json({ error: "Failed to fetch overdue custodies" });
  }
});

// 7.5 LIST ALL CUSTODIES (Enhanced with Full Filtering)
router.get("/api/treasury/custodies", authenticateToken, async (req, res) => {
  try {
    const { status, category, employee_id, account_id, branch_id, search, is_overdue } = req.query;
    let query = `
      SELECT c.*, 
        e.name as employee_name, 
        e.employee_code, 
        COALESCE((SELECT name FROM hr_departments WHERE id = e.department_id), c.department) as employee_department,
        a.name as account_name, 
        t.name_ar as custody_type_name,
        t.code as custody_type_code,
        t.category as custody_category,
        b.name as branch_name,
        cc.name as cost_center_name
      FROM treasury_custodies c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN treasury_accounts a ON c.account_id = a.id
      LEFT JOIN treasury_custody_types t ON (c.custody_type_id = t.id OR c.custody_type = t.category)
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Status Filter with smart synonyms
    if (status && status !== 'all') {
      if (status === 'active' || status === 'issued') {
        query += ` AND c.status IN ('active', 'issued', 'paid')`;
      } else if (status === 'pending_approval' || status === 'pending') {
        query += ` AND c.status IN ('pending_approval', 'pending')`;
      } else if (status === 'closed' || status === 'cleared') {
        query += ` AND c.status IN ('closed', 'cleared', 'fully_cleared')`;
      } else if (status === 'partially_settled') {
        query += ` AND c.status IN ('partially_settled', 'partially_cleared')`;
      } else if (status === 'rejected') {
        query += ` AND c.status IN ('rejected', 'cancelled', 'canceled')`;
      } else {
        params.push(status);
        query += ` AND c.status = $${params.length}`;
      }
    }

    // Category / Custody Type Filter
    if (category && category !== 'all') {
      if (typeof category === 'string' && category.startsWith('type_')) {
        const typeId = parseInt(category.replace('type_', ''), 10);
        if (!isNaN(typeId)) {
          params.push(typeId);
          query += ` AND c.custody_type_id = $${params.length}`;
        }
      } else {
        params.push(category);
        params.push(`%${category}%`);
        query += ` AND (c.custody_type = $${params.length - 1} OR t.category = $${params.length - 1} OR t.code = $${params.length - 1} OR t.name_ar ILIKE $${params.length} OR CAST(c.custody_type_id AS TEXT) = $${params.length - 1})`;
      }
    }

    // Employee Filter
    if (employee_id && employee_id !== 'all') {
      params.push(Number(employee_id));
      query += ` AND c.employee_id = $${params.length}`;
    }

    // Safe / Account Filter
    if (account_id && account_id !== 'all') {
      params.push(Number(account_id));
      query += ` AND c.account_id = $${params.length}`;
    }

    // Branch Filter
    if (branch_id && branch_id !== 'all') {
      params.push(Number(branch_id));
      query += ` AND c.branch_id = $${params.length}`;
    }

    // General Search (Supports Custody Voucher #, Employee Code, Employee Name, Purpose, Safe, Type)
    if (search && String(search).trim() !== '') {
      const s = String(search).trim();
      params.push(`%${s}%`);
      query += ` AND (
        c.custody_number ILIKE $${params.length} 
        OR CAST(c.id AS TEXT) ILIKE $${params.length}
        OR c.purpose ILIKE $${params.length} 
        OR e.name ILIKE $${params.length}
        OR e.employee_code ILIKE $${params.length}
        OR CAST(e.id AS TEXT) ILIKE $${params.length}
        OR a.name ILIKE $${params.length}
        OR t.name_ar ILIKE $${params.length}
      )`;
    }

    query += ` ORDER BY c.created_at DESC`;
    const custodies = (await pool.query(query, params)).rows;

    const now = new Date();
    const enriched = custodies.map((c: any) => {
      const dueDate = c.due_date ? new Date(c.due_date) : null;
      const isOverdue = Boolean(dueDate && dueDate < now && ['active', 'issued', 'pending_settlement'].includes(c.status));
      const overdueDays = isOverdue && dueDate ? Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;
      return {
        ...c,
        is_overdue: isOverdue,
        overdue_days: overdueDays
      };
    });

    const result = is_overdue === 'true' ? enriched.filter((x: any) => x.is_overdue) : enriched;
    res.json(result);
  } catch (error) {
    console.error("Fetch custodies error:", error);
    res.status(500).json({ error: "Failed to fetch custodies list" });
  }
});

// 7.6 GET SINGLE CUSTODY DETAILS (Full Graph)
router.get("/api/treasury/custodies/:id", authenticateToken, async (req, res) => {
  try {
    const numericId = Number(req.params.id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return res.status(400).json({ error: "Invalid custody ID" });
    }
    const custodyRes = await pool.query(`
      SELECT c.*, 
        e.name as employee_name, 
        e.employee_code, 
        e.phone as employee_phone,
        COALESCE((SELECT name FROM hr_departments WHERE id = e.department_id), c.department) as employee_department,
        a.name as account_name, 
        a.current_balance as account_balance,
        t.name_ar as custody_type_name,
        t.code as custody_type_code,
        t.category as custody_category,
        b.name as branch_name,
        cc.name as cost_center_name,
        u_app.username as approver_name,
        u_iss.username as issuer_name
      FROM treasury_custodies c
      LEFT JOIN employees e ON c.employee_id = e.id
      LEFT JOIN treasury_accounts a ON c.account_id = a.id
      LEFT JOIN treasury_custody_types t ON (c.custody_type_id = t.id OR c.custody_type = t.category)
      LEFT JOIN branches b ON c.branch_id = b.id
      LEFT JOIN cost_centers cc ON c.cost_center_id = cc.id
      LEFT JOIN users u_app ON c.approved_by = u_app.id
      LEFT JOIN users u_iss ON c.issued_by = u_iss.id
      WHERE c.id = $1
    `, [numericId]);

    if (custodyRes.rows.length === 0) {
      return res.status(404).json({ error: "العهدة غير موجودة" });
    }

    const custody = custodyRes.rows[0];

    // Fetch child entities
    const expenses = (await pool.query(`
      SELECT ce.*, cc.name as cost_center_name, u.username as creator_name
      FROM treasury_custody_expenses ce
      LEFT JOIN cost_centers cc ON ce.cost_center_id = cc.id
      LEFT JOIN users u ON ce.created_by = u.id
      WHERE ce.custody_id = $1
      ORDER BY ce.expense_date DESC, ce.id DESC
    `, [req.params.id])).rows;

    const items = (await pool.query(`
      SELECT ci.*, fa.name as linked_asset_name, fa.code as linked_asset_code
      FROM treasury_custody_items ci
      LEFT JOIN fixed_assets fa ON ci.asset_id = fa.id
      WHERE ci.custody_id = $1
      ORDER BY ci.id ASC
    `, [req.params.id])).rows;

    const settlements = (await pool.query(`
      SELECT cs.*, a.name as treasury_account_name, u_rev.username as reviewer_name, u_app.username as approver_name
      FROM treasury_custody_settlements cs
      LEFT JOIN treasury_accounts a ON cs.treasury_account_id = a.id
      LEFT JOIN users u_rev ON cs.reviewed_by = u_rev.id
      LEFT JOIN users u_app ON cs.approved_by = u_app.id
      WHERE cs.custody_id = $1
      ORDER BY cs.created_at DESC
    `, [req.params.id])).rows;

    const approvals = (await pool.query(`
      SELECT ca.*, u.username as approver_name
      FROM treasury_custody_approvals ca
      LEFT JOIN users u ON ca.approver_id = u.id
      WHERE ca.custody_id = $1
      ORDER BY ca.approval_level ASC, ca.id ASC
    `, [req.params.id])).rows;

    const attachments = (await pool.query(`
      SELECT ca.*, u.username as uploader_name
      FROM treasury_custody_attachments ca
      LEFT JOIN users u ON ca.uploaded_by = u.id
      WHERE ca.custody_id = $1
      ORDER BY ca.created_at DESC
    `, [req.params.id])).rows;

    const auditLogs = (await pool.query(`
      SELECT al.*, u.username as user_name
      FROM treasury_custody_audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.custody_id = $1
      ORDER BY al.created_at DESC
    `, [req.params.id])).rows;

    // Overdue calculation
    const now = new Date();
    const dueDate = custody.due_date ? new Date(custody.due_date) : null;
    const isOverdue = Boolean(dueDate && dueDate < now && ['active', 'issued', 'pending_settlement'].includes(custody.status));
    const overdueDays = isOverdue && dueDate ? Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    res.json({
      ...custody,
      is_overdue: isOverdue,
      overdue_days: overdueDays,
      expenses,
      items,
      settlements,
      approvals,
      attachments,
      auditLogs
    });
  } catch (error) {
    console.error("Fetch custody details error:", error);
    res.status(500).json({ error: "Failed to fetch custody details" });
  }
});

// 7.7 CREATE NEW CUSTODY (Request / Draft / Submit)
router.post("/api/treasury/custodies", authenticateToken, async (req, res) => {
  const {
    employee_id,
    custody_type_id,
    custody_type,
    account_id,
    amount,
    currency,
    branch_id,
    cost_center_id,
    project_name,
    due_date,
    duration_days,
    purpose,
    notes,
    is_draft,
    items
  } = req.body;

  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();

  try {
    const parsedEmployeeId = Number(employee_id);
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
      return res.status(400).json({ error: "يجب اختيار موظف صالح للعهدة النقدية" });
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "قيمة العهدة النقدية يجب أن تكون أكبر من صفر" });
    }
    if (Array.isArray(items) && items.length > 0) {
      return res.status(400).json({ error: "تسجيل العهد العينية والأصول يتم من صفحة العهد في الموارد البشرية" });
    }
    let cashTypeId = custody_type_id ? Number(custody_type_id) : null;
    let cashTypeCategory = "cash";
    if (cashTypeId) {
      const custodyType = (await client.query(
        `SELECT id, category FROM treasury_custody_types
          WHERE id=$1 AND is_active=true AND category IN ('cash', 'temporary', 'permanent')
            AND requires_treasury=true AND requires_asset=false AND requires_inventory=false`,
        [cashTypeId]
      )).rows[0];
      if (!custodyType) {
        return res.status(400).json({ error: "صفحة الخزينة مخصصة للعهد النقدية؛ سجّل العهد العينية من الموارد البشرية" });
      }
      cashTypeCategory = custodyType.category;
    } else {
      const custodyType = (await client.query(
        `SELECT id, category FROM treasury_custody_types
          WHERE is_active=true AND category='cash' AND requires_treasury=true
          ORDER BY id LIMIT 1`
      )).rows[0];
      cashTypeId = Number(custodyType?.id) || null;
      if (!cashTypeId) {
        return res.status(400).json({ error: "لا يوجد نوع عهدة نقدية مفعّل في إعدادات الخزينة" });
      }
      cashTypeCategory = custodyType.category;
    }

    await client.query("BEGIN");

    // Generate Sequential Custody Number: CUS-YYYY-XXXX
    const year = new Date().getFullYear();
    const countRes = await client.query(
      "SELECT COUNT(*)::integer as count FROM treasury_custodies WHERE EXTRACT(YEAR FROM created_at) = $1",
      [year]
    );
    const seq = (countRes.rows[0].count + 1).toString().padStart(4, "0");
    const custodyNumber = `CUS-${year}-${seq}`;

    const initialStatus = is_draft ? 'draft' : 'pending_approval';

    // Calculate due date if duration given
    let calculatedDueDate = due_date;
    if (!calculatedDueDate && duration_days) {
      const d = new Date();
      d.setDate(d.getDate() + parseInt(duration_days));
      calculatedDueDate = d.toISOString().split('T')[0];
    }

    const result = await client.query(`
      INSERT INTO treasury_custodies 
      (custody_number, custody_type_id, custody_type, employee_id, branch_id, cost_center_id, project_name, account_id, 
       amount, issued_amount, spent_amount, remaining_amount, currency, status, request_date, due_date, duration_days, 
       purpose, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0, $9, $10, $11, NOW(), $12, $13, $14, $15, $16) 
      RETURNING *
    `, [
      custodyNumber,
      cashTypeId,
      cashTypeCategory,
      parseInt(employee_id),
      branch_id ? parseInt(branch_id) : null,
      cost_center_id ? parseInt(cost_center_id) : null,
      project_name || "",
      account_id ? parseInt(account_id) : null,
      parsedAmount,
      currency || 'EGP',
      initialStatus,
      calculatedDueDate || null,
      parseInt(duration_days) || 30,
      purpose || "طلب عهدة موظف",
      notes || "",
      userId
    ]);

    const newCustody = result.rows[0];

    // Insert Items if provided (for equipment, assets, tools, inventory, vehicles)
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await client.query(`
          INSERT INTO treasury_custody_items
          (custody_id, item_type, asset_id, item_name, item_code, serial_number, barcode, quantity, unit_cost, total_value, condition_on_issue, notes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          newCustody.id,
          item.item_type || 'equipment',
          item.asset_id ? parseInt(item.asset_id) : null,
          item.item_name || 'بند عهدة',
          item.item_code || '',
          item.serial_number || '',
          item.barcode || '',
          parseFloat(item.quantity) || 1,
          parseFloat(item.unit_cost) || 0,
          (parseFloat(item.quantity) || 1) * (parseFloat(item.unit_cost) || 0),
          item.condition_on_issue || 'ممتازة',
          item.notes || ''
        ]);
      }
    }

    // Log Audit
    await logCustodyAudit(
      client, 
      newCustody.id, 
      is_draft ? "create_draft" : "submit_request", 
      null, 
      initialStatus, 
      { message: `تم إنشاء طلب العهدة رقم ${custodyNumber} بقيمة ${parsedAmount} ج.م` }, 
      userId, 
      userName
    );

    await client.query("COMMIT");
    res.json(newCustody);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Create custody error:", error);
    res.status(500).json({ error: error.message || "Failed to create custody" });
  } finally {
    client.release();
  }
});

// 7.8 UPDATE CUSTODY (Draft or Pending)
router.put("/api/treasury/custodies/:id", authenticateToken, async (req, res) => {
  const {
    employee_id,
    custody_type_id,
    custody_type,
    account_id,
    amount,
    currency,
    branch_id,
    cost_center_id,
    project_name,
    due_date,
    duration_days,
    purpose,
    notes
  } = req.body;

  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const old = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!old) throw new Error("Custody not found");
    if (!['draft', 'pending_approval', 'pending'].includes(old.status)) {
      throw new Error("لا يمكن تعديل العهدة بعد الصرف والاعتماد");
    }

    const parsedAmount = parseFloat(amount) || 0;
    const result = await client.query(`
      UPDATE treasury_custodies 
      SET employee_id = $1, custody_type_id = $2, custody_type = $3, account_id = $4, amount = $5, remaining_amount = $5,
          currency = $6, branch_id = $7, cost_center_id = $8, project_name = $9, due_date = $10, duration_days = $11,
          purpose = $12, notes = $13, updated_at = NOW()
      WHERE id = $14 RETURNING *
    `, [
      parseInt(employee_id),
      custody_type_id ? parseInt(custody_type_id) : old.custody_type_id,
      custody_type || old.custody_type,
      account_id ? parseInt(account_id) : null,
      parsedAmount,
      currency || 'EGP',
      branch_id ? parseInt(branch_id) : null,
      cost_center_id ? parseInt(cost_center_id) : null,
      project_name || "",
      due_date || old.due_date,
      parseInt(duration_days) || old.duration_days,
      purpose || old.purpose,
      notes || old.notes,
      req.params.id
    ]);

    await logCustodyAudit(client, old.id, "update", old.status, old.status, { old, new: result.rows[0] }, userId, userName);

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Update custody error:", error);
    res.status(500).json({ error: error.message || "Failed to update custody" });
  } finally {
    client.release();
  }
});

// 7.9 SUBMIT DRAFT FOR APPROVAL
router.post("/api/treasury/custodies/:id/submit", authenticateToken, async (req, res) => {
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const old = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!old) throw new Error("العهدة غير موجودة");
    if (old.status !== 'draft') throw new Error("يمكن إرسال المسودات فقط للاعتماد");

    const result = await client.query(
      "UPDATE treasury_custodies SET status = 'pending_approval', updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    await logCustodyAudit(client, old.id, "submit_for_approval", old.status, "pending_approval", { message: "تم إرسال الطلب للاعتماد" }, userId, userName);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message || "Failed to submit custody" });
  } finally {
    client.release();
  }
});

// 7.10 APPROVE CUSTODY REQUEST
router.post("/api/treasury/custodies/:id/approve", authenticateToken, async (req, res) => {
  const { notes, approval_level } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody record not found");
    if (custody.status !== 'pending_approval' && custody.status !== 'pending') {
      throw new Error("العهدة ليست قيد انتظار الموافقة");
    }

    // Insert into approval logs
    await client.query(`
      INSERT INTO treasury_custody_approvals (custody_id, approval_level, approver_id, status, decision, comments, decided_at)
      VALUES ($1, $2, $3, 'approved', 'approved', $4, NOW())
    `, [custody.id, parseInt(approval_level) || 1, userId, notes || "تمت الموافقة"]);

    const result = await client.query(`
      UPDATE treasury_custodies 
      SET status = 'approved', approved_by = $1, approved_at = NOW(), updated_at = NOW() 
      WHERE id = $2 RETURNING *
    `, [userId, req.params.id]);

    await logCustodyAudit(client, custody.id, "approve", custody.status, "approved", { notes }, userId, userName);

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Approve custody error:", error);
    res.status(500).json({ error: error.message || "Failed to approve custody" });
  } finally {
    client.release();
  }
});

// 7.11 REJECT CUSTODY REQUEST
router.post("/api/treasury/custodies/:id/reject", authenticateToken, async (req, res) => {
  const { reason } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody record not found");

    await client.query(`
      INSERT INTO treasury_custody_approvals (custody_id, approval_level, approver_id, status, decision, comments, decided_at)
      VALUES ($1, 1, $2, 'rejected', 'rejected', $3, NOW())
    `, [custody.id, userId, reason || "تم الرفض"]);

    const result = await client.query(`
      UPDATE treasury_custodies 
      SET status = 'rejected', notes = CONCAT(notes, ' - سبب الرفض: ', $1::text), updated_at = NOW() 
      WHERE id = $2 RETURNING *
    `, [reason || "تم الرفض", req.params.id]);

    await logCustodyAudit(client, custody.id, "reject", custody.status, "rejected", { reason }, userId, userName);

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Reject custody error:", error);
    res.status(500).json({ error: error.message || "Failed to reject custody" });
  } finally {
    client.release();
  }
});

// 7.12 ISSUE / DISBURSE CUSTODY (صرف وتسليم العهدة)
router.post(["/api/treasury/custodies/:id/pay", "/api/treasury/custodies/:id/issue"], authenticateToken, async (req, res) => {
  const { account_id, payment_method, notes } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("العهدة غير موجودة");
    if (!['approved', 'pending', 'pending_approval'].includes(custody.status)) {
      throw new Error("لا يمكن صرف عهدة غير معتمدة أو تم صرفها مسبقاً");
    }

    const targetAccountId = account_id || custody.account_id;
    const custodyAmount = parseFloat(custody.amount) || 0;

    let voucherNum = null;

    // For cash/treasury based custodies: deduct money from treasury and create payment voucher
    if (custodyAmount > 0) {
      if (!targetAccountId) {
        throw new Error("يرجى تحديد الخزينة المانحة للصرف المالي");
      }

      const account = (await client.query("SELECT * FROM treasury_accounts WHERE id = $1", [targetAccountId])).rows[0];
      if (!account) {
        throw new Error("الخزينة المحددة غير موجودة");
      }
      if (Number(account.current_balance) < custodyAmount) {
        const negRes = await client.query("SELECT value FROM treasury_settings WHERE key = 'allow_negative_balance'");
        const lastRow = negRes.rows.length > 0 ? negRes.rows[negRes.rows.length - 1] : null;
        const allowNeg = lastRow ? lastRow.value !== 'false' : true;
        if (!allowNeg) {
          throw new Error(`رصيد الخزينة (${account.current_balance} ج.م) غير كافٍ لصرف العهدة بقيمة (${custodyAmount} ج.م)`);
        }
      }

      // Generate Voucher No for Custody Outflow
      const year = new Date().getFullYear();
      voucherNum = await generateTreasuryVoucherNumber(client, "payment", year);

      const balanceBefore = Number(account.current_balance);
      const balanceAfter = balanceBefore - custodyAmount;

      // Insert Treasury Transaction
      await client.query(`
        INSERT INTO treasury_transactions 
        (account_id, amount, transaction_type, notes, created_by, status, voucher_number, voucher_type, balance_before, balance_after, reference_type, reference_id)
        VALUES ($1, $2, 'cash_out', $3, $4, 'approved', $5, 'payment', $6, $7, 'custody', $8)
      `, [
        targetAccountId,
        -custodyAmount,
        `صرف عهدة مالية للموظف - كود العهدة: ${custody.custody_number || custody.id} - ${custody.purpose}`,
        userId,
        voucherNum,
        balanceBefore,
        balanceAfter,
        custody.id
      ]);

      // Deduct balance from Treasury Account
      await client.query("UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2", [custodyAmount, targetAccountId]);

      // Post General Ledger Journal Entry if enabled
      try {
        const emp = (await client.query("SELECT name, code FROM employees WHERE id = $1", [custody.employee_id])).rows[0];
        const empName = emp ? emp.name : "الموظف";
        
        const glConfig = await getAccountConfig();
        const period = await getOpenPeriod();
        const custodyDebitAccountId = Number(glConfig.employee_advances || glConfig.accounts_receivable);
        const custodyCreditAccountId = Number(glConfig.cash);
        if (!custodyDebitAccountId || !custodyCreditAccountId) {
          throw new Error("لم يتم تكوين حساب العهد وحساب الخزينة في إعدادات الحسابات العامة");
        }

        const jeResult = await client.query(`
          INSERT INTO journal_entries (date, description, reference, source_type, source_id, status, total_debit, total_credit, created_by, branch_id, period_id)
          VALUES (CURRENT_DATE, $1, $2, 'custody', $3, 'posted', $4, $4, $5, $6, $7) RETURNING id
        `, [
          `صرف عهدة نقدية للموظف ${empName} - سند ${voucherNum}`,
          voucherNum,
          custody.id,
          custodyAmount,
          userId,
          account.branch_id || null,
          period?.id ?? null
        ]);

        if (jeResult.rows.length > 0) {
          const jeId = jeResult.rows[0].id;
          // Debit the employee custody/receivable account — Credit the treasury cash account
          await client.query(`
            INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
            VALUES
              ($1, $2, $3, 0, $4, $5),
              ($1, $6, 0, $3, $7, $5)
          `, [
            jeId,
            custodyDebitAccountId,
            custodyAmount,
            `إثبات عهدة طرف الموظف ${empName}`,
            custody.cost_center_id,
            custodyCreditAccountId,
            `صرف نقدية من الخزينة ${account.name}`
          ]);
        }
      } catch (e) {
        console.log("Journal auto-posting info (non-blocking):", e);
      }
    }

    // Update items status if attached
    await client.query(
      "UPDATE treasury_custody_items SET status = 'assigned', issued_at = NOW() WHERE custody_id = $1",
      [custody.id]
    );

    // Update custody state to issued / active
    const result = await client.query(`
      UPDATE treasury_custodies 
      SET status = 'issued', issued_amount = $1, account_id = $2, issued_by = $3, issued_at = NOW(), updated_at = NOW() 
      WHERE id = $4 RETURNING *
    `, [custodyAmount, targetAccountId, userId, req.params.id]);

    await logCustodyAudit(
      client, 
      custody.id, 
      "issue_custody", 
      custody.status, 
      "issued", 
      { 
        amount: custodyAmount, 
        account_id: targetAccountId, 
        voucher_number: voucherNum, 
        notes: notes || "تم صرف وتسليم العهدة" 
      }, 
      userId, 
      userName
    );

    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Issue custody error:", error);
    res.status(500).json({ error: error.message || "Failed to issue custody" });
  } finally {
    client.release();
  }
});

// 7.13 CONFIRM RECEIPT BY EMPLOYEE (استلام الموظف وتفعيل العهدة)
router.post("/api/treasury/custodies/:id/receive", authenticateToken, async (req, res) => {
  const { notes } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody record not found");

    const result = await client.query(`
      UPDATE treasury_custodies 
      SET status = 'active', received_at = NOW(), updated_at = NOW() 
      WHERE id = $1 RETURNING *
    `, [req.params.id]);

    await logCustodyAudit(client, custody.id, "receive_custody", custody.status, "active", { notes: notes || "أقر الموظف باستلام العهدة" }, userId, userName);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Receive custody error:", error);
    res.status(500).json({ error: error.message || "Failed to confirm custody receipt" });
  } finally {
    client.release();
  }
});

// 7.14 CUSTODY EXPENSES & INVOICES (تسجيل فواتير ومصروفات العهدة)
router.get("/api/treasury/custodies/:id/expenses", authenticateToken, async (req, res) => {
  try {
    const expenses = (await pool.query(`
      SELECT ce.*, cc.name as cost_center_name, u.username as creator_name
      FROM treasury_custody_expenses ce
      LEFT JOIN cost_centers cc ON ce.cost_center_id = cc.id
      LEFT JOIN users u ON ce.created_by = u.id
      WHERE ce.custody_id = $1
      ORDER BY ce.expense_date DESC, ce.id DESC
    `, [req.params.id])).rows;
    res.json(expenses);
  } catch (error) {
    console.error("Fetch expenses error:", error);
    res.status(500).json({ error: "Failed to fetch custody expenses" });
  }
});

router.post("/api/treasury/custodies/:id/expenses", authenticateToken, async (req, res) => {
  const {
    expense_date,
    description,
    category,
    amount,
    tax_amount,
    account_id,
    cost_center_id,
    supplier_name,
    invoice_number,
    payment_method,
    receipt_attachment_url,
    notes
  } = req.body;

  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody not found");
    if (['closed', 'canceled'].includes(custody.status)) {
      throw new Error("لا يمكن إضافة مصروفات على عهدة مغلقة أو ملغاة");
    }

    const expAmount = parseFloat(amount) || 0;
    const countRes = await client.query("SELECT COUNT(*)::integer as count FROM treasury_custody_expenses WHERE custody_id = $1", [custody.id]);
    const expNum = `EXP-${(countRes.rows[0].count + 1).toString().padStart(3, '0')}`;

    const expResult = await client.query(`
      INSERT INTO treasury_custody_expenses
      (custody_id, expense_number, expense_date, description, category, amount, tax_amount, account_id, cost_center_id, 
       supplier_name, invoice_number, payment_method, receipt_attachment_url, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *
    `, [
      custody.id,
      expNum,
      expense_date || new Date().toISOString().split('T')[0],
      description || "بند مصروفات",
      category || "نثريات ومشتريات",
      expAmount,
      parseFloat(tax_amount) || 0,
      account_id ? parseInt(account_id) : null,
      cost_center_id ? parseInt(cost_center_id) : (custody.cost_center_id || null),
      supplier_name || "",
      invoice_number || "",
      payment_method || "نقدي",
      receipt_attachment_url || "",
      notes || "",
      userId
    ]);

    // Recalculate spent and remaining amount on custody
    const sumRes = await client.query("SELECT COALESCE(SUM(amount), 0)::float as total_spent FROM treasury_custody_expenses WHERE custody_id = $1", [custody.id]);
    const totalSpent = sumRes.rows[0]?.total_spent || 0;
    const custodyOrig = parseFloat(custody.amount) || 0;
    const remaining = Math.max(0, custodyOrig - totalSpent);
    const additionalDue = totalSpent > custodyOrig ? (totalSpent - custodyOrig) : 0;

    await client.query(`
      UPDATE treasury_custodies 
      SET spent_amount = $1, remaining_amount = $2, additional_due_amount = $3, updated_at = NOW() 
      WHERE id = $4
    `, [totalSpent, remaining, additionalDue, custody.id]);

    await logCustodyAudit(
      client, 
      custody.id, 
      "add_expense", 
      custody.status, 
      custody.status, 
      { expense_number: expNum, amount: expAmount, description }, 
      userId, 
      userName
    );

    await client.query("COMMIT");
    res.json(expResult.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Add expense error:", error);
    res.status(500).json({ error: error.message || "Failed to add expense" });
  } finally {
    client.release();
  }
});

router.delete("/api/treasury/custodies/:id/expenses/:expId", authenticateToken, async (req, res) => {
  const userId = (req as any).user?.id || 1;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody not found");
    if (['closed', 'canceled'].includes(custody.status)) throw new Error("لا يمكن حذف مصروف لعهدة مغلقة");

    await client.query("DELETE FROM treasury_custody_expenses WHERE id = $1 AND custody_id = $2", [req.params.expId, req.params.id]);

    // Recalculate spent
    const sumRes = await client.query("SELECT COALESCE(SUM(amount), 0)::float as total_spent FROM treasury_custody_expenses WHERE custody_id = $1", [custody.id]);
    const totalSpent = sumRes.rows[0]?.total_spent || 0;
    const custodyOrig = parseFloat(custody.amount) || 0;
    const remaining = Math.max(0, custodyOrig - totalSpent);
    const additionalDue = totalSpent > custodyOrig ? (totalSpent - custodyOrig) : 0;

    await client.query(`
      UPDATE treasury_custodies 
      SET spent_amount = $1, remaining_amount = $2, additional_due_amount = $3, updated_at = NOW() 
      WHERE id = $4
    `, [totalSpent, remaining, additionalDue, custody.id]);

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message || "Failed to delete expense" });
  } finally {
    client.release();
  }
});

// 7.15 CUSTODY ITEMS & FIXED ASSETS HANDOVER (تسليم واسترجاع الأصول)
router.get("/api/treasury/custodies/:id/items", authenticateToken, async (req, res) => {
  try {
    const items = (await pool.query(`
      SELECT ci.*, fa.name as linked_asset_name, fa.code as linked_asset_code
      FROM treasury_custody_items ci
      LEFT JOIN fixed_assets fa ON ci.asset_id = fa.id
      WHERE ci.custody_id = $1
      ORDER BY ci.id ASC
    `, [req.params.id])).rows;
    res.json(items);
  } catch (error) {
    console.error("Fetch items error:", error);
    res.status(500).json({ error: "Failed to fetch custody items" });
  }
});

router.post("/api/treasury/custodies/:id/items", authenticateToken, async (req, res) => {
  const { item_type, asset_id, item_name, item_code, serial_number, barcode, quantity, unit_cost, condition_on_issue, notes } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody not found");

    const qty = parseFloat(quantity) || 1;
    const cost = parseFloat(unit_cost) || 0;
    const totalVal = qty * cost;

    const result = await client.query(`
      INSERT INTO treasury_custody_items
      (custody_id, item_type, asset_id, item_name, item_code, serial_number, barcode, quantity, unit_cost, total_value, condition_on_issue, status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'assigned', $12) RETURNING *
    `, [
      custody.id,
      item_type || 'equipment',
      asset_id ? parseInt(asset_id) : null,
      item_name || 'بند عهدة',
      item_code || '',
      serial_number || '',
      barcode || '',
      qty,
      cost,
      totalVal,
      condition_on_issue || 'ممتازة',
      notes || ''
    ]);

    await logCustodyAudit(client, custody.id, "add_item", custody.status, custody.status, { item_name, quantity: qty }, userId, userName);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message || "Failed to add custody item" });
  } finally {
    client.release();
  }
});

// Return custody item / equipment
router.post("/api/treasury/custodies/:id/items/:itemId/return", authenticateToken, async (req, res) => {
  const { condition_on_return, return_notes } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      UPDATE treasury_custody_items 
      SET status = 'returned', returned_at = NOW(), condition_on_return = $1, notes = CONCAT(notes, ' - ملاحظات الاسترجاع: ', $2::text)
      WHERE id = $3 AND custody_id = $4 RETURNING *
    `, [condition_on_return || 'جيدة', return_notes || '', req.params.itemId, req.params.id]);

    await logCustodyAudit(client, parseInt(req.params.id), "return_item", "assigned", "returned", { item_id: req.params.itemId, condition: condition_on_return }, userId, userName);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message || "Failed to return custody item" });
  } finally {
    client.release();
  }
});

// 7.16 CUSTODY SETTLEMENT & CLEARANCE (التسوية والتصفية المالية الشاملة)
router.post("/api/treasury/custodies/:id/settle", authenticateToken, async (req, res) => {
  const {
    settlement_type, // 'full', 'partial', 'replenish'
    returned_to_treasury,
    additional_paid_to_employee,
    treasury_account_id,
    notes,
    settlement_expenses // array of new or approved expenses
  } = req.body;

  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody record not found");
    if (!['active', 'issued', 'pending_settlement', 'overdue', 'paid'].includes(custody.status)) {
      throw new Error("يمكن تصفية العهد النشطة والمصروفة فقط");
    }

    const targetSafeId = treasury_account_id || custody.account_id;
    const year = new Date().getFullYear();

    // 1. Calculate Expenses Total
    const expRes = await client.query("SELECT COALESCE(SUM(amount), 0)::float as total FROM treasury_custody_expenses WHERE custody_id = $1", [custody.id]);
    const totalExpenses = expRes.rows[0]?.total || 0;

    const parsedReturned = parseFloat(returned_to_treasury) || 0;
    const parsedAdditional = parseFloat(additional_paid_to_employee) || 0;
    const origAmount = parseFloat(custody.amount) || 0;

    let receiptVoucher = null;
    let paymentVoucher = null;

    // 2. Handle Cash Returned to Treasury
    if (parsedReturned > 0 && targetSafeId) {
      const account = (await client.query("SELECT current_balance, name FROM treasury_accounts WHERE id = $1", [targetSafeId])).rows[0];
      if (!account) throw new Error("خزينة الاسترداد غير موجودة");

      receiptVoucher = await generateTreasuryVoucherNumber(client, "receipt", year);
      const balanceBefore = Number(account.current_balance);
      const balanceAfter = balanceBefore + parsedReturned;

      await client.query(`
        INSERT INTO treasury_transactions 
        (account_id, amount, transaction_type, notes, created_by, status, voucher_number, voucher_type, balance_before, balance_after, reference_type, reference_id)
        VALUES ($1, $2, 'cash_in', $3, $4, 'approved', $5, 'receipt', $6, $7, 'custody_settlement', $8)
      `, [
        targetSafeId,
        parsedReturned,
        `استرداد المتبقي من العهدة رقم ${custody.custody_number || custody.id} - تسوية نهائية`,
        userId,
        receiptVoucher,
        balanceBefore,
        balanceAfter,
        custody.id
      ]);

      await client.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [parsedReturned, targetSafeId]);
    }

    // 3. Handle Additional Payment to Employee (إذا كانت المصروفات أكبر من العهدة)
    if (parsedAdditional > 0 && targetSafeId) {
      const account = (await client.query("SELECT current_balance, name FROM treasury_accounts WHERE id = $1", [targetSafeId])).rows[0];
      if (account && Number(account.current_balance) >= parsedAdditional) {
        paymentVoucher = await generateTreasuryVoucherNumber(client, "payment", year);
        const balanceBefore = Number(account.current_balance);
        const balanceAfter = balanceBefore - parsedAdditional;

        await client.query(`
          INSERT INTO treasury_transactions 
          (account_id, amount, transaction_type, notes, created_by, status, voucher_number, voucher_type, balance_before, balance_after, reference_type, reference_id)
          VALUES ($1, $2, 'cash_out', $3, $4, 'approved', $5, 'payment', $6, $7, 'custody_reimbursement', $8)
        `, [
          targetSafeId,
          -parsedAdditional,
          `صرف فروق تسوية عهدة مستحقة للموظف - عهدة ${custody.custody_number || custody.id}`,
          userId,
          paymentVoucher,
          balanceBefore,
          balanceAfter,
          custody.id
        ]);

        await client.query("UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2", [parsedAdditional, targetSafeId]);
      }
    }

    // 4. Generate Settlement Number: SET-YYYY-XXXX
    const setSeqRes = await client.query(
      "SELECT COUNT(*)::integer as count FROM treasury_custody_settlements WHERE EXTRACT(YEAR FROM created_at) = $1",
      [year]
    );
    const setNumber = `SET-${year}-${(setSeqRes.rows[0].count + 1).toString().padStart(4, '0')}`;

    // 5. Post General Ledger Closing Journal Entry
    let journalEntryId = null;
    try {
      const emp = (await client.query("SELECT name FROM employees WHERE id = $1", [custody.employee_id])).rows[0];
      const empName = emp ? emp.name : "الموظف";
      
      const glConfig = await getAccountConfig();
      const period = await getOpenPeriod();
      const advanceAccountId = Number(glConfig.employee_advances || glConfig.accounts_receivable);
      const expenseAccountId = Number(glConfig.cost_expense || glConfig.operating_expense);
      const cashAccountId = Number(glConfig.cash);
      if (!advanceAccountId || !expenseAccountId || !cashAccountId) {
        throw new Error("لم يتم تكوين حسابات العهد والمصروفات والخزينة في إعدادات الحسابات العامة");
      }

      // Balanced settlement: clear the employee custody balance against the expenses consumed,
      // the cash returned to the treasury and any difference paid to the employee.
      const settlementLegs = [
        { account_id: expenseAccountId, debit: Number(totalExpenses) || 0, credit: 0, notes: `إثبات مصروفات عهدة ${empName}` },
        { account_id: cashAccountId, debit: parsedReturned, credit: 0, notes: `استرجاع نقدية متبقية من عهدة ${empName}` },
        { account_id: expenseAccountId, debit: parsedAdditional, credit: 0, notes: `فروق تسوية مدفوعة للموظف ${empName}` },
        { account_id: advanceAccountId, debit: 0, credit: (Number(totalExpenses) || 0) + parsedReturned, notes: `تصفية رصيد عهدة ${empName}` },
        { account_id: cashAccountId, debit: 0, credit: parsedAdditional, notes: `صرف فروق تسوية للموظف ${empName}` },
      ].filter(leg => leg.debit > 0 || leg.credit > 0);

      const settlementDebit = settlementLegs.reduce((sum, leg) => sum + leg.debit, 0);
      const settlementCredit = settlementLegs.reduce((sum, leg) => sum + leg.credit, 0);

      if (settlementDebit > 0 && Math.abs(settlementDebit - settlementCredit) < 0.001) {
        const safeBranch = targetSafeId
          ? (await client.query("SELECT branch_id FROM treasury_accounts WHERE id = $1", [targetSafeId])).rows[0]?.branch_id
          : null;
        const jeRes = await client.query(`
          INSERT INTO journal_entries (date, description, reference, source_type, source_id, status, total_debit, total_credit, created_by, branch_id, period_id)
          VALUES (CURRENT_DATE, $1, $2, 'custody_settlement', $3, 'posted', $4, $5, $6, $7, $8) RETURNING id
        `, [
          `قيد تسوية وإقفال عهدة الموظف ${empName} - سند ${setNumber}`,
          setNumber,
          custody.id,
          settlementDebit,
          settlementCredit,
          userId,
          safeBranch || null,
          period?.id ?? null
        ]);

        if (jeRes.rows.length > 0) {
          journalEntryId = jeRes.rows[0].id;
          for (const leg of settlementLegs) {
            await client.query(`
              INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
              VALUES ($1, $2, $3, $4, $5, $6)
            `, [journalEntryId, leg.account_id, leg.debit, leg.credit, leg.notes, custody.cost_center_id]);
          }
        }
      }
    } catch (e) {
      console.log("Settlement GL posting notice:", e);
    }

    // 6. Insert Settlement Record
    const settlementResult = await client.query(`
      INSERT INTO treasury_custody_settlements
      (settlement_number, custody_id, settlement_date, total_expenses, returned_to_treasury, additional_paid_to_employee, 
       settlement_type, treasury_account_id, status, notes, reviewed_by, approved_by, journal_entry_id, created_by)
      VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, 'approved', $8, $9, $9, $10, $9) RETURNING *
    `, [
      setNumber,
      custody.id,
      totalExpenses,
      parsedReturned,
      parsedAdditional,
      settlement_type || 'full',
      targetSafeId,
      notes || "تسوية وتصفية العهدة",
      userId,
      journalEntryId
    ]);

    // 7. Update Custody Status
    const newStatus = settlement_type === 'partial' ? 'partially_settled' : 'closed';
    const updatedCustody = (await client.query(`
      UPDATE treasury_custodies 
      SET status = $1, 
          spent_amount = $2, 
          returned_amount = returned_amount + $3, 
          additional_due_amount = $4,
          remaining_amount = 0,
          cleared_amount = $2,
          clearance_notes = $5,
          cleared_at = NOW(),
          closed_by = $6,
          closed_at = NOW(),
          updated_at = NOW()
      WHERE id = $7 RETURNING *
    `, [
      newStatus,
      totalExpenses,
      parsedReturned,
      parsedAdditional,
      notes || "تمت التسوية",
      userId,
      custody.id
    ])).rows[0];

    await logCustodyAudit(
      client, 
      custody.id, 
      "settle_and_close", 
      custody.status, 
      newStatus, 
      { 
        settlement_number: setNumber, 
        total_expenses: totalExpenses, 
        returned: parsedReturned, 
        additional: parsedAdditional 
      }, 
      userId, 
      userName
    );

    await client.query("COMMIT");
    res.json({
      success: true,
      settlement: settlementResult.rows[0],
      custody: updatedCustody
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Settle custody error:", error);
    res.status(500).json({ error: error.message || "Failed to settle custody" });
  } finally {
    client.release();
  }
});

// Backward-compatible Clearance Route
router.post("/api/treasury/custodies/:id/clear", authenticateToken, async (req, res) => {
  const { cleared_amount, returned_amount, clearance_notes } = req.body;
  const userId = (req as any).user?.id || 1;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody record not found");

    const parsedCleared = parseFloat(cleared_amount) || 0;
    const parsedReturned = parseFloat(returned_amount) || 0;

    // Return unspent cash to Treasury
    if (parsedReturned > 0 && custody.account_id) {
      const account = (await client.query("SELECT current_balance FROM treasury_accounts WHERE id = $1", [custody.account_id])).rows[0];
      if (account) {
        const balanceBefore = Number(account.current_balance);
        const balanceAfter = balanceBefore + parsedReturned;
        const year = new Date().getFullYear();
        const voucherNum = await generateTreasuryVoucherNumber(client, "receipt", year);

        await client.query(`
          INSERT INTO treasury_transactions 
          (account_id, amount, transaction_type, notes, created_by, status, voucher_number, voucher_type, balance_before, balance_after)
          VALUES ($1, $2, 'cash_in', $3, $4, 'approved', $5, 'receipt', $6, $7)
        `, [
          custody.account_id, 
          parsedReturned, 
          `استرداد المتبقي من العهدة المالية للموظف - تصفية العهدة رقم ${custody.custody_number || custody.id}`, 
          userId, 
          voucherNum, 
          balanceBefore, 
          balanceAfter
        ]);

        await client.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [parsedReturned, custody.account_id]);
      }
    }

    // Update custody state
    const result = await client.query(
      `UPDATE treasury_custodies 
       SET status = 'closed', cleared_amount = $1, spent_amount = $1, returned_amount = $2, remaining_amount = 0, clearance_notes = $3, cleared_at = NOW(), closed_at = NOW(), closed_by = $4, updated_at = NOW() 
       WHERE id = $5 RETURNING *`,
      [parsedCleared, parsedReturned, clearance_notes || "تصفية العهدة", userId, req.params.id]
    );

    await logCustodyAudit(client, custody.id, "clear_custody", custody.status, "closed", { cleared: parsedCleared, returned: parsedReturned }, userId);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Clear custody error:", error);
    res.status(500).json({ error: error.message || "Failed to clear custody" });
  } finally {
    client.release();
  }
});

// 7.17 EXTEND CUSTODY DUE DATE (تمديد فترة الاستحقاق)
router.post("/api/treasury/custodies/:id/extend", authenticateToken, async (req, res) => {
  const { new_due_date, extension_days, reason } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const custody = (await client.query("SELECT * FROM treasury_custodies WHERE id = $1", [req.params.id])).rows[0];
    if (!custody) throw new Error("Custody not found");

    let finalDueDate = new_due_date;
    if (!finalDueDate && extension_days) {
      const current = custody.due_date ? new Date(custody.due_date) : new Date();
      current.setDate(current.getDate() + parseInt(extension_days));
      finalDueDate = current.toISOString().split('T')[0];
    }

    const result = await client.query(`
      UPDATE treasury_custodies 
      SET due_date = $1, 
          notes = CONCAT(notes, ' - تم تمديد الاستحقاق إلى ', $1::text, ' لسبب: ', $2::text), 
          updated_at = NOW()
      WHERE id = $3 RETURNING *
    `, [finalDueDate, reason || "طلب الموظف", req.params.id]);

    await logCustodyAudit(client, custody.id, "extend_due_date", custody.status, custody.status, { old_due: custody.due_date, new_due: finalDueDate, reason }, userId, userName);
    await client.query("COMMIT");
    res.json(result.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: error.message || "Failed to extend custody" });
  } finally {
    client.release();
  }
});

// 7.18 SEND REMINDER TO EMPLOYEE (إرسال تنبيه للموظف لتسوية العهدة)
router.post("/api/treasury/custodies/:id/send-reminder", authenticateToken, async (req, res) => {
  const { channel, custom_message } = req.body;
  const userId = (req as any).user?.id || 1;
  const userName = (req as any).user?.username || "admin";
  try {
    const custody = (await pool.query(`
      SELECT c.*, e.name as employee_name, e.phone as employee_phone
      FROM treasury_custodies c
      LEFT JOIN employees e ON c.employee_id = e.id
      WHERE c.id = $1
    `, [req.params.id])).rows[0];

    if (!custody) return res.status(404).json({ error: "العهدة غير موجودة" });

    // Log reminder in audit log
    await pool.query(`
      INSERT INTO treasury_custody_audit_logs (custody_id, action_type, old_status, new_status, details, user_id, user_name)
      VALUES ($1, 'send_reminder', $2, $2, $3, $4, $5)
    `, [
      custody.id,
      custody.status,
      JSON.stringify({
        channel: channel || 'sms',
        recipient: custody.employee_name,
        phone: custody.employee_phone,
        message: custom_message || `عزيزي الموظف ${custody.employee_name}، يرجى التكرم بتقديم فواتير ومستندات تسوية العهدة رقم ${custody.custody_number || custody.id}`
      }),
      userId,
      userName
    ]);

    res.json({
      success: true,
      message: `تم إرسال التنبيه بنجاح للموظف ${custody.employee_name}`,
      phone: custody.employee_phone
    });
  } catch (error) {
    console.error("Send reminder error:", error);
    res.status(500).json({ error: "Failed to send reminder" });
  }
});

// 7.19 ATTACHMENTS (رفع مستندات وتفويضات العهدة)
router.post("/api/treasury/custodies/:id/attachments", authenticateToken, async (req, res) => {
  const { title, file_url, file_name, file_type, file_size } = req.body;
  const userId = (req as any).user?.id || 1;
  try {
    const result = await pool.query(`
      INSERT INTO treasury_custody_attachments (custody_id, title, file_url, file_name, file_type, file_size, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [
      req.params.id,
      title || file_name || "مرفق عهدة",
      file_url,
      file_name || "document.pdf",
      file_type || "application/pdf",
      parseInt(file_size) || 0,
      userId
    ]);
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Upload attachment error:", error);
    res.status(500).json({ error: "Failed to save attachment" });
  }
});

router.delete("/api/treasury/custodies/:id/attachments/:attId", authenticateToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM treasury_custody_attachments WHERE id = $1 AND custody_id = $2", [req.params.attId, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

// 8. TREASURY CONFIG SETTINGS (الإعدادات)
router.get("/api/treasury/settings", authenticateToken, async (req, res) => {
  try {
    const settings = (await pool.query("SELECT * FROM treasury_settings")).rows;
    res.json(settings);
  } catch (error) {
    console.error("Fetch settings error:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.post("/api/treasury/settings", authenticateToken, async (req, res) => {
  const { settings } = req.body; // Array of { key, value, description }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of settings) {
      await client.query(
        `INSERT INTO treasury_settings (key, value, description) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description`,
        [item.key, item.value, item.description || ""]
      );
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Save settings error:", error);
    res.status(500).json({ error: "Failed to save settings" });
  } finally {
    client.release();
  }
});

// 9. AUDIT TRAIL LOGS (سجل كامل لجميع الحركات)
router.get("/api/treasury/audit-logs", authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT l.*, u.username as user_name, a.name as account_name
      FROM treasury_audit_logs l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN treasury_accounts a ON l.account_id = a.id
      ORDER BY l.created_at DESC
      LIMIT 100
    `;
    const logs = (await pool.query(query)).rows;
    res.json(logs);
  } catch (error) {
    console.error("Fetch audit logs error:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

export default router;
