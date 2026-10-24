import express from "express";
import { pool } from "../../server-db.js";
import { authenticateToken } from "../system/system_api.routes.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getAccountConfig, getOpenPeriod } from "../accounts/services/auto-posting.service.js";
import { periodGuardMiddleware } from "../accounts/services/period-guard.middleware.js";

const router = express.Router();
router.use(periodGuardMiddleware);

const DEFAULT_TRANSFER_TYPES = [
  ["TRF-SAFE-SAFE", "safe_to_safe", "تحويل بين الخزائن النقدية", "Safe to Safe Transfer", "safe", "safe", 100000],
  ["TRF-SAFE-BANK", "safe_to_bank", "إيداع نقدي من خزينة إلى بنك", "Safe to Bank Deposit", "safe", "bank", 500000],
  ["TRF-BANK-SAFE", "bank_to_safe", "سحب بنكي لتغذية الخزينة", "Bank Withdrawal to Safe", "bank", "safe", 300000],
  ["TRF-BANK-BANK", "bank_to_bank", "تحويل بنكي بين الحسابات المصرفية", "Bank to Bank Transfer", "bank", "bank", 1000000],
  ["TRF-BRANCH", "branch_transfer", "تحويل مالي بين الفروع", "Inter-Branch Transfer", "any", "any", 250000],
  ["TRF-COSTCENTER", "cost_center_transfer", "تحويل بين مراكز التكلفة", "Cost Center Transfer", "any", "any", 150000],
] as const;

async function ensureTreasuryTransferTypes(client: any): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS treasury_transfer_types (
      id SERIAL PRIMARY KEY,
      code VARCHAR(50) NOT NULL UNIQUE,
      name_ar VARCHAR(255) NOT NULL,
      name_en VARCHAR(255),
      source_type VARCHAR(50) DEFAULT 'any',
      destination_type VARCHAR(50) DEFAULT 'any',
      requires_receipt_confirmation BOOLEAN DEFAULT true,
      requires_approval BOOLEAN DEFAULT true,
      max_limit DECIMAL(15,2),
      is_active BOOLEAN DEFAULT true,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  for (const [code, , nameAr, nameEn, sourceType, destinationType, maxLimit] of DEFAULT_TRANSFER_TYPES) {
    await client.query(
      `INSERT INTO treasury_transfer_types
        (code, name_ar, name_en, source_type, destination_type, requires_receipt_confirmation, requires_approval, max_limit, is_active)
       VALUES ($1, $2, $3, $4, $5, true, true, $6, true)
       ON CONFLICT (code) DO NOTHING`,
      [code, nameAr, nameEn, sourceType, destinationType, maxLimit],
    );
  }
}

// Configure multer for transfer attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads", "transfers");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `transfer-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Helper to log audit trail
async function logTransferAudit(
  client: any,
  transferId: number,
  actionType: string,
  oldValues: any,
  newValues: any,
  userId: number,
  notes: string,
  req?: any
) {
  try {
    const ipAddress = req ? (req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "") : "";
    const userRes = await client.query("SELECT username, name FROM users WHERE id = $1", [userId]);
    const userName = userRes.rows[0]?.name || userRes.rows[0]?.username || "System";

    await client.query(
      `INSERT INTO treasury_transfer_audit_logs 
       (transfer_id, action_type, old_values, new_values, user_id, user_name, ip_address, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        transferId,
        actionType,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        userId,
        userName,
        ipAddress,
        notes
      ]
    );
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

// Helper: post the General Ledger entry for a money transfer.
// All treasury accounts share the same GL cash account, so both legs post there; any
// difference between the amount leaving the source and the amount credited to the
// destination is a transfer fee/rounding difference and goes to an expense account.
async function postTransferGlEntry(client: any, opts: {
  reference: string;
  description: string;
  sourceLabel: string;
  destinationLabel: string;
  amountOut: number;
  amountIn: number;
  sourceType?: string;
  sourceId?: number | null;
  branchId?: number | null;
  costCenterId?: number | null;
  createdBy?: number | null;
}): Promise<number | null> {
  const glConfig = await getAccountConfig();
  const cashAccountId = Number(glConfig.cash);
  const differenceAccountId = Number(glConfig.cost_expense || glConfig.operating_expense);
  if (!cashAccountId) return null;

  const amountIn = Math.abs(Number(opts.amountIn) || 0);
  const amountOut = Math.abs(Number(opts.amountOut) || 0);
  if (amountIn <= 0 && amountOut <= 0) return null;

  const legs: { account_id: number; debit: number; credit: number; notes: string }[] = [
    { account_id: cashAccountId, debit: amountIn, credit: 0, notes: `استلام ${opts.destinationLabel} — ${opts.reference}` },
    { account_id: cashAccountId, debit: 0, credit: amountOut, notes: `صرف ${opts.sourceLabel} — ${opts.reference}` },
  ];
  const difference = Number((amountOut - amountIn).toFixed(2));
  if (difference > 0 && differenceAccountId) {
    legs.push({ account_id: differenceAccountId, debit: difference, credit: 0, notes: `عمولة/فرق تحويل مالي — ${opts.reference}` });
  } else if (difference < 0 && differenceAccountId) {
    legs.push({ account_id: differenceAccountId, debit: 0, credit: Math.abs(difference), notes: `فرق تسوية تحويل مالي — ${opts.reference}` });
  }

  const totalDebit = legs.reduce((s, l) => s + l.debit, 0);
  const totalCredit = legs.reduce((s, l) => s + l.credit, 0);
  if (totalDebit <= 0 || Math.abs(totalDebit - totalCredit) > 0.001) {
    console.warn(`[TransferGL] Skipped unbalanced transfer entry ${opts.reference} (debit ${totalDebit} / credit ${totalCredit})`);
    return null;
  }

  const period = await getOpenPeriod();
  const periodId = period?.id ?? null;
  const jeRes = await client.query(
    `INSERT INTO journal_entries (date, description, reference, source_type, source_id, status, total_debit, total_credit, created_by, branch_id, period_id)
     VALUES (CURRENT_DATE, $1, $2, $3, $4, 'posted', $5, $6, $7, $8, $9) RETURNING id`,
    [
      opts.description,
      opts.reference,
      opts.sourceType || 'treasury_transfer',
      opts.sourceId ?? null,
      totalDebit,
      totalCredit,
      opts.createdBy ?? null,
      opts.branchId ?? null,
      periodId,
    ]
  );
  const journalEntryId = jeRes.rows[0]?.id ?? null;
  if (!journalEntryId) return null;

  for (const leg of legs) {
    await client.query(
      `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [journalEntryId, leg.account_id, leg.debit, leg.credit, leg.notes, opts.costCenterId ?? null]
    );
  }
  return journalEntryId;
}

// Helper to push notification
async function createTransferNotification(
  client: any,
  title: string,
  message: string,
  type: string = "transfer",
  targetUserId?: number,
  referenceId?: number
) {
  try {
    await client.query(
      `INSERT INTO notifications (title, message, type, user_id, reference_id, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, false, NOW())`,
      [title, message, type, targetUserId || null, referenceId || null]
    );
  } catch (err) {
    // Non-blocking notification
    console.log("Notification notice (non-blocking):", err);
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. DASHBOARD & KPIS
// ═══════════════════════════════════════════════════════════════
router.get(["/api/treasury/transfers/dashboard", "/api/treasury/transfers/kpi"], authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_transfers_count,
        COUNT(CASE WHEN DATE(transfer_date) = CURRENT_DATE THEN 1 END) as today_count,
        COALESCE(SUM(CASE WHEN DATE(transfer_date) = CURRENT_DATE THEN amount ELSE 0 END), 0) as today_amount,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_count,
        COUNT(CASE WHEN status = 'pending_approval' THEN 1 END) as pending_approval_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_count,
        COUNT(CASE WHEN status IN ('executed', 'in_transit') THEN 1 END) as executed_in_transit_count,
        COUNT(CASE WHEN status = 'pending_receipt' THEN 1 END) as pending_receipt_count,
        COUNT(CASE WHEN status IN ('completed', 'posted', 'received') THEN 1 END) as completed_posted_count,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
        COUNT(CASE WHEN status = 'reversed' THEN 1 END) as reversed_count,
        COALESCE(SUM(CASE WHEN status IN ('completed', 'posted', 'received', 'executed', 'pending_receipt') THEN amount ELSE 0 END), 0) as total_transferred_amount,
        COALESCE(SUM(transfer_fee), 0) as total_fees_amount
      FROM treasury_transfers
    `;
    const result = await pool.query(query);
    const kpi = result.rows[0] || {};
    
    // Parse numeric fields safely
    res.json({
      total_transfers_count: Number(kpi.total_transfers_count) || 0,
      today_count: Number(kpi.today_count) || 0,
      today_amount: parseFloat(kpi.today_amount) || 0,
      draft_count: Number(kpi.draft_count) || 0,
      pending_approval_count: Number(kpi.pending_approval_count) || 0,
      approved_count: Number(kpi.approved_count) || 0,
      executed_in_transit_count: Number(kpi.executed_in_transit_count) || 0,
      pending_receipt_count: Number(kpi.pending_receipt_count) || 0,
      completed_posted_count: Number(kpi.completed_posted_count) || 0,
      cancelled_count: Number(kpi.cancelled_count) || 0,
      reversed_count: Number(kpi.reversed_count) || 0,
      total_transferred_amount: parseFloat(kpi.total_transferred_amount) || 0,
      total_fees_amount: parseFloat(kpi.total_fees_amount) || 0
    });
  } catch (error) {
    console.error("Transfers Dashboard Error:", error);
    res.status(500).json({ error: "Failed to fetch transfers dashboard stats" });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. REPORTS & ADVANCED ANALYTICS
// ═══════════════════════════════════════════════════════════════
router.get("/api/treasury/transfers/reports", authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, status, transferType, sourceAccount, destinationAccount, accountId, branchId, costCenterId } = req.query;
    
    let whereClauses: string[] = ["1=1"];
    let params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      whereClauses.push(`t.transfer_date >= LEFT($${paramIndex}::text, 10)::date`);
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      whereClauses.push(`t.transfer_date < (LEFT($${paramIndex}::text, 10)::date + INTERVAL '1 day')`);
      params.push(endDate);
      paramIndex++;
    }
    if (accountId && accountId !== "all") {
      whereClauses.push(`(t.source_account_id = $${paramIndex} OR t.destination_account_id = $${paramIndex})`);
      params.push(Number(accountId));
      paramIndex++;
    }
    if (status && status !== "all") {
      whereClauses.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }
    if (transferType && transferType !== "all") {
      whereClauses.push(`(t.transfer_type = $${paramIndex} OR t.transfer_type_id::text = $${paramIndex})`);
      params.push(transferType);
      paramIndex++;
    }
    if (sourceAccount && sourceAccount !== "all") {
      whereClauses.push(`t.source_account_id = $${paramIndex}`);
      params.push(Number(sourceAccount));
      paramIndex++;
    }
    if (destinationAccount && destinationAccount !== "all") {
      whereClauses.push(`t.destination_account_id = $${paramIndex}`);
      params.push(Number(destinationAccount));
      paramIndex++;
    }
    if (branchId && branchId !== "all") {
      whereClauses.push(`(t.source_branch_id = $${paramIndex} OR t.destination_branch_id = $${paramIndex})`);
      params.push(Number(branchId));
      paramIndex++;
    }
    if (costCenterId && costCenterId !== "all") {
      whereClauses.push(`(t.source_cost_center_id = $${paramIndex} OR t.destination_cost_center_id = $${paramIndex})`);
      params.push(Number(costCenterId));
      paramIndex++;
    }

    const whereSql = whereClauses.join(" AND ");

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transfers,
        COALESCE(SUM(t.amount), 0) as total_amount,
        COALESCE(SUM(t.transfer_fee), 0) as total_fees,
        COALESCE(AVG(t.amount), 0) as avg_transfer_amount,
        COUNT(CASE WHEN t.status IN ('completed', 'posted', 'received') THEN 1 END) as completed_count,
        COALESCE(SUM(CASE WHEN t.status IN ('completed', 'posted', 'received') THEN t.amount ELSE 0 END), 0) as completed_amount
      FROM treasury_transfers t
      WHERE ${whereSql}
    `;
    const summaryRes = await pool.query(summaryQuery, params);

    const detailedQuery = `
      SELECT 
        t.*,
        sa.name as source_account_name, sa.type as source_account_type, sa.code as source_account_code,
        da.name as destination_account_name, da.type as destination_account_type, da.code as destination_account_code,
        tp.name_ar as transfer_type_name,
        sb.name as source_branch_name,
        db.name as destination_branch_name,
        sc.name as source_cost_center_name,
        dc.name as destination_cost_center_name,
        u.username as created_by_name
      FROM treasury_transfers t
      LEFT JOIN treasury_accounts sa ON t.source_account_id = sa.id
      LEFT JOIN treasury_accounts da ON t.destination_account_id = da.id
      LEFT JOIN treasury_transfer_types tp ON t.transfer_type_id = tp.id OR t.transfer_type = tp.code
      LEFT JOIN branches sb ON t.source_branch_id = sb.id
      LEFT JOIN branches db ON t.destination_branch_id = db.id
      LEFT JOIN cost_centers sc ON t.source_cost_center_id = sc.id
      LEFT JOIN cost_centers dc ON t.destination_cost_center_id = dc.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE ${whereSql}
      ORDER BY t.transfer_date DESC, t.id DESC
      LIMIT 500
    `;
    const detailedRes = await pool.query(detailedQuery, params);

    res.json({
      summary: summaryRes.rows[0] || {},
      transfers: detailedRes.rows || []
    });
  } catch (error) {
    console.error("Transfers Report Error:", error);
    res.status(500).json({ error: "Failed to generate transfers report" });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. TRANSFER TYPES
// ═══════════════════════════════════════════════════════════════
router.get(["/api/treasury/transfer-types", "/api/treasury/transfers/types"], authenticateToken, async (req, res) => {
  try {
    await ensureTreasuryTransferTypes(pool);
    const result = await pool.query("SELECT * FROM treasury_transfer_types ORDER BY id ASC");
    res.json(result.rows);
  } catch (error) {
    console.error("Fetch Transfer Types Error:", error);
    res.status(500).json({ error: "Failed to fetch transfer types" });
  }
});

router.post(["/api/treasury/transfer-types", "/api/treasury/transfers/types"], authenticateToken, async (req, res) => {
  try {
    const { code, name_ar, name_en, source_type, destination_type, requires_receipt_confirmation, requires_approval, max_limit, is_active, description } = req.body;
    const result = await pool.query(
      `INSERT INTO treasury_transfer_types 
       (code, name_ar, name_en, source_type, destination_type, requires_receipt_confirmation, requires_approval, max_limit, is_active, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        code,
        name_ar,
        name_en || null,
        source_type || 'any',
        destination_type || 'any',
        requires_receipt_confirmation ?? true,
        requires_approval ?? true,
        max_limit ? parseFloat(max_limit) : null,
        is_active ?? true,
        description || null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Create Transfer Type Error:", error);
    res.status(500).json({ error: "Failed to create transfer type" });
  }
});

router.put(["/api/treasury/transfer-types/:id", "/api/treasury/transfers/types/:id"], authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name_ar, name_en, source_type, destination_type, requires_receipt_confirmation, requires_approval, max_limit, is_active, description } = req.body;
    const result = await pool.query(
      `UPDATE treasury_transfer_types 
       SET code = $1, name_ar = $2, name_en = $3, source_type = $4, destination_type = $5,
           requires_receipt_confirmation = $6, requires_approval = $7, max_limit = $8, is_active = $9, description = $10
       WHERE id = $11
       RETURNING *`,
      [
        code,
        name_ar,
        name_en || null,
        source_type || 'any',
        destination_type || 'any',
        requires_receipt_confirmation ?? true,
        requires_approval ?? true,
        max_limit ? parseFloat(max_limit) : null,
        is_active ?? true,
        description || null,
        id
      ]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transfer type not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error("Update Transfer Type Error:", error);
    res.status(500).json({ error: "Failed to update transfer type" });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. LIST & SEARCH TRANSFERS
// ═══════════════════════════════════════════════════════════════
router.get("/api/treasury/transfers", authenticateToken, async (req, res) => {
  try {
    const { 
      search, 
      status, 
      transferType, 
      sourceAccount, 
      destinationAccount, 
      branchId, 
      costCenterId,
      startDate, 
      endDate,
      page = 1, 
      limit = 50 
    } = req.query;

    let whereClauses: string[] = ["1=1"];
    let params: any[] = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`(
        t.transfer_number ILIKE $${paramIndex} 
        OR t.purpose ILIKE $${paramIndex} 
        OR t.statement ILIKE $${paramIndex} 
        OR t.notes ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status && status !== "all") {
      whereClauses.push(`t.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (transferType && transferType !== "all") {
      whereClauses.push(`(t.transfer_type = $${paramIndex} OR t.transfer_type_id::text = $${paramIndex})`);
      params.push(transferType);
      paramIndex++;
    }

    if (sourceAccount && sourceAccount !== "all") {
      whereClauses.push(`t.source_account_id = $${paramIndex}`);
      params.push(Number(sourceAccount));
      paramIndex++;
    }

    if (destinationAccount && destinationAccount !== "all") {
      whereClauses.push(`t.destination_account_id = $${paramIndex}`);
      params.push(Number(destinationAccount));
      paramIndex++;
    }

    if (branchId && branchId !== "all") {
      whereClauses.push(`(t.source_branch_id = $${paramIndex} OR t.destination_branch_id = $${paramIndex})`);
      params.push(Number(branchId));
      paramIndex++;
    }

    if (costCenterId && costCenterId !== "all") {
      whereClauses.push(`(t.source_cost_center_id = $${paramIndex} OR t.destination_cost_center_id = $${paramIndex})`);
      params.push(Number(costCenterId));
      paramIndex++;
    }

    if (startDate) {
      whereClauses.push(`t.transfer_date >= $${paramIndex}`);
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      whereClauses.push(`t.transfer_date <= $${paramIndex}`);
      params.push(endDate);
      paramIndex++;
    }

    const whereSql = whereClauses.join(" AND ");
    const offset = (Number(page) - 1) * Number(limit);

    const countQuery = `SELECT COUNT(*) FROM treasury_transfers t WHERE ${whereSql}`;
    const countRes = await pool.query(countQuery, params);
    const totalCount = parseInt(countRes.rows[0]?.count || "0", 10);

    const query = `
      SELECT 
        t.*,
        sa.name as source_account_name, sa.type as source_account_type, sa.code as source_account_code,
        da.name as destination_account_name, da.type as destination_account_type, da.code as destination_account_code,
        tp.name_ar as transfer_type_name,
        sb.name as source_branch_name,
        db.name as destination_branch_name,
        sc.name as source_cost_center_name,
        dc.name as destination_cost_center_name,
        u.username as created_by_name,
        ap.username as approved_by_name,
        ex.username as executed_by_name,
        rc.username as received_by_name,
        rv.username as reversed_by_name,
        COALESCE(je.reference, CAST(je.id AS TEXT)) as journal_entry_number
      FROM treasury_transfers t
      LEFT JOIN treasury_accounts sa ON t.source_account_id = sa.id
      LEFT JOIN treasury_accounts da ON t.destination_account_id = da.id
      LEFT JOIN treasury_transfer_types tp ON t.transfer_type_id = tp.id OR t.transfer_type = tp.code
      LEFT JOIN branches sb ON t.source_branch_id = sb.id
      LEFT JOIN branches db ON t.destination_branch_id = db.id
      LEFT JOIN cost_centers sc ON t.source_cost_center_id = sc.id
      LEFT JOIN cost_centers dc ON t.destination_cost_center_id = dc.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users ap ON t.approved_by = ap.id
      LEFT JOIN users ex ON t.executed_by = ex.id
      LEFT JOIN users rc ON t.received_by = rc.id
      LEFT JOIN users rv ON t.reversed_by = rv.id
      LEFT JOIN journal_entries je ON t.journal_entry_id = je.id
      WHERE ${whereSql}
      ORDER BY t.id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(Number(limit), offset);

    const result = await pool.query(query, params);
    res.json({
      transfers: result.rows || [],
      total: totalCount,
      page: Number(page),
      limit: Number(limit)
    });
  } catch (error) {
    console.error("List Transfers Error:", error);
    res.status(500).json({ error: "Failed to fetch financial transfers list" });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. GET SINGLE TRANSFER BY ID (Full Details with Audit & Attachments)
// ═══════════════════════════════════════════════════════════════
router.get("/api/treasury/transfers/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return res.status(400).json({ error: "Invalid transfer ID" });
    }
    const query = `
      SELECT 
        t.*,
        sa.name as source_account_name, sa.type as source_account_type, sa.code as source_account_code, sa.current_balance as source_account_current_balance,
        da.name as destination_account_name, da.type as destination_account_type, da.code as destination_account_code, da.current_balance as destination_account_current_balance,
        tp.name_ar as transfer_type_name,
        sb.name as source_branch_name,
        db.name as destination_branch_name,
        sc.name as source_cost_center_name,
        dc.name as destination_cost_center_name,
        u.username as created_by_name,
        ap.username as approved_by_name,
        ex.username as executed_by_name,
        rc.username as received_by_name,
        rv.username as reversed_by_name,
        COALESCE(je.reference, CAST(je.id AS TEXT)) as journal_entry_number
      FROM treasury_transfers t
      LEFT JOIN treasury_accounts sa ON t.source_account_id = sa.id
      LEFT JOIN treasury_accounts da ON t.destination_account_id = da.id
      LEFT JOIN treasury_transfer_types tp ON t.transfer_type_id = tp.id OR t.transfer_type = tp.code
      LEFT JOIN branches sb ON t.source_branch_id = sb.id
      LEFT JOIN branches db ON t.destination_branch_id = db.id
      LEFT JOIN cost_centers sc ON t.source_cost_center_id = sc.id
      LEFT JOIN cost_centers dc ON t.destination_cost_center_id = dc.id
      LEFT JOIN users u ON t.created_by = u.id
      LEFT JOIN users ap ON t.approved_by = ap.id
      LEFT JOIN users ex ON t.executed_by = ex.id
      LEFT JOIN users rc ON t.received_by = rc.id
      LEFT JOIN users rv ON t.reversed_by = rv.id
      LEFT JOIN journal_entries je ON t.journal_entry_id = je.id
      WHERE t.id = $1
    `;
    const result = await pool.query(query, [numericId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Transfer not found" });
    }

    const transfer = result.rows[0];

    // Fetch attachments
    const attRes = await pool.query(
      "SELECT * FROM treasury_transfer_attachments WHERE transfer_id = $1 ORDER BY id DESC",
      [id]
    );
    transfer.attachments = attRes.rows || [];

    // Fetch audit logs
    const auditRes = await pool.query(
      `SELECT * FROM treasury_transfer_audit_logs WHERE transfer_id = $1 ORDER BY id DESC`,
      [id]
    );
    transfer.audit_logs = auditRes.rows || [];

    res.json(transfer);
  } catch (error) {
    console.error("Get Transfer Details Error:", error);
    res.status(500).json({ error: "Failed to fetch transfer details" });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. CREATE TRANSFER (Draft / Submit for Approval)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userId = (req as any).user?.id || 1;
    const {
      transfer_type_id,
      transfer_type = "safe_to_safe",
      source_account_id,
      destination_account_id,
      source_branch_id,
      destination_branch_id,
      source_cost_center_id,
      destination_cost_center_id,
      transfer_date,
      value_date,
      source_currency = "EGP",
      destination_currency = "EGP",
      amount,
      exchange_rate = 1,
      destination_amount,
      transfer_fee = 0,
      fee_currency = "EGP",
      fee_account_id,
      fee_borne_by = "company",
      purpose,
      category = "operational",
      statement,
      notes,
      submit_immediately = false
    } = req.body;

    await ensureTreasuryTransferTypes(client);
    const defaultType = DEFAULT_TRANSFER_TYPES.find(([, type]) => type === transfer_type);
    const typeResult = transfer_type_id
      ? await client.query(
          "SELECT id FROM treasury_transfer_types WHERE id = $1 AND is_active = true",
          [transfer_type_id],
        )
      : defaultType
        ? await client.query(
            "SELECT id FROM treasury_transfer_types WHERE code = $1 AND is_active = true",
            [defaultType[0]],
          )
        : { rows: [] };
    if (typeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "نوع التحويل المحدد غير موجود أو غير مفعل" });
    }
    const resolvedTransferTypeId = typeResult.rows[0].id;

    // 1. Basic Validations
    if (!source_account_id || !destination_account_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "يجب تحديد الخزينة المصدر والخزينة المستهدفة للتحويل" });
    }

    if (Number(source_account_id) === Number(destination_account_id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "لا يمكن التحويل من وإلى نفس الحساب أو الخزينة" });
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "يجب أن يكون مبلغ التحويل أكبر من الصفر" });
    }

    const parsedRate = parseFloat(exchange_rate) || 1;
    const calcDestAmount = destination_amount ? parseFloat(destination_amount) : (transferAmount * parsedRate);
    const parsedFee = parseFloat(transfer_fee) || 0;

    // 2. Fetch Source Account and Check Available Balance
    const srcRes = await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [source_account_id]);
    if (srcRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "الحساب أو الخزينة المصدر غير موجودة" });
    }
    const srcAccount = srcRes.rows[0];

    const dstRes = await client.query("SELECT * FROM treasury_accounts WHERE id = $1", [destination_account_id]);
    if (dstRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "الحساب أو الخزينة المستهدفة غير موجودة" });
    }
    const dstAccount = dstRes.rows[0];

    // Check negative balance setting
    const settingsRes = await client.query("SELECT key, value FROM treasury_settings");
    const settingsMap: Record<string, string> = {};
    settingsRes.rows.forEach((r: any) => { settingsMap[r.key] = r.value; });

    const allowNegative = settingsMap['transfer_allow_negative_source'] === 'true';
    const totalSourceDeduction = transferAmount + (fee_borne_by === 'source' ? parsedFee : 0);
    const srcCurrentBal = parseFloat(srcAccount.current_balance) || 0;

    if (!allowNegative && srcCurrentBal < totalSourceDeduction) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        error: `لا يمكن إنشاء التحويل: الرصيد الحالي للخزينة المصدر (${srcCurrentBal.toLocaleString()} ${srcAccount.currency || 'ج.م'}) غير كافٍ لتغطية المبلغ المطلوب (${totalSourceDeduction.toLocaleString()}).` 
      });
    }

    // 3. Generate Sequential Unique Number TRF-YYYY-xxxxxx
    const currentYear = new Date().getFullYear();
    const seqRes = await client.query(
      `SELECT COUNT(*) FROM treasury_transfers WHERE transfer_number LIKE $1`,
      [`TRF-${currentYear}-%`]
    );
    const nextSeq = (parseInt(seqRes.rows[0]?.count || "0", 10) + 1).toString().padStart(6, "0");
    const transferNumber = `TRF-${currentYear}-${nextSeq}`;

    // Determine initial status
    const initialStatus = submit_immediately ? "pending_approval" : "draft";

    // 4. Insert into database
    const insertQuery = `
      INSERT INTO treasury_transfers (
        transfer_number, transfer_type_id, transfer_type,
        source_account_id, destination_account_id,
        source_branch_id, destination_branch_id,
        source_cost_center_id, destination_cost_center_id,
        transfer_date, value_date,
        source_currency, destination_currency,
        amount, exchange_rate, destination_amount, exchange_difference,
        transfer_fee, fee_currency, fee_account_id, fee_borne_by,
        purpose, category, statement, notes,
        status,
        sender_user_id,
        created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7,
        $8, $9,
        $10, $11,
        $12, $13,
        $14, $15, $16, $17,
        $18, $19, $20, $21,
        $22, $23, $24, $25,
        $26,
        $27,
        $28, NOW(), NOW()
      ) RETURNING *
    `;

    const insertRes = await client.query(insertQuery, [
      transferNumber,
      resolvedTransferTypeId,
      transfer_type,
      source_account_id,
      destination_account_id,
      source_branch_id || srcAccount.branch_id || null,
      destination_branch_id || dstAccount.branch_id || null,
      source_cost_center_id || srcAccount.cost_center_id || null,
      destination_cost_center_id || dstAccount.cost_center_id || null,
      transfer_date || new Date().toISOString(),
      value_date || transfer_date || new Date().toISOString(),
      source_currency || srcAccount.currency || "EGP",
      destination_currency || dstAccount.currency || "EGP",
      transferAmount,
      parsedRate,
      calcDestAmount,
      0, // exchange difference
      parsedFee,
      fee_currency || "EGP",
      fee_account_id || null,
      fee_borne_by,
      purpose || `تحويل مالي من ${srcAccount.name} إلى ${dstAccount.name}`,
      category,
      statement || purpose || "تحويل مالي بين الحسابات",
      notes || null,
      initialStatus,
      userId,
      userId
    ]);

    const createdTransfer = insertRes.rows[0];

    // 5. Log Audit Trail
    await logTransferAudit(
      client,
      createdTransfer.id,
      "create",
      null,
      { status: initialStatus, amount: transferAmount, transfer_number: transferNumber },
      userId,
      `إنشاء طلب تحويل مالي رقم ${transferNumber} بمبلغ ${transferAmount} ${source_currency}`,
      req
    );

    // 6. Push Notification
    if (submit_immediately) {
      await createTransferNotification(
        client,
        "طلب تحويل مالي جديد قيد الاعتماد",
        `تم تقديم طلب تحويل مالي رقم ${transferNumber} بقيمة ${transferAmount.toLocaleString()} ${source_currency} وبانتظار الاعتماد.`,
        "transfer_approval",
        undefined,
        createdTransfer.id
      );
    }

    await client.query("COMMIT");
    res.status(201).json(createdTransfer);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Create Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to create transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. EDIT TRANSFER (Draft / Pending Approval)
// ═══════════════════════════════════════════════════════════════
router.put("/api/treasury/transfers/:id", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;

    const existingRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const existing = existingRes.rows[0];

    if (!["draft", "pending_approval"].includes(existing.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `لا يمكن تعديل التحويل المالي وهو بالحالة '${existing.status}'` });
    }

    const {
      transfer_type_id,
      transfer_type,
      source_account_id,
      destination_account_id,
      source_branch_id,
      destination_branch_id,
      source_cost_center_id,
      destination_cost_center_id,
      transfer_date,
      value_date,
      source_currency,
      destination_currency,
      amount,
      exchange_rate,
      destination_amount,
      transfer_fee,
      fee_currency,
      fee_account_id,
      fee_borne_by,
      purpose,
      category,
      statement,
      notes
    } = req.body;

    const transferAmount = amount ? parseFloat(amount) : parseFloat(existing.amount);
    const parsedRate = exchange_rate ? parseFloat(exchange_rate) : parseFloat(existing.exchange_rate || 1);
    const calcDestAmount = destination_amount ? parseFloat(destination_amount) : (transferAmount * parsedRate);

    const updateQuery = `
      UPDATE treasury_transfers SET
        transfer_type_id = COALESCE($1, transfer_type_id),
        transfer_type = COALESCE($2, transfer_type),
        source_account_id = COALESCE($3, source_account_id),
        destination_account_id = COALESCE($4, destination_account_id),
        source_branch_id = COALESCE($5, source_branch_id),
        destination_branch_id = COALESCE($6, destination_branch_id),
        source_cost_center_id = COALESCE($7, source_cost_center_id),
        destination_cost_center_id = COALESCE($8, destination_cost_center_id),
        transfer_date = COALESCE($9, transfer_date),
        value_date = COALESCE($10, value_date),
        source_currency = COALESCE($11, source_currency),
        destination_currency = COALESCE($12, destination_currency),
        amount = $13,
        exchange_rate = $14,
        destination_amount = $15,
        transfer_fee = COALESCE($16, transfer_fee),
        fee_currency = COALESCE($17, fee_currency),
        fee_account_id = COALESCE($18, fee_account_id),
        fee_borne_by = COALESCE($19, fee_borne_by),
        purpose = COALESCE($20, purpose),
        category = COALESCE($21, category),
        statement = COALESCE($22, statement),
        notes = COALESCE($23, notes),
        updated_at = NOW()
      WHERE id = $24
      RETURNING *
    `;

    const updateRes = await client.query(updateQuery, [
      transfer_type_id,
      transfer_type,
      source_account_id,
      destination_account_id,
      source_branch_id,
      destination_branch_id,
      source_cost_center_id,
      destination_cost_center_id,
      transfer_date,
      value_date,
      source_currency,
      destination_currency,
      transferAmount,
      parsedRate,
      calcDestAmount,
      transfer_fee !== undefined ? parseFloat(transfer_fee) : existing.transfer_fee,
      fee_currency,
      fee_account_id,
      fee_borne_by,
      purpose,
      category,
      statement,
      notes,
      id
    ]);

    const updated = updateRes.rows[0];

    await logTransferAudit(
      client,
      Number(id),
      "edit",
      { amount: existing.amount, purpose: existing.purpose },
      { amount: updated.amount, purpose: updated.purpose },
      userId,
      `تعديل بيانات التحويل المالي رقم ${existing.transfer_number}`,
      req
    );

    await client.query("COMMIT");
    res.json(updated);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Update Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to update transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. SUBMIT FOR APPROVAL (Draft -> Pending Approval)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/submit", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;

    const trfRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const transfer = trfRes.rows[0];

    if (transfer.status !== "draft") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "يمكن إرسال المسودات فقط للاعتماد" });
    }

    const updatedRes = await client.query(
      `UPDATE treasury_transfers 
       SET status = 'pending_approval', updated_at = NOW() 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    await logTransferAudit(
      client,
      Number(id),
      "submit_for_approval",
      { status: "draft" },
      { status: "pending_approval" },
      userId,
      `إرسال التحويل المالي رقم ${transfer.transfer_number} للاعتماد`,
      req
    );

    await createTransferNotification(
      client,
      "طلب اعتماد تحويل مالي",
      `تم إرسال التحويل المالي رقم ${transfer.transfer_number} بقيمة ${parseFloat(transfer.amount).toLocaleString()} ج.م للاعتماد والمراجعة.`,
      "transfer_approval",
      undefined,
      Number(id)
    );

    await client.query("COMMIT");
    res.json(updatedRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Submit Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to submit transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 9. APPROVE TRANSFER (Pending Approval -> Approved)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/approve", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;
    const { approval_notes } = req.body;

    const trfRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const transfer = trfRes.rows[0];

    if (transfer.status !== "pending_approval") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "التحويل ليس في حالة انتظار الاعتماد" });
    }

    const accountIds = [Number(transfer.source_account_id), Number(transfer.destination_account_id)];
    const accountsRes = await client.query(
      "SELECT * FROM treasury_accounts WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE",
      [accountIds],
    );
    const sourceAccount = accountsRes.rows.find((account: any) => Number(account.id) === Number(transfer.source_account_id));
    const destinationAccount = accountsRes.rows.find((account: any) => Number(account.id) === Number(transfer.destination_account_id));
    if (!sourceAccount || !destinationAccount) {
      throw new Error("خزينة المصدر أو الخزينة المستهدفة غير موجودة");
    }

    const transferAmount = Number(transfer.amount);
    const transferFee = Number(transfer.transfer_fee) || 0;
    const sourceDeduction = transferAmount + (transfer.fee_borne_by === "source" ? transferFee : 0);
    const destinationCredit = Number(transfer.destination_amount || transferAmount * Number(transfer.exchange_rate || 1))
      - (transfer.fee_borne_by === "destination" ? transferFee : 0);
    const sourceBalanceBefore = Number(sourceAccount.current_balance) || 0;
    const destinationBalanceBefore = Number(destinationAccount.current_balance) || 0;
    const settingsRes = await client.query(
      "SELECT value FROM treasury_settings WHERE key = 'transfer_allow_negative_source'",
    );
    const allowNegative = settingsRes.rows[0]?.value === "true";

    if (!allowNegative && sourceBalanceBefore < sourceDeduction) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: `الرصيد المتاح في الخزينة المصدر (${sourceBalanceBefore.toLocaleString()} ج.م) غير كافٍ لخصم المبلغ الإجمالي (${sourceDeduction.toLocaleString()} ج.م).`,
      });
    }

    const sourceBalanceAfter = sourceBalanceBefore - sourceDeduction;
    const destinationBalanceAfter = destinationBalanceBefore + destinationCredit;
    await client.query(
      "UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2",
      [sourceDeduction, sourceAccount.id],
    );
    await client.query(
      "UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2",
      [destinationCredit, destinationAccount.id],
    );

    const sourceTransactionRes = await client.query(
      `INSERT INTO treasury_transactions
        (account_id, amount, transaction_type, reference_type, reference_id, notes, created_by,
         cost_center_id, status, voucher_number, voucher_type, payment_method, balance_before, balance_after, branch_id)
       VALUES ($1, $2, 'transfer', 'general', $3, $4, $5, $6, 'approved', $7, 'payment', 'bank', $8, $9, $10)
       RETURNING id`,
      [
        sourceAccount.id,
        -sourceDeduction,
        transfer.id,
        `تحويل صادر إلى ${destinationAccount.name} - ${transfer.transfer_number}`,
        userId,
        transfer.source_cost_center_id || null,
        `${transfer.transfer_number}-OUT`,
        sourceBalanceBefore,
        sourceBalanceAfter,
        transfer.source_branch_id || sourceAccount.branch_id || null,
      ],
    );
    const destinationTransactionRes = await client.query(
      `INSERT INTO treasury_transactions
        (account_id, amount, transaction_type, reference_type, reference_id, notes, created_by,
         cost_center_id, status, voucher_number, voucher_type, payment_method, balance_before, balance_after, branch_id)
       VALUES ($1, $2, 'transfer', 'general', $3, $4, $5, $6, 'approved', $7, 'receipt', 'bank', $8, $9, $10)
       RETURNING id`,
      [
        destinationAccount.id,
        destinationCredit,
        transfer.id,
        `تحويل وارد من ${sourceAccount.name} - ${transfer.transfer_number}`,
        userId,
        transfer.destination_cost_center_id || null,
        `${transfer.transfer_number}-IN`,
        destinationBalanceBefore,
        destinationBalanceAfter,
        transfer.destination_branch_id || destinationAccount.branch_id || null,
      ],
    );

    const journalEntryId = await postTransferGlEntry(client, {
      reference: transfer.transfer_number,
      description: `تحويل مالي معتمد من ${sourceAccount.name} إلى ${destinationAccount.name} - ${transfer.transfer_number}`,
      sourceLabel: sourceAccount.name,
      destinationLabel: destinationAccount.name,
      amountOut: sourceDeduction,
      amountIn: destinationCredit,
      sourceId: transfer.id,
      branchId: transfer.source_branch_id || sourceAccount.branch_id || null,
      costCenterId: transfer.destination_cost_center_id || transfer.source_cost_center_id || null,
      createdBy: userId,
    });

    const updatedRes = await client.query(
      `UPDATE treasury_transfers 
       SET status = 'completed', approved_by = $1, approved_at = NOW(), approval_notes = $2,
           executed_by = $1, executed_at = NOW(), received_by = $1, received_at = NOW(),
           source_balance_before = $3, source_balance_after = $4,
           destination_balance_before = $5, destination_balance_after = $6,
           source_transaction_id = $7, destination_transaction_id = $8,
           journal_entry_id = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [
        userId,
        approval_notes || null,
        sourceBalanceBefore,
        sourceBalanceAfter,
        destinationBalanceBefore,
        destinationBalanceAfter,
        sourceTransactionRes.rows[0]?.id,
        destinationTransactionRes.rows[0]?.id,
        journalEntryId,
        id,
      ],
    );

    await logTransferAudit(
      client,
      Number(id),
      "approve",
      { status: "pending_approval" },
      {
        status: "completed",
        approved_by: userId,
        source_balance_after: sourceBalanceAfter,
        destination_balance_after: destinationBalanceAfter,
        notes: approval_notes,
      },
      userId,
      `اعتماد وتنفيذ التحويل المالي رقم ${transfer.transfer_number} ونقل الرصيد من ${sourceAccount.name} إلى ${destinationAccount.name}`,
      req
    );

    await createTransferNotification(
      client,
      "تم تنفيذ التحويل المالي",
      `تم اعتماد التحويل المالي رقم ${transfer.transfer_number} وتحريك المبلغ بين الخزينتين.`,
      "transfer_completed",
      transfer.created_by,
      Number(id)
    );

    await client.query("COMMIT");
    res.json({
      ...updatedRes.rows[0],
      source_balance_before: sourceBalanceBefore,
      source_balance_after: sourceBalanceAfter,
      destination_balance_before: destinationBalanceBefore,
      destination_balance_after: destinationBalanceAfter,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Approve Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to approve transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 10. REJECT TRANSFER (Pending Approval -> Rejected)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/reject", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "يجب كتابة سبب الرفض" });
    }

    const trfRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const transfer = trfRes.rows[0];

    if (!["pending_approval", "approved"].includes(transfer.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "لا يمكن رفض هذا التحويل في حالته الحالية" });
    }

    const updatedRes = await client.query(
      `UPDATE treasury_transfers 
       SET status = 'rejected', rejection_reason = $1, updated_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [rejection_reason, id]
    );

    await logTransferAudit(
      client,
      Number(id),
      "reject",
      { status: transfer.status },
      { status: "rejected", rejection_reason },
      userId,
      `رفض طلب التحويل المالي رقم ${transfer.transfer_number}. السبب: ${rejection_reason}`,
      req
    );

    await createTransferNotification(
      client,
      "تم رفض التحويل المالي",
      `تم رفض طلب التحويل المالي رقم ${transfer.transfer_number}. السبب: ${rejection_reason}`,
      "transfer_rejected",
      transfer.created_by,
      Number(id)
    );

    await client.query("COMMIT");
    res.json(updatedRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Reject Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to reject transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 11. EXECUTE / DISPATCH FROM SOURCE SAFE
// (Deducts from Source Safe -> Sets Status to Pending Receipt / In Transit)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/execute", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;
    const { execution_notes, auto_receive = false } = req.body;

    // 1. Fetch and Lock Transfer
    const trfRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const transfer = trfRes.rows[0];

    if (!["approved", "draft"].includes(transfer.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `لا يمكن تنفيذ التحويل وهو بالحالة '${transfer.status}'. يجب أن يكون معتمداً أولاً.` });
    }

    const transferAmount = parseFloat(transfer.amount);
    const transferFee = parseFloat(transfer.transfer_fee) || 0;
    const totalDeduct = transferAmount + (transfer.fee_borne_by === 'source' ? transferFee : 0);

    // 2. Fetch and Lock Source Account
    const srcRes = await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [transfer.source_account_id]);
    if (srcRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "الخزينة المصدر غير موجودة" });
    }
    const srcAccount = srcRes.rows[0];
    const srcBalanceBefore = parseFloat(srcAccount.current_balance) || 0;

    // Check balance sufficiency
    const settingsRes = await client.query("SELECT key, value FROM treasury_settings");
    const settingsMap: Record<string, string> = {};
    settingsRes.rows.forEach((r: any) => { settingsMap[r.key] = r.value; });
    const allowNegative = settingsMap['transfer_allow_negative_source'] === 'true';

    if (!allowNegative && srcBalanceBefore < totalDeduct) {
      await client.query("ROLLBACK");
      return res.status(400).json({ 
        error: `الرصيد المتاح في الخزينة المصدر (${srcBalanceBefore.toLocaleString()} ج.م) غير كافٍ لخصم المبلغ الإجمالي (${totalDeduct.toLocaleString()} ج.م).` 
      });
    }

    const srcBalanceAfter = srcBalanceBefore - totalDeduct;

    // 3. Deduct from Source Safe
    await client.query("UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2", [totalDeduct, transfer.source_account_id]);

    // 4. Record Source Treasury Transaction (Transfer Out)
    const year = new Date().getFullYear();
    const countTrxRes = await client.query("SELECT COUNT(*) FROM treasury_transactions WHERE date >= $1", [`${year}-01-01`]);
    const srcVoucherNum = `TRF-OUT-${year}-${(parseInt(countTrxRes.rows[0]?.count || "0", 10) + 1).toString().padStart(5, '0')}`;

    const srcTxRes = await client.query(
      `INSERT INTO treasury_transactions 
       (account_id, type, amount, current_balance_after, reference_number, category, description, branch_id, cost_center_id, created_by, status, date)
       VALUES ($1, 'transfer_out', $2, $3, $4, 'transfer', $5, $6, $7, $8, 'completed', NOW())
       RETURNING id`,
      [
        transfer.source_account_id,
        transferAmount,
        srcBalanceAfter,
        transfer.transfer_number,
        `صرف تحويل مالي صادر إلى ${transfer.destination_account_id} - قيد رقم ${transfer.transfer_number}`,
        transfer.source_branch_id || srcAccount.branch_id,
        transfer.source_cost_center_id || srcAccount.cost_center_id,
        userId
      ]
    );
    const srcTxId = srcTxRes.rows[0]?.id;

    // 5. Determine if Auto-Receive or In-Transit
    let nextStatus = "pending_receipt";
    let dstBalanceBefore: number | null = null;
    let dstBalanceAfter: number | null = null;
    let dstTxId: number | null = null;
    let journalEntryId: number | null = null;

    if (auto_receive) {
      // Immediate settlement (e.g. Bank to Bank direct)
      const dstRes = await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [transfer.destination_account_id]);
      const dstAccount = dstRes.rows[0];
      dstBalanceBefore = parseFloat(dstAccount.current_balance) || 0;
      
      const dstCreditAmount = parseFloat(transfer.destination_amount) - (transfer.fee_borne_by === 'destination' ? transferFee : 0);
      dstBalanceAfter = dstBalanceBefore + dstCreditAmount;

      await client.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [dstCreditAmount, transfer.destination_account_id]);

      const dstVoucherNum = `TRF-IN-${year}-${(parseInt(countTrxRes.rows[0]?.count || "0", 10) + 2).toString().padStart(5, '0')}`;
      const dstTxRes = await client.query(
        `INSERT INTO treasury_transactions 
         (account_id, type, amount, current_balance_after, reference_number, category, description, branch_id, cost_center_id, created_by, status, date)
         VALUES ($1, 'transfer_in', $2, $3, $4, 'transfer', $5, $6, $7, $8, 'completed', NOW())
         RETURNING id`,
        [
          transfer.destination_account_id,
          dstCreditAmount,
          dstBalanceAfter,
          transfer.transfer_number,
          `استلام تحويل مالي وارد من ${srcAccount.name} - قيد رقم ${transfer.transfer_number}`,
          transfer.destination_branch_id || dstAccount.branch_id,
          transfer.destination_cost_center_id || dstAccount.cost_center_id,
          userId
        ]
      );
      dstTxId = dstTxRes.rows[0]?.id;
      nextStatus = "completed";

      // Post GL Journal Entry (balanced, using the real chart of accounts)
      try {
        journalEntryId = await postTransferGlEntry(client, {
          reference: transfer.transfer_number,
          description: `إثبات تحويل مالي من ${srcAccount.name} إلى ${dstAccount.name} - ${transfer.transfer_number}`,
          sourceLabel: srcAccount.name,
          destinationLabel: dstAccount.name,
          amountOut: transferAmount,
          amountIn: dstCreditAmount,
          sourceId: transfer.id,
          branchId: transfer.source_branch_id || srcAccount.branch_id || null,
          costCenterId: transfer.destination_cost_center_id || transfer.source_cost_center_id || null,
          createdBy: userId,
        });
      } catch (jeErr) {
        console.log("Journal auto-post notice:", jeErr);
      }
    }

    // 6. Update Transfer Record
    const updateRes = await client.query(
      `UPDATE treasury_transfers SET
        status = $1,
        executed_by = $2,
        executed_at = NOW(),
        source_balance_before = $3,
        source_balance_after = $4,
        destination_balance_before = COALESCE($5, destination_balance_before),
        destination_balance_after = COALESCE($6, destination_balance_after),
        source_transaction_id = $7,
        destination_transaction_id = COALESCE($8, destination_transaction_id),
        journal_entry_id = COALESCE($9, journal_entry_id),
        received_by = CASE WHEN $1 = 'completed' THEN $2 ELSE received_by END,
        received_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE received_at END,
        updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        nextStatus,
        userId,
        srcBalanceBefore,
        srcBalanceAfter,
        dstBalanceBefore,
        dstBalanceAfter,
        srcTxId,
        dstTxId,
        journalEntryId,
        id
      ]
    );

    // 7. Audit Log
    await logTransferAudit(
      client,
      Number(id),
      "execute",
      { status: transfer.status, source_balance_before: srcBalanceBefore },
      { status: nextStatus, source_balance_after: srcBalanceAfter, notes: execution_notes },
      userId,
      `تنفيذ وصرف التحويل المالي رقم ${transfer.transfer_number} من ${srcAccount.name} بمبلغ ${transferAmount} ج.م`,
      req
    );

    // 8. Notification
    await createTransferNotification(
      client,
      nextStatus === "completed" ? "اكتمل التحويل المالي" : "تحويل مالي في انتظار الاستلام",
      `تم تنفيذ وصرف التحويل رقم ${transfer.transfer_number} من ${srcAccount.name}. في انتظار تأكيد الاستلام من الخزينة المستهدفة.`,
      "transfer_in_transit",
      undefined,
      Number(id)
    );

    await client.query("COMMIT");
    res.json(updateRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Execute Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to execute transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 12. CONFIRM RECEIPT (Pending Receipt -> Completed / Posted)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/receive", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;
    const { receipt_notes } = req.body;

    // 1. Fetch and Lock Transfer
    const trfRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const transfer = trfRes.rows[0];

    if (!["pending_receipt", "executed", "in_transit"].includes(transfer.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `لا يمكن استلام التحويل وهو بالحالة '${transfer.status}'.` });
    }

    const transferFee = parseFloat(transfer.transfer_fee) || 0;
    const dstCreditAmount = parseFloat(transfer.destination_amount) - (transfer.fee_borne_by === 'destination' ? transferFee : 0);

    // 2. Fetch and Lock Destination Account
    const dstRes = await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [transfer.destination_account_id]);
    if (dstRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "الخزينة أو الحساب المستهدف غير موجود" });
    }
    const dstAccount = dstRes.rows[0];
    const dstBalanceBefore = parseFloat(dstAccount.current_balance) || 0;
    const dstBalanceAfter = dstBalanceBefore + dstCreditAmount;

    // 3. Credit Destination Account
    await client.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [dstCreditAmount, transfer.destination_account_id]);

    // 4. Record Destination Transaction
    const year = new Date().getFullYear();
    const countTrxRes = await client.query("SELECT COUNT(*) FROM treasury_transactions WHERE date >= $1", [`${year}-01-01`]);
    const dstVoucherNum = `TRF-IN-${year}-${(parseInt(countTrxRes.rows[0]?.count || "0", 10) + 1).toString().padStart(5, '0')}`;

    const dstTxRes = await client.query(
      `INSERT INTO treasury_transactions 
       (account_id, type, amount, current_balance_after, reference_number, category, description, branch_id, cost_center_id, created_by, status, date)
       VALUES ($1, 'transfer_in', $2, $3, $4, 'transfer', $5, $6, $7, $8, 'completed', NOW())
       RETURNING id`,
      [
        transfer.destination_account_id,
        dstCreditAmount,
        dstBalanceAfter,
        transfer.transfer_number,
        `استلام نقدية تحويل مالي وارد من قيد رقم ${transfer.transfer_number}`,
        transfer.destination_branch_id || dstAccount.branch_id,
        transfer.destination_cost_center_id || dstAccount.cost_center_id,
        userId
      ]
    );
    const dstTxId = dstTxRes.rows[0]?.id;

    // 5. Post GL Journal Entry (balanced, using the real chart of accounts)
    let journalEntryId: number | null = null;
    try {
      const srcAccount = (await client.query("SELECT name, branch_id FROM treasury_accounts WHERE id = $1", [transfer.source_account_id])).rows[0];
      const srcName = srcAccount ? srcAccount.name : "الخزينة المصدر";

      journalEntryId = await postTransferGlEntry(client, {
        reference: transfer.transfer_number,
        description: `إثبات تحويل مالي واستلام نقدية من ${srcName} إلى ${dstAccount.name} - ${transfer.transfer_number}`,
        sourceLabel: srcName,
        destinationLabel: dstAccount.name,
        amountOut: parseFloat(transfer.amount),
        amountIn: dstCreditAmount,
        sourceId: transfer.id,
        branchId: transfer.destination_branch_id || dstAccount.branch_id || srcAccount?.branch_id || null,
        costCenterId: transfer.destination_cost_center_id || transfer.source_cost_center_id || null,
        createdBy: userId,
      });
    } catch (jeErr) {
      console.log("Journal auto-post notice:", jeErr);
    }

    // 6. Update Transfer Record
    const updateRes = await client.query(
      `UPDATE treasury_transfers SET
        status = 'completed',
        received_by = $1,
        received_at = NOW(),
        receipt_notes = $2,
        destination_balance_before = $3,
        destination_balance_after = $4,
        destination_transaction_id = $5,
        journal_entry_id = COALESCE($6, journal_entry_id),
        updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [
        userId,
        receipt_notes || "تم تأكيد الاستلام الفعلي ومطابقة الرصيد",
        dstBalanceBefore,
        dstBalanceAfter,
        dstTxId,
        journalEntryId,
        id
      ]
    );

    // 7. Audit Log
    await logTransferAudit(
      client,
      Number(id),
      "receive",
      { status: transfer.status, destination_balance_before: dstBalanceBefore },
      { status: "completed", destination_balance_after: dstBalanceAfter, notes: receipt_notes },
      userId,
      `تأكيد استلام التحويل المالي رقم ${transfer.transfer_number} في ${dstAccount.name} بمبلغ ${dstCreditAmount} ج.م`,
      req
    );

    // 8. Notification
    await createTransferNotification(
      client,
      "تم استلام التحويل المالي بالكامل",
      `تم تأكيد استلام التحويل المالي رقم ${transfer.transfer_number} بنجاح وإيداعه في ${dstAccount.name}.`,
      "transfer_completed",
      transfer.created_by,
      Number(id)
    );

    await client.query("COMMIT");
    res.json(updateRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Receive Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to confirm receipt" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 13. CANCEL TRANSFER (Draft / Pending Approval -> Cancelled)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/cancel", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;
    const { cancellation_reason } = req.body;

    const trfRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const transfer = trfRes.rows[0];

    if (!["draft", "pending_approval", "rejected"].includes(transfer.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `لا يمكن إلغاء التحويل وهو بالحالة '${transfer.status}'. استخدم خيار 'عكس التحويل' إذا كان منفذاً.` });
    }

    const updatedRes = await client.query(
      `UPDATE treasury_transfers 
       SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW() 
       WHERE id = $2 RETURNING *`,
      [cancellation_reason || "إلغاء بواسطة المستخدم", id]
    );

    await logTransferAudit(
      client,
      Number(id),
      "cancel",
      { status: transfer.status },
      { status: "cancelled", cancellation_reason },
      userId,
      `إلغاء طلب التحويل المالي رقم ${transfer.transfer_number}`,
      req
    );

    await client.query("COMMIT");
    res.json(updatedRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Cancel Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to cancel transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 14. REVERSE TRANSFER (Reverse Executed / Completed Transfer)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/reverse", authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;
    const { reversal_reason } = req.body;

    if (!reversal_reason || !reversal_reason.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "يجب تحديد سبب عكس التحويل المالي" });
    }

    // 1. Fetch and Lock Transfer
    const trfRes = await client.query("SELECT * FROM treasury_transfers WHERE id = $1 FOR UPDATE", [id]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "التحويل المالي غير موجود" });
    }
    const transfer = trfRes.rows[0];

    if (!["completed", "posted", "received", "executed", "pending_receipt"].includes(transfer.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `لا يمكن عكس هذا التحويل في حالته الحالية (${transfer.status}).` });
    }

    if (transfer.status === "reversed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "هذا التحويل معكوس بالفعل مسبقاً." });
    }

    const transferAmount = parseFloat(transfer.amount);
    const transferFee = parseFloat(transfer.transfer_fee) || 0;
    const sourceRefundAmount = transferAmount + (transfer.fee_borne_by === 'source' ? transferFee : 0);
    const destDeductAmount = parseFloat(transfer.destination_amount) - (transfer.fee_borne_by === 'destination' ? transferFee : 0);

    // 2. Fetch and Lock Destination Account (if was completed / received)
    const isCompleted = ["completed", "posted", "received"].includes(transfer.status);
    if (isCompleted) {
      const dstRes = await client.query("SELECT * FROM treasury_accounts WHERE id = $1 FOR UPDATE", [transfer.destination_account_id]);
      const dstAccount = dstRes.rows[0];
      const dstCurrentBal = parseFloat(dstAccount.current_balance) || 0;

      if (dstCurrentBal < destDeductAmount) {
        await client.query("ROLLBACK");
        return res.status(400).json({ 
          error: `لا يمكن عكس التحويل: رصيد الخزينة المستهدفة الحالي (${dstCurrentBal.toLocaleString()} ج.م) أقل من المبلغ المراد استرداده (${destDeductAmount.toLocaleString()} ج.م).` 
        });
      }

      // Deduct from Destination Account
      await client.query("UPDATE treasury_accounts SET current_balance = current_balance - $1 WHERE id = $2", [destDeductAmount, transfer.destination_account_id]);
    }

    // 3. Refund to Source Account
    await client.query("UPDATE treasury_accounts SET current_balance = current_balance + $1 WHERE id = $2", [sourceRefundAmount, transfer.source_account_id]);

    // 4. Generate Reversal Number & Records
    const year = new Date().getFullYear();
    const reversalNumber = `REV-${transfer.transfer_number}`;

    // Record Reversal Treasury Transactions
    await client.query(
      `INSERT INTO treasury_transactions 
       (account_id, type, amount, reference_number, category, description, branch_id, cost_center_id, created_by, status, date)
       VALUES ($1, 'transfer_in', $2, $3, 'transfer_reversal', $4, $5, $6, $7, 'completed', NOW())`,
      [
        transfer.source_account_id,
        sourceRefundAmount,
        reversalNumber,
        `عكس تحويل مالي واسترداد نقدية - قيد أصلي ${transfer.transfer_number}`,
        transfer.source_branch_id,
        transfer.source_cost_center_id,
        userId
      ]
    );

    if (isCompleted) {
      await client.query(
        `INSERT INTO treasury_transactions 
         (account_id, type, amount, reference_number, category, description, branch_id, cost_center_id, created_by, status, date)
         VALUES ($1, 'transfer_out', $2, $3, 'transfer_reversal', $4, $5, $6, $7, 'completed', NOW())`,
        [
          transfer.destination_account_id,
          destDeductAmount,
          reversalNumber,
          `عكس تحويل مالي واسترداد نقدية - قيد أصلي ${transfer.transfer_number}`,
          transfer.destination_branch_id,
          transfer.destination_cost_center_id,
          userId
        ]
      );

      // Post Reversal Journal Entry (balanced, using the real chart of accounts)
      try {
        await postTransferGlEntry(client, {
          reference: reversalNumber,
          description: `عكس قيد التحويل المالي رقم ${transfer.transfer_number}. السبب: ${reversal_reason}`,
          sourceLabel: `عكس التحويل - ${transfer.transfer_number}`,
          destinationLabel: `استرداد قيد التحويل - ${transfer.transfer_number}`,
          amountOut: destDeductAmount,
          amountIn: sourceRefundAmount,
          sourceType: 'treasury_transfer_reversal',
          sourceId: transfer.id,
          branchId: transfer.source_branch_id || transfer.destination_branch_id || null,
          costCenterId: transfer.source_cost_center_id || transfer.destination_cost_center_id || null,
          createdBy: userId,
        });
      } catch (jeErr) {
        console.log("Reversal Journal Entry notice:", jeErr);
      }
    }

    // 5. Update Original Transfer
    const updatedRes = await client.query(
      `UPDATE treasury_transfers SET
        status = 'reversed',
        reversed_by = $1,
        reversed_at = NOW(),
        reversal_reason = $2,
        reversal_transfer_number = $3,
        updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [userId, reversal_reason, reversalNumber, id]
    );

    // 6. Audit Log
    await logTransferAudit(
      client,
      Number(id),
      "reverse",
      { status: transfer.status },
      { status: "reversed", reversal_reason, reversal_number: reversalNumber },
      userId,
      `عكس التحويل المالي رقم ${transfer.transfer_number}. السبب: ${reversal_reason}`,
      req
    );

    // 7. Notification
    await createTransferNotification(
      client,
      "تم عكس التحويل المالي",
      `تم عكس وإلغاء أثر التحويل المالي رقم ${transfer.transfer_number} واسترداد الأرصدة إلى وضعها السابق.`,
      "transfer_reversed",
      transfer.created_by,
      Number(id)
    );

    await client.query("COMMIT");
    res.json(updatedRes.rows[0]);
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Reverse Transfer Error:", error);
    res.status(500).json({ error: error.message || "Failed to reverse transfer" });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 15. ATTACHMENTS (Upload & Delete)
// ═══════════════════════════════════════════════════════════════
router.post("/api/treasury/transfers/:id/attachments", authenticateToken, (upload.single("file") as any), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || 1;
    const { document_type = "transfer_voucher", notes } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "لم يتم تحديد أي ملف للرفع" });
    }

    const fileUrl = `/uploads/transfers/${req.file.filename}`;
    const result = await pool.query(
      `INSERT INTO treasury_transfer_attachments 
       (transfer_id, file_name, file_url, file_type, file_size, document_type, notes, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        id,
        req.file.originalname,
        fileUrl,
        req.file.mimetype,
        req.file.size,
        document_type,
        notes || null,
        userId
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Upload Attachment Error:", error);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

router.delete("/api/treasury/transfers/:id/attachments/:attId", authenticateToken, async (req, res) => {
  try {
    const { id, attId } = req.params;
    await pool.query("DELETE FROM treasury_transfer_attachments WHERE id = $1 AND transfer_id = $2", [attId, id]);
    res.json({ success: true, message: "Attachment deleted" });
  } catch (error) {
    console.error("Delete Attachment Error:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

export default router;
