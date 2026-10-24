import { Router } from "express";
import { pool } from "../../server-db.js";
import { ERPEventBus } from "../../server-erp-core.js";
import { generateTreasuryVoucherNumber } from "./services/treasury-voucher.service.js";

const router = Router();

// Standard supported denominations for Cash Counting
export const CASH_DENOMINATIONS = [
  { value: 200, label_ar: "200 جنيه", label_en: "200 EGP", type: "banknote" },
  { value: 100, label_ar: "100 جنيه", label_en: "100 EGP", type: "banknote" },
  { value: 50, label_ar: "50 جنيه", label_en: "50 EGP", type: "banknote" },
  { value: 20, label_ar: "20 جنيه", label_en: "20 EGP", type: "banknote" },
  { value: 10, label_ar: "10 جنيه", label_en: "10 EGP", type: "banknote" },
  { value: 5, label_ar: "5 جنيه", label_en: "5 EGP", type: "banknote" },
  { value: 1, label_ar: "1 جنيه (ورقي/معدني)", label_en: "1 EGP", type: "coin_or_bill" },
  { value: 0.5, label_ar: "50 قرش / نصف جنيه", label_en: "0.50 EGP", type: "coin" },
];

// Helper to authenticate token
const authenticateToken = (req: any, res: any, next: any) => {
  // If globalApiSecurityMiddleware already attached req.user, proceed
  if (req.user) {
    return next();
  }
  // Default fallback user for offline / test preview
  req.user = { id: 1, username: "admin", role: "admin", permissions: { all: true } };
  next();
};

/**
 * Helper: Calculate physical cash total from denomination breakdown object
 */
function calculateActualCash(denominations: Record<string, number> | any[]): number {
  if (!denominations) return 0;
  
  if (Array.isArray(denominations)) {
    return denominations.reduce((sum: number, item: any) => {
      const denom = Number(item.denomination || item.value || 0);
      const count = Number(item.count || item.quantity || 0);
      return sum + (denom * count);
    }, 0);
  }

  let total = 0;
  for (const [denomStr, countVal] of Object.entries(denominations)) {
    const denom = parseFloat(denomStr);
    const count = Number(countVal) || 0;
    if (!isNaN(denom) && count > 0) {
      total += denom * count;
    }
  }
  return Math.round(total * 100) / 100;
}

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 1. GET /api/treasury/current-status/:treasuryId
 * Retrieves current book balance, today's opening balance, deposits, withdrawals
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.get("/api/treasury/current-status/:treasuryId", authenticateToken, async (req, res) => {
  try {
    const treasuryId = Number(req.params.treasuryId);
    if (!treasuryId || isNaN(treasuryId)) {
      return res.status(400).json({ error: "INVALID_TREASURY_ID", message: "معرف الخزينة غير صالح" });
    }

    // 1. Fetch treasury account info
    const accountRes = await pool.query(
      `SELECT a.*, b.name as branch_name 
       FROM treasury_accounts a 
       LEFT JOIN branches b ON a.branch_id = b.id 
       WHERE a.id = $1`,
      [treasuryId]
    );

    if (accountRes.rows.length === 0) {
      return res.status(404).json({ error: "TREASURY_NOT_FOUND", message: "الخزينة المحددة غير موجودة" });
    }

    const account = accountRes.rows[0];
    const today = new Date().toISOString().split("T")[0];

    // 2. Fetch today's approved movements for this treasury
    const flowsRes = await pool.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 AND (transaction_type != 'transfer' OR transaction_type IS NULL) THEN amount ELSE 0 END), 0)::numeric as regular_deposits,
        COALESCE(SUM(CASE WHEN amount < 0 AND (transaction_type != 'transfer' OR transaction_type IS NULL) THEN ABS(amount) ELSE 0 END), 0)::numeric as regular_withdrawals,
        COALESCE(SUM(CASE WHEN amount > 0 AND transaction_type = 'transfer' THEN amount ELSE 0 END), 0)::numeric as transfers_in,
        COALESCE(SUM(CASE WHEN amount < 0 AND transaction_type = 'transfer' THEN ABS(amount) ELSE 0 END), 0)::numeric as transfers_out
       FROM treasury_transactions 
       WHERE account_id = $1 AND (created_at::date = $2::date OR date = $2) AND status = 'approved'`,
      [treasuryId, today]
    );

    const flow = flowsRes.rows[0] || { regular_deposits: 0, regular_withdrawals: 0, transfers_in: 0, transfers_out: 0 };
    const totalDeposits = Number(flow.regular_deposits || 0) + Number(flow.transfers_in || 0);
    const totalWithdrawals = Number(flow.regular_withdrawals || 0) + Number(flow.transfers_out || 0);

    const currentBookBalance = Number(account.current_balance || 0);
    const calculatedOpeningBalance = Math.round((currentBookBalance - totalDeposits + totalWithdrawals) * 100) / 100;
    const openingBalance = Math.max(0, calculatedOpeningBalance);

    // 3. Fetch latest closing record
    const lastClosingRes = await pool.query(
      `SELECT * FROM treasury_closings 
       WHERE treasury_id = $1 
       ORDER BY closing_date DESC LIMIT 1`,
      [treasuryId]
    );

    const lastClosing = lastClosingRes.rows[0] || null;

    res.json({
      treasury_id: account.id,
      treasury_name: account.name,
      treasury_code: account.code || `SAFE-${account.id}`,
      branch_id: account.branch_id,
      branch_name: account.branch_name || "الفرع الرئيسي",
      currency: account.currency || "EGP",
      account_type: account.type || "safe",
      opening_balance: openingBalance,
      total_deposits: Math.round(totalDeposits * 100) / 100,
      total_withdrawals: Math.round(totalWithdrawals * 100) / 100,
      book_balance: currentBookBalance,
      last_closing_date: lastClosing ? lastClosing.closing_date : null,
      last_closing_status: lastClosing ? lastClosing.status : null,
      last_closing_variance: lastClosing ? Number(lastClosing.variance) : 0,
      is_active: account.is_active !== false,
      denominations_template: CASH_DENOMINATIONS
    });
  } catch (error: any) {
    console.error("Fetch treasury current status error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch treasury status" });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 2. POST /api/treasury/close
 * Receives treasury ID, denomination counts array/object, notes.
 * Computes book balance, actual counted cash, variance, and creates closing record.
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.post("/api/treasury/close", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      treasury_id,
      account_id,
      denominations = {},
      notes = "",
      custom_actual_balance,
      responsible_user: reqResponsibleUser
    } = req.body;

    const targetTreasuryId = Number(treasury_id || account_id);
    if (!targetTreasuryId || isNaN(targetTreasuryId)) {
      return res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "يجب اختيار الخزينة المراد إقفالها وجردها"
      });
    }

    const userId = (req as any).user?.id || 1;
    const responsibleUserName = reqResponsibleUser || (req as any).user?.username || (req as any).user?.name || "المسؤول المالي";

    await client.query("BEGIN");

    // 1. Fetch current treasury account details
    const accountRes = await client.query(
      `SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE`,
      [targetTreasuryId]
    );

    if (accountRes.rows.length === 0) {
      throw new Error("الخزينة المحددة غير موجودة في سجلات النظام");
    }

    const account = accountRes.rows[0];
    const today = new Date().toISOString().split("T")[0];

    // 2. Fetch today's transactions for this treasury
    const flowsRes = await client.query(
      `SELECT 
        COALESCE(SUM(CASE WHEN amount > 0 AND (transaction_type != 'transfer' OR transaction_type IS NULL) THEN amount ELSE 0 END), 0)::numeric as receipts,
        COALESCE(SUM(CASE WHEN amount < 0 AND (transaction_type != 'transfer' OR transaction_type IS NULL) THEN ABS(amount) ELSE 0 END), 0)::numeric as payments,
        COALESCE(SUM(CASE WHEN amount > 0 AND transaction_type = 'transfer' THEN amount ELSE 0 END), 0)::numeric as transfers_in,
        COALESCE(SUM(CASE WHEN amount < 0 AND transaction_type = 'transfer' THEN ABS(amount) ELSE 0 END), 0)::numeric as transfers_out
       FROM treasury_transactions 
       WHERE account_id = $1 AND (created_at::date = $2::date OR date = $2) AND status = 'approved'`,
      [targetTreasuryId, today]
    );

    const flow = flowsRes.rows[0] || { receipts: 0, payments: 0, transfers_in: 0, transfers_out: 0 };
    const totalDeposits = Number(flow.receipts || 0) + Number(flow.transfers_in || 0);
    const totalWithdrawals = Number(flow.payments || 0) + Number(flow.transfers_out || 0);

    const bookBalance = Math.round(Number(account.current_balance || 0) * 100) / 100;
    const openingBalance = Math.max(0, Math.round((bookBalance - totalDeposits + totalWithdrawals) * 100) / 100);

    // 3. Compute Actual Physical Cash from Denominations Breakdown
    let actualBalance = 0;
    let normalizedDenominations: Record<string, number> = {};

    if (custom_actual_balance !== undefined && custom_actual_balance !== null && Object.keys(denominations).length === 0) {
      actualBalance = Number(custom_actual_balance);
    } else {
      if (Array.isArray(denominations)) {
        denominations.forEach((item: any) => {
          const val = String(item.denomination || item.value);
          const count = Number(item.count || item.quantity || 0);
          normalizedDenominations[val] = count;
        });
        actualBalance = calculateActualCash(normalizedDenominations);
      } else {
        normalizedDenominations = { ...denominations };
        actualBalance = calculateActualCash(normalizedDenominations);
      }
    }

    actualBalance = Math.round(actualBalance * 100) / 100;

    // 4. Calculate Variance (actual_balance - book_balance)
    const variance = Math.round((actualBalance - bookBalance) * 100) / 100;

    // 5. Determine Status according to enterprise requirements
    let status: 'Matched' | 'Deficit - Pending Review' | 'Surplus - Pending Review' = 'Matched';
    if (variance < 0) {
      status = 'Deficit - Pending Review';
    } else if (variance > 0) {
      status = 'Surplus - Pending Review';
    }

    const closingDate = new Date().toISOString();

    // 6. Insert into treasury_closings table
    const insertRes = await client.query(
      `INSERT INTO treasury_closings (
        treasury_id,
        closing_date,
        opening_balance,
        total_deposits,
        total_withdrawals,
        book_balance,
        actual_balance,
        variance,
        responsible_user,
        responsible_user_id,
        status,
        notes,
        denominations,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        targetTreasuryId,
        closingDate,
        openingBalance,
        totalDeposits,
        totalWithdrawals,
        bookBalance,
        actualBalance,
        variance,
        responsibleUserName,
        userId,
        status,
        notes || (status === 'Matched' ? "إقفال اليومية ومطابقة الجرد الفعلي" : `إقفال اليومية مع وجود فروقات (${variance > 0 ? 'زيادة' : 'عجز'} ${Math.abs(variance)} ج.م)`),
        JSON.stringify(normalizedDenominations)
      ]
    );

    const closingRecord = insertRes.rows[0];

    // 7. Synchronize with legacy treasury_daily_closings for backward compatibility
    try {
      await client.query(
        `INSERT INTO treasury_daily_closings (
          account_id,
          opening_balance,
          receipts,
          payments,
          transfers_in,
          transfers_out,
          expected_balance,
          actual_balance,
          difference,
          status,
          notes,
          created_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'closed', $10, $11, $12)`,
        [
          targetTreasuryId,
          openingBalance,
          flow.receipts || 0,
          flow.payments || 0,
          flow.transfers_in || 0,
          flow.transfers_out || 0,
          bookBalance,
          actualBalance,
          variance,
          notes || "إقفال اليومية التلقائي",
          userId,
          closingDate
        ]
      );
    } catch (legacyErr) {
      console.warn("Legacy daily closings table sync notice:", legacyErr);
    }

    // 8. Insert Audit Log
    try {
      await client.query(
        `INSERT INTO treasury_audit_logs (account_id, action_type, old_values, new_values, user_id, user_name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          targetTreasuryId,
          "daily_closing_and_verification",
          JSON.stringify({ book_balance: bookBalance }),
          JSON.stringify({
            closing_id: closingRecord.id,
            actual_balance: actualBalance,
            variance: variance,
            status: status,
            responsible_user: responsibleUserName
          }),
          userId,
          responsibleUserName
        ]
      );
    } catch (_) {}

    // 9. Dispatch Event Bus Event
    try {
      ERPEventBus.getInstance().emitEvent("TreasuryClosingCreated", {
        closingId: closingRecord.id,
        treasuryId: targetTreasuryId,
        treasuryName: account.name,
        bookBalance,
        actualBalance,
        variance,
        status,
        responsibleUser: responsibleUserName,
        timestamp: closingDate
      });
    } catch (_) {}

    await client.query("COMMIT");

    // Return the response with calculation data and status
    res.status(201).json({
      success: true,
      message: status === 'Matched' 
        ? "تم إقفال اليومية ومطابقة النقدية بنجاح دون أي فروقات" 
        : `تم تسجيل إقفال اليومية وحفظ الفروقات (${status}) للمراجعة المالية`,
      closing: {
        ...closingRecord,
        treasury_name: account.name,
        treasury_code: account.code || `SAFE-${account.id}`,
        treasury_currency: account.currency || "EGP",
        denominations: normalizedDenominations
      },
      calculations: {
        opening_balance: openingBalance,
        total_deposits: totalDeposits,
        total_withdrawals: totalWithdrawals,
        book_balance: bookBalance,
        actual_balance: actualBalance,
        variance: variance,
        status: status
      }
    });

  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("POST /api/treasury/close error:", error);
    res.status(500).json({
      error: "CLOSING_FAILED",
      message: error.message || "فشل تنفيذ إقفال الخزينة والجرد الفعلي"
    });
  } finally {
    client.release();
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 3. GET /api/treasury/closings-archive
 * Retrieves historical closing records with pagination and filtering.
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.get("/api/treasury/closings-archive", authenticateToken, async (req, res) => {
  try {
    const {
      treasury_id,
      treasuryId,
      start_date,
      startDate,
      end_date,
      endDate,
      status,
      search,
      page = "1",
      limit = "10",
      sort_by = "closing_date",
      order = "DESC"
    } = req.query as any;

    const targetTreasuryId = treasury_id || treasuryId;
    const fromDate = start_date || startDate;
    const toDate = end_date || endDate;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    // Build conditions
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (targetTreasuryId && targetTreasuryId !== "all" && targetTreasuryId !== "") {
      conditions.push(`c.treasury_id = $${pIdx++}`);
      params.push(Number(targetTreasuryId));
    }

    if (fromDate && fromDate.trim() !== "") {
      conditions.push(`c.closing_date >= $${pIdx++}::timestamp`);
      params.push(`${fromDate.trim()} 00:00:00`);
    }

    if (toDate && toDate.trim() !== "") {
      conditions.push(`c.closing_date <= $${pIdx++}::timestamp`);
      params.push(`${toDate.trim()} 23:59:59`);
    }

    if (status && status !== "all" && status.trim() !== "") {
      conditions.push(`c.status = $${pIdx++}`);
      params.push(status.trim());
    }

    if (search && search.trim() !== "") {
      const searchPattern = `%${search.trim().toLowerCase()}%`;
      conditions.push(`(
        LOWER(c.responsible_user) LIKE $${pIdx} OR 
        LOWER(COALESCE(c.notes, '')) LIKE $${pIdx} OR 
        LOWER(s.name) LIKE $${pIdx} OR
        LOWER(COALESCE(s.code, '')) LIKE $${pIdx}
      )`);
      params.push(searchPattern);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // 1. Fetch Paginated Records
    const dataQuery = `
      SELECT 
        c.*,
        s.name as treasury_name,
        s.code as treasury_code,
        s.currency as treasury_currency,
        b.name as branch_name,
        u.username as creator_username,
        rev.username as reviewer_username
      FROM treasury_closings c
      JOIN treasury_accounts s ON c.treasury_id = s.id
      LEFT JOIN branches b ON s.branch_id = b.id
      LEFT JOIN users u ON c.responsible_user_id = u.id
      LEFT JOIN users rev ON c.reviewed_by = rev.id
      ${whereClause}
      ORDER BY c.closing_date DESC, c.id DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const queryParams = [...params, limitNum, offset];
    const closingsRes = await pool.query(dataQuery, queryParams);

    // 2. Count Total Records
    const countQuery = `
      SELECT COUNT(*)::integer as total_count
      FROM treasury_closings c
      JOIN treasury_accounts s ON c.treasury_id = s.id
      ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const totalCount = countRes.rows[0]?.total_count || 0;

    // 3. Compute Summary Statistics for Archive
    const statsQuery = `
      SELECT 
        COUNT(*)::integer as total_closings,
        COUNT(CASE WHEN c.status = 'Matched' THEN 1 END)::integer as matched_count,
        COUNT(CASE WHEN c.status LIKE '%Deficit%' OR c.variance < 0 THEN 1 END)::integer as deficit_count,
        COUNT(CASE WHEN c.status LIKE '%Surplus%' OR c.variance > 0 THEN 1 END)::integer as surplus_count,
        COALESCE(SUM(c.book_balance), 0)::numeric as total_book_amount,
        COALESCE(SUM(c.actual_balance), 0)::numeric as total_actual_amount,
        COALESCE(SUM(c.variance), 0)::numeric as total_variance_amount
      FROM treasury_closings c
      JOIN treasury_accounts s ON c.treasury_id = s.id
      ${whereClause}
    `;
    const statsRes = await pool.query(statsQuery, params);
    const stats = statsRes.rows[0] || {
      total_closings: 0,
      matched_count: 0,
      deficit_count: 0,
      surplus_count: 0,
      total_book_amount: 0,
      total_actual_amount: 0,
      total_variance_amount: 0
    };

    // Format output
    const formattedClosings = closingsRes.rows.map((row: any) => {
      let parsedDenominations = {};
      try {
        parsedDenominations = typeof row.denominations === "string" 
          ? JSON.parse(row.denominations) 
          : (row.denominations || {});
      } catch {
        parsedDenominations = {};
      }

      return {
        ...row,
        book_balance: Number(row.book_balance || 0),
        actual_balance: Number(row.actual_balance || 0),
        variance: Number(row.variance || 0),
        opening_balance: Number(row.opening_balance || 0),
        total_deposits: Number(row.total_deposits || 0),
        total_withdrawals: Number(row.total_withdrawals || 0),
        denominations: parsedDenominations
      };
    });

    res.json({
      success: true,
      closings: formattedClosings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      },
      summary: {
        total_closings: Number(stats.total_closings || 0),
        matched_count: Number(stats.matched_count || 0),
        deficit_count: Number(stats.deficit_count || 0),
        surplus_count: Number(stats.surplus_count || 0),
        total_book_amount: Number(stats.total_book_amount || 0),
        total_actual_amount: Number(stats.total_actual_amount || 0),
        total_variance_amount: Number(stats.total_variance_amount || 0)
      }
    });

  } catch (error: any) {
    console.error("GET /api/treasury/closings-archive error:", error);
    res.status(500).json({
      error: "ARCHIVE_FETCH_FAILED",
      message: error.message || "فشل جلب أرشيف إقفالات الخزينة"
    });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 4. GET /api/treasury/closings/:id
 * Retrieve details of a specific closing record by ID
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.get("/api/treasury/closings/:id", authenticateToken, async (req, res) => {
  try {
    const closingId = Number(req.params.id);
    if (!closingId || isNaN(closingId)) {
      return res.status(400).json({ error: "INVALID_ID", message: "معرف سجل الإقفال غير صالح" });
    }

    const query = `
      SELECT 
        c.*,
        s.name as treasury_name,
        s.code as treasury_code,
        s.currency as treasury_currency,
        b.name as branch_name,
        u.username as creator_username,
        rev.username as reviewer_username
      FROM treasury_closings c
      JOIN treasury_accounts s ON c.treasury_id = s.id
      LEFT JOIN branches b ON s.branch_id = b.id
      LEFT JOIN users u ON c.responsible_user_id = u.id
      LEFT JOIN users rev ON c.reviewed_by = rev.id
      WHERE c.id = $1
    `;

    const result = await pool.query(query, [closingId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "NOT_FOUND", message: "سجل إقفال الخزينة غير موجود" });
    }

    const row = result.rows[0];
    let parsedDenominations = {};
    try {
      parsedDenominations = typeof row.denominations === "string" 
        ? JSON.parse(row.denominations) 
        : (row.denominations || {});
    } catch {
      parsedDenominations = {};
    }

    res.json({
      ...row,
      book_balance: Number(row.book_balance || 0),
      actual_balance: Number(row.actual_balance || 0),
      variance: Number(row.variance || 0),
      opening_balance: Number(row.opening_balance || 0),
      total_deposits: Number(row.total_deposits || 0),
      total_withdrawals: Number(row.total_withdrawals || 0),
      denominations: parsedDenominations
    });
  } catch (error: any) {
    console.error("GET closing by id error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch closing details" });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 5. POST /api/treasury/closings/:id/review
 * Financial supervisor review / approval / settlement of variance
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.post("/api/treasury/closings/:id/review", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const closingId = Number(req.params.id);
    const { action = "approve", review_notes = "", post_adjustment = false } = req.body;
    const userId = (req as any).user?.id || 1;
    const reviewerName = (req as any).user?.username || "المشرف المالي";

    await client.query("BEGIN");

    const closingRes = await client.query("SELECT * FROM treasury_closings WHERE id = $1 FOR UPDATE", [closingId]);
    if (closingRes.rows.length === 0) {
      throw new Error("سجل الإقفال غير موجود");
    }

    const closing = closingRes.rows[0];
    let newStatus = closing.status;

    if (action === "approve" || action === "settle") {
      newStatus = "Settled";
    } else if (action === "reopen") {
      newStatus = "Reopened";
    }

    // Update closing record
    const updateRes = await client.query(
      `UPDATE treasury_closings
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [newStatus, userId, review_notes || `تمت المراجعة والاعتماد بواسطة ${reviewerName}`, closingId]
    );

    // If requested to post adjustment transaction to reconcile ledger
    if (post_adjustment && Number(closing.variance) !== 0) {
      const variance = Number(closing.variance);
      const voucherType = variance > 0 ? "receipt" : "payment";
      const typeLabel = variance > 0 ? "تسوية زيادة جرد نقدية" : "تسوية عجز جرد نقدية";
      const year = new Date().getFullYear();
      const voucherNum = await generateTreasuryVoucherNumber(client, voucherType, year);

      await client.query(
        `INSERT INTO treasury_transactions 
         (account_id, amount, transaction_type, notes, created_by, status, voucher_number, voucher_type, balance_before, balance_after)
         VALUES ($1, $2, 'adjustment', $3, $4, 'approved', $5, $6, $7, $8)`,
        [
          closing.treasury_id,
          variance,
          `${typeLabel} - اعتماد إقفال اليومية رقم #${closing.id}`,
          userId,
          voucherNum,
          voucherType,
          closing.book_balance,
          closing.actual_balance
        ]
      );

      // Reconcile treasury account balance
      await client.query(
        "UPDATE treasury_accounts SET current_balance = $1 WHERE id = $2",
        [closing.actual_balance, closing.treasury_id]
      );
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "تمت مراجعة واعتماد إقفال الخزينة بنجاح",
      closing: updateRes.rows[0]
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Review closing error:", error);
    res.status(500).json({ error: error.message || "Failed to review closing" });
  } finally {
    client.release();
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 6. GET /api/treasury/pre-closing-check/:treasuryId
 * Inspects unapproved transactions, pending transfers, and locks before closing
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.get("/api/treasury/pre-closing-check/:treasuryId", authenticateToken, async (req, res) => {
  try {
    const treasuryId = Number(req.params.treasuryId);
    if (!treasuryId || isNaN(treasuryId)) {
      return res.status(400).json({ error: "INVALID_ID", message: "معرف الخزينة غير صالح" });
    }

    const today = new Date().toISOString().split("T")[0];

    // 1. Check pending vouchers (unapproved receipts or payments)
    const pendingVouchersRes = await pool.query(
      `SELECT COUNT(*)::integer as count 
       FROM treasury_transactions 
       WHERE account_id = $1 AND status = 'pending'`,
      [treasuryId]
    );
    const pendingVouchersCount = pendingVouchersRes.rows[0]?.count || 0;

    // 2. Check pending transfers
    const pendingTransfersRes = await pool.query(
      `SELECT COUNT(*)::integer as count 
       FROM treasury_transactions 
       WHERE account_id = $1 AND transaction_type = 'transfer' AND status = 'pending'`,
      [treasuryId]
    );
    const pendingTransfersCount = pendingTransfersRes.rows[0]?.count || 0;

    // 3. Check if today is already closed
    const todayClosingRes = await pool.query(
      `SELECT * FROM treasury_closings 
       WHERE treasury_id = $1 AND closing_date::date = $2::date AND status != 'Reopened'
       ORDER BY closing_date DESC LIMIT 1`,
      [treasuryId, today]
    );
    const isTodayClosed = todayClosingRes.rows.length > 0;

    // 4. Build checklist array
    const checklist: Array<{
      key: string;
      title_ar: string;
      is_blocking: boolean;
      status: 'pass' | 'fail' | 'warning';
      count: number;
      message: string;
    }> = [];

    // Voucher check
    checklist.push({
      key: "pending_vouchers",
      title_ar: "سندات ومقبوضات/مدفوعات قيد الانتظار",
      is_blocking: true,
      status: pendingVouchersCount === 0 ? "pass" : "fail",
      count: pendingVouchersCount,
      message: pendingVouchersCount === 0 
        ? "جميع السندات المكتوبة معتمدة بنجاح" 
        : `يوجد ${pendingVouchersCount} سند مالية غير معتمدة تتطلب الاعتماد أولاً`
    });

    // Transfer check
    checklist.push({
      key: "pending_transfers",
      title_ar: "تحويلات مالية معلقة بين الخزائن",
      is_blocking: true,
      status: pendingTransfersCount === 0 ? "pass" : "fail",
      count: pendingTransfersCount,
      message: pendingTransfersCount === 0 
        ? "لا توجد تحويلات معلقة" 
        : `يوجد ${pendingTransfersCount} تحويل مالي بانتظار التأكيد والاستلام`
    });

    // Duplicate closing check
    checklist.push({
      key: "today_closing_status",
      title_ar: "حالة إقفال اليومية السابق",
      is_blocking: true,
      status: !isTodayClosed ? "pass" : "warning",
      count: isTodayClosed ? 1 : 0,
      message: !isTodayClosed 
        ? "اليومية مفتوحة وجاهزة للإقفال والجرد" 
        : "تم تسجيل إقفال لهذه الخزينة اليوم بالفعل"
    });

    const isReadyToClose = checklist.every(item => !item.is_blocking || item.status === "pass");

    res.json({
      treasury_id: treasuryId,
      is_ready_to_close: isReadyToClose,
      pending_vouchers_count: pendingVouchersCount,
      pending_transfers_count: pendingTransfersCount,
      is_today_closed: isTodayClosed,
      checklist
    });
  } catch (error: any) {
    console.error("Pre-closing check error:", error);
    res.status(500).json({ error: error.message || "Failed pre-closing verification" });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 7. GET /api/treasury/pre-closing-ledger/:treasuryId
 * Retrieves today's detailed movements breakdown before daily closing
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.get("/api/treasury/pre-closing-ledger/:treasuryId", authenticateToken, async (req, res) => {
  try {
    const treasuryId = Number(req.params.treasuryId);
    if (!treasuryId || isNaN(treasuryId)) {
      return res.status(400).json({ error: "INVALID_ID", message: "معرف الخزينة غير صالح" });
    }

    const today = new Date().toISOString().split("T")[0];

    const query = `
      SELECT 
        t.id,
        t.voucher_number,
        t.voucher_type,
        t.amount,
        t.transaction_type,
        t.notes,
        t.status,
        t.created_at,
        t.balance_before,
        t.balance_after,
        u.username as created_by_name
      FROM treasury_transactions t
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.account_id = $1 AND (t.created_at::date = $2::date OR t.date = $2)
      ORDER BY t.created_at ASC
    `;

    const result = await pool.query(query, [treasuryId, today]);

    res.json({
      treasury_id: treasuryId,
      date: today,
      total_count: result.rows.length,
      transactions: result.rows.map((row: any) => ({
        ...row,
        amount: Number(row.amount || 0),
        balance_before: Number(row.balance_before || 0),
        balance_after: Number(row.balance_after || 0)
      }))
    });
  } catch (error: any) {
    console.error("Pre-closing ledger error:", error);
    res.status(500).json({ error: error.message || "Failed to fetch pre-closing ledger" });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 8. GET /api/treasury/variance-report
 * Analytical report of cash shortages & overages across treasuries & users
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.get("/api/treasury/variance-report", authenticateToken, async (req, res) => {
  try {
    const { branch_id, treasury_id, start_date, end_date } = req.query as any;

    const conditions: string[] = ["c.variance != 0"];
    const params: any[] = [];
    let pIdx = 1;

    if (branch_id && branch_id !== "all") {
      conditions.push(`s.branch_id = $${pIdx++}`);
      params.push(Number(branch_id));
    }

    if (treasury_id && treasury_id !== "all") {
      conditions.push(`c.treasury_id = $${pIdx++}`);
      params.push(Number(treasury_id));
    }

    if (start_date) {
      conditions.push(`c.closing_date >= $${pIdx++}::timestamp`);
      params.push(`${start_date} 00:00:00`);
    }

    if (end_date) {
      conditions.push(`c.closing_date <= $${pIdx++}::timestamp`);
      params.push(`${end_date} 23:59:59`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const query = `
      SELECT 
        c.id,
        c.closing_date,
        c.book_balance,
        c.actual_balance,
        c.variance,
        c.responsible_user,
        c.status,
        c.notes,
        c.review_notes,
        s.name as treasury_name,
        b.name as branch_name
      FROM treasury_closings c
      JOIN treasury_accounts s ON c.treasury_id = s.id
      LEFT JOIN branches b ON s.branch_id = b.id
      ${whereClause}
      ORDER BY c.closing_date DESC
    `;

    const result = await pool.query(query, params);

    // Compute aggregations
    let totalDeficit = 0;
    let totalSurplus = 0;
    const userBreakdown: Record<string, { user: string; deficit: number; surplus: number; count: number }> = {};

    result.rows.forEach((row: any) => {
      const v = Number(row.variance || 0);
      const user = row.responsible_user || "غير محدد";

      if (!userBreakdown[user]) {
        userBreakdown[user] = { user, deficit: 0, surplus: 0, count: 0 };
      }
      userBreakdown[user].count += 1;

      if (v < 0) {
        totalDeficit += Math.abs(v);
        userBreakdown[user].deficit += Math.abs(v);
      } else if (v > 0) {
        totalSurplus += v;
        userBreakdown[user].surplus += v;
      }
    });

    res.json({
      success: true,
      summary: {
        total_records: result.rows.length,
        total_deficit: Math.round(totalDeficit * 100) / 100,
        total_surplus: Math.round(totalSurplus * 100) / 100,
        net_variance: Math.round((totalSurplus - totalDeficit) * 100) / 100
      },
      user_breakdown: Object.values(userBreakdown),
      records: result.rows.map((r: any) => ({
        ...r,
        book_balance: Number(r.book_balance || 0),
        actual_balance: Number(r.actual_balance || 0),
        variance: Number(r.variance || 0)
      }))
    });
  } catch (error: any) {
    console.error("Variance report error:", error);
    res.status(500).json({ error: error.message || "Failed to generate variance report" });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * 9. POST /api/treasury/closings/:id/reopen
 * Reopens a closed session with reason logging and Audit Trail
 * ═════════════════════════════════════════════════════════════════════════════
 */
router.post("/api/treasury/closings/:id/reopen", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const closingId = Number(req.params.id);
    const { reason = "" } = req.body;
    const userId = (req as any).user?.id || 1;
    const userName = (req as any).user?.username || "المشرف المالي";

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        error: "REASON_REQUIRED",
        message: "يجب كتابة سبب رسمي يتكون من 5 أحرف على الأقل لإعادة فتح اليومية المغلقة"
      });
    }

    await client.query("BEGIN");

    const closingRes = await client.query("SELECT * FROM treasury_closings WHERE id = $1 FOR UPDATE", [closingId]);
    if (closingRes.rows.length === 0) {
      throw new Error("سجل الإقفال غير موجود");
    }

    const closing = closingRes.rows[0];

    // Update status to Reopened
    const updateRes = await client.query(
      `UPDATE treasury_closings
       SET status = 'Reopened', review_notes = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [`إعادة فتح اليومية بواسطة ${userName} — السبب: ${reason.trim()}`, closingId]
    );

    // Insert Audit Trail
    await client.query(
      `INSERT INTO treasury_audit_logs (account_id, action_type, old_values, new_values, user_id, user_name, created_at)
       VALUES ($1, 'reopen_closing', $2, $3, $4, $5, NOW())`,
      [
        closing.treasury_id,
        JSON.stringify({ status: closing.status }),
        JSON.stringify({ status: "Reopened", reopen_reason: reason.trim(), reopened_by: userName }),
        userId,
        userName
      ]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "تمت إعادة فتح يومية الخزينة بنجاح وتسجيل السبب في سجل التدقيق",
      closing: updateRes.rows[0]
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Reopen closing error:", error);
    res.status(500).json({ error: error.message || "فشل إعادة فتح يومية الخزينة" });
  } finally {
    client.release();
  }
});

export default router;

