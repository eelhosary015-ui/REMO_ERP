import { pool } from '../../../server-db.js';

// ═══════════════════════════════════════════════════════════════
// Auto Posting Service — Accounting Integration
// Automatically creates journal entries for operations across the system
// ═══════════════════════════════════════════════════════════════

export interface JournalEntryResult {
  success: boolean;
  journal_entry_id?: number;
  error?: string;
}

interface AutoPostingConfig {
  customer_account_id?: number;
  supplier_account_id?: number;
  sales_account_id?: number;
  sales_returns_account_id?: number;
  purchase_account_id?: number;
  purchase_returns_account_id?: number;
  inventory_account_id?: number;
  cost_of_goods_account_id?: number;
  cash_account_id?: number;
  bank_account_id?: number;
  discount_allowed_account_id?: number;
  discount_received_account_id?: number;
  scrap_account_id?: number;
  production_cost_account_id?: number;
  wage_payable_account_id?: number;
  wage_expense_account_id?: number;
  waste_loss_account_id?: number;
  // Add more as needed
}

async function getAutoPostingConfig(companyId?: number, branchId?: number): Promise<AutoPostingConfig> {
  const { rows } = await pool.query('SELECT config_key, account_id FROM account_config');
  const config: AutoPostingConfig = {};
  for (const row of rows) {
    (config as any)[row.config_key] = row.account_id;
  }
  return config;
}

async function getDocumentNumber(prefix: string): Promise<string> {
  const { rows } = await pool.query(
    "SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM LENGTH($1)+1) AS INTEGER)), 0) + 1 as next_num FROM journal_entries WHERE reference LIKE $2 || '%'",
    [prefix, prefix + '-']
  );
  return `${prefix}-${String(rows[0].next_num).padStart(6, '0')}`;
}

async function createJournalEntry(data: {
  date: string;
  reference: string;
  description: string;
  source_type: string;
  source_id?: number;
  branch_id?: number;
  company_id?: number;
  items: Array<{
    account_id: number;
    debit: number;
    credit: number;
    description?: string;
    cost_center_id?: number;
  }>;
}): Promise<JournalEntryResult> {
  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'No journal items' };
  }

  const totalDebit = data.items.reduce((s, i) => s + (i.debit || 0), 0);
  const totalCredit = data.items.reduce((s, i) => s + (i.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return { success: false, error: `Debit/Credit mismatch: ${totalDebit} vs ${totalCredit}` };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO journal_entries (date, reference, description, source_type, source_id, branch_id, company_id, total_debit, total_credit, status, period_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'posted',
         (SELECT id FROM financial_periods WHERE month = EXTRACT(MONTH FROM $1::date) AND year = EXTRACT(YEAR FROM $1::date) AND status = 'open' LIMIT 1))
       RETURNING id`,
      [data.date, data.reference, data.description, data.source_type, data.source_id, data.branch_id, data.company_id, totalDebit, totalCredit]
    );

    const jeId = rows[0].id;

    for (const item of data.items) {
      if ((item.debit || 0) === 0 && (item.credit || 0) === 0) continue;
      let validCostCenterId: number | null = null;
      if (item.cost_center_id && !isNaN(Number(item.cost_center_id))) {
        try {
          const ccCheck = await client.query("SELECT id FROM cost_centers WHERE id = $1 LIMIT 1", [Number(item.cost_center_id)]);
          if (ccCheck.rows.length > 0) {
            validCostCenterId = ccCheck.rows[0].id;
          }
        } catch (_) {}
      }
      await client.query(
        // journal_items stores the line label in `notes` (there is no description column)
        `INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [jeId, item.account_id, item.debit || 0, item.credit || 0, item.description, validCostCenterId]
      );
    }

    await client.query('COMMIT');
    return { success: true, journal_entry_id: jeId };
  } catch (error: any) {
    await client.query('ROLLBACK');
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════════════════════════════
// Auto Posting Functions — Called from other services/controllers
// ═══════════════════════════════════════════════════════════════

/**
 * Post a sales invoice automatically
 * Debit: Customer/ Cash  |  Credit: Sales Revenue
 */
export async function postSalesInvoice(params: {
  orderId: number;
  total: number;
  cost: number;
  customerId?: number;
  paymentMethod: string;
  branchId?: number;
  companyId?: number;
  date?: string;
}): Promise<JournalEntryResult> {
  const config = await getAutoPostingConfig(params.companyId);
  const reference = await getDocumentNumber('SL');
  const date = params.date || new Date().toISOString().split('T')[0];

  const items: any[] = [];

  // Debit: Customer or Cash
  if (params.paymentMethod === 'cash' || params.paymentMethod === 'card') {
    const accountId = config.cash_account_id;
    if (!accountId) return { success: false, error: 'Cash account not configured' };
    items.push({ account_id: accountId, debit: params.total, credit: 0, description: `فاتورة بيع #${params.orderId}` });
  } else {
    const accountId = config.customer_account_id;
    if (!accountId) return { success: false, error: 'Customer account not configured' };
    items.push({ account_id: accountId, debit: params.total, credit: 0, description: `فاتورة بيع #${params.orderId} - عميل` });
  }

  // Credit: Sales Revenue
  const salesAccountId = config.sales_account_id;
  if (salesAccountId) {
    items.push({ account_id: salesAccountId, debit: 0, credit: params.total, description: `إيراد مبيعات - فاتورة #${params.orderId}` });
  }

  // Debit: Cost of Goods Sold
  if (params.cost > 0 && config.cost_of_goods_account_id) {
    items.push({ account_id: config.cost_of_goods_account_id, debit: params.cost, credit: 0, description: `تكلفة بضاعة مباعة - فاتورة #${params.orderId}` });
    // Credit: Inventory
    if (config.inventory_account_id) {
      items.push({ account_id: config.inventory_account_id, debit: 0, credit: params.cost, description: `تخفيض مخزون - فاتورة #${params.orderId}` });
    }
  }

  return createJournalEntry({
    date,
    reference,
    description: `تسجيل فاتورة بيع #${params.orderId}`,
    source_type: 'sales_invoice',
    source_id: params.orderId,
    branch_id: params.branchId,
    company_id: params.companyId,
    items,
  });
}

/**
 * Post a purchase invoice automatically
 * Debit: Inventory  |  Credit: Supplier/ Cash
 */
export async function postPurchaseInvoice(params: {
  purchaseId: number;
  total: number;
  supplierId?: number;
  paymentMethod: string;
  branchId?: number;
  companyId?: number;
  date?: string;
}): Promise<JournalEntryResult> {
  const config = await getAutoPostingConfig(params.companyId);
  const reference = await getDocumentNumber('PU');
  const date = params.date || new Date().toISOString().split('T')[0];

  const items: any[] = [];

  // Debit: Inventory
  const invAccountId = config.inventory_account_id || config.purchase_account_id;
  if (!invAccountId) return { success: false, error: 'Inventory/Purchase account not configured' };
  items.push({ account_id: invAccountId, debit: params.total, credit: 0, description: `فاتورة شراء #${params.purchaseId}` });

  // Credit: Supplier or Cash
  if (params.paymentMethod === 'cash') {
    const accountId = config.cash_account_id;
    if (!accountId) return { success: false, error: 'Cash account not configured' };
    items.push({ account_id: accountId, debit: 0, credit: params.total, description: `سداد مشتريات #${params.purchaseId}` });
  } else {
    const accountId = config.supplier_account_id;
    if (!accountId) return { success: false, error: 'Supplier account not configured' };
    items.push({ account_id: accountId, debit: 0, credit: params.total, description: `مستحق مورد - فاتورة #${params.purchaseId}` });
  }

  return createJournalEntry({
    date,
    reference,
    description: `تسجيل فاتورة شراء #${params.purchaseId}`,
    source_type: 'purchase_invoice',
    source_id: params.purchaseId,
    branch_id: params.branchId,
    company_id: params.companyId,
    items,
  });
}

/**
 * Post inventory stock adjustment
 * Debit: Inventory (increase) or Credit: Inventory (decrease)  |  Opposite: Inventory Variance
 */
export async function postInventoryAdjustment(params: {
  transactionId: number;
  warehouseId: number;
  ingredientId: number;
  quantity: number;
  unitCost: number;
  transactionType: string; // 'in', 'out', 'adjust', 'transfer'
  branchId?: number;
  companyId?: number;
  description?: string;
}): Promise<JournalEntryResult> {
  const config = await getAutoPostingConfig(params.companyId);
  const amount = Math.abs(params.quantity * params.unitCost);
  if (amount === 0) return { success: false, error: 'Zero amount' };

  const reference = await getDocumentNumber('INV');
  const date = new Date().toISOString().split('T')[0];
  const items: any[] = [];

  if (!config.inventory_account_id) return { success: false, error: 'Inventory account not configured' };

  if (params.transactionType === 'in') {
    // Stock increase: Debit Inventory
    items.push({ account_id: config.inventory_account_id, debit: amount, credit: 0, description: params.description || `إضافة مخزون - حركة #${params.transactionId}` });
    // Credit: Purchase/Expense account
    if (config.purchase_account_id) {
      items.push({ account_id: config.purchase_account_id, debit: 0, credit: amount, description: `تكلفة إضافة مخزون` });
    }
  } else {
    // Stock decrease: Credit Inventory
    items.push({ account_id: config.inventory_account_id, debit: 0, credit: amount, description: params.description || `صرف مخزون - حركة #${params.transactionId}` });
    // Debit: COGS
    if (config.cost_of_goods_account_id) {
      items.push({ account_id: config.cost_of_goods_account_id, debit: amount, credit: 0, description: `تكلفة بضاعة - صرف مخزون` });
    }
  }

  return createJournalEntry({
    date,
    reference,
    description: params.description || `تسجيل حركة مخزون #${params.transactionId}`,
    source_type: 'inventory_transaction',
    source_id: params.transactionId,
    branch_id: params.branchId,
    company_id: params.companyId,
    items,
  });
}

/**
 * Post manufacturing order completion
 * Debit: Finished Goods Inventory  |  Credit: Raw Materials + Production Overhead
 */
export async function postManufacturingCompletion(params: {
  moId: number;
  totalMaterialCost: number;
  totalProductionCost: number;
  finishedGoodsAccountId?: number;
  branchId?: number;
  companyId?: number;
}): Promise<JournalEntryResult> {
  const config = await getAutoPostingConfig(params.companyId);
  const reference = await getDocumentNumber('MO');
  const date = new Date().toISOString().split('T')[0];
  const totalCost = params.totalMaterialCost + params.totalProductionCost;
  const items: any[] = [];

  // Debit: Finished Goods / Inventory
  const fgAccountId = params.finishedGoodsAccountId || config.inventory_account_id;
  if (fgAccountId) {
    items.push({ account_id: fgAccountId, debit: totalCost, credit: 0, description: `منتج تام - أمر إنتاج #${params.moId}` });
  }

  // Credit: Raw Materials
  if (params.totalMaterialCost > 0 && config.inventory_account_id) {
    items.push({ account_id: config.inventory_account_id, debit: 0, credit: params.totalMaterialCost, description: `خامات مستهلكة - أمر إنتاج #${params.moId}` });
  }

  // Credit: Production Cost / Wages Payable
  if (params.totalProductionCost > 0 && config.production_cost_account_id) {
    items.push({ account_id: config.production_cost_account_id, debit: 0, credit: params.totalProductionCost, description: `تكاليف إنتاج - أمر إنتاج #${params.moId}` });
  }

  if (items.length === 0) return { success: false, error: 'No accounts configured for manufacturing posting' };

  return createJournalEntry({
    date,
    reference,
    description: `تسجيل إتمام أمر إنتاج #${params.moId}`,
    source_type: 'manufacturing_order',
    source_id: params.moId,
    branch_id: params.branchId,
    company_id: params.companyId,
    items,
  });
}

/**
 * Post scrap/waste
 * Debit: Scrap/Waste Loss  |  Credit: Inventory
 */
export async function postScrap(params: {
  recordId: number;
  totalCost: number;
  reason?: string;
  branchId?: number;
  companyId?: number;
}): Promise<JournalEntryResult> {
  const config = await getAutoPostingConfig(params.companyId);
  const reference = await getDocumentNumber('SC');
  const date = new Date().toISOString().split('T')[0];
  const items: any[] = [];

  // Debit: Scrap/Loss account
  const scrapAccountId = config.scrap_account_id || config.waste_loss_account_id;
  if (scrapAccountId) {
    items.push({ account_id: scrapAccountId, debit: params.totalCost, credit: 0, description: `هالك - ${params.reason || ''}` });
  }

  // Credit: Inventory
  if (config.inventory_account_id) {
    items.push({ account_id: config.inventory_account_id, debit: 0, credit: params.totalCost, description: `تخفيض مخزون هالك` });
  }

  if (items.length === 0) return { success: false, error: 'No accounts configured for scrap posting' };

  return createJournalEntry({
    date,
    reference,
    description: `تسجيل هالك #${params.recordId}`,
    source_type: 'scrap',
    source_id: params.recordId,
    branch_id: params.branchId,
    company_id: params.companyId,
    items,
  });
}

/**
 * Post payroll disbursement
 * Debit: Wage Expense  |  Credit: Cash/Bank
 */
export async function postPayroll(params: {
  payrollId: number;
  totalNet: number;
  branchId?: number;
  companyId?: number;
}): Promise<JournalEntryResult> {
  const config = await getAutoPostingConfig(params.companyId);
  const reference = await getDocumentNumber('PR');
  const date = new Date().toISOString().split('T')[0];
  const items: any[] = [];

  // Debit: Wage Expense
  if (config.wage_expense_account_id) {
    items.push({ account_id: config.wage_expense_account_id, debit: params.totalNet, credit: 0, description: `مرتبات - قيد #${params.payrollId}` });
  }

  // Credit: Cash
  if (config.cash_account_id) {
    items.push({ account_id: config.cash_account_id, debit: 0, credit: params.totalNet, description: `صرف مرتبات` });
  }

  if (items.length < 2) return { success: false, error: 'Wage/Cash accounts not configured' };

  return createJournalEntry({
    date,
    reference,
    description: `صرف رواتب #${params.payrollId}`,
    source_type: 'payroll',
    source_id: params.payrollId,
    branch_id: params.branchId,
    company_id: params.companyId,
    items,
  });
}