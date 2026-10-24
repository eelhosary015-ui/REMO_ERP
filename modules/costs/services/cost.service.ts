import { costRepository, OperatingCostRecord, CostQueryFilters } from '../repositories/cost.repository.js';
import { ProductCostBreakdown, LandedCostAllocationItem } from '../domain/cost.types.js';
import { ERPEventBus } from '../../../server-erp-core.js';
import { postCostEntry } from '../../accounts/services/auto-posting.service.js';
import { beginIdempotency, completeIdempotency, failIdempotency } from '../../enterprise/services/idempotency.service.js';
import { UnitConversionService } from '../../common/services/unit_conversion.service.js';
import { pool } from '../../../server-db.js';
import { generateTreasuryVoucherNumber } from '../../accounting/services/treasury-voucher.service.js';

export class CostService {
  private async ensureEnterpriseCostSchema(): Promise<void> {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cost_allocations (
        id SERIAL PRIMARY KEY,
        operating_cost_id INTEGER NOT NULL REFERENCES operating_costs(id) ON DELETE CASCADE,
        source_cost_center_id INTEGER, target_cost_center_id INTEGER,
        production_order_id INTEGER, product_id INTEGER,
        allocation_method TEXT NOT NULL, allocation_basis NUMERIC(18,6) DEFAULT 0,
        allocation_percent NUMERIC(9,4) DEFAULT 0, allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'allocated', notes TEXT, created_by TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cost_audit_trail (
        id SERIAL PRIMARY KEY,
        operating_cost_id INTEGER NOT NULL REFERENCES operating_costs(id) ON DELETE CASCADE,
        action TEXT NOT NULL, from_status TEXT, to_status TEXT,
        details JSONB NOT NULL DEFAULT '{}'::jsonb, user_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE operating_costs
        ADD COLUMN IF NOT EXISTS safe_id INTEGER REFERENCES safes(id);
      ALTER TABLE operating_costs
        ADD COLUMN IF NOT EXISTS treasury_account_id INTEGER REFERENCES treasury_accounts(id);
    `);
  }

  async getOperatingCostDashboard(
    filters: { from?: string; to?: string; branch?: string; costCenterId?: number; costItemId?: number },
    client?: any
  ) {
    const query = client ? client.query.bind(client) : pool.queryPostgres.bind(pool);
    const where: string[] = ['1=1'];
    const params: any[] = [];
    const add = (clause: string, value: any) => { params.push(value); where.push(clause.replace('?', `$${params.length}`)); };
    if (filters.from) add('oc.date >= ?::date', filters.from);
    if (filters.to) add('oc.date < (?::date + INTERVAL \'1 day\')', filters.to);
    if (filters.branch) add('oc.branch = ?', filters.branch);
    if (filters.costCenterId) add('oc.cost_center_id = ?', filters.costCenterId);
    if (filters.costItemId) add('oc.cost_item_id = ?', filters.costItemId);
    const clause = where.join(' AND ');
    const queries = [
      () => query(`SELECT COUNT(*)::int AS total_count,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)),0) AS total_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE oc.approval_status='Approved'),0) AS approved_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE oc.approval_status IN ('Draft','Pending')),0) AS pending_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE COALESCE(oc.allocation_status,'unallocated')='allocated'),0) AS allocated_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE COALESCE(oc.allocation_status,'unallocated')<>'allocated'),0) AS unallocated_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE COALESCE(oc.direct_indirect,'indirect')='direct'),0) AS direct_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE COALESCE(oc.direct_indirect,'indirect')='indirect'),0) AS indirect_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE COALESCE(oc.cost_behavior,'variable')='fixed'),0) AS fixed_amount,
        COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)) FILTER (WHERE COALESCE(oc.cost_behavior,'variable')='variable'),0) AS variable_amount
        FROM operating_costs oc WHERE ${clause}`, params),
      () => query(`SELECT COALESCE(ci.name,'غير مصنف') AS name, COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)),0) AS amount, COUNT(*)::int AS count
        FROM operating_costs oc LEFT JOIN cost_items ci ON ci.id=oc.cost_item_id WHERE ${clause} GROUP BY ci.name ORDER BY amount DESC LIMIT 20`, params),
      () => query(`SELECT COALESCE(cc.name,'غير مرتبط') AS name, COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)),0) AS amount, COUNT(*)::int AS count
        FROM operating_costs oc LEFT JOIN cost_centers cc ON cc.id=oc.cost_center_id WHERE ${clause} GROUP BY cc.name ORDER BY amount DESC LIMIT 20`, params),
      () => query(`SELECT COALESCE(oc.source,'manual') AS source, COALESCE(SUM(COALESCE(NULLIF(oc.total,0), oc.amount)),0) AS amount, COUNT(*)::int AS count
        FROM operating_costs oc WHERE ${clause} GROUP BY oc.source ORDER BY amount DESC`, params)
    ];
    let results: any[];
    if (client) {
      results = [];
      for (const runQuery of queries) results.push(await runQuery());
    } else {
      results = await Promise.all(queries.map(runQuery => runQuery()));
    }
    const [summary, byItem, byCenter, bySource] = results;
    return { summary: summary.rows[0], by_item: byItem.rows, by_center: byCenter.rows, by_source: bySource.rows };
  }

  private async postApprovedCostInTransaction(
    cost: OperatingCostRecord,
    user: any,
    client: any,
    forceLedger = false
  ): Promise<{ journalEntry: any | null; safeTransaction: any | null }> {
    let journalEntry: any | null = null;
    if (cost.link_ledger || forceLedger) {
      journalEntry = await postCostEntry({
        id: cost.id!,
        category: cost.category,
        amount: Number(cost.amount),
        branch_id: cost.branch_id,
        notes: cost.notes || cost.voucher_no,
        date: cost.date,
        cost_center_id: cost.cost_center_id,
        payment_method: cost.payment_method,
        cost_item_id: cost.cost_item_id,
        safe: cost.treasury_account_id ? undefined : cost.safe,
        safe_id: cost.treasury_account_id ? undefined : cost.safe_id,
        accounting_account: cost.accounting_account,
        created_by: user?.id || null
      }, client);

      if (!journalEntry?.id) {
        throw new Error('فشل إنشاء القيد المحاسبي للتكلفة');
      }
      await costRepository.updateJournalEntryId(cost.id!, journalEntry.id, client);
    }

    const paymentMethod = String(cost.payment_method || 'نقدي').trim().toLowerCase();
    let safeTransaction: any | null = null;
    const isCashPayment = paymentMethod === 'نقدي' || paymentMethod === 'cash' || !paymentMethod;
    const isBankPayment = ['شبكة', 'تحويل بنكي', 'بنكي', 'bank', 'تحويل', 'bank transfer', 'card'].includes(paymentMethod);
    if (cost.treasury_account_id && (isCashPayment || isBankPayment)) {
      const amount = Number(Number(cost.amount).toFixed(2));
      const accountResult = await client.query(
        'SELECT id, name, type, currency, current_balance, status FROM treasury_accounts WHERE id = $1 FOR UPDATE',
        [cost.treasury_account_id]
      );
      const treasuryAccount = accountResult.rows[0];
      if (!treasuryAccount || treasuryAccount.status !== 'active') {
        throw new Error(`حساب الخزينة المحدد غير موجود أو غير نشط: ${cost.safe || cost.treasury_account_id}`);
      }
      const allowedTypes = isCashPayment ? ['cash', 'petty_cash'] : ['bank'];
      if (!allowedTypes.includes(String(treasuryAccount.type).toLowerCase())) {
        throw new Error(`نوع حساب "${treasuryAccount.name}" لا يتوافق مع طريقة الدفع المحددة`);
      }

      const existingResult = await client.query(
        `SELECT * FROM treasury_transactions
          WHERE account_id = $1 AND reference_type = 'cost' AND reference_id = $2
            AND status NOT IN ('canceled', 'reversed')
          ORDER BY id FOR UPDATE`,
        [treasuryAccount.id, cost.id]
      );
      if (existingResult.rows.length > 1) {
        throw new Error('توجد أكثر من حركة خزينة مرتبطة بالتكلفة؛ يلزم مراجعتها قبل إعادة الترحيل');
      }
      if (existingResult.rows[0]) {
        const existing = existingResult.rows[0];
        if (Number(existing.amount) !== -amount || Number(existing.account_id) !== Number(treasuryAccount.id)) {
          throw new Error('حركة الخزينة السابقة لا تطابق حساب ومبلغ التكلفة؛ يلزم مراجعتها قبل الترحيل');
        }
        safeTransaction = existing;
      } else {
        const balanceBefore = Number(treasuryAccount.current_balance || 0);
        const negativeBalanceSetting = await client.query(
          "SELECT value FROM treasury_settings WHERE key = 'allow_negative_balance'"
        );
        const allowNegativeBalance = negativeBalanceSetting.rows.length === 0
          || negativeBalanceSetting.rows[negativeBalanceSetting.rows.length - 1].value !== 'false';
        if (balanceBefore < amount && !allowNegativeBalance) {
          throw new Error(`رصيد الخزينة "${treasuryAccount.name}" غير كافٍ: المتاح ${balanceBefore.toFixed(2)} ${treasuryAccount.currency || 'EGP'}، والمطلوب ${amount.toFixed(2)} ${treasuryAccount.currency || 'EGP'}`);
        }
        const balanceAfter = Number((balanceBefore - amount).toFixed(2));
        const voucherNumber = await generateTreasuryVoucherNumber(client, 'payment');
        const createdBy = Number(user?.id);
        const transactionResult = await client.query(
          `INSERT INTO treasury_transactions (
             account_id, amount, transaction_type, reference_type, reference_id,
             created_by, approved_by, approved_at, notes, cost_center_id, status,
             voucher_number, voucher_type, payment_method, balance_before, balance_after,
             current_balance_after, branch_id, date, type, reference_number, category, description
           ) VALUES (
             $1, $2, 'cash_out', 'cost', $3, $4, $4, CURRENT_TIMESTAMP, $5, $6, 'approved',
             $7, 'payment', $8, $9, $10, $10, $11, COALESCE($12::date, CURRENT_DATE),
             'cash_out', $7, 'operating_cost', $5
           ) RETURNING *`,
          [
            treasuryAccount.id,
            -amount,
            cost.id,
            Number.isInteger(createdBy) && createdBy > 0 ? createdBy : null,
            `سداد تكلفة ${cost.voucher_no || `#${cost.id}`} — ${cost.category}`,
            cost.cost_center_id || null,
            voucherNumber,
            isCashPayment ? 'cash' : 'bank',
            balanceBefore,
            balanceAfter,
            cost.branch_id || null,
            cost.date || null
          ]
        );
        const updatedBalance = await client.query(
          `UPDATE treasury_accounts
              SET current_balance = current_balance - $1
            WHERE id = $2 AND ($3::boolean OR current_balance >= $1)`,
          [amount, treasuryAccount.id, allowNegativeBalance]
        );
        if (updatedBalance.rowCount !== 1) {
          throw new Error(`تعذر تحديث رصيد الخزينة "${treasuryAccount.name}"؛ أُلغيت المعاملة`);
        }
        safeTransaction = transactionResult.rows[0];
      }
    } else if (isCashPayment) {
      if (!cost.safe) throw new Error('يجب تحديد الخزينة قبل اعتماد تكلفة مدفوعة نقداً');
      const safeResult = cost.safe_id
        ? await client.query('SELECT id, name, balance FROM safes WHERE id = $1 FOR UPDATE', [cost.safe_id])
        : await client.query('SELECT id, name, balance FROM safes WHERE name = $1 ORDER BY id FOR UPDATE', [cost.safe]);
      if (!cost.safe_id && safeResult.rows.length > 1) {
        throw new Error('اسم الخزينة غير فريد؛ يجب تحديد الخزينة بالمعرف قبل الترحيل');
      }
      const safe = safeResult.rows[0];
      if (!safe) throw new Error(`الخزينة المحددة غير موجودة: ${cost.safe}`);

      const existingTransaction = await costRepository.findSafeTransactionForCost(safe.id, cost.id!, client);
      const amount = Number(Number(cost.amount).toFixed(2));
      if (existingTransaction && Number(existingTransaction.amount) !== amount) {
        throw new Error('قيمة حركة الخزينة السابقة لا تطابق مبلغ التكلفة؛ يلزم مراجعتها قبل الترحيل');
      }
      if (existingTransaction && existingTransaction.type !== 'expense' && existingTransaction.type !== 'out') {
        throw new Error(`نوع حركة الخزينة السابقة غير متوقع (${existingTransaction.type})؛ يلزم مراجعتها قبل الترحيل`);
      }
      if (existingTransaction?.type === 'expense') {
        const balance = Number(safe.balance || 0);
        if (balance < amount) {
          throw new Error(`رصيد خزينة "${safe.name}" غير كافٍ: المتاح ${balance.toFixed(2)} ج.م، والمطلوب ${amount.toFixed(2)} ج.م`);
        }
        await client.query("UPDATE safe_transactions SET type = 'out', payment_method = 'cash' WHERE id = $1", [existingTransaction.id]);
        await client.query('UPDATE safes SET balance = balance - $1 WHERE id = $2', [amount, safe.id]);
        safeTransaction = { ...existingTransaction, type: 'out', payment_method: 'cash' };
      } else if (!existingTransaction) {
        const balance = Number(safe.balance || 0);
        if (balance < amount) {
          throw new Error(`رصيد خزينة "${safe.name}" غير كافٍ: المتاح ${balance.toFixed(2)} ج.م، والمطلوب ${amount.toFixed(2)} ج.م`);
        }
        safeTransaction = await costRepository.insertSafeTransaction({
          safe_id: safe.id,
          type: 'out',
          amount,
          notes: `سداد تكلفة #${cost.id} — ${cost.voucher_no} (${cost.category})`,
          reference_id: String(cost.id),
          user_id: user?.id,
          created_by: user?.username || cost.created_by,
          payment_method: 'cash'
        }, client);
        await client.query('UPDATE safes SET balance = balance - $1 WHERE id = $2', [amount, safe.id]);
      } else {
        safeTransaction = existingTransaction;
      }
    }

    return { journalEntry, safeTransaction };
  }

  async transitionOperatingCost(id: number, toStatus: string, user: any): Promise<any> {
    await this.ensureEnterpriseCostSchema();
    const allowed: Record<string, string[]> = {
      Draft: ['Pending', 'Cancelled'], Pending: ['Approved', 'Rejected'], Approved: ['Allocated', 'Cancelled'], Allocated: ['Closed'], Closed: []
    };
    const actor = user?.username || user?.name || 'النظام';
    const timestampField: Record<string, string> = { Pending: 'submitted_at', Approved: 'approved_at', Allocated: 'allocated_at', Closed: 'closed_at' };
    const actorField: Record<string, string> = { Pending: 'submitted_by', Approved: 'approved_by', Allocated: 'allocated_by', Closed: 'closed_by' };
    const client = await pool.connectPostgres();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const locked = await client.query('SELECT id FROM operating_costs WHERE id = $1 FOR UPDATE', [id]);
      if (!locked.rows[0]) throw new Error('سجل التكلفة غير موجود');
      const cost = await costRepository.getOperatingCostById(id, client);
      if (!cost) throw new Error('سجل التكلفة غير موجود');

      const from = cost.approval_status || 'Draft';
      if (from !== toStatus && !allowed[from]?.includes(toStatus)) {
        throw new Error(`لا يمكن نقل التكلفة من ${from} إلى ${toStatus}`);
      }

      let updatedCost = cost;
      if (from !== toStatus) {
        const fields = [`approval_status='${toStatus}'`];
        if (timestampField[toStatus]) fields.push(`${timestampField[toStatus]}=CURRENT_TIMESTAMP`);
        if (actorField[toStatus]) fields.push(`${actorField[toStatus]}=$2`);
        const updated = await client.query(
          `UPDATE operating_costs SET ${fields.join(', ')} WHERE id=$1 RETURNING *`,
          [id, actor]
        );
        updatedCost = updated.rows[0];
        await client.query(
          'INSERT INTO cost_audit_trail (operating_cost_id, action, from_status, to_status, user_name) VALUES ($1,$2,$3,$4,$5)',
          [id, 'status_change', from, toStatus, actor]
        );
      }

      let financialRefs: { journalEntry: any | null; safeTransaction: any | null } | null = null;
      if (toStatus === 'Approved') {
        financialRefs = await this.postApprovedCostInTransaction(updatedCost, user, client);
        if (financialRefs.journalEntry) updatedCost.journal_entry_id = financialRefs.journalEntry.id;
      }

      const persisted = await costRepository.getOperatingCostById(id, client);
      await client.query('COMMIT');
      transactionStarted = false;
      return {
        ...persisted,
        treasury_transaction_id: financialRefs?.safeTransaction?.id || null,
        treasury_transaction_number: financialRefs?.safeTransaction?.voucher_number || financialRefs?.safeTransaction?.id || null,
        journal_entry_reference: financialRefs?.journalEntry?.reference || null
      };
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch((rollbackError: any) => {
          console.error('[CostService] Failed to roll back approval transaction:', rollbackError?.message || rollbackError);
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async previewCostAllocation(input: { totalCost: number; method: string; allocations: any[] }) {
    const total = Number(input.totalCost) || 0;
    const allocations = Array.isArray(input.allocations) ? input.allocations : [];
    const rows = allocations.map(row => {
      const percent = Number(row.percent ?? row.allocation_percent ?? 0);
      const amount = input.method === 'percentage' ? total * percent / 100 : Number(row.amount ?? 0);
      return { ...row, percent, amount: Number(amount.toFixed(2)) };
    });
    const allocated = rows.reduce((sum, row) => sum + row.amount, 0);
    const percentTotal = rows.reduce((sum, row) => sum + row.percent, 0);
    return { total, method: input.method, rows, percent_total: percentTotal, allocated_amount: Number(allocated.toFixed(2)), remaining_amount: Number((total - allocated).toFixed(2)), valid: input.method === 'percentage' ? Math.abs(percentTotal - 100) < 0.01 : Math.abs(allocated - total) < 0.01 };
  }

  async allocateOperatingCost(id: number, input: { method: string; allocations: any[] }, user: any): Promise<any> {
    await this.ensureEnterpriseCostSchema();
    const cost = await costRepository.getOperatingCostById(id);
    if (!cost) throw new Error('سجل التكلفة غير موجود');
    if (cost.approval_status !== 'Approved') throw new Error('يجب اعتماد التكلفة قبل تخصيصها');
    const preview = await this.previewCostAllocation({ totalCost: Number(cost.total || cost.amount), ...input });
    if (!preview.valid) throw new Error('يجب أن يساوي مجموع التخصيص 100% أو إجمالي قيمة التكلفة');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM cost_allocations WHERE operating_cost_id=$1', [id]);
      const actor = user?.username || user?.name || 'النظام';
      for (const row of preview.rows) {
        await client.query(`INSERT INTO cost_allocations (operating_cost_id, source_cost_center_id, target_cost_center_id, production_order_id, product_id, allocation_method, allocation_basis, allocation_percent, allocated_amount, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [id, cost.cost_center_id || null, row.target_cost_center_id || row.cost_center_id || null, row.production_order_id || null, row.product_id || null, input.method, row.basis || 0, row.percent, row.amount, row.notes || null, actor]);
      }
      const updated = await client.query(`UPDATE operating_costs SET allocation_status='allocated', allocated_by=$2, allocated_at=CURRENT_TIMESTAMP, approval_status='Allocated' WHERE id=$1 RETURNING *`, [id, actor]);
      await client.query(`INSERT INTO cost_audit_trail (operating_cost_id, action, from_status, to_status, details, user_name) VALUES ($1,'allocation',$2,'Allocated',$3::jsonb,$4)`, [id, cost.approval_status, JSON.stringify(preview), actor]);
      await client.query('COMMIT');
      return { cost: updated.rows[0], preview };
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async getCostAuditTrail(id: number): Promise<any[]> {
    await this.ensureEnterpriseCostSchema();
    const result = await pool.query('SELECT * FROM cost_audit_trail WHERE operating_cost_id=$1 ORDER BY created_at DESC, id DESC', [id]);
    return result.rows;
  }
  // ────────────────── INVENTORY COSTING (MOVING WEIGHTED AVERAGE) ──────────────────

  /**
   * Authoritative Moving Weighted Average formula for inventory costing across ERP:
   * New Average Cost = (Old Quantity * Old Average Cost + Incoming Quantity * Incoming Unit Cost) / (Old Quantity + Incoming Quantity)
   */
  calculateMovingWeightedAverage(
    oldQty: number,
    oldAvgCost: number,
    incomingQty: number,
    incomingUnitCost: number
  ): number {
    const safeOldQty = Math.max(0, Number(oldQty) || 0);
    const safeOldCost = Math.max(0, Number(oldAvgCost) || 0);
    const safeIncomingQty = Math.max(0, Number(incomingQty) || 0);
    const safeIncomingCost = Math.max(0, Number(incomingUnitCost) || 0);

    const totalQty = safeOldQty + safeIncomingQty;
    if (totalQty <= 0) {
      return safeIncomingCost > 0 ? safeIncomingCost : safeOldCost;
    }

    const totalValuation = (safeOldQty * safeOldCost) + (safeIncomingQty * safeIncomingCost);
    return Number((totalValuation / totalQty).toFixed(4));
  }

  // ────────────────── OPERATING COSTS VALIDATION & LOGIC ──────────────────

  validateCostPayload(data: Partial<OperatingCostRecord>): void {
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('مبلغ التكلفة يجب أن يكون رقماً موجباً أكبر من صفر');
    }
    if (!data.date || !Number.isFinite(new Date(data.date).getTime())) {
      throw new Error('تاريخ التكلفة غير صحيح');
    }
    if (!Number.isInteger(Number(data.cost_center_id)) || Number(data.cost_center_id) <= 0) {
      throw new Error('يجب اختيار مركز تكلفة صحيح');
    }
    if (!Number.isInteger(Number(data.cost_item_id)) || Number(data.cost_item_id) <= 0) {
      throw new Error('يجب اختيار بند تكلفة صحيح');
    }
    const tax = Number(data.tax ?? 0);
    const total = Number(data.total ?? data.amount);
    if (!Number.isFinite(tax) || tax < 0 || !Number.isFinite(total) || total <= 0) {
      throw new Error('قيمة الضريبة أو الإجمالي غير صحيحة');
    }
  }

  /**
   * Create an operating cost record as a draft. Accounting and treasury effects
   * are deferred until the record is approved.
   */
  async createOperatingCost(
    data: OperatingCostRecord,
    user: any,
    idempotencyKey?: string | null
  ): Promise<{ cost: OperatingCostRecord; journal_entry?: any; replayed?: boolean }> {
    this.validateCostPayload(data);
    data = { ...data };
    data.approval_status = 'Draft';
    await this.ensureEnterpriseCostSchema();

    const scope = 'operating_cost_create';
    const key = idempotencyKey || (data.voucher_no ? `voucher-${data.voucher_no}` : null);
    const userId = user?.id || null;

    let guard: any = { replay: false, key: null };
    const client = await pool.connectPostgres();
    let transactionStarted = false;
    try {
      if (key) {
        guard = await beginIdempotency(scope, key, data, userId, undefined, undefined, client);
        if (guard.replay) {
          return { ...guard.body, replayed: true };
        }
      }

      await client.query('BEGIN');
      transactionStarted = true;

      const references = await client.query(`
        SELECT
          EXISTS (SELECT 1 FROM cost_centers WHERE id = $1) AS cost_center_exists,
          EXISTS (SELECT 1 FROM cost_items WHERE id = $2) AS cost_item_exists
      `, [Number(data.cost_center_id), Number(data.cost_item_id)]);
      if (!references.rows[0]?.cost_center_exists) {
        throw new Error('مركز التكلفة المحدد غير موجود في قاعدة البيانات');
      }
      if (!references.rows[0]?.cost_item_exists) {
        throw new Error('بند التكلفة المحدد غير موجود في قاعدة البيانات');
      }

      const paymentMethod = String(data.payment_method || 'نقدي').trim().toLowerCase();
      const isCashPayment = paymentMethod === 'نقدي' || paymentMethod === 'cash';
      const isBankPayment = ['شبكة', 'تحويل بنكي', 'بنكي', 'bank', 'تحويل', 'bank transfer', 'card'].includes(paymentMethod);
      if (isCashPayment || isBankPayment) {
        const treasuryAccountId = Number(data.treasury_account_id);
        if (!Number.isInteger(treasuryAccountId) || treasuryAccountId <= 0) {
          throw new Error('اختر خزينة أو حسابًا ماليًا فعالًا من موديول الخزينة');
        }
        const accountResult = await client.query(
          'SELECT id, name, type, currency, status FROM treasury_accounts WHERE id = $1',
          [treasuryAccountId]
        );
        const account = accountResult.rows[0];
        if (!account || account.status !== 'active') {
          throw new Error('حساب الخزينة المحدد غير موجود أو غير نشط');
        }
        const allowedTypes = isCashPayment ? ['cash', 'petty_cash'] : ['bank'];
        if (!allowedTypes.includes(String(account.type).toLowerCase())) {
          throw new Error(`نوع حساب "${account.name}" لا يتوافق مع طريقة الدفع المحددة`);
        }
        data.treasury_account_id = Number(account.id);
        data.safe = account.name;
        data.safe_id = undefined;
      }

      // 1. Generate sequential voucher_no if not present
      if (!data.voucher_no) {
        const month = data.date.slice(0, 7).replace('-', '');
        const prefix = `VCH-${month}-`;
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`operating_costs_voucher:${month}`]);
        const nextNumber = await client.query(`
          SELECT COALESCE(MAX(substring(voucher_no from char_length($1) + 1)::bigint), 0) + 1 AS next
          FROM operating_costs
          WHERE voucher_no LIKE $1 || '%'
            AND substring(voucher_no from char_length($1) + 1) ~ '^[0-9]+$'
        `, [prefix]);
        data.voucher_no = `${prefix}${String(nextNumber.rows[0]?.next || 1).padStart(4, '0')}`;
      }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`operating_cost_voucher:${data.voucher_no}`]);
      const duplicateVoucher = await client.query(
        'SELECT id FROM operating_costs WHERE voucher_no = $1 LIMIT 1',
        [data.voucher_no]
      );
      if (duplicateVoucher.rows.length > 0) {
        throw new Error('رقم سند التكلفة مستخدم بالفعل');
      }

      data.created_by = user?.username || user?.name || data.created_by || 'النظام';
      data.total = data.total ? Number(data.total) : Number(data.amount);

      // 2. Insert into operating_costs table within transaction
      const insertedCost = await costRepository.insertOperatingCost(data, client);
      if (!insertedCost?.id) {
        throw new Error('لم تُرجع قاعدة البيانات سجل التكلفة بعد الحفظ');
      }

      // 3. Log activity
      await costRepository.logActivity(
        'إضافة مصروف تشغيلي',
        `تم إضافة مصروف بقيمة ${insertedCost.amount} (${insertedCost.category}) - سند ${insertedCost.voucher_no}`,
        data.created_by,
        client
      );

      const responsePayload = {
        cost: insertedCost,
        journal_entry: null
      };
      if (guard.key) {
        await completeIdempotency(scope, guard.key, 201, responsePayload, client);
      }

      await client.query('COMMIT');
      transactionStarted = false;

      // 4. Emit ERP event for decoupled listeners
      try {
        ERPEventBus.getInstance().emitEvent('CostRecorded', {
          id: insertedCost.id,
          costId: insertedCost.id,
          category: insertedCost.category,
          amount: insertedCost.amount,
          date: insertedCost.date,
          branch_id: insertedCost.branch_id,
          cost_center_id: insertedCost.cost_center_id,
          cost_item_id: insertedCost.cost_item_id,
          notes: insertedCost.notes,
          link_ledger: insertedCost.link_ledger,
          approval_status: insertedCost.approval_status
        });
      } catch (evtErr: any) {
        console.warn('[CostService] ERPEventBus emitEvent notice:', evtErr?.message);
      }

      return { cost: insertedCost, journal_entry: null };
    } catch (err: any) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch(() => {});
      }
      if (guard.key) {
        await failIdempotency(scope, guard.key, client).catch((idempotencyError: any) => {
          console.error('[CostService] Failed to release idempotency key:', idempotencyError?.message || idempotencyError);
        });
      }
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update an operating cost record
   */
  async updateOperatingCost(id: number, data: Partial<OperatingCostRecord>, user: any): Promise<OperatingCostRecord> {
    await this.ensureEnterpriseCostSchema();
    const existing = await costRepository.getOperatingCostById(id);
    if (!existing) {
      throw new Error('سجل التكلفة غير موجود');
    }

    if (data.amount !== undefined) {
      this.validateCostPayload({ amount: data.amount });
    }

    const updated = await costRepository.updateOperatingCost(id, data);
    if (!updated) {
      throw new Error('فشل تحديث سجل التكلفة');
    }

    // A saved draft must remain unposted. If an approved record is explicitly
    // linked to the ledger, use the same strict posting path as approval.
    if (updated.approval_status === 'Approved' && updated.link_ledger && !updated.journal_entry_id && Number(updated.amount) > 0) {
      await this.postCostToLedger(updated.id!, user);
    }

    await costRepository.logActivity(
      'تعديل تكلفة',
      `تم تعديل السند ${updated.voucher_no} - الحالة: ${updated.approval_status || 'Draft'}`,
      user?.username || 'النظام'
    );

    return updated;
  }

  /**
   * Delete an operating cost record with validation against linked ledger entries
   */
  async deleteOperatingCost(id: number, user: any): Promise<void> {
    const existing = await costRepository.getOperatingCostById(id);
    if (!existing) {
      throw new Error('سجل التكلفة غير موجود');
    }

    if (existing.journal_entry_id) {
      const je = await costRepository.getJournalEntryForCost(id);
      if (je) {
        throw new Error('لا يمكن حذف مصروف مرحل محاسبياً إلى القيود اليومية. يرجى إلغاء القيد أولاً');
      }
    }

    const deleted = await costRepository.deleteOperatingCost(id);
    if (!deleted) {
      throw new Error('فشل حذف سجل التكلفة');
    }

    await costRepository.logActivity(
      'حذف تكلفة',
      `تم حذف المصروف #${id} - سند ${existing.voucher_no}`,
      user?.username || 'النظام'
    );
  }

  /**
   * Authoritatively post an existing cost to accounting ledger
   */
  async postCostToLedger(costId: number, user: any): Promise<any> {
    const client = await pool.connectPostgres();
    let transactionStarted = false;
    try {
      await client.query('BEGIN');
      transactionStarted = true;
      const locked = await client.query('SELECT id FROM operating_costs WHERE id = $1 FOR UPDATE', [costId]);
      if (!locked.rows[0]) throw new Error('سجل التكلفة غير موجود');
      const cost = await costRepository.getOperatingCostById(costId, client);
      if (!cost) throw new Error('سجل التكلفة غير موجود');
      if (cost.approval_status !== 'Approved' && cost.approval_status !== 'Allocated') {
        throw new Error('يجب اعتماد التكلفة قبل ترحيلها محاسبياً');
      }

      const alreadyPosted = Boolean(cost.journal_entry_id);
      const { journalEntry } = await this.postApprovedCostInTransaction(cost, user, client, true);
      if (!journalEntry?.id) throw new Error('فشل إنشاء القيد المحاسبي للتكلفة');
      await costRepository.logActivity(
        'ترحيل مصروف محاسبياً',
        `تم ترحيل المصروف #${costId} إلى القيد اليومي #${journalEntry.id} برقم مرجعي ${journalEntry.reference}`,
        user?.username || 'النظام',
        client
      );
      await client.query('COMMIT');
      transactionStarted = false;
      return {
        message: alreadyPosted ? 'تم ترحيل هذا المصروف مسبقاً' : 'تم ترحيل المصروف بنجاح إلى القيود اليومية',
        journal_entry: journalEntry,
        already_posted: alreadyPosted
      };
    } catch (error) {
      if (transactionStarted) {
        await client.query('ROLLBACK').catch((rollbackError: any) => {
          console.error('[CostService] Failed to roll back ledger posting:', rollbackError?.message || rollbackError);
        });
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Approve an operating cost record (with idempotency guard against double-approval)
   */
  async approveOperatingCost(costId: number, user: any): Promise<OperatingCostRecord> {
    const cost = await costRepository.getOperatingCostById(costId);
    if (!cost) throw new Error('سجل التكلفة غير موجود');
    return this.transitionOperatingCost(costId, 'Approved', user);
  }

  /**
   * Cancel an operating cost record (with idempotency guard against duplicate reversal)
   */
  async cancelOperatingCost(costId: number, user: any, reason?: string): Promise<OperatingCostRecord> {
    const cost = await costRepository.getOperatingCostById(costId);
    if (!cost) {
      throw new Error('سجل التكلفة غير موجود');
    }

    if (cost.approval_status === 'Cancelled') {
      return cost; // Idempotent: already cancelled
    }

    const updated = await costRepository.updateOperatingCost(costId, {
      approval_status: 'Cancelled',
      notes: reason ? `${cost.notes || ''} [ملغي: ${reason}]` : `${cost.notes || ''} [ملغي]`
    });

    if (!updated) {
      throw new Error('فشل إلغاء التكلفة');
    }

    await costRepository.logActivity(
      'إلغاء تكلفة',
      `تم إلغاء المصروف #${costId} - سند ${updated.voucher_no}. السبب: ${reason || 'غير محدد'}`,
      user?.username || 'النظام'
    );

    return updated;
  }

  async getOperatingCosts(filters: CostQueryFilters = {}): Promise<OperatingCostRecord[]> {
    return costRepository.findAll(filters);
  }

  async getOperatingCostById(id: number): Promise<OperatingCostRecord | null> {
    return costRepository.getOperatingCostById(id);
  }

  async clearAllData(user: any): Promise<void> {
    await costRepository.clearAllOperatingCosts();
    await costRepository.logActivity('تفريغ بيانات التكاليف', 'تم مسح سجلات التكاليف والقيود والحركات المرتبطة', user?.username || 'النظام');
  }

  // ────────────────── COST CENTERS & ITEMS DOMAIN ──────────────────

  async getCostCenters(): Promise<any[]> {
    return costRepository.findCostCenters();
  }

  async createCostCenter(data: any, user: any): Promise<any> {
    if (!data.name || !data.name.trim()) {
      throw new Error('اسم مركز التكلفة مطلوب');
    }
    if (data.parent_id) {
      const parent = await costRepository.getCostCenterById(Number(data.parent_id));
      if (!parent) {
        throw new Error('مركز التكلفة الأب المحدد غير موجود');
      }
    }
    const result = await costRepository.insertCostCenter(data);
    await costRepository.logActivity('إضافة مركز تكلفة', `تم إضافة مركز التكلفة: ${result.name}`, user?.username || 'النظام');
    return result;
  }

  async updateCostCenter(id: number, data: any, user: any): Promise<any> {
    const existing = await costRepository.getCostCenterById(id);
    if (!existing) {
      throw new Error('مركز التكلفة غير موجود');
    }
    if (data.parent_id) {
      const parentId = Number(data.parent_id);
      if (parentId === Number(id)) {
        throw new Error('لا يمكن أن يكون مركز التكلفة أباً لنفسه');
      }
      const parent = await costRepository.getCostCenterById(parentId);
      if (!parent) {
        throw new Error('مركز التكلفة الأب المحدد غير موجود');
      }
    }
    const result = await costRepository.updateCostCenter(id, data);
    await costRepository.logActivity('تعديل مركز تكلفة', `تم تعديل مركز التكلفة: ${result.name}`, user?.username || 'النظام');
    return result;
  }

  async deleteCostCenter(id: number, user: any): Promise<void> {
    const count = await costRepository.countOperatingCostsByCenterId(id);
    if (count > 0) {
      throw new Error(`لا يمكن حذف مركز التكلفة لوجود ${count} مصروف مرتبط به`);
    }
    const deleted = await costRepository.deleteCostCenter(id);
    if (!deleted) {
      throw new Error('فشل حذف مركز التكلفة');
    }
    await costRepository.logActivity('حذف مركز تكلفة', `تم حذف مركز التكلفة رقم #${id}`, user?.username || 'النظام');
  }

  async getCostItems(): Promise<any[]> {
    return costRepository.findCostItems();
  }

  async createCostItem(data: any, user: any): Promise<any> {
    if (!data.name || !data.name.trim()) {
      throw new Error('اسم بند التكلفة مطلوب');
    }
    if (data.parent_id) {
      const parent = await costRepository.getCostItemById(Number(data.parent_id));
      if (!parent) {
        throw new Error('البند الأب المحدد غير موجود');
      }
    }
    const result = await costRepository.insertCostItem(data);
    await costRepository.logActivity('إضافة بند تكلفة', `تم إضافة بند التكلفة: ${result.name}`, user?.username || 'النظام');
    return result;
  }

  async updateCostItem(id: number, data: any, user: any): Promise<any> {
    const existing = await costRepository.getCostItemById(id);
    if (!existing) {
      throw new Error('بند التكلفة غير موجود');
    }
    if (data.parent_id) {
      const parentId = Number(data.parent_id);
      if (parentId === Number(id)) {
        throw new Error('لا يمكن أن يكون البند أباً لنفسه');
      }
      const parent = await costRepository.getCostItemById(parentId);
      if (!parent) {
        throw new Error('البند الأب المحدد غير موجود');
      }
    }
    const result = await costRepository.updateCostItem(id, data);
    await costRepository.logActivity('تعديل بند تكلفة', `تم تعديل بند التكلفة: ${result.name}`, user?.username || 'النظام');
    return result;
  }

  async deleteCostItem(id: number, user: any): Promise<void> {
    const count = await costRepository.countOperatingCostsByItemId(id);
    if (count > 0) {
      throw new Error(`لا يمكن حذف بند التكلفة لوجود ${count} مصروف مرتبط به`);
    }
    const deleted = await costRepository.deleteCostItem(id);
    if (!deleted) {
      throw new Error('فشل حذف بند التكلفة');
    }
    await costRepository.logActivity('حذف بند تكلفة', `تم حذف بند التكلفة رقم #${id}`, user?.username || 'النظام');
  }

  // ────────────────── ESTIMATED BUDGETS ──────────────────

  async getBudgets(): Promise<any[]> {
    return costRepository.findBudgets();
  }

  async createBudget(data: any, user: any): Promise<any> {
    if (!data.name || !data.planned_amount) {
      throw new Error('بيانات الموازنة التقديرية غير مكتملة');
    }
    const result = await costRepository.insertBudget(data);
    await costRepository.logActivity('إضافة موازنة تقديرية', `تم إضافة موازنة: ${result.name} بقيمة ${result.planned_amount}`, user?.username || 'النظام');
    return result;
  }

  async deleteBudget(id: number, user: any): Promise<void> {
    const deleted = await costRepository.deleteBudget(id);
    if (!deleted) {
      throw new Error('فشل حذف الموازنة التقديرية');
    }
    await costRepository.logActivity('حذف موازنة تقديرية', `تم حذف الموازنة رقم #${id}`, user?.username || 'النظام');
  }

  // ────────────────── STANDARD & PRODUCT COSTS ──────────────────

  async getStandardCosts(): Promise<any[]> {
    return costRepository.getStandardCosts();
  }

  async saveStandardCost(data: any, user: any): Promise<any> {
    const result = await costRepository.insertStandardCost(data);
    await costRepository.logActivity('تحديث التكاليف المعيارية', 'تم تحديث معدلات التكلفة المعيارية', user?.username || 'النظام');
    return result;
  }

  async getProductCosts(): Promise<any[]> {
    return costRepository.getProductCosts();
  }

  async getProductCostReport(filters: any = {}): Promise<any[]> {
    return costRepository.getProductCostReport(filters);
  }

  async saveProductCost(data: any, user: any): Promise<any> {
    const result = await costRepository.insertProductCost(data);
    await costRepository.logActivity('تسجيل تكلفة منتج', `تم تسجيل تكاليف المنتج #${data.product_id}`, user?.username || 'النظام');
    return result;
  }

  // ────────────────── SETTINGS DOMAIN ──────────────────

  async getSettings(): Promise<Record<string, any>> {
    const result = await pool.query(`SELECT key, value FROM system_settings WHERE key LIKE 'cost_%'`);
    const settings: any = {};
    result.rows.forEach((row: any) => {
      settings[row.key] = row.value;
    });
    return settings;
  }

  async saveSettings(settings: Record<string, any>): Promise<void> {
    for (const key in settings) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        await pool.query(`
          INSERT INTO system_settings (key, value) 
          VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP
        `, [key, String(settings[key])]);
      }
    }
  }

  // ────────────────── PRODUCT & RECIPE COSTING FOUNDATION ──────────────────

  /**
   * قائمة أصناف حساب التكلفة مع pagination على السيرفر.
   * لو Limit/offset مش مبعوتة بيرجع كل النتائج (back-compat للكلام القديم).
   */
  async getRecipeProducts(
    search?: string,
    warehouseId?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ data: any[]; total: number }> {
    const result: any = await costRepository.getRecipeProducts(search, warehouseId, options);
    // حماية: الريبو بيرجع { data, total } بس لو الكود القديم رجع مصفوفة
    if (Array.isArray(result)) {
      return { data: result, total: result.length };
    }
    return {
      data: Array.isArray(result?.data) ? result.data : [],
      total: Number(result?.total) || 0
    };
  }

  async getAllIngredientsWithCost(warehouseId?: number): Promise<any[]> {
    return costRepository.getAllIngredientsWithCost(warehouseId);
  }

  async updateRecipeIngredients(productId: string, ingredients: any[], yieldPortions?: number, user?: any): Promise<void> {
    if (yieldPortions && Number(yieldPortions) > 0) {
      await pool.query(`UPDATE products SET yield_portions = $1 WHERE id = $2 OR CAST(id AS TEXT) = $2 OR name = $2`, [Number(yieldPortions), String(productId)]);
    }
    await costRepository.updateRecipeIngredients(productId, ingredients);
    await costRepository.logActivity('تحديث مكونات الوصفة', `تم تحديث مكونات وصفة المنتج #${productId}`, user?.username || 'النظام');
  }

  /**
   * Central recipe cost calculation engine with Production BOM, Warehouse, Unit Conversion, and Purchase WAC integration
   */
  async calculateRecipeCost(
    productId: string,
    costSourceParam: string = "weighted_avg",
    warehouseId: string = "all",
    visited: string[] = []
  ): Promise<any> {
    const currentId = String(productId);
    if (visited.includes(currentId)) {
      return null; // Prevent circular dependency
    }
    const newVisited = [...visited, currentId];

    const cleanNumeric = String(productId).replace(/^PRD-|^BOM-|^REC-|^ING-/i, '').trim();

    const prodRes = await pool.query(`
      SELECT id, name, category, item_code, barcode, sku, price as selling_price, cost_price, unit, yield_portions, show_in_pos, is_active
      FROM products
      WHERE id::text = $1 
         OR ($2 <> '' AND id::text = $2)
         OR item_code = $1 
         OR barcode = $1 
         OR sku = $1 
         OR name = $1
      LIMIT 1
    `, [String(productId), cleanNumeric]);

    let product: any = null;
    let linkedProduct: any = null;

    if (prodRes.rows.length > 0) {
      product = prodRes.rows[0];
      linkedProduct = {
        id: product.id,
        name: product.name,
        category: product.category,
        item_code: product.item_code,
        selling_price: product.selling_price
      };
    } else {
      const bomDirect = await pool.query(
        `SELECT * FROM production_boms WHERE id::text = $1 OR ($2 <> '' AND id::text = $2) OR COALESCE(name, product_name) = $1 LIMIT 1`, 
        [String(productId), cleanNumeric]
      );
      if (bomDirect.rows.length > 0) {
        const b = bomDirect.rows[0];
        product = {
          id: b.id,
          name: b.name || b.product_name || `BOM-${b.id}`,
          category: 'وصفة تصنيع إنتاج',
          item_code: b.bom_code || b.id,
          barcode: '',
          sku: '',
          selling_price: b.total_cost || 0,
          cost_price: b.total_cost || 0,
          unit: 'وحدة',
          yield_portions: 1,
          show_in_pos: false,
          is_active: true
        };

        if (b.product_id || b.product_name) {
          const linkedRes = await pool.query(
            `SELECT id, name, category, item_code, price as selling_price FROM products WHERE CAST(id AS TEXT) = $1 OR name = $2 LIMIT 1`,
            [String(b.product_id || ''), String(b.product_name || b.name || '')]
          );
          if (linkedRes.rows.length > 0) {
            linkedProduct = linkedRes.rows[0];
          }
        }
      } else {
        const recDirect = await pool.query(
          `SELECT * FROM recipes WHERE id::text = $1 OR ($2 <> '' AND id::text = $2) OR ('REC-' || id::text) = $1 OR name = $1 LIMIT 1`,
          [String(productId), cleanNumeric]
        );
        if (recDirect.rows.length > 0) {
          const r = recDirect.rows[0];
          product = {
            id: `REC-${r.id}`,
            name: r.name,
            category: 'وصفة تحضير / طهي',
            item_code: `REC-${r.id}`,
            barcode: '',
            sku: '',
            selling_price: r.total_cost || 0,
            cost_price: r.total_cost || 0,
            unit: 'وجبة / حصة',
            yield_portions: r.total_yield || r.yield_portions || 1,
            show_in_pos: false,
            is_active: true
          };

          if (r.product_id) {
            const linkedRes = await pool.query(
              `SELECT id, name, category, item_code, price as selling_price FROM products WHERE CAST(id AS TEXT) = $1 OR name = $2 LIMIT 1`,
              [String(r.product_id), r.name]
            );
            if (linkedRes.rows.length > 0) {
              linkedProduct = linkedRes.rows[0];
            }
          }
        } else {
          const cleanIngId = String(productId).replace(/^ING-/i, '');
          const ingDirect = await pool.query(
            `SELECT * FROM ingredients WHERE id::text = $1 OR ($2 <> '' AND id::text = $2) OR code = $1 OR item_code = $1 OR name = $3 OR ('ING-' || id::text) = $3 OR barcode = $1 LIMIT 1`,
            [cleanIngId, cleanNumeric, String(productId)]
          );
          if (ingDirect.rows.length > 0) {
            const i = ingDirect.rows[0];
            product = {
              id: `ING-${i.id}`,
              name: i.name,
              category: i.category || i.item_group || 'خامات ومكونات',
              item_code: i.code || i.item_code || `ITEM-${i.id}`,
              barcode: i.barcode || '',
              sku: '',
              selling_price: i.cost || i.cost_price || i.avg_cost || 0,
              cost_price: i.cost || i.cost_price || i.avg_cost || 0,
              unit: i.unit || 'كجم',
              yield_portions: 1,
              show_in_pos: false,
              is_active: true
            };
          }
        }
      }
    }

    if (!product) {
      // Graceful fallback to first active product in database
      const fallbackProd = await pool.query(
        `SELECT id, name, category, item_code, barcode, sku, price as selling_price, cost_price, unit, yield_portions, show_in_pos, is_active FROM products WHERE is_active = true ORDER BY id ASC LIMIT 1`
      );
      if (fallbackProd.rows.length > 0) {
        product = fallbackProd.rows[0];
        linkedProduct = {
          id: product.id,
          name: product.name,
          category: product.category,
          item_code: product.item_code,
          selling_price: product.selling_price
        };
      } else {
        const fallbackBom = await pool.query(`SELECT * FROM production_boms ORDER BY id ASC LIMIT 1`);
        if (fallbackBom.rows.length > 0) {
          const b = fallbackBom.rows[0];
          product = {
            id: b.id,
            name: b.name || b.product_name || `BOM-${b.id}`,
            category: 'وصفة تصنيع إنتاج',
            item_code: b.bom_code || b.id,
            barcode: '',
            sku: '',
            selling_price: b.total_cost || 0,
            cost_price: b.total_cost || 0,
            unit: 'وحدة',
            yield_portions: 1,
            show_in_pos: false,
            is_active: true
          };
        }
      }
    }

    if (!product) {
      throw new Error('المنتج أو الصنف غير موجود في سجل المنتجات');
    }

    let selectedWarehouse: any = null;
    if (warehouseId && warehouseId !== "all" && warehouseId !== "undefined") {
      const whRes = await pool.query(`SELECT id, name, code FROM warehouses WHERE CAST(id AS TEXT) = $1`, [String(warehouseId)]);
      if (whRes.rows.length > 0) {
        selectedWarehouse = whRes.rows[0];
      }
    }

    // 1. Check if a Production BOM exists in production_boms
    const bomRes = await pool.query(`
      SELECT * FROM production_boms 
      WHERE CAST(product_id AS TEXT) = $1 OR COALESCE(name, product_name) = $2 
      ORDER BY id DESC LIMIT 1
    `, [String(product.id), product.name]);

    let productionBom: any = null;
    let rawItemsList: any[] = [];
    let bomScrap = 0;
    let bomLaborFromRoutings = 0;

    if (bomRes.rows.length > 0) {
      productionBom = bomRes.rows[0];
      bomScrap = parseFloat(productionBom.scrap_percentage) || 0;
      
      if (productionBom.items_json) {
        try {
          const parsed = typeof productionBom.items_json === 'string' ? JSON.parse(productionBom.items_json) : productionBom.items_json;
          if (Array.isArray(parsed) && parsed.length > 0) rawItemsList = parsed;
        } catch (_) {}
      }

      if (rawItemsList.length === 0) {
        const biRes = await pool.query(`
          SELECT bi.*, i.name as ingredient_name, i.unit as base_unit, i.cost_price, i.avg_cost, i.last_purchase_price
          FROM bom_items bi
          LEFT JOIN ingredients i ON bi.ingredient_id::text = i.id::text
          WHERE bi.bom_id::text = $1::text
          ORDER BY bi.sort_order, bi.id
        `, [String(productionBom.id)]);
        if (biRes.rows.length > 0) {
          rawItemsList = biRes.rows.map((r: any) => ({
            materialId: r.ingredient_id,
            ingredientId: r.ingredient_id,
            name: r.ingredient_name,
            quantity: Number(r.quantity) || 0,
            unit: r.unit || r.base_unit || 'كجم',
            waste_percent: bomScrap
          }));
        }
      }

      if (productionBom.routings_json) {
        try {
          const routings = typeof productionBom.routings_json === 'string' ? JSON.parse(productionBom.routings_json) : productionBom.routings_json;
          if (Array.isArray(routings)) {
            for (const r of routings) {
              const run = Number(r.runTime) || 0;
              const setup = Number(r.setupTime) || 0;
              const rate = Number(r.costPerHour) || 25;
              const extCost = Number(r.subcontractCost) || 0;
              bomLaborFromRoutings += ((run + setup) / 60) * rate + extCost;
            }
          }
        } catch (_) {}
      }
    }

    // 2. If no Production BOM items found, check recipes & recipe_ingredients (Kitchen/Restaurant module)
    if (rawItemsList.length === 0) {
      const recRes = await pool.query(`
        SELECT r.id, r.name, r.total_yield, ri.ingredient_id, ri.quantity, ri.unit, ri.waste_percent, i.name as ingredient_name
        FROM recipes r
        JOIN recipe_ingredients ri ON r.id::text = ri.recipe_id::text
        LEFT JOIN ingredients i ON ri.ingredient_id::text = i.id::text
        WHERE r.product_id::text = $1 OR r.name = $2
      `, [String(product.id), product.name]);
      if (recRes.rows.length > 0) {
        rawItemsList = recRes.rows.map((r: any) => ({
          ingredientId: r.ingredient_id,
          materialId: r.ingredient_id,
          name: r.ingredient_name,
          quantity: Number(r.quantity) || 0,
          unit: r.unit || 'كجم',
          waste_percent: Number(r.waste_percent) || 0
        }));
      }
    }

    // 3. If still no items, check product_ingredients table
    if (rawItemsList.length === 0) {
      const piRes = await pool.query(`
        SELECT pi.ingredient_id, pi.quantity, pi.unit, pi.waste_percent, i.name as ingredient_name
        FROM product_ingredients pi
        LEFT JOIN ingredients i ON pi.ingredient_id::text = i.id::text
        WHERE pi.product_id::text = $1
      `, [String(product.id)]);
      if (piRes.rows.length > 0) {
        rawItemsList = piRes.rows.map((r: any) => ({
          ingredientId: r.ingredient_id,
          materialId: r.ingredient_id,
          name: r.ingredient_name,
          quantity: Number(r.quantity) || 0,
          unit: r.unit || 'كجم',
          waste_percent: Number(r.waste_percent) || 0
        }));
      }
    }

    const convertDirect = (qty: number, fromUnit: string, toUnit: string): number => {
      if (!qty || !fromUnit || !toUnit) return Number(qty) || 0;
      const res = UnitConversionService.convertStandardDirect(Number(qty) || 0, fromUnit, toUnit);
      if (res.success) {
        return res.toQuantity;
      }
      return Number(qty) || 0;
    };

    let totalIngredientsCost = 0;
    let totalWasteCost = 0;
    let hasMissingCost = false;
    let hasInsufficientStock = false;

    const ingredients: any[] = [];

    // ── فهرس واحد لكل الـ BOMs مرة واحدة بدل استعلام لكل مكون (كان N+1 query) ──
    let subBomProductIds = new Set<string>();
    let subBomNames = new Set<string>();
    try {
      const allBoms = await pool.query(`SELECT product_id, name, product_name FROM production_boms`);
      for (const b of allBoms.rows) {
        if (b.product_id !== null && b.product_id !== undefined) subBomProductIds.add(String(b.product_id));
        const nm = b.name || b.product_name;
        if (nm) subBomNames.add(String(nm));
      }
    } catch (bomIdxErr) {
      console.warn('[CostService] Failed to build sub-assembly BOM index:', bomIdxErr);
    }

    for (const item of rawItemsList) {
      const explicitIngredientId = item.ingredientId ?? item.ingredient_id;
      const materialReference = item.materialId ?? item.material_id ?? item.materialCode ?? '';
      const itemCodeReference = String(item.code ?? item.ingredientCode ?? item.item_code ?? materialReference ?? '').trim();
      const itemNameReference = String(item.materialName ?? item.ingredientName ?? item.name ?? '').trim();
      const ingId = explicitIngredientId ?? (parseInt(String(materialReference || '').replace(/[^0-9]/g, '')) || null);
      let ingRow: any = null;

      if (ingId) {
        const r = await pool.query(`SELECT * FROM ingredients WHERE id = $1`, [ingId]);
        if (r.rows.length > 0) ingRow = r.rows[0];
      }
      if (!ingRow && (itemNameReference || itemCodeReference)) {
        const r = await pool.query(`
          SELECT * FROM ingredients
          WHERE ($1 <> '' AND (name = $1 OR code = $1 OR item_code = $1))
             OR ($2 <> '' AND (name = $2 OR code = $2 OR item_code = $2))
          LIMIT 1
        `, [itemCodeReference, itemNameReference]);
        if (r.rows.length > 0) ingRow = r.rows[0];
      }

      const ingName = ingRow?.name || itemNameReference || 'اسم الصنف غير متوفر';
      const itemCode = ingRow?.item_code || ingRow?.code || itemCodeReference || `ITEM-${ingId || '000'}`;
      if (!ingRow && ingName === 'اسم الصنف غير متوفر') {
        console.warn(`[CostService] Missing ingredient relationship for recipe component: code=${itemCode}, id=${ingId ?? 'none'}`);
      }
      const costUnit = ingRow?.unit || item.unit || 'كجم';
      const recipeUnit = item.unit || ingRow?.unit || 'كجم';

      let totalStockQty = 0;
      let totalStockValue = 0;
      let wacInv = 0;
      let lastPriceInv = 0;
      let directAvgCost = 0;
      let availableQty = 0;

      if (ingRow) {
        const fallbackIngCost = Number(ingRow.avg_cost || ingRow.cost_price || ingRow.cost || ingRow.last_purchase_price || 0);

        let invRows: any[] = [];
        try {
          // Single Source of Truth: query actual records directly from inventory_items
          if (selectedWarehouse) {
            const invRes = await pool.query(
              `SELECT id, warehouse_id, ingredient_id, quantity, available, reserved, avg_cost, cost, last_cost 
               FROM inventory_items 
               WHERE (ingredient_id::text = $1::text OR item_id::text = $1::text) AND (warehouse_id::text = $2::text)`,
              [String(ingRow.id), String(selectedWarehouse.id)]
            );
            invRows = invRes.rows || [];
          } else {
            const invRes = await pool.query(
              `SELECT id, warehouse_id, ingredient_id, quantity, available, reserved, avg_cost, cost, last_cost 
               FROM inventory_items 
               WHERE (ingredient_id::text = $1::text OR item_id::text = $1::text)`,
              [String(ingRow.id)]
            );
            invRows = invRes.rows || [];
          }
        } catch (invErr) {
          console.warn(`[CostService] Failed to query inventory_items for ingredient ${ingRow.id}:`, invErr);
          invRows = [];
        }

        // Apply strict Weighted Average Cost (WAC) formula:
        // WAC = Total Inventory Value ÷ Total Available / Present Stock Quantity
        for (const row of invRows) {
          const qty = Number(row.quantity ?? row.available ?? 0);
          const rowAvailable = Number(row.available ?? row.quantity ?? 0);
          const rowAvg = Number(row.avg_cost || 0);
          const rowCost = Number(row.cost || 0);
          const rowLast = Number(row.last_cost || 0);
          const effectiveRowUnit = rowAvg > 0 ? rowAvg : (rowCost > 0 ? rowCost : fallbackIngCost);

          if (qty > 0) {
            totalStockQty += qty;
            totalStockValue += qty * effectiveRowUnit;
          }
          availableQty += rowAvailable;

          if (rowAvg > 0) {
            directAvgCost = directAvgCost > 0 ? (selectedWarehouse ? rowAvg : Math.max(directAvgCost, rowAvg)) : rowAvg;
          }
          if (rowLast > 0) {
            lastPriceInv = Math.max(lastPriceInv, rowLast);
          }
        }

        if (totalStockQty > 0 && totalStockValue > 0) {
          wacInv = totalStockValue / totalStockQty;
        } else if (directAvgCost > 0) {
          // Zero current stock fallback: use direct recorded average cost
          wacInv = directAvgCost;
        } else if (lastPriceInv > 0) {
          // Zero current stock fallback: use last purchase cost
          wacInv = lastPriceInv;
        } else if (fallbackIngCost > 0) {
          wacInv = fallbackIngCost;
        }

        // Keep ingredient master record synchronized with latest WAC if stock exists
        if (wacInv > 0 && Math.abs(Number(ingRow.avg_cost || 0) - wacInv) > 0.001) {
          try {
            await pool.query(`UPDATE ingredients SET avg_cost = $1 WHERE id::text = $2::text`, [wacInv, String(ingRow.id)]);
          } catch (syncErr) {}
        }
      }

      if (wacInv <= 0 && ingRow) {
        wacInv = Number(ingRow.avg_cost || ingRow.cost_price || ingRow.cost || ingRow.last_purchase_price || 0);
      }
      if (lastPriceInv <= 0 && ingRow) {
        lastPriceInv = Number(ingRow.last_purchase_price || ingRow.cost_price || ingRow.cost || 0);
      }
      const stdPrice = Number(ingRow?.cost_price ?? ingRow?.cost ?? 0);

      // Query actual purchase invoices (WAC and Last Purchase) if available
      let purchaseWac = 0;
      let purchaseLastPrice = 0;
      let purchaseCount = 0;

      if (ingRow) {
        try {
          const pParams: any[] = [String(ingRow.id)];
          let whFilter = '';
          if (selectedWarehouse) {
            pParams.push(String(selectedWarehouse.id));
            whFilter = `AND (p.warehouse_id::text = $2::text)`;
          }

          const pRes = await pool.query(`
            SELECT 
              SUM(COALESCE(pi.quantity, 0) * COALESCE(pi.unit_price, 0)) / NULLIF(SUM(COALESCE(pi.quantity, 0)), 0) as purchase_wac,
              COUNT(*) as purchase_count
            FROM purchase_items pi
            JOIN purchases p ON pi.purchase_id::text = p.id::text
            WHERE (pi.ingredient_id::text = $1::text)
              ${whFilter}
              AND COALESCE(p.status, '') NOT IN ('cancelled', 'rejected')
              AND COALESCE(pi.quantity, 0) > 0
          `, pParams);

          if (pRes.rows.length > 0 && pRes.rows[0].purchase_wac !== null) {
            purchaseWac = Number(pRes.rows[0].purchase_wac) || 0;
            purchaseCount = Number(pRes.rows[0].purchase_count) || 0;
          }

          const pLastRes = await pool.query(`
            SELECT pi.unit_price
            FROM purchase_items pi
            JOIN purchases p ON pi.purchase_id::text = p.id::text
            WHERE (pi.ingredient_id::text = $1::text)
              ${whFilter}
              AND COALESCE(p.status, '') NOT IN ('cancelled', 'rejected')
              AND COALESCE(pi.quantity, 0) > 0
            ORDER BY COALESCE(p.date, CURRENT_TIMESTAMP) DESC, p.id DESC
            LIMIT 1
          `, pParams);

          if (pLastRes.rows.length > 0) {
            purchaseLastPrice = Number(pLastRes.rows[0].unit_price) || 0;
          }
        } catch (pErr) {
          console.warn(`[CostService] Purchase history lookup failed for ingredient ${ingRow.id}:`, pErr);
        }
      }

      const wac = wacInv > 0 ? wacInv : (purchaseWac > 0 ? purchaseWac : Number(ingRow?.avg_cost ?? ingRow?.cost_price ?? ingRow?.cost ?? 0));
      const lastPrice = lastPriceInv > 0 ? lastPriceInv : (purchaseLastPrice > 0 ? purchaseLastPrice : Number(ingRow?.last_purchase_price ?? ingRow?.cost_price ?? ingRow?.cost ?? 0));

      const whPrefix = selectedWarehouse ? `[${selectedWarehouse.name}] ` : "";

      let unitCost = 0;
      let costSourceLabel = "يحتاج سعر";

      if (costSourceParam === "last_purchase") {
        if (lastPrice > 0) { 
          unitCost = lastPrice; 
          costSourceLabel = lastPriceInv > 0 ? `${whPrefix}آخر سعر شراء (المخزون)` : `${whPrefix}آخر سعر شراء (فاتورة مشتريات)`; 
        } else if (wac > 0) { 
          unitCost = wac; 
          costSourceLabel = `${whPrefix}متوسط الشراء WAC (بديل)`; 
        } else if (stdPrice > 0) { 
          unitCost = stdPrice; 
          costSourceLabel = `${whPrefix}تكلفة قياسية (بديل)`; 
        }
      } else if (costSourceParam === "standard") {
        if (stdPrice > 0) { 
          unitCost = stdPrice; 
          costSourceLabel = `${whPrefix}تكلفة قياسية`; 
        } else if (wac > 0) { 
          unitCost = wac; 
          costSourceLabel = `${whPrefix}متوسط الشراء WAC (بديل)`; 
        } else if (lastPrice > 0) { 
          unitCost = lastPrice; 
          costSourceLabel = `${whPrefix}آخر سعر شراء (بديل)`; 
        }
      } else {
        // Default: Weighted Average Cost (WAC)
        if (wac > 0) { 
          unitCost = wac; 
          if (selectedWarehouse) {
            costSourceLabel = totalStockQty > 0
              ? `[${selectedWarehouse.name}] متوسط مرجح المخزن (WAC: ${totalStockQty.toFixed(1)} ${costUnit})`
              : `[${selectedWarehouse.name}] متوسط التكلفة المسجل (رصيد صفري)`;
          } else {
            costSourceLabel = totalStockQty > 0
              ? `متوسط مرجح عام لكافة المخازن (WAC: ${totalStockQty.toFixed(1)} ${costUnit})`
              : (wacInv > 0 ? `متوسط تكلفة المخزون (رصيد صفري)` : `متوسط التكلفة المسجل`);
          }
        } else if (lastPrice > 0) { 
          unitCost = lastPrice; 
          costSourceLabel = `${whPrefix}آخر سعر شراء (بديل WAC)`; 
        } else if (stdPrice > 0) { 
          unitCost = stdPrice; 
          costSourceLabel = `${whPrefix}تكلفة قياسية (بديل WAC)`; 
        }
      }

      if (unitCost <= 0) {
        hasMissingCost = true;
        costSourceLabel = "غير متاح - حدد سعراً";
      }

      // ────────────────── RECURSIVE SUB-ASSEMBLY CHECK ──────────────────
      let isSubAssembly = false;
      let subAssemblyDetails = null;
      let subAssemblyCostPerUnit = 0;

      // Check if this ingredient has its own BOM (multi-level BOM)
      // بنستعمل الفهرس المحسوب فوق بدل استعلام جديد لكل مكون
      const hasSubBom =
        (ingRow?.id !== null && ingRow?.id !== undefined && subBomProductIds.has(String(ingRow.id))) ||
        subBomNames.has(ingName);

      if (hasSubBom) {
        try {
          const subCost = await this.calculateRecipeCost(ingRow?.id ? `ING-${ingRow.id}` : item.name, costSourceParam, warehouseId, newVisited);
          if (subCost && subCost.summary && subCost.summary.cost_per_portion > 0) {
            isSubAssembly = true;
            subAssemblyDetails = subCost;
            subAssemblyCostPerUnit = subCost.summary.cost_per_portion;
            unitCost = subAssemblyCostPerUnit;
            costSourceLabel = "إنتاج داخلي (Sub-Assembly)";
            hasMissingCost = false; // Resolved via recursive calculation
          }
        } catch (subErr) {
          console.warn(`[CostService] Recursive calculation failed for ${ingName}:`, subErr);
        }
      }
      // ─────────────────────────────────────────────────────────────

      const rawQty = Number(item.quantity) || 0;
      const wastePct = Number(item.waste_percent ?? item.wastePercent ?? bomScrap ?? 0);
      const wasteQty = rawQty * (wastePct / 100);
      const effectiveQty = rawQty + wasteQty;

      const convertedEffectiveQty = convertDirect(effectiveQty, recipeUnit, costUnit);
      const convertedRawQty = convertDirect(rawQty, recipeUnit, costUnit);
      const convertedWasteQty = convertDirect(wasteQty, recipeUnit, costUnit);

      const rawCost = convertedRawQty * unitCost;
      const wasteCost = convertedWasteQty * unitCost;
      const totalIngredientCost = convertedEffectiveQty * unitCost;

      const availableStock = totalStockQty > 0 ? totalStockQty : availableQty;
      const stockSufficient = availableStock >= convertedEffectiveQty;
      if (!stockSufficient) {
        hasInsufficientStock = true;
      }

      totalIngredientsCost += totalIngredientCost;
      totalWasteCost += wasteCost;

      ingredients.push({
        ingredient_id: ingRow?.id || ingId,
        item_id: ingRow?.id || ingId,
        item_name: ingName,
        ingredient_name: ingName,
        item_code: itemCode,
        ingredient_category: ingRow?.item_group || ingRow?.category || "خامات ومكونات",
        recipe_quantity: rawQty,
        recipe_unit: recipeUnit,
        waste_percent: wastePct,
        waste_quantity: wasteQty,
        effective_quantity: effectiveQty,
        converted_effective_quantity: convertedEffectiveQty,
        converted_raw_quantity: convertedRawQty,
        converted_waste_quantity: convertedWasteQty,
        cost_unit: costUnit,
        unit_cost: unitCost,
        cost_source_label: costSourceLabel,
        raw_cost: rawCost,
        waste_cost: wasteCost,
        total_ingredient_cost: totalIngredientCost,
        has_cost: unitCost > 0,
        available_stock: availableStock,
        warehouse_id: selectedWarehouse ? selectedWarehouse.id : 'all',
        warehouse_name: selectedWarehouse ? selectedWarehouse.name : 'جميع المخازن (المتوسط العام)',
        stock_sufficient: stockSufficient,
        is_sub_assembly: isSubAssembly,
        sub_assembly_details: subAssemblyDetails
      });
    }

    const existingCostRes = await pool.query(
      `SELECT * FROM product_costs WHERE CAST(product_id AS TEXT) = $1 ORDER BY id DESC LIMIT 1`,
      [String(product.id)]
    );
    const existingCost = existingCostRes.rows[0] || {};

    // Allocated operating costs are manufacturing overhead only when they are
    // explicitly linked to this product. This keeps generic cost-center pools
    // unassigned until an allocation decision is made and never changes stock.
    let allocatedManufacturingOverhead = 0;
    let allocationDetails: any[] = [];
    try {
      const allocationRes = await pool.query(`
        SELECT ca.id, ca.operating_cost_id, ca.production_order_id, ca.product_id,
               ca.target_cost_center_id, ca.allocation_method, ca.allocation_percent,
               ca.allocated_amount, oc.voucher_no, oc.source, oc.cost_item_id,
               ci.name AS cost_item_name, cc.name AS cost_center_name
        FROM cost_allocations ca
        JOIN operating_costs oc ON oc.id::text = ca.operating_cost_id::text
        LEFT JOIN cost_items ci ON ci.id::text = oc.cost_item_id::text
        LEFT JOIN cost_centers cc ON cc.id::text = ca.target_cost_center_id::text
        WHERE ca.product_id::text = $1::text
          AND ca.status = 'allocated'
          AND oc.approval_status IN ('Allocated', 'Approved', 'Closed')
        ORDER BY ca.id
      `, [String(product.id)]);
      allocationDetails = allocationRes.rows;
      allocatedManufacturingOverhead = allocationDetails.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
    } catch (allocationError: any) {
      console.warn('[CostService] Product allocation lookup skipped:', allocationError?.message || allocationError);
    }

    const packagingCost = Number(existingCost.packaging) || 0;
    const laborCost = (Number(existingCost.direct_labor) || 0) + bomLaborFromRoutings;
    const baseOverheadCost = (Number(existingCost.electricity) || 0) + (Number(existingCost.maintenance) || 0) + (Number(existingCost.indirect_overhead) || 0);
    const overheadCost = baseOverheadCost + allocatedManufacturingOverhead;

    const grandTotalCost = totalIngredientsCost + packagingCost + laborCost + overheadCost;

    const yieldPortions = Math.max(1, Number(product.yield_portions) || 1);
    const costPerPortion = grandTotalCost / yieldPortions;

    const sellingPrice = Number(product.selling_price) || 0;
    const grossProfit = sellingPrice - costPerPortion;
    const profitMarginPct = sellingPrice > 0 ? (grossProfit / sellingPrice) * 100 : 0;
    const foodCostPct = sellingPrice > 0 ? (costPerPortion / sellingPrice) * 100 : 0;

    let status = "Calculated";
    if (!ingredients.length) {
      status = "No Recipe";
    } else if (hasMissingCost) {
      status = "Missing Costs";
    } else if (Number(product.cost_price) > 0 && Math.abs(Number(product.cost_price) - costPerPortion) > 0.05) {
      status = "Outdated";
    }

    const historyRes = await pool.query(
      `SELECT * FROM recipe_cost_history WHERE product_id::text = $1::text ORDER BY id DESC LIMIT 2`,
      [String(product.id)]
    );
    const prevHistory = historyRes.rows[1] || historyRes.rows[0];
    const previousCost = prevHistory ? Number(prevHistory.cost_per_portion) : Number(product.cost_price) || costPerPortion;
    const costDiff = costPerPortion - previousCost;
    const costDiffPct = previousCost > 0 ? (costDiff / previousCost) * 100 : 0;

    return {
      product,
      linked_product: linkedProduct,
      production_bom: productionBom ? {
        id: productionBom.id,
        name: productionBom.name || productionBom.product_name,
        version: productionBom.version,
        scrap_percentage: bomScrap,
        routing_labor_cost: bomLaborFromRoutings,
        linked_product_id: linkedProduct?.id || productionBom.product_id,
        linked_product_name: linkedProduct?.name || productionBom.product_name
      } : null,
      ingredients,
      warehouse: selectedWarehouse ? {
        id: selectedWarehouse.id,
        name: selectedWarehouse.name,
        code: selectedWarehouse.code
      } : {
        id: "all",
        name: "جميع المخازن (المتوسط المرجح العام)",
        code: "ALL"
      },
      cost_allocations: allocationDetails,
      summary: {
        total_ingredients_cost: totalIngredientsCost,
        total_waste_cost: totalWasteCost,
        packaging_cost: packagingCost,
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        base_overhead_cost: baseOverheadCost,
        allocated_manufacturing_overhead: allocatedManufacturingOverhead,
        grand_total_cost: grandTotalCost,
        yield_portions: yieldPortions,
        cost_per_portion: costPerPortion,
        selling_price: sellingPrice,
        gross_profit: grossProfit,
        profit_margin_pct: profitMarginPct,
        food_cost_pct: foodCostPct,
        previous_cost: previousCost,
        cost_diff: costDiff,
        cost_diff_pct: costDiffPct,
        status,
        cost_source_param: costSourceParam,
        has_missing_cost: hasMissingCost,
        has_insufficient_stock: hasInsufficientStock
      }
    };
  }

  /**
   * ترجمة معرّف الوصفة القادم من الواجهة لمعرّف منتج حقيقي في جدول products.
   * الكود القديم كان بيعمل `WHERE id::text = $3 OR name = $3` وده كان بيعدّل
   * أي منتج بنفس الاسم (تعديل صامت لبيانات غلط). هنا بنطابق بالمعرّف فقط،
   * وبالاسم بس لما يكون المطابق واحد لا غير.
   */
  private async resolveProductsRowId(recipeProductId: string): Promise<{ id: number | null; name: string | null }> {
    const raw = String(recipeProductId ?? '').trim();
    if (!raw || raw === 'null' || raw === 'undefined') return { id: null, name: null };

    const asNumber = /^\d+$/.test(raw) ? Number(raw) : null;
    if (asNumber !== null) {
      const byId = await pool.query(`SELECT id::text AS id, name FROM products WHERE id = $1 LIMIT 1`, [asNumber]);
      if (byId.rows.length > 0) return { id: asNumber, name: byId.rows[0].name };
      return { id: null, name: null };
    }

    // غير رقمي (مثل 'ING-12' أو 'REC-3'): نطابق بالاسم بس لو النتيجة واحدة
    const byName = await pool.query(`SELECT id::text AS id, name FROM products WHERE name = $1 LIMIT 2`, [raw]);
    if (byName.rows.length === 1) return { id: Number(byName.rows[0].id), name: byName.rows[0].name };
    if (byName.rows.length > 1) {
      throw new Error(`أكثر من منتج بالاسم "${raw}" — لا يمكن تحديد أي منتج يتم تحديثه. اختر صنفًا بمعرّف محدد.`);
    }
    return { id: null, name: null };
  }

  /**(version الت由来 من آخر سجل محفوظ) — بدل 'V1' الثابت اللي كان بيكسر معنى السجل */
  private nextRecipeVersion(lastVersion: unknown): string {
    const match = String(lastVersion ?? '').match(/(\d+)\s*$/);
    const next = match ? Number(match[1]) + 1 : 1;
    return `V${next}`;
  }

  async saveRecipeCost(payload: any, user: any): Promise<any> {
    const productRef = String(payload.product_id ?? '').trim();
    if (!productRef) throw new Error('رقم الصنف مطلوب لحفظ تكلفة الـ Recipe');

    // تحديد المنتج الهدف مرة واحدة وبشكل آمن
    const target = await this.resolveProductsRowId(productRef);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // رقم النسخة الفعلي (مش 'V1' ثابت) عشان سجل التغيرات يبقى له معنى
      const verRes = await client.query(
        `SELECT recipe_version FROM recipe_cost_history WHERE product_id::text = $1::text ORDER BY id DESC LIMIT 1`,
        [productRef]
      );
      const recipeVersion = this.nextRecipeVersion(verRes.rows[0]?.recipe_version ?? payload.recipe_version);

      const histRes = await client.query(`
        INSERT INTO recipe_cost_history (
          product_id, recipe_version, cost_source, total_ingredients_cost, total_waste_cost,
          packaging_cost, labor_cost, overhead_cost, grand_total_cost, yield_portions,
          cost_per_portion, selling_price, gross_profit, profit_margin_pct, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        productRef,
        recipeVersion,
        payload.cost_source || "weighted_avg",
        Number(payload.total_ingredients_cost) || 0,
        Number(payload.total_waste_cost) || 0,
        Number(payload.packaging_cost) || 0,
        Number(payload.labor_cost) || 0,
        Number(payload.overhead_cost) || 0,
        Number(payload.grand_total_cost) || 0,
        Number(payload.yield_portions) || 1,
        Number(payload.cost_per_portion) || 0,
        Number(payload.selling_price) || 0,
        Number(payload.gross_profit) || 0,
        Number(payload.profit_margin_pct) || 0,
        payload.status || "Approved"
      ]);

      // تحديث سعر التكلفة: بالمعرّف المطابق فقط — مفيش لمس لأي صف تاني
      if (target.id !== null) {
        await client.query(`
          UPDATE products
          SET cost_price = $1, price = CASE WHEN $2 > 0 THEN $2 ELSE price END
          WHERE id = $3
        `, [Number(payload.cost_per_portion) || 0, Number(payload.selling_price) || 0, target.id]);
      } else {
        console.warn(`[CostService] saveRecipeCost: no matching products row for "${productRef}" — cost saved to history only, product price NOT updated.`);
      }

      if (target.id !== null) {
        await client.query(`
          INSERT INTO product_costs (
            product_id, raw_material, direct_labor, packaging, indirect_overhead, selling_price
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          target.id,
          Number(payload.total_ingredients_cost) || 0,
          Number(payload.labor_cost) || 0,
          Number(payload.packaging_cost) || 0,
          Number(payload.overhead_cost) || 0,
          Number(payload.selling_price) || 0
        ]);
      }

      if (Array.isArray(payload.ingredients) && payload.ingredients.length > 0 && target.id !== null) {
        const prodIdNum = target.id;
        await client.query(`DELETE FROM product_ingredients WHERE product_id = $1`, [prodIdNum]);
        for (const item of payload.ingredients) {
          const ingId = parseInt(String(item.ingredient_id || item.ingredientId || item.materialId), 10);
          if (!isNaN(ingId)) {
            await client.query(
              `INSERT INTO product_ingredients (product_id, ingredient_id, quantity, unit, waste_percent) VALUES ($1, $2, $3, $4, $5)`,
              [prodIdNum, ingId, Number(item.recipe_quantity || item.quantity) || 0, item.recipe_unit || item.unit || 'كجم', Number(item.waste_percent) || 0]
            );
          }
        }
      }

      await costRepository.logActivity(
        "تحديث وتنسيق تكلفة الـ Recipe",
        `تم اعتماد وتحديد تكلفة الوجبة لـ ${target.name || productRef} (${recipeVersion}): ${payload.cost_per_portion} ج.م`,
        user?.username || "النظام"
      );

      await client.query('COMMIT');
      return { ...histRes.rows[0], recipe_version: recipeVersion, product_updated: target.id !== null };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecipeCostHistory(productId: string): Promise<any[]> {
    return costRepository.getRecipeCostHistory(productId);
  }

  // ────────────────── LANDED COST FOUNDATION (PHASE 3 / 4 PREPARATION) ──────────────────

  /**
   * Authoritative Landed Cost Allocation calculation model:
   * Capitalizes freight, customs, insurance, and other landing expenses across receipt items by value or quantity.
   */
  calculateLandedCostAllocation(
    totalLandedExpenses: { freight: number; customs: number; insurance: number; other: number },
    items: { id: number; quantity: number; unitPrice: number }[],
    allocationMethod: 'by_value' | 'by_quantity' = 'by_value'
  ): LandedCostAllocationItem[] {
    const totalFreight = Math.max(0, Number(totalLandedExpenses.freight) || 0);
    const totalCustoms = Math.max(0, Number(totalLandedExpenses.customs) || 0);
    const totalInsurance = Math.max(0, Number(totalLandedExpenses.insurance) || 0);
    const totalOther = Math.max(0, Number(totalLandedExpenses.other) || 0);
    const grandLandedExpenses = totalFreight + totalCustoms + totalInsurance + totalOther;

    const totalBaseValue = items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unitPrice)), 0);
    const totalQuantity = items.reduce((sum, it) => sum + Number(it.quantity), 0);

    return items.map((it) => {
      const qty = Number(it.quantity) || 1;
      const baseAmount = qty * Number(it.unitPrice);
      const ratio = allocationMethod === 'by_value'
        ? (totalBaseValue > 0 ? baseAmount / totalBaseValue : 1 / items.length)
        : (totalQuantity > 0 ? qty / totalQuantity : 1 / items.length);

      const allocatedFreight = Number((totalFreight * ratio).toFixed(2));
      const allocatedCustoms = Number((totalCustoms * ratio).toFixed(2));
      const allocatedInsurance = Number((totalInsurance * ratio).toFixed(2));
      const allocatedOther = Number((totalOther * ratio).toFixed(2));
      const totalItemLanded = baseAmount + allocatedFreight + allocatedCustoms + allocatedInsurance + allocatedOther;
      const finalUnitCost = Number((totalItemLanded / qty).toFixed(4));

      return {
        itemId: it.id,
        quantity: qty,
        baseAmount,
        allocatedFreight,
        allocatedCustoms,
        allocatedInsurance,
        allocatedOther,
        totalLandedCost: Number(totalItemLanded.toFixed(2)),
        finalUnitCost
      };
    });
  }

  // ────────────────── ACTIVITY LOGS & INTEGRATIONS ──────────────────

  async getActivityLogs(limit = 100): Promise<any[]> {
    return costRepository.getActivityLogs(limit);
  }

  async logActivity(action: string, details: string, username: string = 'النظام'): Promise<void> {
    return costRepository.logActivity(action, details, username);
  }

  async getIntegrationEmployees(): Promise<any[]> {
    return costRepository.getIntegrationEmployees();
  }

  async getIntegrationSuppliers(): Promise<any[]> {
    return costRepository.getIntegrationSuppliers();
  }

  async getIntegrationCustomers(): Promise<any[]> {
    return costRepository.getIntegrationCustomers();
  }

  async getIntegrationProducts(): Promise<any[]> {
    return costRepository.getIntegrationProducts();
  }

  async getIntegrationIngredients(): Promise<any[]> {
    return costRepository.getIntegrationIngredients();
  }

  async getIntegrationWarehouses(): Promise<any[]> {
    return costRepository.getIntegrationWarehouses();
  }

  async getIntegrationAccounts(): Promise<any[]> {
    return costRepository.getIntegrationAccounts();
  }
}

export const costService = new CostService();
