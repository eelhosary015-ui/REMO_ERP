import { pool } from '../../../server-db.js';
import { OperatingCostDomain } from '../domain/cost.types.js';
import { randomBytes } from 'node:crypto';

export type OperatingCostRecord = OperatingCostDomain;

export interface CostQueryFilters {
  branch?: string;
  department?: string;
  cost_center_id?: number;
  cost_item_id?: number;
  date_from?: string;
  date_to?: string;
  status?: string;
  approval_status?: string;
  allocation_status?: string;
  source?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class CostRepository {
  // ────────────────── OPERATING COSTS ──────────────────

  async findAll(filters: CostQueryFilters = {}, client?: any): Promise<OperatingCostRecord[]> {
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.branch) {
      conditions.push(`oc.branch = $${idx++}`);
      params.push(filters.branch);
    }
    if (filters.department) {
      conditions.push(`oc.department = $${idx++}`);
      params.push(filters.department);
    }
    if (filters.cost_center_id) {
      conditions.push(`oc.cost_center_id = $${idx++}`);
      params.push(filters.cost_center_id);
    }
    if (filters.cost_item_id) {
      conditions.push(`oc.cost_item_id = $${idx++}`);
      params.push(filters.cost_item_id);
    }
    if (filters.date_from) {
      conditions.push(`oc.date >= $${idx++}`);
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      conditions.push(`oc.date <= $${idx++}`);
      params.push(filters.date_to);
    }
    if (filters.status) {
      conditions.push(`oc.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.approval_status) {
      conditions.push(`oc.approval_status = $${idx++}`);
      params.push(filters.approval_status);
    }
    if (filters.allocation_status) {
      conditions.push(`COALESCE(oc.allocation_status, 'unallocated') = $${idx++}`);
      params.push(filters.allocation_status);
    }
    if (filters.source) {
      conditions.push(`COALESCE(oc.source, oc.source_type, 'manual') = $${idx++}`);
      params.push(filters.source);
    }
    if (filters.search) {
      conditions.push(`(oc.voucher_no ILIKE $${idx} OR oc.notes ILIKE $${idx} OR oc.created_by ILIKE $${idx})`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = filters.limit ? `LIMIT $${idx++}` : 'LIMIT 200';
    if (filters.limit) params.push(filters.limit);
    const offsetClause = filters.offset ? `OFFSET $${idx++}` : '';
    if (filters.offset) params.push(filters.offset);

    const query = `
      SELECT 
        oc.*,
        cc.name as cost_center_name,
        cc.code as cost_center_code,
        ci.name as cost_item_name,
        COALESCE(ci.category, ci.type, 'عام') as cost_item_category
      FROM operating_costs oc
      LEFT JOIN cost_centers cc ON oc.cost_center_id = cc.id
      LEFT JOIN cost_items ci ON oc.cost_item_id = ci.id
      ${whereClause}
      ORDER BY oc.date DESC, oc.id DESC
      ${limitClause} ${offsetClause}
    `;

    const res = client
      ? await client.query(query, params)
      : await pool.queryPostgres(query, params);
    return res.rows;
  }

  async getOperatingCostById(id: number, client?: any): Promise<OperatingCostRecord | null> {
    const query = `
      SELECT 
        oc.*,
        cc.name as cost_center_name,
        cc.code as cost_center_code,
        ci.name as cost_item_name
      FROM operating_costs oc
      LEFT JOIN cost_centers cc ON oc.cost_center_id = cc.id
      LEFT JOIN cost_items ci ON oc.cost_item_id = ci.id
      WHERE oc.id = $1
    `;
    const res = client
      ? await client.query(query, [id])
      : await pool.queryPostgres(query, [id]);
    return res.rows[0] || null;
  }

  async getOperatingCostByVoucher(voucherNo: string): Promise<OperatingCostRecord | null> {
    const res = await pool.queryPostgres('SELECT * FROM operating_costs WHERE voucher_no = $1', [voucherNo]);
    return res.rows[0] || null;
  }

  async getOperatingCostBySource(sourceType: string, sourceId: number): Promise<OperatingCostRecord | null> {
    const res = await pool.queryPostgres(
      'SELECT * FROM operating_costs WHERE source_type = $1 AND source_id = $2',
      [sourceType, sourceId]
    );
    return res.rows[0] || null;
  }

  async insertOperatingCost(cost: OperatingCostRecord, client?: any): Promise<OperatingCostRecord> {
    const runner = client || pool;
    const query = `
      INSERT INTO operating_costs (
        voucher_no, date, branch, department, cost_center_id, cost_item_id, category,
        payment_method, safe, notes, amount, status, created_by, link_ledger,
        project, product, supplier, employee, customer, accounting_account, tax, total,
        currency, approval_status, customer_id, employee_id, supplier_id, product_id,
        warehouse_id, purchase_id, purchase_order_id, purchase_request_id,
        purchase_receipt_id, purchase_quotation_id, source_type, journal_entry_id,
        due_date, financial_period, company_id, exchange_rate, discount, cost_type,
        cost_behavior, direct_indirect, allocation_method, allocation_status, source, safe_id,
        treasury_account_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26,
        $27, $28, $29, $30, $31, $32, $33, $34, $35, $36,
        $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, $48, $49
      ) RETURNING *
    `;

    const values = [
      cost.voucher_no || null,
      cost.date ? new Date(cost.date) : new Date(),
      cost.branch || 'القاهرة',
      cost.department || 'العامة',
      cost.cost_center_id ? Number(cost.cost_center_id) : null,
      cost.cost_item_id ? Number(cost.cost_item_id) : null,
      cost.category || cost.department || 'other',
      cost.payment_method || 'نقدي',
      cost.safe || null,
      cost.notes || null,
      Number(cost.amount) || 0,
      cost.status || 'نشط',
      cost.created_by || 'النظام',
      cost.link_ledger === true,
      cost.project || null,
      cost.product || null,
      cost.supplier || null,
      cost.employee || null,
      cost.customer || null,
      cost.accounting_account || null,
      cost.tax ? Number(cost.tax) : 0,
      cost.total ? Number(cost.total) : (Number(cost.amount) || 0),
      cost.currency || 'EGP',
      cost.approval_status || 'Draft',
      cost.customer_id ? Number(cost.customer_id) : null,
      cost.employee_id ? Number(cost.employee_id) : null,
      cost.supplier_id ? Number(cost.supplier_id) : null,
      cost.product_id ? Number(cost.product_id) : null,
      cost.warehouse_id ? Number(cost.warehouse_id) : null,
      cost.purchase_id ? Number(cost.purchase_id) : null,
      cost.purchase_order_id ? Number(cost.purchase_order_id) : null,
      cost.purchase_request_id ? Number(cost.purchase_request_id) : null,
      cost.purchase_receipt_id ? Number(cost.purchase_receipt_id) : null,
      cost.purchase_quotation_id ? Number(cost.purchase_quotation_id) : null,
      cost.source_type || null,
      cost.journal_entry_id ? Number(cost.journal_entry_id) : null,
      cost.due_date ? new Date(cost.due_date) : null,
      cost.financial_period || null,
      cost.company_id ? Number(cost.company_id) : null,
      cost.exchange_rate ? Number(cost.exchange_rate) : 1,
      cost.discount ? Number(cost.discount) : 0,
      cost.cost_type || 'operating',
      cost.cost_behavior || 'variable',
      cost.direct_indirect || 'indirect',
      cost.allocation_method || 'manual',
      cost.allocation_status || 'unallocated',
      cost.source || cost.source_type || 'manual',
      cost.safe_id ? Number(cost.safe_id) : null,
      cost.treasury_account_id ? Number(cost.treasury_account_id) : null
    ];

    const res = await runner.query(query, values);
    return res.rows[0];
  }

  async updateOperatingCost(id: number, cost: Partial<OperatingCostRecord>, client?: any): Promise<OperatingCostRecord | null> {
    const runner = client || pool;
    const query = `
      UPDATE operating_costs SET
        voucher_no = COALESCE($1, voucher_no),
        date = COALESCE($2, date),
        branch = COALESCE($3, branch),
        department = COALESCE($4, department),
        cost_center_id = $5,
        cost_item_id = $6,
        payment_method = COALESCE($7, payment_method),
        safe = $8,
        notes = $9,
        amount = COALESCE($10, amount),
        status = COALESCE($11, status),
        created_by = COALESCE($12, created_by),
        link_ledger = COALESCE($13, link_ledger),
        project = $14,
        product = $15,
        supplier = $16,
        employee = $17,
        customer = $18,
        accounting_account = $19,
        tax = COALESCE($20, tax),
        total = COALESCE($21, total),
        currency = COALESCE($22, currency),
        approval_status = COALESCE($23, approval_status),
        customer_id = $24,
        employee_id = $25,
        supplier_id = $26,
        product_id = $27,
        warehouse_id = $28,
        due_date = COALESCE($29, due_date),
        financial_period = COALESCE($30, financial_period),
        company_id = COALESCE($31, company_id),
        exchange_rate = COALESCE($32, exchange_rate),
        discount = COALESCE($33, discount),
        cost_type = COALESCE($34, cost_type),
        cost_behavior = COALESCE($35, cost_behavior),
        direct_indirect = COALESCE($36, direct_indirect),
        allocation_method = COALESCE($37, allocation_method),
        allocation_status = COALESCE($38, allocation_status),
        source = COALESCE($39, source),
        safe_id = $40,
        treasury_account_id = $41
      WHERE id = $42
      RETURNING *
    `;

    const values = [
      cost.voucher_no || null,
      cost.date ? new Date(cost.date) : null,
      cost.branch || null,
      cost.department || null,
      cost.cost_center_id !== undefined ? (cost.cost_center_id ? Number(cost.cost_center_id) : null) : null,
      cost.cost_item_id !== undefined ? (cost.cost_item_id ? Number(cost.cost_item_id) : null) : null,
      cost.payment_method || null,
      cost.safe !== undefined ? cost.safe : null,
      cost.notes !== undefined ? cost.notes : null,
      cost.amount !== undefined ? Number(cost.amount) : null,
      cost.status || null,
      cost.created_by || null,
      cost.link_ledger !== undefined ? cost.link_ledger : null,
      cost.project !== undefined ? cost.project : null,
      cost.product !== undefined ? cost.product : null,
      cost.supplier !== undefined ? cost.supplier : null,
      cost.employee !== undefined ? cost.employee : null,
      cost.customer !== undefined ? cost.customer : null,
      cost.accounting_account !== undefined ? cost.accounting_account : null,
      cost.tax !== undefined ? Number(cost.tax) : null,
      cost.total !== undefined ? Number(cost.total) : null,
      cost.currency || null,
      cost.approval_status || null,
      cost.customer_id !== undefined ? (cost.customer_id ? Number(cost.customer_id) : null) : null,
      cost.employee_id !== undefined ? (cost.employee_id ? Number(cost.employee_id) : null) : null,
      cost.supplier_id !== undefined ? (cost.supplier_id ? Number(cost.supplier_id) : null) : null,
      cost.product_id !== undefined ? (cost.product_id ? Number(cost.product_id) : null) : null,
      cost.warehouse_id !== undefined ? (cost.warehouse_id ? Number(cost.warehouse_id) : null) : null,
      cost.due_date ? new Date(cost.due_date) : null,
      cost.financial_period || null,
      cost.company_id ? Number(cost.company_id) : null,
      cost.exchange_rate !== undefined ? Number(cost.exchange_rate) : null,
      cost.discount !== undefined ? Number(cost.discount) : null,
      cost.cost_type || null,
      cost.cost_behavior || null,
      cost.direct_indirect || null,
      cost.allocation_method || null,
      cost.allocation_status || null,
      cost.source || cost.source_type || null,
      cost.safe_id !== undefined ? (cost.safe_id ? Number(cost.safe_id) : null) : null,
      cost.treasury_account_id !== undefined ? (cost.treasury_account_id ? Number(cost.treasury_account_id) : null) : null,
      Number(id)
    ];

    const res = await runner.query(query, values);
    return res.rows[0] || null;
  }

  async deleteOperatingCost(id: number, client?: any): Promise<boolean> {
    const runner = client || pool;
    const res = await runner.query('DELETE FROM operating_costs WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount || 0) > 0;
  }

  async updateJournalEntryId(costId: number, journalEntryId: number, client?: any): Promise<void> {
    const runner = client || pool;
    await runner.query(
      'UPDATE operating_costs SET journal_entry_id = $1, link_ledger = true WHERE id = $2',
      [journalEntryId, costId]
    );
  }

  async getJournalEntryForCost(costId: number): Promise<any | null> {
    const res = await pool.query(
      "SELECT * FROM journal_entries WHERE source_type = 'cost' AND source_id = $1 LIMIT 1",
      [costId]
    );
    return res.rows[0] || null;
  }

  async clearAllOperatingCosts(client?: any): Promise<void> {
    const runner = client || pool;
    await runner.query('DELETE FROM operating_costs');
    await runner.query('DELETE FROM safe_transactions WHERE notes LIKE $1', ['%تكاليف%']);
    await runner.query('DELETE FROM journal_entries WHERE source_type = $1', ['cost']);
    await runner.query('DELETE FROM approval_requests WHERE module_type = $1', ['operating_cost']);
  }

  // ────────────────── COST CENTERS ──────────────────

  async findCostCenters(): Promise<any[]> {
    const res = await pool.query('SELECT * FROM cost_centers ORDER BY id ASC');
    return res.rows;
  }

  async getCostCenterById(id: number): Promise<any | null> {
    const res = await pool.query('SELECT * FROM cost_centers WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async insertCostCenter(data: any): Promise<any> {
    const code = String(data.code || `CC-${Date.now()}-${randomBytes(3).toString('hex')}`);
    const res = await pool.query(`
      INSERT INTO cost_centers (
        code, name, type, manager, budget, description, status, parent_id, company_id,
        branch_id, department_id, accounting_analytic_ref, budget_enabled,
        production_enabled, allocation_enabled
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      code,
      data.name,
      data.type || 'تشغيلي',
      data.manager || null,
      data.budget ? Number(data.budget) : 0,
      data.description || null,
      data.status || 'نشط',
      data.parent_id ? Number(data.parent_id) : null,
      data.company_id ? Number(data.company_id) : null,
      data.branch_id ? Number(data.branch_id) : null,
      data.department_id ? Number(data.department_id) : null,
      data.accounting_analytic_ref || null,
      data.budget_enabled === true,
      data.production_enabled === true,
      data.allocation_enabled !== false
    ]);
    return res.rows[0];
  }

  async updateCostCenter(id: number, data: any): Promise<any | null> {
    const res = await pool.query(`
      UPDATE cost_centers
      SET name = $1, type = $2, manager = $3, budget = $4, description = $5, status = $6
        , parent_id = $7, company_id = $8, branch_id = $9, department_id = $10
        , accounting_analytic_ref = $11, budget_enabled = $12
        , production_enabled = $13, allocation_enabled = $14
      WHERE id = $15
      RETURNING *
    `, [
      data.name,
      data.type,
      data.manager,
      Number(data.budget) || 0,
      data.description,
      data.status,
      data.parent_id ? Number(data.parent_id) : null,
      data.company_id ? Number(data.company_id) : null,
      data.branch_id ? Number(data.branch_id) : null,
      data.department_id ? Number(data.department_id) : null,
      data.accounting_analytic_ref || null,
      data.budget_enabled === true,
      data.production_enabled === true,
      data.allocation_enabled !== false,
      Number(id)
    ]);
    return res.rows[0] || null;
  }

  async deleteCostCenter(id: number): Promise<boolean> {
    const res = await pool.query('DELETE FROM cost_centers WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount || 0) > 0;
  }

  async countOperatingCostsByCenterId(centerId: number): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) as count FROM operating_costs WHERE cost_center_id = $1', [centerId]);
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  // ────────────────── COST ITEMS ──────────────────

  async findCostItems(): Promise<any[]> {
    const res = await pool.query('SELECT * FROM cost_items ORDER BY id ASC');
    return res.rows;
  }

  async getCostItemById(id: number): Promise<any | null> {
    const res = await pool.query('SELECT * FROM cost_items WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  async insertCostItem(data: any): Promise<any> {
    const code = String(data.code || `CI-${Date.now()}-${randomBytes(3).toString('hex')}`);
    const res = await pool.query(`
      INSERT INTO cost_items (
        code, name, category, default_center_id, default_allocation_method,
        budget_cap, alert_threshold, is_hr_linked, is_warehouse_linked,
        is_procurement_linked, description, status, accounting_account_id, parent_id,
        arabic_name, english_name, direct_indirect, cost_behavior, allow_production_allocation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      code,
      data.name,
      data.category || 'عام',
      data.default_center_id ? Number(data.default_center_id) : null,
      data.default_allocation_method || 'percentage',
      data.budget_cap ? Number(data.budget_cap) : 0,
      data.alert_threshold ? Number(data.alert_threshold) : 90,
      data.is_hr_linked === true,
      data.is_warehouse_linked === true,
      data.is_procurement_linked === true,
      data.description || null,
      data.status || 'نشط',
      data.accounting_account_id ? Number(data.accounting_account_id) : null,
      data.parent_id ? Number(data.parent_id) : null,
      data.arabic_name || data.name || null,
      data.english_name || null,
      data.direct_indirect || 'indirect',
      data.cost_behavior || 'variable',
      data.allow_production_allocation === true
    ]);
    return res.rows[0];
  }

  async updateCostItem(id: number, data: any): Promise<any | null> {
    const res = await pool.query(`
      UPDATE cost_items
      SET name = $1, category = $2, default_center_id = $3, default_allocation_method = $4,
          budget_cap = $5, alert_threshold = $6, is_hr_linked = $7, is_warehouse_linked = $8,
          is_procurement_linked = $9, description = $10, status = $11,
            accounting_account_id = $12, parent_id = $13, arabic_name = $14,
            english_name = $15, direct_indirect = $16, cost_behavior = $17,
            allow_production_allocation = $18
          WHERE id = $19
      RETURNING *
    `, [
      data.name,
      data.category,
      data.default_center_id ? Number(data.default_center_id) : null,
      data.default_allocation_method || 'percentage',
      data.budget_cap ? Number(data.budget_cap) : 0,
      data.alert_threshold ? Number(data.alert_threshold) : 90,
      data.is_hr_linked === true,
      data.is_warehouse_linked === true,
      data.is_procurement_linked === true,
      data.description || null,
      data.status || 'نشط',
      data.accounting_account_id ? Number(data.accounting_account_id) : null,
      data.parent_id ? Number(data.parent_id) : null,
      data.arabic_name || data.name || null,
      data.english_name || null,
      data.direct_indirect || 'indirect',
      data.cost_behavior || 'variable',
      data.allow_production_allocation === true,
      Number(id)
    ]);
    return res.rows[0] || null;
  }

  async deleteCostItem(id: number): Promise<boolean> {
    const res = await pool.query('DELETE FROM cost_items WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount || 0) > 0;
  }

  async countOperatingCostsByItemId(itemId: number): Promise<number> {
    const res = await pool.query('SELECT COUNT(*) as count FROM operating_costs WHERE cost_item_id = $1', [itemId]);
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  // ────────────────── BUDGETS ──────────────────

  async findBudgets(): Promise<any[]> {
    const res = await pool.query('SELECT * FROM estimated_budgets ORDER BY id DESC');
    return res.rows;
  }

  async insertBudget(data: any): Promise<any> {
    const res = await pool.query(`
      INSERT INTO estimated_budgets (name, type, branch, period, start_date, end_date, planned_amount, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      data.name,
      data.type || 'تشغيلية',
      data.branch || 'الفرع الرئيسي',
      data.period || 'شهري',
      data.start_date ? new Date(data.start_date) : new Date(),
      data.end_date ? new Date(data.end_date) : new Date(),
      data.planned_amount ? Number(data.planned_amount) : 0,
      data.notes || null,
      data.status || 'معتمدة'
    ]);
    return res.rows[0];
  }

  async deleteBudget(id: number): Promise<boolean> {
    const res = await pool.query('DELETE FROM estimated_budgets WHERE id = $1 RETURNING id', [id]);
    return (res.rowCount || 0) > 0;
  }

  // ────────────────── STANDARD & PRODUCT COSTS ──────────────────

  async getStandardCosts(): Promise<any[]> {
    const res = await pool.query('SELECT * FROM standard_costs ORDER BY id DESC LIMIT 1');
    return res.rows;
  }

  async insertStandardCost(data: any): Promise<any> {
    const res = await pool.query(`
      INSERT INTO standard_costs (rate_type, base_rate, overhead, hours, std_materials, std_labor, std_overhead, std_utilities)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.rate_type || 'hourly',
      Number(data.base_rate) || 0,
      Number(data.overhead) || 0,
      Number(data.hours) || 0,
      Number(data.std_materials) || 0,
      Number(data.std_labor) || 0,
      Number(data.std_overhead) || 0,
      Number(data.std_utilities) || 0
    ]);
    return res.rows[0];
  }

  async getProductCosts(): Promise<any[]> {
    const res = await pool.query('SELECT * FROM product_costs ORDER BY id DESC');
    return res.rows;
  }

  async getProductCostReport(filters: {
    search?: string;
    fromDate?: string;
    toDate?: string;
    costCenter?: string;
    branchId?: string;
    category?: string;
    hasRecipe?: string;
  } = {}): Promise<any[]> {
    try {
      let paramIndex = 1;
      const params: any[] = [];
      const whereConditions: string[] = ['1=1'];

      if (filters.search && filters.search.trim()) {
        const searchTerm = `%${filters.search.trim()}%`;
        params.push(searchTerm);
        whereConditions.push(`(
          p.name ILIKE $${paramIndex}
          OR COALESCE(p.item_code, '') ILIKE $${paramIndex}
          OR COALESCE(p.code, '') ILIKE $${paramIndex}
          OR COALESCE(p.barcode, '') ILIKE $${paramIndex}
          OR COALESCE(p.sku, '') ILIKE $${paramIndex}
          OR COALESCE(p.category, '') ILIKE $${paramIndex}
          OR CAST(p.id AS TEXT) ILIKE $${paramIndex}
        )`);
        paramIndex++;
      }

      if (filters.category && filters.category !== 'all' && filters.category.trim()) {
        params.push(filters.category.trim());
        whereConditions.push(`p.category = $${paramIndex}`);
        paramIndex++;
      }

      if (filters.fromDate && filters.fromDate.trim()) {
        params.push(filters.fromDate.trim());
        whereConditions.push(`(
          p.updated_at >= $${paramIndex}::timestamp
          OR r.updated_at >= $${paramIndex}::timestamp
          OR pb.updated_at >= $${paramIndex}::timestamp
          OR pc.updated_at >= $${paramIndex}::timestamp
        )`);
        paramIndex++;
      }

      if (filters.toDate && filters.toDate.trim()) {
        params.push(`${filters.toDate.trim()} 23:59:59`);
        whereConditions.push(`(
          p.updated_at <= $${paramIndex}::timestamp
          OR r.updated_at <= $${paramIndex}::timestamp
          OR pb.updated_at <= $${paramIndex}::timestamp
          OR pc.updated_at <= $${paramIndex}::timestamp
        )`);
        paramIndex++;
      }

      if (filters.branchId && filters.branchId !== 'all' && filters.branchId.trim()) {
        params.push(filters.branchId.trim());
        whereConditions.push(`(
          CAST(r.branch_id AS TEXT) = $${paramIndex}
          OR CAST(p.branch_id AS TEXT) = $${paramIndex}
        )`);
        paramIndex++;
      }

      const query = `
        WITH recipe_costs AS (
          SELECT 
            ri.recipe_id,
            COUNT(ri.id) as ingredients_count,
            SUM(
              COALESCE(ri.quantity, 0) * 
              COALESCE(
                NULLIF(ri.unit_cost, 0),
                (
                  SELECT COALESCE(
                    SUM(inv.quantity * inv.avg_cost) / NULLIF(SUM(inv.quantity), 0),
                    i.avg_cost,
                    i.cost_price,
                    i.last_purchase_price,
                    i.cost,
                    0
                  )
                  FROM ingredients i
                  LEFT JOIN inventory_items inv ON (inv.ingredient_id::text = i.id::text OR inv.item_id::text = i.id::text)
                  WHERE i.id::text = ri.ingredient_id::text
                  GROUP BY i.id, i.avg_cost, i.cost_price, i.last_purchase_price, i.cost
                ),
                0
              ) * (1 + COALESCE(ri.waste_percent, 0) / 100.0)
            ) as computed_recipe_material_cost
          FROM recipe_ingredients ri
          GROUP BY ri.recipe_id
        ),
        bom_costs AS (
          SELECT 
            bi.bom_id,
            COUNT(bi.id) as bom_items_count,
            SUM(
              COALESCE(bi.quantity, 0) * 
              COALESCE(
                NULLIF(bi.unit_cost, 0),
                (
                  SELECT COALESCE(
                    SUM(inv.quantity * inv.avg_cost) / NULLIF(SUM(inv.quantity), 0),
                    i.avg_cost,
                    i.cost_price,
                    i.last_purchase_price,
                    i.cost,
                    0
                  )
                  FROM ingredients i
                  LEFT JOIN inventory_items inv ON (inv.ingredient_id::text = i.id::text OR inv.item_id::text = i.id::text)
                  WHERE i.id::text = bi.ingredient_id::text
                  GROUP BY i.id, i.avg_cost, i.cost_price, i.last_purchase_price, i.cost
                ),
                0
              )
            ) as computed_bom_material_cost
          FROM bom_items bi
          GROUP BY bi.bom_id
        ),
        latest_product_costs AS (
          SELECT DISTINCT ON (product_id)
            product_id,
            raw_material,
            direct_labor,
            electricity,
            maintenance,
            depreciation,
            transport,
            packaging,
            indirect_overhead,
            selling_price,
            total_cost,
            profit_margin,
            updated_at
          FROM product_costs
          ORDER BY product_id, id DESC
        ),
        combined_report AS (
          SELECT 
            p.id::text as id,
            COALESCE(p.item_code, p.code, p.sku, 'PRD-' || p.id::text) as code,
            p.name,
            COALESCE(p.category, 'عام') as category,
            COALESCE(p.unit, 'وحدة') as unit,
            p.image_url,
            p.updated_at,
            
            -- Recipe Link
            r.id as recipe_id,
            r.name as recipe_name,
            r.total_yield as recipe_yield,
            r.branch_id,
            
            -- BOM Link
            pb.id as bom_id,
            COALESCE(pb.name, pb.product_name) as bom_name,
            
            -- Ingredients Count
            COALESCE(rc.ingredients_count, bc.bom_items_count, 0) as ingredients_count,
            
            -- Selling Price
            COALESCE(
              NULLIF(p.price, 0),
              NULLIF(r.selling_price, 0),
              NULLIF(pc.selling_price, 0),
              0
            )::numeric as sale_price,
            
            -- Real Material Cost
            COALESCE(
              NULLIF(rc.computed_recipe_material_cost / NULLIF(COALESCE(r.total_yield, 1), 0), 0),
              NULLIF(bc.computed_bom_material_cost, 0),
              NULLIF(pc.raw_material, 0),
              NULLIF(r.total_cost, 0),
              NULLIF(pb.total_cost, 0),
              NULLIF(p.cost_price, 0),
              NULLIF(p.cost, 0),
              0
            )::numeric as material_cost,
            
            -- Labor Cost
            COALESCE(pc.direct_labor, 0)::numeric as labor_cost,
            
            -- Overhead / Indirect Cost
            (
              COALESCE(pc.indirect_overhead, 0) +
              COALESCE(pc.electricity, 0) +
              COALESCE(pc.maintenance, 0) +
              COALESCE(pc.depreciation, 0) +
              COALESCE(pc.transport, 0) +
              COALESCE(pc.packaging, 0)
            )::numeric as overhead_cost,
            
            -- Specific breakdown
            COALESCE(pc.packaging, 0)::numeric as packaging_cost,
            COALESCE(pc.electricity, 0)::numeric as electricity_cost,
            COALESCE(pc.maintenance, 0)::numeric as maintenance_cost,
            COALESCE(pc.depreciation, 0)::numeric as depreciation_cost,
            COALESCE(pc.transport, 0)::numeric as transport_cost,
            COALESCE(pc.indirect_overhead, 0)::numeric as indirect_overhead_cost,
            
            -- Has Recipe Flag
            CASE 
              WHEN r.id IS NOT NULL OR pb.id IS NOT NULL OR COALESCE(rc.ingredients_count, bc.bom_items_count, 0) > 0 THEN true
              ELSE false
            END as has_recipe
            
          FROM products p
          LEFT JOIN recipes r ON (r.product_id::text = p.id::text OR (r.product_id IS NULL AND r.name = p.name))
          LEFT JOIN production_boms pb ON (
            pb.product_id::text = p.id::text
            OR pb.product_id::text = p.item_code
            OR pb.product_name = p.name
            OR pb.name = p.name
          )
          LEFT JOIN recipe_costs rc ON rc.recipe_id::text = r.id::text
          LEFT JOIN bom_costs bc ON bc.bom_id::text = pb.id::text
          LEFT JOIN latest_product_costs pc ON pc.product_id::text = p.id::text
          WHERE ${whereConditions.join(' AND ')}
        )
        SELECT 
          id,
          code,
          name,
          category,
          unit,
          image_url,
          recipe_id,
          recipe_name,
          bom_id,
          bom_name,
          ingredients_count,
          has_recipe,
          branch_id,
          sale_price,
          material_cost,
          labor_cost,
          overhead_cost,
          packaging_cost,
          electricity_cost,
          maintenance_cost,
          depreciation_cost,
          transport_cost,
          indirect_overhead_cost,
          
          -- Total Unit Cost
          (material_cost + labor_cost + overhead_cost)::numeric as total_unit_cost,
          
          -- Profit Margin (Absolute EGP)
          (sale_price - (material_cost + labor_cost + overhead_cost))::numeric as profit_margin,
          
          -- Margin Percentage (%)
          CASE 
            WHEN sale_price > 0 THEN 
              ROUND(((sale_price - (material_cost + labor_cost + overhead_cost)) / sale_price * 100)::numeric, 2)
            ELSE 0 
          END as margin_pct,
          
          -- Food Cost / Material Cost Percentage (%)
          CASE 
            WHEN sale_price > 0 THEN 
              ROUND((material_cost / sale_price * 100)::numeric, 2)
            ELSE 0 
          END as food_cost_pct,
          
          updated_at
        FROM combined_report
        ORDER BY has_recipe DESC, total_unit_cost DESC, name ASC;
      `;

      const result = await pool.query(query, params);
      let rows = result.rows;

      if (filters.hasRecipe === 'true') {
        rows = rows.filter((r: any) => r.has_recipe === true);
      } else if (filters.hasRecipe === 'false') {
        rows = rows.filter((r: any) => r.has_recipe === false);
      }

      return rows;
    } catch (err: any) {
      console.error('[CostRepository] getProductCostReport error:', err?.message || err);
      return [];
    }
  }

  async insertProductCost(data: any): Promise<any> {
    const res = await pool.query(`
      INSERT INTO product_costs (
        product_id, raw_material, direct_labor, electricity, maintenance,
        depreciation, transport, packaging, indirect_overhead, selling_price,
        total_cost, profit_margin
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      data.product_id,
      Number(data.raw_material) || 0,
      Number(data.direct_labor) || 0,
      Number(data.electricity) || 0,
      Number(data.maintenance) || 0,
      Number(data.depreciation) || 0,
      Number(data.transport) || 0,
      Number(data.packaging) || 0,
      Number(data.indirect_overhead) || 0,
      Number(data.selling_price) || 0,
      Number(data.total_cost) || 0,
      Number(data.profit_margin) || 0
    ]);
    return res.rows[0];
  }

  // ────────────────── RECIPE COSTING ──────────────────

  async getRecipeProducts(
    search?: string,
    warehouseId?: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{ data: any[]; total: number }> {
    try {
      let paramIndex = 1;
      const params: any[] = [];
      let searchWhereProd = '';
      let searchWhereIng = '';
      let searchWhereBom = '';
      let searchWhereRecipe = '';

      // Pagination (اختياري): لوLimit مش مبعوت بيرجع كل النتائج زي زمان
      const limitValue = Number(options.limit);
      const offsetValue = Number(options.offset);
      const hasLimit = Number.isFinite(limitValue) && limitValue > 0;
      const hasOffset = Number.isFinite(offsetValue) && offsetValue > 0;
      let limitClause = '';
      if (hasLimit || hasOffset) {
        if (hasLimit) {
          params.push(Math.min(limitValue, 500));
          limitClause = `LIMIT $${paramIndex}`;
          paramIndex++;
        }
        if (hasOffset) {
          params.push(offsetValue);
          limitClause += ` OFFSET $${paramIndex}`;
          paramIndex++;
        }
      }

      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        params.push(searchTerm);
        const pIdx = `$${paramIndex}`;
        paramIndex++;

        searchWhereProd = `
          AND (
            p.name ILIKE ${pIdx}
            OR COALESCE(p.item_code, '') ILIKE ${pIdx}
            OR COALESCE(p.code, '') ILIKE ${pIdx}
            OR COALESCE(p.barcode, '') ILIKE ${pIdx}
            OR COALESCE(p.sku, '') ILIKE ${pIdx}
            OR COALESCE(p.category, '') ILIKE ${pIdx}
            OR CAST(p.id AS TEXT) ILIKE ${pIdx}
          )
        `;

        searchWhereIng = `
          AND (
            i.name ILIKE ${pIdx}
            OR COALESCE(i.item_code, '') ILIKE ${pIdx}
            OR COALESCE(i.code, '') ILIKE ${pIdx}
            OR COALESCE(i.barcode, '') ILIKE ${pIdx}
            OR COALESCE(i.category, '') ILIKE ${pIdx}
            OR COALESCE(i.item_group, '') ILIKE ${pIdx}
            OR ('ING-' || i.id::text) ILIKE ${pIdx}
            OR CAST(i.id AS TEXT) ILIKE ${pIdx}
          )
        `;

        searchWhereBom = `
          AND (
            COALESCE(pb.name, pb.product_name, '') ILIKE ${pIdx}
            OR COALESCE(pb.bom_code, '') ILIKE ${pIdx}
            OR CAST(pb.id AS TEXT) ILIKE ${pIdx}
          )
        `;

        searchWhereRecipe = `
          AND (
            r.name ILIKE ${pIdx}
            OR CAST(r.id AS TEXT) ILIKE ${pIdx}
          )
        `;
      }

      const res = await pool.query(`
        WITH prod_list AS (
          SELECT 
            p.id::text as id,
            p.name,
            COALESCE(p.item_code, p.code, 'PRD-' || p.id::text) as item_code,
            COALESCE(p.barcode, '') as barcode,
            COALESCE(p.sku, p.code, '') as sku,
            COALESCE(p.category, 'منتجات عامة') as category,
            COALESCE(p.cost_price, p.cost, 0) as cost_price,
            COALESCE(p.price, 0) as price,
            COALESCE(p.unit, 'حبة') as unit,
            COALESCE(p.yield_portions, 1) as yield_portions,
            COALESCE(p.show_in_pos, true) as show_in_pos,
            COALESCE(p.is_active, true) as is_active,
            'product' as item_type,
            COALESCE(
              (SELECT pb.id::text FROM production_boms pb WHERE (CAST(pb.product_id AS TEXT) = CAST(p.id AS TEXT) OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name) ORDER BY pb.id DESC LIMIT 1),
              (SELECT r.id::text FROM recipes r WHERE (CAST(r.product_id AS TEXT) = CAST(p.id AS TEXT) OR r.name = p.name) ORDER BY r.id DESC LIMIT 1)
            )::text as production_bom_id,
            COALESCE(
              (SELECT COALESCE(pb.name, pb.product_name, pb.bom_code) FROM production_boms pb WHERE (CAST(pb.product_id AS TEXT) = CAST(p.id AS TEXT) OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name) ORDER BY pb.id DESC LIMIT 1),
              (SELECT r.name FROM recipes r WHERE (CAST(r.product_id AS TEXT) = CAST(p.id AS TEXT) OR r.name = p.name) ORDER BY r.id DESC LIMIT 1)
            ) as production_bom_name,
            COALESCE(
              (SELECT pb.version::text FROM production_boms pb WHERE (CAST(pb.product_id AS TEXT) = CAST(p.id AS TEXT) OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name) ORDER BY pb.id DESC LIMIT 1),
              '1'
            ) as production_bom_version,
            COALESCE(
              (SELECT pb.scrap_percentage FROM production_boms pb WHERE (CAST(pb.product_id AS TEXT) = CAST(p.id AS TEXT) OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name) ORDER BY pb.id DESC LIMIT 1),
              0
            ) as production_bom_scrap,
            COALESCE(
              (SELECT pb.total_cost FROM production_boms pb WHERE (CAST(pb.product_id AS TEXT) = CAST(p.id AS TEXT) OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name) ORDER BY pb.id DESC LIMIT 1),
              (SELECT r.total_cost FROM recipes r WHERE (CAST(r.product_id AS TEXT) = CAST(p.id AS TEXT) OR r.name = p.name) ORDER BY r.id DESC LIMIT 1),
              0
            ) as production_bom_cost,
            (
              SELECT COUNT(*) FROM (
                SELECT 1 FROM product_ingredients pi WHERE pi.product_id::text = p.id::text
                UNION ALL
                SELECT 1 FROM bom_items bi JOIN production_boms pb ON bi.bom_id::text = pb.id::text WHERE (pb.product_id::text = p.id::text OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name)
                UNION ALL
                SELECT 1 FROM recipe_ingredients ri JOIN recipes r ON ri.recipe_id::text = r.id::text WHERE (r.product_id::text = p.id::text OR r.name = p.name)
              ) t
            ) as ingredients_count,
            COALESCE(
              (SELECT raw_material FROM product_costs pc WHERE CAST(pc.product_id AS TEXT) = CAST(p.id AS TEXT) ORDER BY id DESC LIMIT 1),
              (SELECT pb.total_cost FROM production_boms pb WHERE (CAST(pb.product_id AS TEXT) = CAST(p.id AS TEXT) OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name) ORDER BY pb.id DESC LIMIT 1),
              (SELECT r.total_cost FROM recipes r WHERE (CAST(r.product_id AS TEXT) = CAST(p.id AS TEXT) OR r.name = p.name) ORDER BY r.id DESC LIMIT 1),
              p.cost_price,
              p.cost,
              0
            ) as material_cost,
            COALESCE(
              (SELECT direct_labor + indirect_overhead FROM product_costs pc WHERE CAST(pc.product_id AS TEXT) = CAST(p.id AS TEXT) ORDER BY id DESC LIMIT 1),
              0
            ) as production_cost,
            COALESCE(
              (SELECT (COALESCE(raw_material, 0) + COALESCE(direct_labor, 0) + COALESCE(electricity, 0) + COALESCE(maintenance, 0) + COALESCE(depreciation, 0) + COALESCE(transport, 0) + COALESCE(packaging, 0) + COALESCE(indirect_overhead, 0)) FROM product_costs pc WHERE CAST(pc.product_id AS TEXT) = CAST(p.id AS TEXT) ORDER BY id DESC LIMIT 1),
              (SELECT pb.total_cost FROM production_boms pb WHERE (CAST(pb.product_id AS TEXT) = CAST(p.id AS TEXT) OR pb.product_id::text = p.item_code OR pb.product_name = p.name OR pb.name = p.name) ORDER BY pb.id DESC LIMIT 1),
              (SELECT r.total_cost FROM recipes r WHERE (CAST(r.product_id AS TEXT) = CAST(p.id AS TEXT) OR r.name = p.name) ORDER BY r.id DESC LIMIT 1),
              p.cost_price,
              p.cost,
              0
            ) as saved_total_cost,
            p.id::text as linked_product_id,
            p.name as linked_product_name
          FROM products p
          WHERE (p.is_active IS NULL OR p.is_active = true)
            ${searchWhereProd}
        ),
        ing_list AS (
          SELECT 
            'ING-' || i.id::text as id,
            i.name,
            COALESCE(i.item_code, i.code, 'ING-' || i.id::text) as item_code,
            COALESCE(i.barcode, '') as barcode,
            COALESCE(i.code, i.item_code, '') as sku,
            COALESCE(i.category, i.item_group, 'خامات ومكونات') as category,
            COALESCE(i.cost, i.cost_price, i.avg_cost, 0) as cost_price,
            COALESCE(i.cost, i.cost_price, i.avg_cost, 0) as price,
            COALESCE(i.unit, 'وحدة') as unit,
            1 as yield_portions,
            false as show_in_pos,
            true as is_active,
            'ingredient' as item_type,
            NULL::text as production_bom_id,
            NULL::text as production_bom_name,
            '1'::text as production_bom_version,
            0 as production_bom_scrap,
            0 as production_bom_cost,
            0 as ingredients_count,
            COALESCE(i.avg_cost, i.cost_price, i.cost, 0) as material_cost,
            0 as production_cost,
            COALESCE(i.avg_cost, i.cost_price, i.cost, 0) as saved_total_cost,
            '' as linked_product_id,
            '' as linked_product_name
          FROM ingredients i
          WHERE 1=1
            ${searchWhereIng}
        ),
        standalone_boms AS (
          SELECT 
            pb.id::text as id,
            COALESCE(pb.name, pb.product_name, 'وصفة ' || pb.id::text) as name,
            COALESCE(pb.bom_code, pb.id::text) as item_code,
            '' as barcode,
            '' as sku,
            'وصفة تصنيع إنتاج' as category,
            COALESCE(pb.total_cost, 0) as cost_price,
            COALESCE(pb.total_cost, 0) as price,
            'وحدة' as unit,
            1 as yield_portions,
            false as show_in_pos,
            true as is_active,
            'bom' as item_type,
            pb.id::text as production_bom_id,
            COALESCE(pb.name, pb.product_name, 'وصفة ' || pb.id::text) as production_bom_name,
            COALESCE(pb.version::text, '1')::text as production_bom_version,
            COALESCE(pb.scrap_percentage, 0) as production_bom_scrap,
            COALESCE(pb.total_cost, 0) as production_bom_cost,
            (
              SELECT COUNT(*) FROM bom_items bi WHERE bi.bom_id::text = pb.id::text
            ) as ingredients_count,
            COALESCE(pb.total_cost, 0) as material_cost,
            0 as production_cost,
            COALESCE(pb.total_cost, 0) as saved_total_cost,
            COALESCE((SELECT p2.id::text FROM products p2 WHERE CAST(p2.id AS TEXT) = CAST(pb.product_id AS TEXT) OR p2.name = COALESCE(pb.name, pb.product_name) LIMIT 1), pb.product_id::text, '') as linked_product_id,
            COALESCE((SELECT p2.name FROM products p2 WHERE CAST(p2.id AS TEXT) = CAST(pb.product_id AS TEXT) OR p2.name = COALESCE(pb.name, pb.product_name) LIMIT 1), pb.product_name, pb.name, '') as linked_product_name
          FROM production_boms pb
          WHERE (pb.product_id IS NULL OR pb.product_id::text NOT IN (SELECT id::text FROM products))
            AND COALESCE(pb.name, pb.product_name, '') NOT IN (SELECT name FROM products)
            ${searchWhereBom}
        ),
        standalone_recipes AS (
          SELECT 
            'REC-' || r.id::text as id,
            r.name,
            COALESCE(r.id::text, '') as item_code,
            '' as barcode,
            '' as sku,
            'وصفة مطعم وجبة' as category,
            COALESCE(r.total_cost, 0) as cost_price,
            COALESCE(r.selling_price, 0) as price,
            'وجبة' as unit,
            COALESCE(r.total_yield, 1) as yield_portions,
            true as show_in_pos,
            true as is_active,
            'recipe' as item_type,
            r.id::text as production_bom_id,
            r.name as production_bom_name,
            '1'::text as production_bom_version,
            0 as production_bom_scrap,
            COALESCE(r.total_cost, 0) as production_bom_cost,
            (
              SELECT COUNT(*) FROM recipe_ingredients ri WHERE ri.recipe_id::text = r.id::text
            ) as ingredients_count,
            COALESCE(r.total_cost, 0) as material_cost,
            0 as production_cost,
            COALESCE(r.total_cost, 0) as saved_total_cost,
            COALESCE((SELECT p2.id::text FROM products p2 WHERE CAST(p2.id AS TEXT) = CAST(r.product_id AS TEXT) OR p2.name = r.name LIMIT 1), r.product_id::text, '') as linked_product_id,
            COALESCE((SELECT p2.name FROM products p2 WHERE CAST(p2.id AS TEXT) = CAST(r.product_id AS TEXT) OR p2.name = r.name LIMIT 1), r.name, '') as linked_product_name
          FROM recipes r
          WHERE (r.product_id IS NULL OR r.product_id::text NOT IN (SELECT id::text FROM products))
            AND r.name NOT IN (SELECT name FROM products)
            ${searchWhereRecipe}
        )
        SELECT *, COUNT(*) OVER() AS total_count FROM (
          SELECT * FROM prod_list
          UNION ALL
          SELECT * FROM ing_list
          UNION ALL
          SELECT * FROM standalone_boms
          UNION ALL
          SELECT * FROM standalone_recipes
        ) all_items
        ORDER BY name ASC
        ${limitClause}
      `, params);
      const total = res.rows.length ? Number(res.rows[0].total_count ?? res.rows.length) : 0;
      const data = res.rows.map(({ total_count, ...row }: any) => row);
      return { data, total } as any;
    } catch (e) {
      console.error('[CostRepository] getRecipeProducts full query error, using safe fallback query:', e);
      let searchWhere = '';
      const params: any[] = [];
      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        searchWhere = `WHERE (name ILIKE $1 OR COALESCE(code, '') ILIKE $1 OR COALESCE(item_code, '') ILIKE $1 OR COALESCE(barcode, '') ILIKE $1)`;
      }

      const prodFallback = await pool.query(`
        SELECT 
          p.id::text as id,
          p.name,
          COALESCE(p.code, p.item_code, 'PRD-' || p.id::text) as item_code,
          COALESCE(p.barcode, '') as barcode,
          COALESCE(p.code, '') as sku,
          'منتجات عامة' as category,
          COALESCE(p.cost, p.cost_price, 0) as cost_price,
          COALESCE(p.price, 0) as price,
          COALESCE(p.unit, 'حبة') as unit,
          1 as yield_portions,
          true as show_in_pos,
          true as is_active,
          'product' as item_type,
          NULL as production_bom_id,
          NULL as production_bom_name,
          1 as production_bom_version,
          0 as production_bom_scrap,
          0 as production_bom_cost,
          0 as ingredients_count
        FROM products p
        ${searchWhere}
      `, params);

      let ingFallbackRows: any[] = [];
      try {
        const ingFallback = await pool.query(`
          SELECT 
            'ING-' || i.id::text as id,
            i.name,
            COALESCE(i.item_code, i.code, 'ING-' || i.id::text) as item_code,
            COALESCE(i.barcode, '') as barcode,
            COALESCE(i.code, i.item_code, '') as sku,
            COALESCE(i.category, i.item_group, 'خامات ومكونات') as category,
            COALESCE(i.cost, i.cost_price, i.avg_cost, 0) as cost_price,
            COALESCE(i.cost, i.cost_price, i.avg_cost, 0) as price,
            COALESCE(i.unit, 'وحدة') as unit,
            1 as yield_portions,
            false as show_in_pos,
            true as is_active,
            'ingredient' as item_type,
            NULL as production_bom_id,
            NULL as production_bom_name,
            1 as production_bom_version,
            0 as production_bom_scrap,
            0 as production_bom_cost,
            0 as ingredients_count
          FROM ingredients i
          ${searchWhere}
        `, params);
        ingFallbackRows = ingFallback.rows;
      } catch (_) {}

      const fallbackRows = [...prodFallback.rows, ...ingFallbackRows];
      return { data: fallbackRows, total: fallbackRows.length } as any;
    }
  }

  async getAllIngredientsWithCost(warehouseId?: number): Promise<any[]> {
    let query: string;
    let params: any[] = [];

    if (warehouseId) {
      query = `
        SELECT 
          i.id,
          i.name,
          i.unit,
          i.barcode,
          COALESCE(SUM(inv.quantity), 0) as stock_quantity,
          COALESCE(
            NULLIF(
              SUM(COALESCE(inv.quantity, 0) * COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0), NULLIF(i.avg_cost, 0), NULLIF(i.cost_price, 0), i.cost, 0)) 
              / NULLIF(SUM(COALESCE(inv.quantity, 0)), 0),
              0
            ),
            NULLIF(MAX(COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0))), 0),
            NULLIF(i.avg_cost, 0),
            NULLIF(i.cost_price, 0),
            i.cost,
            0
          ) as avg_cost,
          COALESCE(
            NULLIF(
              SUM(COALESCE(inv.quantity, 0) * COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0), NULLIF(i.avg_cost, 0), NULLIF(i.cost_price, 0), i.cost, 0)) 
              / NULLIF(SUM(COALESCE(inv.quantity, 0)), 0),
              0
            ),
            NULLIF(MAX(COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0))), 0),
            NULLIF(i.avg_cost, 0),
            NULLIF(i.cost_price, 0),
            i.cost,
            0
          ) as unit_cost,
          COALESCE(NULLIF(i.cost_price, 0), i.cost, 0) as standard_cost,
          COALESCE(NULLIF(MAX(inv.last_cost), 0), NULLIF(i.last_purchase_price, 0), NULLIF(i.cost_price, 0), i.cost, 0) as last_purchase_cost
        FROM ingredients i
        LEFT JOIN inventory_items inv ON (inv.ingredient_id::text = i.id::text OR inv.item_id::text = i.id::text) AND inv.warehouse_id::text = $1::text
        GROUP BY i.id, i.name, i.unit, i.barcode, i.cost, i.cost_price, i.avg_cost, i.last_purchase_price
        ORDER BY i.name ASC
      `;
      params = [warehouseId];
    } else {
      query = `
        SELECT 
          i.id,
          i.name,
          i.unit,
          i.barcode,
          COALESCE(SUM(inv.quantity), 0) as stock_quantity,
          COALESCE(
            NULLIF(
              SUM(COALESCE(inv.quantity, 0) * COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0), NULLIF(i.avg_cost, 0), NULLIF(i.cost_price, 0), i.cost, 0)) 
              / NULLIF(SUM(COALESCE(inv.quantity, 0)), 0),
              0
            ),
            NULLIF(MAX(COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0))), 0),
            NULLIF(i.avg_cost, 0),
            NULLIF(i.cost_price, 0),
            i.cost,
            0
          ) as avg_cost,
          COALESCE(
            NULLIF(
              SUM(COALESCE(inv.quantity, 0) * COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0), NULLIF(i.avg_cost, 0), NULLIF(i.cost_price, 0), i.cost, 0)) 
              / NULLIF(SUM(COALESCE(inv.quantity, 0)), 0),
              0
            ),
            NULLIF(MAX(COALESCE(NULLIF(inv.avg_cost, 0), NULLIF(inv.cost, 0))), 0),
            NULLIF(i.avg_cost, 0),
            NULLIF(i.cost_price, 0),
            i.cost,
            0
          ) as unit_cost,
          COALESCE(NULLIF(i.cost_price, 0), i.cost, 0) as standard_cost,
          COALESCE(NULLIF(MAX(inv.last_cost), 0), NULLIF(i.last_purchase_price, 0), NULLIF(i.cost_price, 0), i.cost, 0) as last_purchase_cost
        FROM ingredients i
        LEFT JOIN inventory_items inv ON (inv.ingredient_id::text = i.id::text OR inv.item_id::text = i.id::text)
        GROUP BY i.id, i.name, i.unit, i.barcode, i.cost, i.cost_price, i.avg_cost, i.last_purchase_price
        ORDER BY i.name ASC
      `;
    }

    try {
      const res = await pool.query(query, params);
      return res.rows;
    } catch (e) {
      console.error('[CostRepository] getAllIngredientsWithCost error, using fallback:', e);
      const fallback = await pool.query(`
        SELECT 
          id, name, unit, barcode, 0 as stock_quantity, 
          COALESCE(avg_cost, cost_price, cost, 0) as avg_cost, 
          COALESCE(avg_cost, cost_price, cost, 0) as unit_cost,
          COALESCE(cost_price, cost, 0) as standard_cost,
          COALESCE(last_purchase_price, cost_price, cost, 0) as last_purchase_cost
        FROM ingredients ORDER BY name ASC
      `);
      return fallback.rows;
    }
  }

  async getRecipeIngredients(productId: string): Promise<any[]> {
    const res = await pool.query(`
      SELECT 
        pi.ingredient_id as id,
        pi.ingredient_id,
        pi.quantity,
        pi.unit,
        COALESCE(pi.waste_percent, 0) as waste_percent,
        i.name as ingredient_name,
        i.unit as base_unit,
        COALESCE(i.cost, i.cost_price, i.avg_cost, 0) as cost_price
      FROM product_ingredients pi
      LEFT JOIN ingredients i ON pi.ingredient_id::text = i.id::text
      WHERE pi.product_id::text = $1::text
      ORDER BY pi.ingredient_id ASC
    `, [productId]);
    return res.rows;
  }

  async updateRecipeIngredients(productId: string, ingredients: any[], client?: any): Promise<void> {
    const runner = client || pool;
    await runner.query('DELETE FROM product_ingredients WHERE product_id::text = $1::text', [productId]);

    for (const item of ingredients) {
      if (item.ingredient_id && Number(item.quantity) > 0) {
        await runner.query(`
          INSERT INTO product_ingredients (product_id, ingredient_id, quantity, unit, waste_percent)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          productId,
          item.ingredient_id,
          Number(item.quantity),
          item.unit || null,
          Number(item.waste_percent) || 0
        ]);
      }
    }
  }

  async insertRecipeCostHistory(data: any): Promise<any> {
    const res = await pool.query(`
      INSERT INTO recipe_cost_history (
        product_id, recipe_version, cost_source, total_ingredients_cost,
        total_waste_cost, packaging_cost, labor_cost, overhead_cost,
        grand_total_cost, yield_portions, cost_per_portion, selling_price,
        gross_profit, profit_margin_pct, status, calculated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `, [
      String(data.product_id),
      data.recipe_version || 'V1',
      data.cost_source || 'weighted_avg',
      Number(data.total_ingredients_cost) || 0,
      Number(data.total_waste_cost) || 0,
      Number(data.packaging_cost) || 0,
      Number(data.labor_cost) || 0,
      Number(data.overhead_cost) || 0,
      Number(data.grand_total_cost) || 0,
      Number(data.yield_portions) || 1,
      Number(data.cost_per_portion) || 0,
      Number(data.selling_price) || 0,
      Number(data.gross_profit) || 0,
      Number(data.profit_margin_pct) || 0,
      data.status || 'Calculated',
      data.calculated_by || 'النظام'
    ]);
    return res.rows[0];
  }

  async getRecipeCostHistory(productId: string): Promise<any[]> {
    const res = await pool.query(`
      SELECT * FROM recipe_cost_history
      WHERE product_id::text = $1::text
      ORDER BY created_at DESC
      LIMIT 20
    `, [productId]);
    return res.rows;
  }

  async updateProductCostPrice(productId: string, costPrice: number, client?: any): Promise<void> {
    const runner = client || pool;
    await runner.query(
      'UPDATE products SET cost_price = $1 WHERE id::text = $2::text',
      [costPrice, productId]
    );
  }

  // ────────────────── TREASURY & SAFES ──────────────────

  async getSafeByName(safeName: string, client?: any): Promise<any | null> {
    const runner = client || pool;
    const res = await runner.query('SELECT id, name, branch_id FROM safes WHERE name = $1 LIMIT 1', [safeName]);
    return res.rows[0] || null;
  }

  async findSafeTransactionForCost(safeId: number, costId: number, client?: any): Promise<any | null> {
    const runner = client || pool;
    const res = await runner.query(
      "SELECT * FROM safe_transactions WHERE safe_id = $1 AND reference_id = $2 AND notes LIKE $3 ORDER BY id LIMIT 1",
      [safeId, costId, `%تكلفة #${costId}%`]
    );
    return res.rows[0] || null;
  }

  async insertSafeTransaction(data: {
    safe_id: number;
    type: string;
    amount: number;
    notes?: string;
    reference_id?: string;
    created_by?: string;
    user_id?: number | string | null;
    payment_method?: string;
  }, client?: any): Promise<any> {
    const runner = client || pool;
    // safe_transactions stores the numeric user id only (no created_by / username column).
    const rawUser = data.user_id ?? data.created_by;
    const parsedUser = Number(rawUser);
    const userId = Number.isFinite(parsedUser) && parsedUser > 0 ? parsedUser : null;
    const res = await runner.query(`
      INSERT INTO safe_transactions (safe_id, type, amount, notes, reference_id, user_id, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      data.safe_id,
      data.type || 'expense',
      Number(data.amount),
      data.notes || null,
      data.reference_id || null,
      userId,
      data.payment_method || 'cash'
    ]);
    return res.rows[0];
  }

  // ────────────────── ACTIVITY LOGS ──────────────────

  async getActivityLogs(limit = 100): Promise<any[]> {
    const res = await pool.query(
      'SELECT * FROM costs_activity_log ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return res.rows;
  }

  async logActivity(action: string, details: string, username: string = 'النظام', client?: any): Promise<void> {
    if (client) {
      await client.query(
        'INSERT INTO costs_activity_log (action, details, username) VALUES ($1, $2, $3)',
        [action, details, username]
      );
      return;
    }

    try {
      await pool.query(
        'INSERT INTO costs_activity_log (action, details, username) VALUES ($1, $2, $3)',
        [action, details, username]
      );
    } catch (_) {}
  }

  // ────────────────── INTEGRATIONS ──────────────────

  async getIntegrationEmployees(): Promise<any[]> {
    const res = await pool.query('SELECT id, name, job_title, basic_salary FROM employees ORDER BY name ASC');
    return res.rows;
  }

  async getIntegrationSuppliers(): Promise<any[]> {
    const res = await pool.query('SELECT id, name, phone, balance FROM suppliers ORDER BY name ASC');
    return res.rows;
  }

  async getIntegrationCustomers(): Promise<any[]> {
    const res = await pool.query('SELECT id, name, phone FROM customers ORDER BY name ASC');
    return res.rows;
  }

  async getIntegrationProducts(): Promise<any[]> {
    const res = await pool.query('SELECT id, name, category, price, cost_price FROM products ORDER BY name ASC');
    return res.rows;
  }

  async getIntegrationIngredients(): Promise<any[]> {
    const res = await pool.query('SELECT id, name, unit, cost_price FROM ingredients ORDER BY name ASC');
    return res.rows;
  }

  async getIntegrationWarehouses(): Promise<any[]> {
    const res = await pool.query('SELECT id, name, location FROM warehouses ORDER BY name ASC');
    return res.rows;
  }

  async getIntegrationAccounts(): Promise<any[]> {
    const res = await pool.query('SELECT id, name, code, type FROM accounts WHERE is_active = true ORDER BY code ASC');
    return res.rows;
  }
}

export const costRepository = new CostRepository();
