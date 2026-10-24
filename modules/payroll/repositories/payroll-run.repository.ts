import { pool } from "../../../server-db.js";

/**
 * مسير المرتبات (Payroll Run)
 * ─────────────────────────────
 * يعيد استخدام جدول `payroll_months` الموجود بالفعل كنظام مسير شهري، ويضيف
 * إليه أعمدة الترحيل المالي (الإجماليات وحالة الإقفال والقيد المحاسبي) وأعمدة
 * التوسع، بدلًا من إنشاء نظام مرتبات موازٍ.
 *
 * الحالات:
 *   draft          → مسودة (لم يُرحَّل أي قيد بعد)
 *   accrued        → معتمد / مقفل ومستحق الدفع (تم ترحيل قيد الاستحقاق)
 *   partially_paid → مصروف جزئيًا
 *   paid           → مصروف بالكامل
 */
export type PayrollRunStatus = "draft" | "accrued" | "partially_paid" | "paid";

export interface PayrollRunRecord {
  id: number;
  year: number;
  month: number;
  branch_id: number | null;
  department_id: number | null;
  status: PayrollRunStatus | string;
  run_number: string | null;
  total_net: number;
  total_paid: number;
  total_additions: number;
  total_deductions: number;
  accrual_journal_entry_id: number | null;
  accrual_reference: string | null;
  paid_at: Date | null;
  notes: string | null;
  created_by: number | null;
  updated_by: number | null;
}

export interface PayrollRunItemRecord {
  id: number;
  run_id: number;
  employee_id: number;
  employee_code: string | null;
  employee_name: string | null;
  basic_salary: number;
  additions: number;
  deductions: number;
  net_salary: number;
  paid_amount: number;
}

const RUN_COLUMNS = `
  id, year, month, branch_id, department_id, status, run_number,
  COALESCE(total_net, 0)::numeric AS total_net,
  COALESCE(total_paid, 0)::numeric AS total_paid,
  COALESCE(total_additions, 0)::numeric AS total_additions,
  COALESCE(total_deductions, 0)::numeric AS total_deductions,
  accrual_journal_entry_id, accrual_reference, paid_at, notes, created_by, updated_by, created_at, closed_at
`;

export class PayrollRunRepository {
  private static schemaEnsured = false;

  /**
   * DDL idempotent. When an explicit db client is supplied (behavioural tests or
   * an open transaction) the statements run on that connection every time, so
   * they participate in the caller's transaction instead of leaking DDL.
   */
  async ensureSchema(db: any = pool): Promise<void> {
    if (db === pool && PayrollRunRepository.schemaEnsured) return;

    await db.query(`
      CREATE TABLE IF NOT EXISTS payroll_months (
        id SERIAL PRIMARY KEY,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        status VARCHAR(30) DEFAULT 'draft',
        closed_at TIMESTAMP,
        closed_by INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const additions = [
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS branch_id INTEGER",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS department_id INTEGER",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS run_number TEXT",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS total_net DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS total_paid DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS total_additions DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS total_deductions DECIMAL(15,2) DEFAULT 0",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS accrual_journal_entry_id INTEGER",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS accrual_reference TEXT",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS created_by INTEGER",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS updated_by INTEGER",
      "ALTER TABLE payroll_months ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ];
    for (const statement of additions) {
      await db.query(statement);
    }

    // مسير واحد لكل (شهر، سنة، فرع، قسم). التعبير COALESCE يجعل الفرع/القسم
    // الفارغ قيمة واحدة بدل NULL المتكررة.
    await db.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS payroll_months_period_uidx
        ON payroll_months (year, month, COALESCE(branch_id, 0), COALESCE(department_id, 0))
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS payroll_run_items (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES payroll_months(id) ON DELETE CASCADE,
        employee_id INTEGER NOT NULL,
        employee_code TEXT,
        employee_name TEXT,
        basic_salary DECIMAL(15,2) DEFAULT 0,
        additions DECIMAL(15,2) DEFAULT 0,
        deductions DECIMAL(15,2) DEFAULT 0,
        net_salary DECIMAL(15,2) DEFAULT 0,
        paid_amount DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (run_id, employee_id)
      )
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS payroll_payments (
        id SERIAL PRIMARY KEY,
        run_id INTEGER NOT NULL REFERENCES payroll_months(id) ON DELETE CASCADE,
        amount DECIMAL(15,2) NOT NULL,
        payment_source TEXT NOT NULL DEFAULT 'cash',
        treasury_account_id INTEGER,
        treasury_transaction_id INTEGER,
        journal_entry_id INTEGER,
        voucher_number TEXT,
        payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
        reference_number TEXT,
        payment_method TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'posted',
        idempotency_key TEXT,
        reversal_journal_entry_id INTEGER,
        reversal_transaction_id INTEGER,
        reversed_at TIMESTAMP,
        reversed_by INTEGER,
        created_by INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.query("ALTER TABLE payroll_payments ADD COLUMN IF NOT EXISTS idempotency_key TEXT");
    await db.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS payroll_payments_idempotency_uidx
         ON payroll_payments (run_id, idempotency_key) WHERE idempotency_key IS NOT NULL`,
    );

    await db.query(`
      CREATE TABLE IF NOT EXISTS payroll_run_audit (
        id SERIAL PRIMARY KEY,
        run_id INTEGER,
        action TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        amount DECIMAL(15,2),
        user_id INTEGER,
        user_name TEXT,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (db === pool) PayrollRunRepository.schemaEnsured = true;
  }

  async findRunByPeriod(
    db: any,
    period: { year: number; month: number; branchId?: number | null; departmentId?: number | null },
    lock = false,
  ): Promise<PayrollRunRecord | null> {
    const result = await db.query(
      `SELECT ${RUN_COLUMNS} FROM payroll_months
        WHERE year = $1 AND month = $2
          AND COALESCE(branch_id, 0) = COALESCE($3::int, 0)
          AND COALESCE(department_id, 0) = COALESCE($4::int, 0)
        LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
      [period.year, period.month, period.branchId ?? null, period.departmentId ?? null],
    );
    return result.rows[0] ?? null;
  }

  async findRunById(db: any, id: number, lock = false): Promise<PayrollRunRecord | null> {
    const result = await db.query(
      `SELECT ${RUN_COLUMNS} FROM payroll_months WHERE id = $1 LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async listRuns(db: any, filters: { year?: number; month?: number; branchId?: number | null; departmentId?: number | null }): Promise<PayrollRunRecord[]> {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.year) {
      params.push(filters.year);
      where.push(`year = $${params.length}`);
    }
    if (filters.month) {
      params.push(filters.month);
      where.push(`month = $${params.length}`);
    }
    if (filters.branchId) {
      params.push(filters.branchId);
      where.push(`COALESCE(branch_id, 0) = $${params.length}`);
    }
    if (filters.departmentId) {
      params.push(filters.departmentId);
      where.push(`COALESCE(department_id, 0) = $${params.length}`);
    }
    const result = await db.query(
      `SELECT ${RUN_COLUMNS},
              (SELECT COUNT(*)::int FROM payroll_run_items i WHERE i.run_id = payroll_months.id) AS employees_count
         FROM payroll_months
        ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY year DESC, month DESC, id DESC`,
      params,
    );
    return result.rows;
  }

  async insertRun(
    db: any,
    period: { year: number; month: number; branchId?: number | null; departmentId?: number | null; runNumber: string; userId?: number | null },
  ): Promise<PayrollRunRecord> {
    const result = await db.query(
      `INSERT INTO payroll_months (year, month, branch_id, department_id, status, run_number, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'draft', $5, $6, $6)
       RETURNING ${RUN_COLUMNS}`,
      [period.year, period.month, period.branchId ?? null, period.departmentId ?? null, period.runNumber, period.userId ?? null],
    );
    return result.rows[0];
  }

  async findRunByIdForUpdate(db: any, id: number): Promise<PayrollRunRecord | null> {
    return this.findRunById(db, id, true);
  }

  async replaceItems(db: any, runId: number, items: PayrollRunItemRecord[]): Promise<void> {
    await db.query("DELETE FROM payroll_run_items WHERE run_id = $1", [runId]);
    for (const item of items) {
      await db.query(
        `INSERT INTO payroll_run_items
           (run_id, employee_id, employee_code, employee_name, basic_salary, additions, deductions, net_salary, paid_amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
        [
          runId,
          item.employee_id,
          item.employee_code ?? null,
          item.employee_name ?? null,
          item.basic_salary,
          item.additions,
          item.deductions,
          item.net_salary,
        ],
      );
    }
  }

  async getItems(db: any, runId: number): Promise<PayrollRunItemRecord[]> {
    const result = await db.query(
      `SELECT * FROM payroll_run_items WHERE run_id = $1 ORDER BY employee_name NULLS LAST, id`,
      [runId],
    );
    return result.rows;
  }

  async updateRunTotals(
    db: any,
    runId: number,
    totals: { totalNet: number; totalAdditions: number; totalDeductions: number },
  ): Promise<void> {
    await db.query(
      `UPDATE payroll_months
          SET total_net = $2, total_additions = $3, total_deductions = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [runId, totals.totalNet, totals.totalAdditions, totals.totalDeductions],
    );
  }

  async markAccrued(
    db: any,
    runId: number,
    data: { journalEntryId: number; reference: string; userId?: number | null },
  ): Promise<void> {
    await db.query(
      `UPDATE payroll_months
          SET status = 'accrued',
              accrual_journal_entry_id = $2,
              accrual_reference = $3,
              closed_at = CURRENT_TIMESTAMP,
              closed_by = $4,
              updated_by = $4,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [runId, data.journalEntryId, data.reference, data.userId ?? null],
    );
  }

  async markAccrualReversed(db: any, runId: number, userId?: number | null): Promise<void> {
    await db.query(
      `UPDATE payroll_months
          SET status = 'draft',
              accrual_journal_entry_id = NULL,
              accrual_reference = NULL,
              closed_at = NULL,
              closed_by = NULL,
              updated_by = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
      [runId, userId ?? null],
    );
  }

  async applyPayment(
    db: any,
    runId: number,
    amount: number,
    status: PayrollRunStatus,
  ): Promise<void> {
    await db.query(
      `UPDATE payroll_months
          SET total_paid = COALESCE(total_paid, 0) + $2::numeric,
              status = $3::text,
              paid_at = CASE WHEN $3::text = 'paid' THEN CURRENT_TIMESTAMP ELSE paid_at END,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $1::int`,
      [runId, amount, status],
    );
  }

  async insertPayment(db: any, payment: any): Promise<any> {
    const result = await db.query(
      `INSERT INTO payroll_payments
         (run_id, amount, payment_source, treasury_account_id, treasury_transaction_id, journal_entry_id,
          voucher_number, payment_date, reference_number, payment_method, notes, status, idempotency_key, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::date, CURRENT_DATE), $9, $10, $11, 'posted', $12, $13)
       RETURNING *`,
      [
        payment.runId,
        payment.amount,
        payment.paymentSource,
        payment.treasuryAccountId ?? null,
        payment.treasuryTransactionId ?? null,
        payment.journalEntryId ?? null,
        payment.voucherNumber ?? null,
        payment.paymentDate ?? null,
        payment.referenceNumber ?? null,
        payment.paymentMethod ?? null,
        payment.notes ?? null,
        payment.idempotencyKey ?? null,
        payment.createdBy ?? null,
      ],
    );
    return result.rows[0];
  }

  async findPaymentById(db: any, id: number, lock = false): Promise<any | null> {
    const result = await db.query(
      `SELECT * FROM payroll_payments WHERE id = $1 LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
      [id],
    );
    return result.rows[0] ?? null;
  }

  async listPayments(db: any, runId: number): Promise<any[]> {
    const result = await db.query(
      `SELECT p.*, t.voucher_number AS transaction_voucher
         FROM payroll_payments p
         LEFT JOIN treasury_transactions t ON t.id = p.treasury_transaction_id
        WHERE p.run_id = $1
        ORDER BY p.id`,
      [runId],
    );
    return result.rows;
  }

  async markPaymentReversed(db: any, paymentId: number, data: { reversalJournalEntryId?: number | null; reversalTransactionId?: number | null; userId?: number | null }): Promise<void> {
    await db.query(
      `UPDATE payroll_payments
          SET status = 'reversed',
              reversal_journal_entry_id = $2,
              reversal_transaction_id = $3,
              reversed_at = CURRENT_TIMESTAMP,
              reversed_by = $4
        WHERE id = $1`,
      [paymentId, data.reversalJournalEntryId ?? null, data.reversalTransactionId ?? null, data.userId ?? null],
    );
  }

  async audit(db: any, entry: {
    runId: number | null;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    amount?: number | null;
    userId?: number | null;
    userName?: string | null;
    details?: string | null;
  }): Promise<void> {
    try {
      await db.query(
        `INSERT INTO payroll_run_audit (run_id, action, from_status, to_status, amount, user_id, user_name, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          entry.runId ?? null,
          entry.action,
          entry.fromStatus ?? null,
          entry.toStatus ?? null,
          entry.amount ?? null,
          entry.userId ?? null,
          entry.userName ?? null,
          entry.details ?? null,
        ],
      );
    } catch (error: any) {
      console.warn("[PayrollRun] audit insert skipped:", error?.message || error);
    }
  }

  /** سجل تدقيق عام (user_logs) بلا اعتماد على server.ts لتفادي الاستيراد الدائري. */
  async logUserAction(db: any, userId: number | null, action: string, recordId: number, details: string): Promise<void> {
    try {
      if (!userId) return;
      await db.query(
        "INSERT INTO user_logs (user_id, action, table_name, record_id, details) VALUES ($1, $2, 'payroll_months', $3, $4)",
        [userId, action, recordId, details],
      );
    } catch (error: any) {
      console.warn("[PayrollRun] user log skipped:", error?.message || error);
    }
  }
}

export const payrollRunRepository = new PayrollRunRepository();
