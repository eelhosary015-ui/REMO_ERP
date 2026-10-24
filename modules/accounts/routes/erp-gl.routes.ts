/**
 * ERP GL — Professional General Ledger API Routes
 * Includes: Fiscal Years, Periods, Budgets, Account Config,
 * Auto-Posting hooks, GL Audit, Enhanced Journal Entries
 */
import { Router } from "express";
import { pool } from "../../../server-db.js";
import { AccountRepository } from "../repositories/account.repository.js";
import {
  postSalesEntry, postPurchaseEntry, postPayrollEntry,
  postTreasuryEntry, postRestaurantOrderEntry, postCustomerPaymentEntry,
  postCostEntry, postReturnEntry, postComplaintRefundEntry,
  postInventoryAdjustmentEntry, postEmployeeAdvanceEntry,
  closePeriod, logGLAudit, recalculateBudgetActuals, getAccountConfig
} from "../services/auto-posting.service.js";
import { closePeriod as closePeriodSecure, reopenPeriod as reopenPeriodSecure, assertClosingPermission } from "../../accounts/services/period-closing.service.js";

const router = Router();
const repo = new AccountRepository();

// ═══════════════════════════════════════
// FISCAL YEARS
// ═══════════════════════════════════════

router.get("/fiscal-years", async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT fy.*,
        (SELECT COUNT(*) FROM financial_periods fp WHERE fp.fiscal_year_id = fy.id) as total_periods,
        (SELECT COUNT(*) FROM financial_periods fp WHERE fp.fiscal_year_id = fy.id AND fp.status = 'closed') as closed_periods
      FROM fiscal_years fy
      ORDER BY fy.start_date DESC
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch fiscal years", details: error.message });
  }
});

router.post("/fiscal-years", async (req: any, res: any) => {
  try {
    const { name, start_date, end_date } = req.body;
    if (!name || !start_date || !end_date) {
      return res.status(400).json({ error: "الاسم وتواريخ البداية والنهاية مطلوبة" });
    }

    const result = await pool.query(
      "INSERT INTO fiscal_years (name, start_date, end_date, created_by) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, start_date, end_date, req.user?.id]
    );

    // Auto-generate 12 periods for the fiscal year
    const fyId = result.rows[0].id;
    const start = new Date(start_date);
    const end = new Date(end_date);
    const periods = [];

    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    while (current <= end) {
      const month = current.getMonth() + 1;
      const year = current.getFullYear();
      const periodEnd = new Date(year, month, 0); // Last day of month

      const periodResult = await pool.query(
        `INSERT INTO financial_periods (fiscal_year_id, month, year, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (month, year) DO UPDATE SET fiscal_year_id = $1, start_date = $4, end_date = $5
         RETURNING *`,
        [fyId, month, year, current.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0]]
      );
      periods.push(periodResult.rows[0]);
      current.setMonth(current.getMonth() + 1);
    }

    await logGLAudit("fiscal_years", fyId, "create", req.user?.id || 0, req.ip, null, result.rows[0]);

    res.json({ ...result.rows[0], periods });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create fiscal year", details: error.message });
  }
});

router.put("/fiscal-years/:id/close", async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await pool.query(
      "UPDATE fiscal_years SET status = 'closed', closed_at = NOW() WHERE id = $1 AND status = 'open'",
      [id]
    );
    await logGLAudit("fiscal_years", parseInt(id), "close", req.user?.id || 0, req.ip);
    res.json({ success: true, message: "تم إقفال السنة المالية بنجاح" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to close fiscal year", details: error.message });
  }
});

// ═══════════════════════════════════════
// FINANCIAL PERIODS
// ═══════════════════════════════════════

router.get("/financial-periods", async (req: any, res: any) => {
  try {
    const { fiscal_year_id } = req.query;
    let query = `
      SELECT fp.*,
        COALESCE(SUM(ji.debit), 0) as period_debit,
        COALESCE(SUM(ji.credit), 0) as period_credit,
        COUNT(DISTINCT je.id) as entry_count
      FROM financial_periods fp
      LEFT JOIN journal_entries je ON je.period_id = fp.id AND je.status = 'posted'
      LEFT JOIN journal_items ji ON ji.journal_entry_id = je.id
    `;
    const params: any[] = [];
    if (fiscal_year_id) {
      query += " WHERE fp.fiscal_year_id = $1";
      params.push(fiscal_year_id);
    }
    query += " GROUP BY fp.id ORDER BY fp.year DESC, fp.month DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch financial periods", details: error.message });
  }
});

router.post("/financial-periods/:id/close", async (req: any, res: any) => {
  try {
    // المسار القديم كان يقفل بلا قفل صف ولا تحقق مسبق ولا سجل.
    // يُحوَّل الآن إلى خدمة الإقفال الموحّدة (نفس منطق /api/financial-periods/:id/close).
    assertClosingPermission(req.user, "close");
    const result = await closePeriodSecure(parseInt(req.params.id), {
      reason: req.body?.reason,
      user: req.user,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 400).json({ error: error.message || "Failed to close period", code: error.code, report: error.report });
  }
});

router.post("/financial-periods/:id/reopen", async (req: any, res: any) => {
  try {
    // كان يحذف قيود الإقفال فعليًا وينسى أي سجل؛ الآن إعادة فتح بسبب إلزامي وسجل تدقيق.
    assertClosingPermission(req.user, "reopen");
    const result = await reopenPeriodSecure(parseInt(req.params.id), {
      reason: req.body?.reason,
      user: req.user,
      force: !!req.body?.force,
      reopenClosedFiscalYear: !!req.body?.reopen_closed_fiscal_year,
    });
    res.json(result);
  } catch (error: any) {
    res.status(error.statusCode || 500).json({ error: error.message || "Failed to reopen period", code: error.code });
  }
});

// ═══════════════════════════════════════
// CHART OF ACCOUNTS (Enhanced)
// ═══════════════════════════════════════

router.get("/chart-of-accounts", async (req: any, res: any) => {
  try {
    const tree = await repo.getAccountTree();
    res.json(tree);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch chart of accounts", details: error.message });
  }
});

router.get("/accounts/:id/ledger", async (req: any, res: any) => {
  try {
    const accountId = parseInt(req.params.id);
    const { date_from, date_to, cost_center_id, page, page_size } = req.query;

    const result = await repo.getAccountLedger(accountId, {
      date_from: date_from as string,
      date_to: date_to as string,
      cost_center_id: cost_center_id ? parseInt(cost_center_id as string) : undefined,
      page: page ? parseInt(page as string) : undefined,
      page_size: page_size ? parseInt(page_size as string) : undefined,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch account ledger", details: error.message });
  }
});

// ═══════════════════════════════════════
// JOURNAL ENTRIES (Enhanced with pagination + filters)
// ═══════════════════════════════════════

router.get("/journal-entries", async (req: any, res: any) => {
  try {
    const { page, page_size, date_from, date_to, source_type, status, account_id, period_id } = req.query;

    const result = await repo.getJournalEntries({
      page: page ? parseInt(page as string) : undefined,
      page_size: page_size ? parseInt(page_size as string) : undefined,
      date_from: date_from as string,
      date_to: date_to as string,
      source_type: source_type as string,
      status: status as string,
      account_id: account_id ? parseInt(account_id as string) : undefined,
      period_id: period_id ? parseInt(period_id as string) : undefined,
    });

    const pageSize = parseInt(page_size as string) || 50;
    res.json({
      data: result.data,
      total: result.total,
      page: parseInt(page as string) || 1,
      page_size: pageSize,
      total_pages: Math.ceil(result.total / pageSize)
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch journal entries", details: error.message });
  }
});

router.post("/journal-entries", async (req: any, res: any) => {
  try {
    const { items, date, description, reference, source_type, source_id, period_id } = req.body;

    if (!items || !Array.isArray(items) || items.length < 2) {
      return res.status(400).json({ error: "القيد يجب أن يحتوي على خطين على الأقل" });
    }

    const totalDebit = items.reduce((sum: number, i: any) => sum + (parseFloat(i.debit) || 0), 0);
    const totalCredit = items.reduce((sum: number, i: any) => sum + (parseFloat(i.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        error: "القيد غير متوازن",
        total_debit: totalDebit,
        total_credit: totalCredit,
        difference: totalDebit - totalCredit
      });
    }

    const entry = await repo.createJournalEntry({
      items,
      date,
      description,
      reference,
      source_type: source_type || 'manual',
      source_id,
      period_id,
      status: 'posted',
      created_by: req.user?.id,
      branch_id: req.user?.branch_id,
    });

    await logGLAudit("journal_entries", entry.id, "create", req.user?.id || 0, req.ip, null, { date, description, total_debit: totalDebit, total_credit: totalCredit });

    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create journal entry", details: error.message });
  }
});

router.delete("/journal-entries/:id", async (req: any, res: any) => {
  try {
    const entryId = parseInt(req.params.id);
    const reversal = await repo.reverseJournalEntry(entryId, req.user?.id || 0);

    await logGLAudit("journal_entries", entryId, "delete", req.user?.id || 0, req.ip);
    res.json({ success: true, reversal_id: reversal.id, message: "تم إلغاء القيد بنجاح وإنشاء قيد عكسي" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to cancel journal entry", details: error.message });
  }
});

// ═══════════════════════════════════════
// ACCOUNT CONFIGURATION
// ═══════════════════════════════════════

router.get("/account-config", async (req: any, res: any) => {
  try {
    const result = await pool.query(`
      SELECT ac.*, a.code as account_code, COALESCE(a.name_ar, a.name) as account_name
      FROM account_config ac
      LEFT JOIN accounts a ON ac.account_id = a.id
      ORDER BY ac.key
    `);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch account config", details: error.message });
  }
});

router.put("/account-config", async (req: any, res: any) => {
  try {
    const { mappings } = req.body;
    if (!mappings || typeof mappings !== 'object') {
      return res.status(400).json({ error: "mappings object is required" });
    }

    for (const [key, accountId] of Object.entries(mappings)) {
      await pool.query(`
        INSERT INTO account_config (key, account_id, updated_at) VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET account_id = $2, updated_at = NOW()
      `, [key, accountId]);
    }

    res.json({ success: true, message: "تم تحديث إعدادات الحسابات بنجاح" });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update account config", details: error.message });
  }
});

// ═══════════════════════════════════════
// BUDGETS
// ═══════════════════════════════════════

router.get("/budgets", async (req: any, res: any) => {
  try {
    const { fiscal_year_id, account_id } = req.query;
    let query = `
      SELECT b.*, a.code as account_code, COALESCE(a.name_ar, a.name) as account_name, a.type as account_type
      FROM budgets b
      LEFT JOIN accounts a ON b.account_id = a.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (fiscal_year_id) {
      conditions.push("b.fiscal_year_id = $" + (params.length + 1));
      params.push(fiscal_year_id);
    }
    if (account_id) {
      conditions.push("b.account_id = $" + (params.length + 1));
      params.push(account_id);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY a.code";

    const result = await pool.query(query, params);

    // Enrich with variance calculations
    const enriched = result.rows.map((b: any) => ({
      ...b,
      annual_amount: parseFloat(b.annual_amount),
      actual_amount: parseFloat(b.actual_amount),
      variance: parseFloat(b.annual_amount) - parseFloat(b.actual_amount),
      variance_percent: parseFloat(b.annual_amount) > 0
        ? Math.round(((parseFloat(b.annual_amount) - parseFloat(b.actual_amount)) / parseFloat(b.annual_amount)) * 10000) / 100
        : 0
    }));

    res.json(enriched);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch budgets", details: error.message });
  }
});

router.post("/budgets", async (req: any, res: any) => {
  try {
    const { name, fiscal_year_id, account_id, cost_center_id, branch_id, monthly_amount, notes } = req.body;
    if (!name || !fiscal_year_id || !account_id) {
      return res.status(400).json({ error: "الاسم والسنة المالية والحساب مطلوبون" });
    }

    const annual = parseFloat(monthly_amount || 0) * 12;
    const result = await pool.query(`
      INSERT INTO budgets (name, fiscal_year_id, account_id, cost_center_id, branch_id, monthly_amount, annual_amount, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *
    `, [name, fiscal_year_id, account_id, cost_center_id, branch_id, monthly_amount, annual, notes, req.user?.id]);

    await logGLAudit("budgets", result.rows[0].id, "create", req.user?.id || 0, req.ip, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to create budget", details: error.message });
  }
});

router.put("/budgets/:id", async (req: any, res: any) => {
  try {
    const { monthly_amount, notes, status } = req.body;
    const annual = parseFloat(monthly_amount || 0) * 12;
    const result = await pool.query(`
      UPDATE budgets SET monthly_amount = $1, annual_amount = $2, notes = $3, status = COALESCE($4, status), updated_at = NOW()
      WHERE id = $5 RETURNING *
    `, [monthly_amount, annual, notes, status, req.params.id]);

    await logGLAudit("budgets", parseInt(req.params.id), "update", req.user?.id || 0, req.ip, null, result.rows[0]);
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to update budget", details: error.message });
  }
});

router.post("/budgets/recalculate", async (req: any, res: any) => {
  try {
    const { fiscal_year_id } = req.body;
    if (!fiscal_year_id) {
      return res.status(400).json({ error: "fiscal_year_id is required" });
    }

    const count = await recalculateBudgetActuals(fiscal_year_id);
    res.json({ success: true, updated_budgets: count, message: `تم إعادة حساب ${count} موازنة` });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to recalculate budgets", details: error.message });
  }
});

// ═══════════════════════════════════════
// GL AUDIT LOGS
// ═══════════════════════════════════════

router.get("/gl-audit-logs", async (req: any, res: any) => {
  try {
    const { table_name, record_id, limit } = req.query;
    let query = `
      SELECT al.*, u.username as user_name
      FROM gl_audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
    `;
    const params: any[] = [];
    const conditions: string[] = [];

    if (table_name) {
      conditions.push("al.table_name = $" + (params.length + 1));
      params.push(table_name);
    }
    if (record_id) {
      conditions.push("al.record_id = $" + (params.length + 1));
      params.push(record_id);
    }
    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }
    query += " ORDER BY al.created_at DESC LIMIT " + (parseInt(limit as string) || 100);

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch GL audit logs", details: error.message });
  }
});

// ═══════════════════════════════════════
// SUB-LEDGER (AR/AP)
// ═══════════════════════════════════════

router.get("/sub-ledger", async (req: any, res: any) => {
  try {
    const { partner_type, partner_id, status } = req.query;
    let query = "SELECT * FROM sub_ledger_entries WHERE 1=1";
    const params: any[] = [];

    if (partner_type) {
      query += " AND partner_type = $" + (params.length + 1);
      params.push(partner_type);
    }
    if (partner_id) {
      query += " AND partner_id = $" + (params.length + 1);
      params.push(partner_id);
    }
    if (status) {
      query += " AND status = $" + (params.length + 1);
      params.push(status);
    }
    query += " ORDER BY created_at DESC LIMIT 200";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to fetch sub-ledger", details: error.message });
  }
});

// ═══════════════════════════════════════
// AUTO-POSTING TRIGGERS (called by other modules)
// ═══════════════════════════════════════

router.post("/auto-post/sales", async (req: any, res: any) => {
  try {
    const entry = await postSalesEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post sales failed", details: error.message });
  }
});

router.post("/auto-post/purchase", async (req: any, res: any) => {
  try {
    const entry = await postPurchaseEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post purchase failed", details: error.message });
  }
});

router.post("/auto-post/payroll", async (req: any, res: any) => {
  try {
    const entry = await postPayrollEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post payroll failed", details: error.message });
  }
});

router.post("/auto-post/restaurant", async (req: any, res: any) => {
  try {
    const entry = await postRestaurantOrderEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post restaurant order failed", details: error.message });
  }
});

router.post("/auto-post/customer-payment", async (req: any, res: any) => {
  try {
    const entry = await postCustomerPaymentEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post customer payment failed", details: error.message });
  }
});

router.post("/auto-post/cost", async (req: any, res: any) => {
  try {
    const entry = await postCostEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post cost failed", details: error.message });
  }
});

router.post("/auto-post/return", async (req: any, res: any) => {
  try {
    const entry = await postReturnEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post return failed", details: error.message });
  }
});

router.post("/auto-post/complaint-refund", async (req: any, res: any) => {
  try {
    const entry = await postComplaintRefundEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post complaint refund failed", details: error.message });
  }
});

router.post("/auto-post/inventory-adjustment", async (req: any, res: any) => {
  try {
    const entry = await postInventoryAdjustmentEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post inventory adjustment failed", details: error.message });
  }
});

router.post("/auto-post/employee-advance", async (req: any, res: any) => {
  try {
    const entry = await postEmployeeAdvanceEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post employee advance failed", details: error.message });
  }
});

router.post("/auto-post/treasury", async (req: any, res: any) => {
  try {
    const entry = await postTreasuryEntry(req.body);
    if (!entry) return res.json({ skipped: true, message: "لم يتم إنشاء قيد — الحسابات غير مضبوطة" });
    res.json({ success: true, journal_entry_id: entry.id, reference: entry.reference });
  } catch (error: any) {
    res.status(500).json({ error: "Auto-post treasury failed", details: error.message });
  }
});

// Auto-post status dashboard: check which modules have GL integration
router.get("/auto-post/status", async (req: any, res: any) => {
  try {
    const config = await getAccountConfig();
    const configuredCount = Object.values(config).filter(Boolean).length;
    
    // Count auto-posted entries by source
    const sourceResult = await pool.query(`
      SELECT source_type, COUNT(*) as count, 
             SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted,
             COALESCE(SUM(total_debit), 0) as total_debit,
             COALESCE(SUM(total_credit), 0) as total_credit
      FROM journal_entries 
      WHERE source_type != 'manual' AND source_type != 'closing'
      GROUP BY source_type
      ORDER BY count DESC
    `);
    
    res.json({
      config_status: {
        total_keys: 27,
        configured_keys: configuredCount,
        is_ready: configuredCount >= 5, // Minimum 5 accounts configured
      },
      posting_stats: sourceResult.rows,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to get auto-post status", details: error.message });
  }
});

// ═══════════════════════════════════════
// ENHANCED REPORTS
// ═══════════════════════════════════════

router.get("/reports/trial-balance-enhanced", async (req: any, res: any) => {
  try {
    const { period_id, as_of_date } = req.query;

    let dateCondition = "";
    const params: any[] = [];

    if (period_id) {
      // Only posted entries belong in a trial balance — drafts must never leak in.
      dateCondition = " AND je.period_id = $" + (params.length + 1) + " AND je.status = 'posted'";
      params.push(period_id);
    } else if (as_of_date) {
      dateCondition = " AND je.date <= $" + (params.length + 1) + " AND je.status = 'posted'";
      params.push(as_of_date);
    } else {
      dateCondition = " AND je.status = 'posted'";
    }

    const result = await pool.query(`
      SELECT 
        a.id, a.code, COALESCE(a.name_ar, a.name) as name, a.type, a.account_nature,
        a.balance as opening_balance,
        COALESCE(SUM(ji.debit), 0) as period_debit,
        COALESCE(SUM(ji.credit), 0) as period_credit,
        a.balance + COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0) as closing_balance
      FROM accounts a
      LEFT JOIN journal_items ji ON ji.account_id = a.id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE a.is_leaf = true AND a.status = true ${dateCondition}
      GROUP BY a.id, a.code, a.name, a.name_ar, a.type, a.account_nature, a.balance
      HAVING COALESCE(SUM(ji.debit), 0) > 0 OR COALESCE(SUM(ji.credit), 0) > 0 OR a.balance != 0
      ORDER BY a.code
    `, params);

    const totalDebit = result.rows.reduce((s: number, r: any) => s + parseFloat(r.period_debit), 0);
    const totalCredit = result.rows.reduce((s: number, r: any) => s + parseFloat(r.period_credit), 0);
    const totalClosing = result.rows.reduce((s: number, r: any) => s + parseFloat(r.closing_balance), 0);

    res.json({
      accounts: result.rows.map((r: any) => ({
        ...r,
        opening_balance: parseFloat(r.opening_balance),
        period_debit: parseFloat(r.period_debit),
        period_credit: parseFloat(r.period_credit),
        closing_balance: parseFloat(r.closing_balance)
      })),
      totals: {
        period_debit: totalDebit,
        period_credit: totalCredit,
        closing_debit: result.rows.filter((r: any) => parseFloat(r.closing_balance) > 0).reduce((s: number, r: any) => s + parseFloat(r.closing_balance), 0),
        closing_credit: result.rows.filter((r: any) => parseFloat(r.closing_balance) < 0).reduce((s: number, r: any) => s + Math.abs(parseFloat(r.closing_balance)), 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate trial balance", details: error.message });
  }
});

router.get("/reports/income-statement-enhanced", async (req: any, res: any) => {
  try {
    const { period_id, as_of_date, fiscal_year_id } = req.query;

    let whereCondition = "je.status = 'posted' AND a.type IN ('revenue', 'expense')";
    const params: any[] = [];

    if (period_id) {
      whereCondition += " AND je.period_id = $" + (params.length + 1);
      params.push(period_id);
    } else if (fiscal_year_id) {
      whereCondition += " AND je.date >= (SELECT start_date FROM fiscal_years WHERE id = $" + (params.length + 1) + ") AND je.date <= (SELECT end_date FROM fiscal_years WHERE id = $" + (params.length + 2) + ")";
      params.push(fiscal_year_id, fiscal_year_id);
    } else if (as_of_date) {
      whereCondition += " AND je.date <= $" + (params.length + 1);
      params.push(as_of_date);
    }

    const result = await pool.query(`
      SELECT 
        a.id, a.code, COALESCE(a.name_ar, a.name) as name, a.type,
        SUM(ji.debit) as total_debit,
        SUM(ji.credit) as total_credit,
        CASE WHEN a.type = 'revenue' THEN SUM(ji.credit) - SUM(ji.debit)
             ELSE SUM(ji.debit) - SUM(ji.credit)
        END as net_amount
      FROM accounts a
      JOIN journal_items ji ON ji.account_id = a.id
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      WHERE ${whereCondition}
      GROUP BY a.id, a.code, a.name, a.name_ar, a.type
      ORDER BY a.type, a.code
    `, params);

    const revenues = result.rows.filter((r: any) => r.type === 'revenue');
    const expenses = result.rows.filter((r: any) => r.type === 'expense');
    const totalRevenue = revenues.reduce((s: number, r: any) => s + parseFloat(r.net_amount), 0);
    const totalExpenses = expenses.reduce((s: number, r: any) => s + parseFloat(r.net_amount), 0);
    const netIncome = totalRevenue - totalExpenses;

    res.json({
      revenues: revenues.map((r: any) => ({ ...r, net_amount: parseFloat(r.net_amount) })),
      expenses: expenses.map((r: any) => ({ ...r, net_amount: parseFloat(r.net_amount) })),
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: netIncome,
      gross_profit_percentage: totalRevenue > 0 ? Math.round((netIncome / totalRevenue) * 10000) / 100 : 0
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate income statement", details: error.message });
  }
});

router.get("/reports/balance-sheet-enhanced", async (req: any, res: any) => {
  try {
    const { as_of_date } = req.query;

    // Always restrict to posted entries; an as-of-date cutoff must not admit drafts.
    const dateFilter = as_of_date
      ? " AND je.date <= $" + 1 + " AND je.status = 'posted'"
      : " AND je.status = 'posted'";
    const params: any[] = as_of_date ? [as_of_date] : [];

    const result = await pool.query(`
      SELECT 
        a.id, a.code, COALESCE(a.name_ar, a.name) as name, a.type,
        a.balance + COALESCE(SUM(CASE WHEN a.account_nature = 'debit' THEN ji.debit - ji.credit ELSE ji.credit - ji.debit END), 0) as balance
      FROM accounts a
      LEFT JOIN journal_items ji ON ji.account_id = a.id
      LEFT JOIN journal_entries je ON ji.journal_entry_id = je.id ${dateFilter}
      WHERE a.is_leaf = true AND a.status = true AND a.type IN ('asset', 'liability', 'equity')
      GROUP BY a.id, a.code, a.name, a.name_ar, a.type, a.balance
      HAVING a.balance + COALESCE(SUM(CASE WHEN a.account_nature = 'debit' THEN ji.debit - ji.credit ELSE ji.credit - ji.debit END), 0) != 0
      ORDER BY a.type, a.code
    `, params);

    const assets = result.rows.filter((r: any) => r.type === 'asset').map((r: any) => ({ ...r, balance: parseFloat(r.balance) }));
    const liabilities = result.rows.filter((r: any) => r.type === 'liability').map((r: any) => ({ ...r, balance: Math.abs(parseFloat(r.balance)) }));
    const equity = result.rows.filter((r: any) => r.type === 'equity').map((r: any) => ({ ...r, balance: Math.abs(parseFloat(r.balance)) }));

    const totalAssets = assets.reduce((s: number, r: any) => s + r.balance, 0);
    const totalLiabilities = liabilities.reduce((s: number, r: any) => s + r.balance, 0);
    const totalEquity = equity.reduce((s: number, r: any) => s + r.balance, 0);

    // Add net income to equity if revenue/expense accounts exist
    const netIncomeResult = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN a.type = 'revenue' THEN ji.credit - ji.debit ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN a.type = 'expense' THEN ji.debit - ji.credit ELSE 0 END), 0) as net_income
      FROM journal_items ji
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      JOIN accounts a ON ji.account_id = a.id
      WHERE je.status = 'posted' ${dateFilter}
    `, params);
    const netIncome = parseFloat(netIncomeResult.rows[0].net_income) || 0;

    res.json({
      assets,
      liabilities,
      equity: [...equity, { id: 0, code: 'NET', name: 'صافي الربح/الخسارة', type: 'equity', balance: netIncome }],
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity + netIncome,
      balance_check: Math.abs(totalAssets - (totalLiabilities + totalEquity + netIncome)) < 0.01
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate balance sheet", details: error.message });
  }
});

export default router;