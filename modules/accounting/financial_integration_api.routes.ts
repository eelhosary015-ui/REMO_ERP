import { Router } from "express";
import { pool } from "../../server-db.js";
import { financialIntegrationService, FinancialEventPayload } from "./services/financial_integration.service.js";
import { authenticateToken } from "../system/system_api.routes.js";

const router = Router();

/**
 * 1. POST /api/financial/integrate
 * Central Entry Point for any ERP Module to post a business event into Financial Integration Layer
 */
router.post("/api/financial/integrate", authenticateToken, async (req: any, res: any) => {
  try {
    const payload: FinancialEventPayload = req.body;

    if (!payload.sourceType || payload.sourceId === undefined || payload.totalAmount === undefined) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PAYLOAD",
        message: "حقول المصدر والمبلغ الإجمالي مطلوبة لإتمام التكامل المالي (sourceType, sourceId, totalAmount)",
      });
    }

    // Attach user from token if available
    if (req.user?.id && !payload.userId) {
      payload.userId = Number(req.user.id);
    }
    if (req.user?.branch_id && !payload.branchId) {
      payload.branchId = Number(req.user.branch_id);
    }

    const result = await financialIntegrationService.processFinancialTransaction(payload);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("Financial Integration API Error:", error);
    return res.status(500).json({
      success: false,
      error: "FINANCIAL_INTEGRATION_ERROR",
      message: error.message || "حدث خطأ أثناء معالجة التكامل المالي",
    });
  }
});

/**
 * 2. GET /api/financial/transactions
 * Retrieve central financial transactions with rich filtering, search, and pagination
 */
router.get("/api/financial/transactions", authenticateToken, async (req: any, res: any) => {
  try {
    const {
      source_type,
      payment_method,
      status,
      branch_id,
      date_from,
      date_to,
      search,
      limit = 50,
      offset = 0,
    } = req.query;

    let whereClauses: string[] = ["1=1"];
    const params: any[] = [];
    let pIdx = 1;

    if (source_type) {
      whereClauses.push(`ft.source_type = $${pIdx++}`);
      params.push(source_type);
    }
    if (payment_method) {
      whereClauses.push(`ft.payment_method = $${pIdx++}`);
      params.push(payment_method);
    }
    if (status) {
      whereClauses.push(`ft.status = $${pIdx++}`);
      params.push(status);
    }
    if (branch_id) {
      whereClauses.push(`ft.branch_id = $${pIdx++}`);
      params.push(branch_id);
    }
    if (date_from) {
      whereClauses.push(`ft.created_at >= $${pIdx++}`);
      params.push(new Date(date_from as string));
    }
    if (date_to) {
      whereClauses.push(`ft.created_at <= $${pIdx++}`);
      params.push(new Date(date_to as string));
    }
    if (search) {
      whereClauses.push(`(
        ft.fin_number ILIKE $${pIdx} OR 
        ft.source_document_number ILIKE $${pIdx} OR 
        ft.description ILIKE $${pIdx} OR 
        c.name ILIKE $${pIdx} OR 
        s.name ILIKE $${pIdx}
      )`);
      params.push(`%${search}%`);
      pIdx++;
    }

    const whereStr = whereClauses.join(" AND ");

    const query = `
      SELECT 
        ft.*,
        ta.name as treasury_account_name,
        ba.name as bank_account_name,
        c.name as customer_name,
        s.name as supplier_name,
        u.username as user_name,
        je.reference as journal_reference
      FROM financial_transactions ft
      LEFT JOIN treasury_accounts ta ON ft.treasury_account_id = ta.id
      LEFT JOIN bank_accounts ba ON ft.bank_account_id = ba.id
      LEFT JOIN customers c ON ft.customer_id = c.id
      LEFT JOIN suppliers s ON ft.supplier_id = s.id
      LEFT JOIN users u ON ft.user_id = u.id
      LEFT JOIN journal_entries je ON ft.journal_entry_id = je.id
      WHERE ${whereStr}
      ORDER BY ft.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++}
    `;

    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM financial_transactions ft
      LEFT JOIN customers c ON ft.customer_id = c.id
      LEFT JOIN suppliers s ON ft.supplier_id = s.id
      WHERE ${whereStr}
    `;

    const [rowsRes, countRes] = await Promise.all([
      pool.query(query, [...params, limit, offset]),
      pool.query(countQuery, params),
    ]);

    return res.json({
      success: true,
      transactions: rowsRes.rows,
      total: countRes.rows[0]?.total || 0,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error: any) {
    console.error("Fetch financial transactions error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch financial transactions" });
  }
});

/**
 * 3. GET /api/financial/transactions/:id
 * Deep Breakdown of a specific Financial Transaction with all linked accounting lines
 */
router.get("/api/financial/transactions/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const isNum = !isNaN(Number(id));

    const txRes = await pool.query(
      `SELECT 
        ft.*,
        ta.name as treasury_account_name,
        ba.name as bank_account_name,
        c.name as customer_name,
        s.name as supplier_name,
        u.username as user_name
      FROM financial_transactions ft
      LEFT JOIN treasury_accounts ta ON ft.treasury_account_id = ta.id
      LEFT JOIN bank_accounts ba ON ft.bank_account_id = ba.id
      LEFT JOIN customers c ON ft.customer_id = c.id
      LEFT JOIN suppliers s ON ft.supplier_id = s.id
      LEFT JOIN users u ON ft.user_id = u.id
      WHERE ${isNum ? "ft.id = $1" : "ft.fin_number = $1"}
      LIMIT 1`,
      [id]
    );

    if (txRes.rows.length === 0) {
      return res.status(404).json({ error: "FINANCIAL_TRANSACTION_NOT_FOUND", message: "الحركة المالية غير موجودة" });
    }

    const tx = txRes.rows[0];

    // Fetch Treasury Tx details if linked
    let treasuryDetail = null;
    if (tx.treasury_transaction_id) {
      const tRes = await pool.query(
        `SELECT tt.*, ta.name as safe_name FROM treasury_transactions tt LEFT JOIN treasury_accounts ta ON tt.account_id = ta.id WHERE tt.id = $1`,
        [tx.treasury_transaction_id]
      );
      treasuryDetail = tRes.rows[0] || null;
    }

    // Fetch Bank Tx details if linked
    let bankDetail = null;
    if (tx.bank_transaction_id) {
      const bRes = await pool.query(
        `SELECT bt.*, ba.name as bank_name FROM bank_transactions bt LEFT JOIN bank_accounts ba ON bt.account_id = ba.id WHERE bt.id = $1`,
        [tx.bank_transaction_id]
      );
      bankDetail = bRes.rows[0] || null;
    }

    // Fetch Customer Tx details if linked
    let customerDetail = null;
    if (tx.customer_transaction_id) {
      const cRes = await pool.query(`SELECT * FROM customer_transactions WHERE id = $1`, [tx.customer_transaction_id]);
      customerDetail = cRes.rows[0] || null;
    }

    // Fetch Supplier Tx details if linked
    let supplierDetail = null;
    if (tx.supplier_transaction_id) {
      const sRes = await pool.query(`SELECT * FROM supplier_transactions WHERE id = $1`, [tx.supplier_transaction_id]);
      supplierDetail = sRes.rows[0] || null;
    }

    // Fetch GL Journal items if linked
    let glJournal = null;
    if (tx.journal_entry_id) {
      const jRes = await pool.query(`SELECT * FROM journal_entries WHERE id = $1`, [tx.journal_entry_id]);
      const jiRes = await pool.query(
        `SELECT ji.*, a.code as account_code, a.name as account_name, cc.name as cost_center_name
         FROM journal_items ji
         LEFT JOIN accounts a ON ji.account_id = a.id
         LEFT JOIN cost_centers cc ON ji.cost_center_id = cc.id
         WHERE ji.journal_entry_id = $1
         ORDER BY ji.id ASC`,
        [tx.journal_entry_id]
      );
      glJournal = {
        ...jRes.rows[0],
        items: jiRes.rows,
      };
    }

    // Fetch Audit history
    const auditRes = await pool.query(
      `SELECT * FROM financial_integration_logs WHERE fin_number = $1 OR (source_type = $2 AND source_id = $3) ORDER BY created_at DESC`,
      [tx.fin_number, tx.source_type, tx.source_id]
    );

    return res.json({
      success: true,
      transaction: tx,
      linkedEntities: {
        treasury: treasuryDetail,
        bank: bankDetail,
        customer: customerDetail,
        supplier: supplierDetail,
        glJournal,
        auditLogs: auditRes.rows,
      },
    });
  } catch (error: any) {
    console.error("Get financial transaction details error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch details" });
  }
});

/**
 * 4. GET /api/financial/summary
 * Executive KPI summary of all integrated financial flows
 */
router.get("/api/financial/summary", authenticateToken, async (_req: any, res: any) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [txSummary, treasurySummary, bankSummary, glSummary, integrityRes] = await Promise.all([
      pool.query(`
        SELECT 
          COUNT(*)::int as total_transactions,
          COALESCE(SUM(CASE WHEN created_at::date = $1 THEN 1 ELSE 0 END), 0)::int as today_transactions,
          COALESCE(SUM(total_amount), 0)::float as total_volume,
          COALESCE(SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END), 0)::int as posted_count,
          COALESCE(SUM(CASE WHEN status = 'reversed' THEN 1 ELSE 0 END), 0)::int as reversed_count
        FROM financial_transactions
      `, [today]),

      pool.query(`
        SELECT 
          COALESCE(SUM(current_balance), 0)::float as total_treasury_balance,
          (SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::float FROM treasury_transactions WHERE status != 'reversed') as total_cash_in,
          (SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0)::float FROM treasury_transactions WHERE status != 'reversed') as total_cash_out
        FROM treasury_accounts WHERE status = 'active' OR status IS NULL
      `),

      pool.query(`
        SELECT 
          COALESCE(SUM(balance), 0)::float as total_bank_balance,
          (SELECT COALESCE(SUM(amount), 0)::float FROM bank_transactions WHERE type = 'credit') as total_bank_in,
          (SELECT COALESCE(SUM(amount), 0)::float FROM bank_transactions WHERE type = 'debit') as total_bank_out
        FROM bank_accounts WHERE is_active = true OR is_active IS NULL
      `),

      pool.query(`
        SELECT 
          COALESCE(SUM(debit), 0)::float as total_gl_debit,
          COALESCE(SUM(credit), 0)::float as total_gl_credit
        FROM journal_items
      `),

      financialIntegrationService.reconcileFinancialIntegrity(),
    ]);

    const tx = txSummary.rows[0] || {};
    const tr = treasurySummary.rows[0] || {};
    const bk = bankSummary.rows[0] || {};
    const gl = glSummary.rows[0] || {};

    return res.json({
      success: true,
      summary: {
        totalTransactions: tx.total_transactions || 0,
        todayTransactions: tx.today_transactions || 0,
        totalVolume: tx.total_volume || 0,
        postedCount: tx.posted_count || 0,
        reversedCount: tx.reversed_count || 0,
        treasury: {
          totalBalance: tr.total_treasury_balance || 0,
          totalCashIn: tr.total_cash_in || 0,
          totalCashOut: tr.total_cash_out || 0,
        },
        bank: {
          totalBalance: bk.total_bank_balance || 0,
          totalBankIn: bk.total_bank_in || 0,
          totalBankOut: bk.total_bank_out || 0,
        },
        gl: {
          totalDebit: gl.total_gl_debit || 0,
          totalCredit: gl.total_gl_credit || 0,
          isBalanced: Math.abs((gl.total_gl_debit || 0) - (gl.total_gl_credit || 0)) < 0.1,
        },
        integrity: integrityRes,
      },
    });
  } catch (error: any) {
    console.error("Fetch financial summary error:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch financial summary" });
  }
});

/**
 * 5. POST /api/financial/reverse/:id
 * Reverses a Financial Transaction atomically
 */
router.post("/api/financial/reverse/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { reason = "طلب إلغاء وعكس يدوي من المستخدم" } = req.body;
    const userId = req.user?.id ? Number(req.user.id) : 1;

    const result = await financialIntegrationService.reverseFinancialTransaction(id, reason, userId);
    return res.json(result);
  } catch (error: any) {
    console.error("Reverse financial transaction error:", error);
    return res.status(500).json({ success: false, error: error.message || "فشل عكس الحركة المالية" });
  }
});

/**
 * 6. GET /api/financial/audit-trail
 * List complete audit trail of all central financial events
 */
router.get("/api/financial/audit-trail", authenticateToken, async (req: any, res: any) => {
  try {
    const { fin_number, source_type, limit = 50 } = req.query;
    let whereClauses = ["1=1"];
    const params: any[] = [];
    let pIdx = 1;

    if (fin_number) {
      whereClauses.push(`fin_number = $${pIdx++}`);
      params.push(fin_number);
    }
    if (source_type) {
      whereClauses.push(`source_type = $${pIdx++}`);
      params.push(source_type);
    }

    const query = `
      SELECT fil.*, u.username as user_name
      FROM financial_integration_logs fil
      LEFT JOIN users u ON fil.user_id = u.id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY fil.created_at DESC
      LIMIT $${pIdx++}
    `;

    const resLogs = await pool.query(query, [...params, limit]);
    return res.json({ success: true, logs: resLogs.rows });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || "Failed to fetch audit trail" });
  }
});

/**
 * 7. POST /api/financial/reconcile
 * Trigger system-wide financial integrity audit
 */
router.post("/api/financial/reconcile", authenticateToken, async (_req: any, res: any) => {
  try {
    const result = await financialIntegrationService.reconcileFinancialIntegrity();
    return res.json({ success: true, reconciliation: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Failed to run reconciliation" });
  }
});

/**
 * 8. POST /api/financial/test-flow
 * Runs an end-to-end integration test scenario (Sales Cash, Sales Credit, Purchase Cash, Treasury Transfer, Payroll)
 */
router.post("/api/financial/test-flow", authenticateToken, async (req: any, res: any) => {
  try {
    const { scenario = "SALES_CASH" } = req.body;
    const testRef = `TEST-${Date.now()}`;
    let payload: FinancialEventPayload;

    switch (scenario) {
      case "SALES_CREDIT":
        payload = {
          sourceType: "SALES_INVOICE",
          sourceId: testRef,
          eventType: "INVOICE_POSTED",
          totalAmount: 3500,
          paymentMethod: "credit",
          customerId: 1,
          description: "فاتورة مبيعات آجلة تجريبية للاختبار المركزي",
        };
        break;

      case "PURCHASE_CASH":
        payload = {
          sourceType: "PURCHASE_INVOICE",
          sourceId: testRef,
          eventType: "INVOICE_PAID",
          totalAmount: 1800,
          paymentMethod: "cash",
          supplierId: 1,
          description: "فاتورة مشتريات نقدية تجريبية للاختبار المركزي",
        };
        break;

      case "PAYROLL":
        payload = {
          sourceType: "PAYROLL_BATCH",
          sourceId: testRef,
          eventType: "SALARIES_DISBURSED",
          totalAmount: 12500,
          paymentMethod: "cash",
          description: "صرف رواتب شهرية تجريبية للاختبار المركزي",
        };
        break;

      case "SALES_CASH":
      default:
        payload = {
          sourceType: "SALES_INVOICE",
          sourceId: testRef,
          eventType: "INVOICE_POSTED",
          totalAmount: 2500,
          paymentMethod: "cash",
          description: "فاتورة مبيعات نقدية تجريبية للاختبار المركزي",
        };
        break;
    }

    const result = await financialIntegrationService.processFinancialTransaction(payload);
    return res.json({ success: true, testScenario: scenario, result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message || "Test flow execution failed" });
  }
});

export default router;
