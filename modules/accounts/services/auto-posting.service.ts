/**
 * ERP Auto-Posting Service
 * Automatically creates journal entries from ALL sub-module transactions:
 * - Sales → Revenue + AR + Tax
 * - Purchases → COGS + Inventory + AP
 * - Payroll → Salary Expense + Cash/AP
 * - Treasury → Cash/Bank movements
 * - Restaurant Orders → Food/Delivery Revenue + Cash/Card
 * - Customer Payments → AR + Cash
 * - Costs → Expense accounts
 * - Sales Returns → Contra-revenue + Cash/AR
 * - Complaints/Refunds → Refund Expense + Cash
 * - Inventory Adjustments → COGS/Other Income + Inventory
 * - Employee Advances → Advance Asset + Cash
 * - Period-End Closing → Revenue/Expense → Income Summary → Retained Earnings
 */
import { pool } from "../../../server-db.js";
import { AccountRepository } from "../repositories/account.repository.js";
import { ERPEventBus } from "../../../server-erp-core.js";

const repo = new AccountRepository();

// ═══════════════════════════════════════
// CONFIG & HELPERS
// ═══════════════════════════════════════

/**
 * تاريخ اليوم بالتوقيت المحلي للسيرفر بصيغة YYYY-MM-DD.
 * لا تستخدم toISOString(): فهي تُعيد التوقيت العالمي (UTC)، وبالتالي تُسجَّل القيود
 * الليلية (بين منتصف الليل و03:00 صباحًا في القاهرة UTC+3) بتاريخ الأمس.
 */
export function localTodayYMD(reference: Date = new Date()): string {
  return `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}-${String(reference.getDate()).padStart(2, "0")}`;
}

interface GLAccountMapping {
  [key: string]: string | undefined;
}

// Normalize config keys: strip _account suffix, convert to snake_case
function normalizeKey(rawKey: string): string {
  return rawKey.replace(/_account$/, '');
}

// Default account code mappings for out-of-the-box ERP integration.
// IMPORTANT: every code here MUST exist in the live chart of accounts (accounts.code),
// otherwise the auto-fallback below silently resolves nothing and the GL stops posting.
export const DEFAULT_ACCOUNT_CODES: Record<string, string> = {
  // ── Assets
  cash: '1110',
  cash_main: '1110',
  cash_petty: '1110',
  bank: '1120',
  bank_account: '1120',
  accounts_receivable: '1130',
  customer_receivables: '1130',
  employee_advances: '1150',
  inventory_asset: '1140',
  raw_materials_inventory: '1141',
  finished_goods_inventory: '1142',
  work_in_progress: '1140',
  input_vat: '1107',
  vat_input: '1107',
  tax_receivable: '1107',
  // ── Liabilities
  accounts_payable: '2110',
  supplier_payables: '2110',
  tax_payable: '2130',
  vat_payable: '2130',
  // ── Revenue
  sales_revenue: '4000',
  food_revenue: '4100',
  food_sales_cash: '4100',
  food_sales_card: '4100',
  food_sales: '4100',
  delivery_revenue: '4000',
  sales_discount: '4000',
  sales_returns: '4000',
  other_income: '4000',
  // ── Expenses
  cost_expense: '5000',
  operating_expense: '5000',
  other_expense: '5000',
  maintenance_expense: '5000',
  marketing_expense: '5000',
  supplies_expense: '5000',
  insurance_expense: '5000',
  refund_expense: '5000',
  cost_of_goods_sold: '5100',
  manufacturing_cost: '5100',
  salary_expense: '5200',
  payroll_expense: '5200',
  rent_expense: '5300',
  utilities_expense: '5400',
  transport_expense: '5000',
  // ── Equity / period closing
  income_summary: '3200',
  retained_earnings: '3300',
};

// Structural accounts the GL engine needs but the operational setup wizard does not seed.
// They are created automatically (idempotent by unique code) so that period closing,
// employee advances and payroll-to-cash cycles always have a valid counter-account.
export const CORE_ACCOUNTS: {
  code: string;
  name: string;
  name_en: string;
  type: string;
  account_type: string;
  nature: 'DEBIT' | 'CREDIT';
  parentCode: string;
  configKey: string;
}[] = [
  { code: '1107', name: 'ضريبة القيمة المضافة - مدخلات (مستردة)', name_en: 'Input VAT (Recoverable)', type: 'asset', account_type: 'ASSET', nature: 'DEBIT', parentCode: '1100', configKey: 'input_vat' },
  { code: '1141', name: 'مخزون المواد الخام', name_en: 'Raw Materials Inventory', type: 'asset', account_type: 'ASSET', nature: 'DEBIT', parentCode: '1100', configKey: 'raw_materials_inventory' },
  { code: '1142', name: 'مخزون الإنتاج التام', name_en: 'Finished Goods Inventory', type: 'asset', account_type: 'ASSET', nature: 'DEBIT', parentCode: '1100', configKey: 'finished_goods_inventory' },
  { code: '1150', name: 'ذمم الموظفين والسلف', name_en: 'Employee Advances & Receivables', type: 'asset', account_type: 'ASSET', nature: 'DEBIT', parentCode: '1100', configKey: 'employee_advances' },
  { code: '3200', name: 'ملخص الدخل', name_en: 'Income Summary', type: 'equity', account_type: 'EQUITY', nature: 'CREDIT', parentCode: '3000', configKey: 'income_summary' },
  { code: '3300', name: 'الأرباح المحتجزة', name_en: 'Retained Earnings', type: 'equity', account_type: 'EQUITY', nature: 'CREDIT', parentCode: '3000', configKey: 'retained_earnings' },
];

function isValidAccountId(id: any): boolean {
  return id !== null && id !== undefined && id !== 'undefined' && id !== 'null' && !isNaN(Number(id)) && Number(id) > 0;
}

async function ensureCoreAccounts(map: GLAccountMapping, db: any = pool): Promise<void> {
  try {
    for (const acc of CORE_ACCOUNTS) {
      let row = (await db.query("SELECT id FROM accounts WHERE code = $1 LIMIT 1", [acc.code])).rows[0];
      if (!row) {
        const parent = (await db.query("SELECT id FROM accounts WHERE code = $1 LIMIT 1", [acc.parentCode])).rows[0];
        row = (await db.query(
          `INSERT INTO accounts (code, name, type, parent_id, balance, name_ar, name_en, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, currency)
           VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, 2, true, true, true, true, 'EGP')
           ON CONFLICT (code) DO NOTHING
           RETURNING id`,
          [acc.code, acc.name, acc.type, parent?.id ?? null, acc.name, acc.name_en, acc.account_type, acc.nature]
        )).rows[0];
        if (!row) {
          row = (await db.query("SELECT id FROM accounts WHERE code = $1 LIMIT 1", [acc.code])).rows[0];
        }
      }
      if (row && isValidAccountId(row.id)) {
        const idStr = String(row.id);
        if (map[acc.configKey] !== idStr) {
          map[acc.configKey] = idStr;
          await db.query(
            `INSERT INTO account_config (key, account_id, updated_at) VALUES ($1, $2, NOW())
             ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = NOW()`,
            [acc.configKey, Number(idStr)]
          );
        }
      }
    }
  } catch (e: any) {
    // Do NOT swallow silently: a failure here previously left the posting map
    // pointing both production legs at the same inventory account, which made
    // every production journal balance onto one account (BUG-ERP-005).
    console.error("[AutoPosting] ensureCoreAccounts FAILED — chart-of-accounts mapping may be incomplete:", e?.message || e);
  }
}

async function getAccountConfig(db: any = pool): Promise<GLAccountMapping> {
  try {
    const result = await db.query("SELECT key, account_id FROM account_config WHERE account_id IS NOT NULL");
    const map: GLAccountMapping = {};
    for (const row of result.rows) {
      if (isValidAccountId(row.account_id)) {
        map[normalizeKey(row.key)] = String(row.account_id);
      }
    }

    // Check if critical core keys are present, otherwise auto-fill from accounts table.
    // Keys are compared in normalized form because account_config rows are stored and read
    // back through normalizeKey() (e.g. the seeded "sales_revenue_account" row resolves to
    // map["sales_revenue"]). Comparing raw keys here would make every _account-suffixed key
    // look "missing" forever and re-run this accounts scan on each call.
    const coreKeys = Array.from(new Set(Object.keys(DEFAULT_ACCOUNT_CODES).map(normalizeKey)));
    const missingKeys = coreKeys.filter(k => !isValidAccountId(map[k]));

    if (missingKeys.length > 0) {
      try {
        const accsResult = await db.query("SELECT id, code, name, type FROM accounts");
        const accounts = accsResult.rows || [];
        const codeMap: Record<string, string> = {};
        for (const a of accounts) {
          codeMap[String(a.code)] = String(a.id);
        }

        const updatesToPersist: { key: string; accountId: number }[] = [];

        // Normalized key → live account code lookup (supports both 4-digit schemes).
        const normalizedDefaultCodes: Record<string, string[]> = {
          cash: ['1110', '1101', '111'],
          cash_main: ['1110', '1101', '111'],
          cash_petty: ['1110', '1101', '111'],
          bank: ['1120', '1101', '112'],
          accounts_receivable: ['1130', '1102', '113'],
          customer_receivables: ['1130', '1102', '113'],
          employee_advances: ['1150', '1104', '111'],
          inventory_asset: ['1140', '1103', '114'],
          raw_materials_inventory: ['1141', '1140', '1103', '114'],
          finished_goods_inventory: ['1142', '1140', '1103', '114'],
          work_in_progress: ['1140', '1103', '114'],
          input_vat: ['1107', '2130', '2103', '213'],
          vat_input: ['1107', '2130', '2103', '213'],
          tax_receivable: ['1107', '2130', '2103', '213'],
          accounts_payable: ['2110', '2101', '211'],
          supplier_payables: ['2110', '2101', '211'],
          tax_payable: ['2130', '2103', '213'],
          vat_payable: ['2130', '2103', '213'],
          sales_revenue: ['4000', '4102', '4101', '4100', '41'],
          food_revenue: ['4100', '4101', '4000', '41'],
          food_sales_cash: ['4100', '4101', '4000', '41'],
          food_sales_card: ['4100', '4101', '4000', '41'],
          food_sales: ['4100', '4101', '4000', '41'],
          delivery_revenue: ['4000', '4103', '4102', '41'],
          sales_discount: ['4201', '4000', '4102', '41'],
          sales_returns: ['4202', '4000', '4102', '41'],
          other_income: ['4000', '4104', '41'],
          cost_expense: ['5000', '5110', '5101', '51'],
          operating_expense: ['5000', '5110', '51'],
          other_expense: ['5000', '5110', '51'],
          maintenance_expense: ['5000', '5105', '51'],
          marketing_expense: ['5000', '5106', '51'],
          supplies_expense: ['5000', '5107', '51'],
          insurance_expense: ['5000', '5108', '51'],
          refund_expense: ['5000', '5111', '51'],
          cost_of_goods_sold: ['5100', '5101', '5000', '51'],
          manufacturing_cost: ['5100', '5101', '51'],
          salary_expense: ['5200', '5102', '52'],
          payroll_expense: ['5200', '5102', '52'],
          rent_expense: ['5300', '5103', '51'],
          utilities_expense: ['5400', '5104', '51'],
          transport_expense: ['5000', '5109', '51'],
          income_summary: ['3200', '3103', '31'],
          retained_earnings: ['3300', '3102', '31'],
        };

        for (const k of missingKeys) {
          const candidates = normalizedDefaultCodes[k] || [DEFAULT_ACCOUNT_CODES[k]];
          let foundId: string | undefined;
          for (const code of candidates) {
            if (code && codeMap[code]) {
              foundId = codeMap[code];
              break;
            }
          }

          // Secondary fallback by type / name keywords if code not exact
          if (!foundId) {
            const match = accounts.find((a: any) => {
              if (k.includes('cash') && (a.name?.includes('صندوق') || a.name?.includes('نقد') || a.name?.includes('خزين'))) return true;
              if (k.includes('bank') && a.name?.includes('بنك')) return true;
              if (k.includes('receivable') && (a.name?.includes('عملاء') || a.name?.includes('مدين'))) return true;
              if (k.includes('payable') && (a.name?.includes('مورد') || a.name?.includes('دائن'))) return true;
              if (k.includes('tax') || k.includes('vat')) {
                if (a.name?.includes('ضريب') || a.name?.includes('ضرائب') || a.name?.includes('قيمة مضافة')) return true;
              }
              if (k.includes('inventory') && a.name?.includes('مخزون')) return true;
              if (k.includes('return') && (a.name?.includes('مرتجع') || a.name?.includes('مردود') || a.type === 'revenue')) return true;
              if (k.includes('discount') && (a.name?.includes('خصم') || a.name?.includes('خصومات') || a.type === 'revenue')) return true;
              if (k.includes('revenue') && (a.name?.includes('مبيعات') || a.name?.includes('إيراد') || a.type === 'revenue')) return true;
              // مرتبات/أجور لها الأولوية على القاعدة العامة للمصروفات، وإلا ربطها
              // بمفتاح payroll_expense بأول حساب مصروف (تكلفة البضاعة المباعة)
              // فتُحمَّل المرتبات على التكلفة بدل مصروف المرتبات والأجور.
              if (/salary|salar|payroll|wage|labor/.test(k)) {
                if (a.name?.includes('مرتب') || a.name?.includes('رواتب') || a.name?.includes('أجور') || a.name?.includes('عمالة')) return true;
              }
              if ((k.includes('cost') || k.includes('cogs') || k.includes('expense')) && (a.name?.includes('تكلفة') || a.name?.includes('مصروف') || a.type === 'expense')) return true;
              return false;
            });
            if (match) foundId = String(match.id);
          }

          if (foundId) {
            map[k] = foundId;
            updatesToPersist.push({ key: k, accountId: Number(foundId) });
          }
        }

        // Persist to account_config in background so subsequent queries and UI show connected
        if (updatesToPersist.length > 0 && db === pool) {
          (async () => {
            try {
              for (const u of updatesToPersist) {
                await pool.query(
                  `INSERT INTO account_config (key, account_id, updated_at) VALUES ($1, $2, NOW())
                   ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = NOW()`,
                  [u.key, u.accountId]
                );
              }
            } catch (_) {}
          })();
        }
      } catch (accErr) {
        if (db !== pool) throw accErr;
        console.warn("[AutoPosting] Account auto-fallback lookup warning:", accErr);
      }
    }

    // Make sure the structural accounts (equity / employee receivables) exist and are mapped
    if (db === pool) await ensureCoreAccounts(map);

    return map;
  } catch (e) {
    if (db !== pool) throw e;
    console.error("[AutoPosting] Error loading account config:", e);
    return {};
  }
}

async function getOpenPeriod(date?: string, db: any = pool): Promise<any> {
  try {
    const targetDate = date ? new Date(date) : new Date();
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();

    const result = await db.query(
      "SELECT * FROM financial_periods WHERE month = $1 AND year = $2 AND status = 'open' LIMIT 1",
      [month, year]
    );
    return result.rows[0] || null;
  } catch (e) {
    if (db !== pool) throw e;
    console.error("[AutoPosting] Error getting open period:", e);
    return null;
  }
}

async function generateNextReference(sourceType: string, db: any = pool, referenceDate?: string): Promise<string> {
  const prefixMap: Record<string, string> = {
    sales: 'SL',
    pos: 'POS',
    purchase: 'PU',
    payroll: 'PR',
    treasury: 'TR',
    cost: 'CO',
    closing: 'CL',
    adjustment: 'AD',
    restaurant: 'RO',
    customer_payment: 'CP',
    sales_return: 'SR',
    complaint_refund: 'RF',
    inventory_adj: 'IA',
    employee_advance: 'EA',
    supplier_payment: 'SP',
    production: 'PRD',
    delivery: 'DN',
    sales_delivery: 'DN',
  };
  const prefix = prefixMap[sourceType] || 'JE';
  const date = referenceDate ? new Date(referenceDate) : new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  const base = `${prefix}-${dateStr}-`;

  try {
    if (db !== pool) {
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`journal-entry-reference:${base}`]);
    }
    // Sequence from the generated reference itself (prefix + month), not from source_type.
    // Some callers pass a key that differs from the stored source_type (e.g. 'production'
    // vs 'production_order'), which made every PRD reference collapse to 00001.
    const result = await db.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM LENGTH($1) + 1) AS INTEGER)), 0) + 1 AS next_num
         FROM journal_entries
        WHERE reference LIKE $1 || '%' AND reference ~ ('^' || $1 || '[0-9]+$')`,
      [base]
    );
    const nextNum = Number(result.rows[0]?.next_num) || 1;
    return `${base}${String(nextNum).padStart(5, '0')}`;
  } catch (e) {
    if (db !== pool) throw e;
    return `${base}00001`;
  }
}

async function createSafeEntry(entryData: any, client?: any): Promise<any> {
  if (client) {
    return repo.createJournalEntry(entryData, client);
  }
  try {
    return await repo.createJournalEntry(entryData);
  } catch (e: any) {
    console.error(`[AutoPosting] Failed to create journal entry: ${e.message}`, entryData);
    return null;
  }
}

// ═══════════════════════════════════════
// 1. SALES AUTO-POSTING
// ═══════════════════════════════════════
export async function postSalesEntry(orderData: {
  id: number;
  total: number;
  discount: number;
  tax_amount: number;
  net_total: number;
  total_cost?: number;
  payment_method: string;
  customer_id?: number;
  customer_name?: string;
  branch_id?: number;
  /** مركز التكلفة الحقيقي للمستند — لا يُستخدم branch_id بديلًا عنه */
  cost_center_id?: number;
  items?: { product_name: string; total: number }[];
  source_type?: string;
  source_label?: string;
  user_id?: number;
}, client?: any): Promise<any> {
  const config = await getAccountConfig();
  if (!config.sales_revenue && !config.cash) {
    if (client) throw new Error("إعدادات حسابات المبيعات والخزينة غير مكتملة");
    return null;
  }

  const isPosRequest = orderData.source_type === 'pos';
  const effectiveSourceType = isPosRequest ? 'pos' : 'sales';

  // Idempotency: verify if already posted.
  // The lookup must be scoped to THIS source type. Sales invoices and POS orders
  // are separate id sequences that share the same numeric range, so matching on
  // ('sales','pos') together would let one module's entry suppress the other's.
  try {
    const existing = await (client || pool).query(
      `SELECT * FROM journal_entries WHERE source_type=$1 AND source_id=$2 ORDER BY id DESC LIMIT 1`,
      [effectiveSourceType, orderData.id]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (error) {
    if (client) throw error;
  }

  const period = await getOpenPeriod();
  const items: any[] = [];
  const totalNet = parseFloat(String(orderData.net_total || orderData.total || 0));
  const totalDiscount = parseFloat(String(orderData.discount || 0));
  const totalTax = parseFloat(String(orderData.tax_amount || 0));
  const salesRevenueAmount = Math.max(0, totalNet + totalDiscount - totalTax); // Subtotal before discount and tax
  const totalCost = parseFloat(String(orderData.total_cost || 0));

  // Debit: Cash, Bank, or Accounts Receivable
  const normalizedPaymentMethod = (orderData.payment_method || '').toLowerCase();
  const isCreditSale = ["آجل", "اجل", "credit"].some((method) => normalizedPaymentMethod.includes(method));
  const isBankSale = ["شبكة", "بنك", "فيزا", "تحويل", "visa", "mastercard", "wallet", "instapay", "card"].some((method) => normalizedPaymentMethod.includes(method));
  const isCashSale = ["نقدي", "نقد", "cash", "صندوق"].some((method) => normalizedPaymentMethod.includes(method));

  if (client && isCreditSale && (!config.accounts_receivable || !orderData.customer_id)) {
    throw new Error("يلزم تحديد حساب العميل والذمم المدينة عند ترحيل بيع آجل");
  }

  if (config.accounts_receivable && (isCreditSale || (orderData.customer_id && !isBankSale && !isCashSale))) {
    items.push({
      account_id: config.accounts_receivable,
      debit: totalNet,
      credit: 0,
      notes: `عملاء — فاتورة مبيعات #${orderData.id} — ${orderData.customer_name || ''}`,
      cost_center_id: orderData.cost_center_id || null
    });
  } else if (isBankSale && (config.bank || config.cash)) {
    items.push({
      account_id: config.bank || config.cash,
      debit: totalNet,
      credit: 0,
      notes: `البنك / شبكة — فاتورة مبيعات #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  } else if (config.cash) {
    items.push({
      account_id: config.cash,
      debit: totalNet,
      credit: 0,
      notes: `الصندوق — فاتورة مبيعات #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  }

  // Credit: Revenue
  if (config.sales_revenue) {
    items.push({
      account_id: config.sales_revenue,
      debit: 0,
      credit: salesRevenueAmount,
      notes: `إيراد مبيعات #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  }

  // Debit: Sales Discount (contra-revenue)
  if (config.sales_discount && totalDiscount > 0) {
    items.push({
      account_id: config.sales_discount,
      debit: totalDiscount,
      credit: 0,
      notes: `خصم مبيعات على فاتورة #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  }

  // Credit: Tax Payable
  if (config.tax_payable && totalTax > 0) {
    items.push({
      account_id: config.tax_payable,
      debit: 0,
      credit: totalTax,
      notes: `ضريبة VAT على فاتورة #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  }

  // Cost of Goods Sold (COGS) & Inventory Asset
  if (totalCost > 0) {
    const cogsAccount = config.cost_of_goods_sold || config.cost_expense;
    const invAccount = config.inventory_asset;
    if (!cogsAccount || !invAccount) {
      if (client) throw new Error("إعدادات حساب تكلفة المبيعات أو المخزون غير مكتملة");
    } else {
      // Debit: COGS
      items.push({
        account_id: cogsAccount,
        debit: totalCost,
        credit: 0,
        notes: `تكلفة البضاعة المباعة (COGS) — فاتورة مبيعات #${orderData.id}`,
        cost_center_id: orderData.cost_center_id || null
      });
      // Credit: Inventory Asset
      items.push({
        account_id: invAccount,
        debit: 0,
        credit: totalCost,
        notes: `صرف مخزون المبيعات — فاتورة #${orderData.id}`,
        cost_center_id: orderData.cost_center_id || null
      });
    }
  }

  if (items.length < 2) return null;

  const isPos = isPosRequest;
  const reference = await generateNextReference(isPos ? 'pos' : 'sales');
  const description = isPos
    ? `قيد إيرادات نقطة البيع (POS) — فاتورة #${orderData.id}`
    : `قيد مبيعات تلقائي — فاتورة #${orderData.id}`;

  const entry = await createSafeEntry({
    date: localTodayYMD(),
    description,
    reference,
    source_type: effectiveSourceType,
    source_id: orderData.id,
    status: 'posted',
    branch_id: orderData.branch_id,
    period_id: period?.id,
    created_by: orderData.user_id || null,
    items
  }, client);
  if (client && !entry) throw new Error("تعذر إنشاء قيد مبيعات نقطة البيع");
  return entry;
}

// ═══════════════════════════════════════
// 2. PURCHASES AUTO-POSTING
// ═══════════════════════════════════════
export async function postPurchaseEntry(purchaseData: {
  id: number;
  total: number;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  supplier_id?: number;
  supplier_name?: string;
  branch_id?: number;
  cost_center_id?: number;
  payment_method?: string;
  paid_amount?: number;
  receipt_id?: number;
  purchase_order_id?: number;
}): Promise<any> {
  const config = await getAccountConfig();
  const period = await getOpenPeriod();
  const total = parseFloat(String(purchaseData.total || 0));
  if (!total) return null;

  // Idempotency: one purchase invoice can create only one purchase journal entry.
  try {
    const existing = await pool.query(`SELECT * FROM journal_entries WHERE source_type='purchase' AND source_id=$1 ORDER BY id DESC LIMIT 1`, [purchaseData.id]);
    if (existing.rows[0]) return existing.rows[0];
  } catch (_) {}

  // Fetch purchase details for accurate subtotal and tax amounts
  let subtotal = Number(purchaseData.subtotal || 0);
  let taxAmount = Number(purchaseData.tax_amount || 0);

  if (purchaseData.id && (!subtotal || !taxAmount)) {
    try {
      const pRes = await pool.query(
        `SELECT subtotal, tax_amount, total_amount, tax_rate FROM purchases WHERE id=$1`,
        [purchaseData.id]
      );
      if (pRes.rows[0]) {
        const row = pRes.rows[0];
        taxAmount = Number(row.tax_amount || 0);
        subtotal = Number(row.subtotal || (Number(row.total_amount || total) - taxAmount));
      }
    } catch (_) {}
  }

  // If subtotal is still 0 and taxAmount is 0, use total
  if (!subtotal) {
    subtotal = taxAmount > 0 ? (total - taxAmount) : total;
  }

  // If a GRN exists, its posted entry has already recognized inventory and
  // credited GRNI. The invoice therefore clears GRNI and creates AP.
  let debitAccount: any = config.inventory_asset || config.cost_of_goods_sold;
  if (purchaseData.receipt_id) {
    try {
      const gr = await pool.query(`SELECT journal_entry_id FROM goods_receipts WHERE id=$1`, [purchaseData.receipt_id]);
      const jeId = gr.rows[0]?.journal_entry_id;
      if (jeId) {
        const line = await pool.query(`SELECT account_id FROM journal_items WHERE journal_entry_id=$1 AND credit>0 ORDER BY id LIMIT 1`, [jeId]);
        if (line.rows[0]) debitAccount = String(line.rows[0].account_id);
      }
    } catch (_) {}
  }
  if (!debitAccount || !config.accounts_payable) return null;

  const items: any[] = [];

  // 1. Debit: Inventory Asset (or GRNI clearing) for Net Amount (Recoverable VAT excluded)
  items.push({
    account_id: debitAccount,
    debit: subtotal,
    credit: 0,
    notes: purchaseData.receipt_id
      ? `تسوية GRNI لفاتورة مشتريات #${purchaseData.id} (صافي المخزون)`
      : `مشتريات لفاتورة #${purchaseData.id} (صافي المخزون)`,
    cost_center_id: purchaseData.cost_center_id || null
  });

  // 2. Debit: Input VAT (Recoverable Tax Asset) if tax > 0
  if (taxAmount > 0 && (config.input_vat || config.tax_payable)) {
    const inputVatAccountId = config.input_vat || config.vat_input || config.tax_receivable || config.tax_payable;
    items.push({
      account_id: inputVatAccountId,
      debit: taxAmount,
      credit: 0,
      notes: `ضريبة مدخلات مستردة (VAT) — فاتورة مشتريات #${purchaseData.id}`,
      cost_center_id: purchaseData.cost_center_id || null
    });
  }

  // 3. Credit: Accounts Payable (Gross Total)
  items.push({
    account_id: config.accounts_payable,
    debit: 0,
    credit: total,
    notes: `موردون — فاتورة مشتريات #${purchaseData.id}`,
    cost_center_id: purchaseData.cost_center_id || null
  });

  const reference = await generateNextReference('purchase');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد فاتورة مشتريات موحد — #${purchaseData.id}`,
    reference,
    source_type: 'purchase',
    source_id: purchaseData.id,
    status: 'posted',
    branch_id: purchaseData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 2b. SUPPLIER PAYMENT AUTO-POSTING
// ═══════════════════════════════════════
export async function postSupplierPaymentEntry(data: {
  supplier_id: number;
  supplier_name?: string;
  amount: number;
  payment_method?: string;
  branch_id?: number;
  transaction_id?: number;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.accounts_payable) {
    console.warn("[GL AutoPost] ❌ Supplier payment NOT posted: 'accounts_payable' account is not configured (إعدادات الحسابات العامة → حساب الموردين).");
    return null;
  }

  const period = await getOpenPeriod();
  const amount = parseFloat(String(data.amount));
  if (!amount || amount <= 0) return null;
  if (data.transaction_id) {
    try {
      const existing = await pool.query(`SELECT * FROM journal_entries WHERE source_type='supplier_payment' AND source_id=$1 ORDER BY id DESC LIMIT 1`, [data.transaction_id]);
      if (existing.rows[0]) return existing.rows[0];
    } catch (_) {}
  }

  // Determine cash/bank account based on payment method
  const cashAccount = (data.payment_method === 'bank' || data.payment_method === 'transfer')
    ? (config.bank || config.cash)
    : config.cash;
  if (!cashAccount) {
    console.warn(`[GL AutoPost] ❌ Supplier payment NOT posted: no ${data.payment_method === 'bank' || data.payment_method === 'transfer' ? 'bank' : 'cash'} account is configured in إعدادات الحسابات العامة (حساب الصندوق/البنك). تأكد من إضافة حساب صندوق في دليل الحسابات وربطه.`);
    return null;
  }

  const items: any[] = [];

  // DR: Reduce Accounts Payable (suppliers)
  items.push({
    account_id: config.accounts_payable,
    debit: amount,
    credit: 0,
    notes: `تخفيض رصيد المورد ${data.supplier_name || '#' + data.supplier_id}`,
    cost_center_id: data.branch_id || null
  });

  // CR: Cash or Bank (money going out)
  items.push({
    account_id: cashAccount,
    debit: 0,
    credit: amount,
    notes: `صرف للمورد ${data.supplier_name || '#' + data.supplier_id}`,
    cost_center_id: data.branch_id || null
  });

  const reference = await generateNextReference('supplier_payment');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `سداد للمورد ${data.supplier_name || '#' + data.supplier_id} - مبلغ ${amount} ج.م`,
    reference,
    source_type: 'supplier_payment',
    source_id: data.transaction_id || data.supplier_id,
    status: 'posted',
    branch_id: data.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 3. PAYROLL AUTO-POSTING
// ═══════════════════════════════════════
export async function postPayrollEntry(payrollData: {
  id: number;
  month: number;
  year: number;
  total_salaries: number;
  total_deductions: number;
  total_net: number;
  total_bonuses?: number;
  branch_id?: number;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.payroll_expense) return null;

  const period = await getOpenPeriod();
  const items: any[] = [];
  const totalGross = parseFloat(String(payrollData.total_salaries));
  const totalDeductions = parseFloat(String(payrollData.total_deductions));
  const totalNet = parseFloat(String(payrollData.total_net));
  if (totalGross === 0) return null;

  // Debit: Salary Expense (gross)
  items.push({
    account_id: config.payroll_expense,
    debit: totalGross,
    credit: 0,
    notes: `مرتبات شهر ${payrollData.month}/${payrollData.year} — إجمالي`,
    cost_center_id: payrollData.branch_id || null
  });

  // Credit: Cash/Bank (net paid amount)
  if (config.cash && totalNet > 0) {
    items.push({
      account_id: config.cash,
      debit: 0,
      credit: totalNet,
      notes: `صافي مرتبات شهر ${payrollData.month}/${payrollData.year} — مدفوع نقداً`,
      cost_center_id: payrollData.branch_id || null
    });
  }

  // Credit: Payroll Payable (deductions = liabilities pending payment)
  if (config.accounts_payable && totalDeductions > 0) {
    items.push({
      account_id: config.accounts_payable,
      debit: 0,
      credit: totalDeductions,
      notes: `خصومات وإعانات مرتبات شهر ${payrollData.month}/${payrollData.year}`,
      cost_center_id: payrollData.branch_id || null
    });
  }

  if (items.length < 2) return null;

  const reference = await generateNextReference('payroll');
  return createSafeEntry({
    date: `${payrollData.year}-${String(payrollData.month).padStart(2, '0')}-28`,
    description: `قيد رواتب تلقائي — ${payrollData.month}/${payrollData.year}`,
    reference,
    source_type: 'payroll',
    source_id: payrollData.id,
    status: 'posted',
    branch_id: payrollData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 4. TREASURY AUTO-POSTING (FIXED)
// ═══════════════════════════════════════
export async function postTreasuryEntry(treasuryData: {
  id: number;
  amount: number;
  transaction_type: 'cash_in' | 'cash_out' | 'transfer' | 'adjustment';
  reference_type?: string;
  reference_id?: number;
  notes?: string;
  cost_center_id?: number;
  branch_id?: number;
  created_by?: number;
  counter_account_id?: number;
  source_type?: string;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.cash) {
    console.warn("[GL AutoPost] ❌ Treasury movement NOT posted: 'cash' account is not configured (لا يوجد حساب صندوق/خزينة في دليل الحسابات). حركة الخزينة لن تظهر في الأستاذ العام.");
    return null;
  }

  const period = await getOpenPeriod();
  const rawAmount = parseFloat(String(treasuryData.amount));
  const amount = Math.abs(rawAmount);
  if (amount === 0 || !Number.isFinite(amount)) return null;

  // A movement that already produced its own journal entry from its own module must not be posted
  // again here, otherwise the same money is counted twice in the GL.
  const referenceType = String(treasuryData.reference_type || '').toLowerCase().trim();
  const POSTED_ELSEWHERE = [
    'pos_order', 'order', 'restaurant', 'sales', 'sales_invoice', 'invoice', 'sales_delivery', 'delivery',
    'purchase', 'purchase_invoice', 'supplier_payment', 'cost', 'payroll', 'salary',
    'sales_return', 'custody', 'custody_reimbursement', 'custody_settlement', 'transfer',
  ];
  if (POSTED_ELSEWHERE.includes(referenceType)) return null;

  const items: any[] = [];
  // cash_in / cash_out are explicit; for adjustments the sign of the amount decides the direction
  const isInflow = treasuryData.transaction_type === 'cash_in'
    || (treasuryData.transaction_type === 'adjustment' && rawAmount >= 0);

  // Cash/Bank account
  items.push({
    account_id: config.cash,
    debit: isInflow ? amount : 0,
    credit: isInflow ? 0 : amount,
    notes: treasuryData.notes || `حركة خزينة #${treasuryData.id} (${treasuryData.transaction_type})`,
    cost_center_id: treasuryData.cost_center_id || treasuryData.branch_id || null
  });

  // Counter-account for cash_out: determine based on reference_type
  if (!isInflow) {
    let counterAccountId = config.other_expense || config.cost_expense || config.accounts_payable; // Default fallback
    let counterNotes = `مصروفات متنوعة — حركة خزينة #${treasuryData.id}`;
    
    if (treasuryData.reference_type === 'payroll' && config.payroll_expense) {
      counterAccountId = config.payroll_expense;
      counterNotes = `مصروف رواتب — حركة خزينة #${treasuryData.id}`;
    } else if (treasuryData.reference_type === 'purchase' && config.inventory_asset) {
      counterAccountId = config.inventory_asset;
      counterNotes = `سداد مشتريات — حركة خزينة #${treasuryData.id}`;
    } else if (treasuryData.reference_type === 'cost') {
      // For costs, we use the cost_expense config
      counterAccountId = config.cost_expense || config.accounts_payable;
      counterNotes = `مصروفات تشغيلية — حركة خزينة #${treasuryData.id}`;
    }

    if (counterAccountId) {
      items.push({
        account_id: counterAccountId,
        debit: amount,
        credit: 0,
        notes: counterNotes,
        cost_center_id: treasuryData.cost_center_id || treasuryData.branch_id || null
      });
    }
  } else {
    // For cash_in: credit the corresponding revenue/AR account
    // Default to other income so a cash receipt without a known source is never silently dropped
    let counterAccountId: string | undefined = config.other_income || config.sales_revenue;
    let counterNotes = treasuryData.notes || `إيرادات متنوعة — حركة خزينة #${treasuryData.id}`;
    
    if (treasuryData.reference_type === 'sales' && config.sales_revenue) {
      counterAccountId = config.sales_revenue;
      counterNotes = `إيراد مبيعات — تحصيل خزينة #${treasuryData.id}`;
    } else if (treasuryData.reference_type === 'customer' && config.accounts_receivable) {
      counterAccountId = config.accounts_receivable;
      counterNotes = `تحصيل عملاء — حركة خزينة #${treasuryData.id}`;
    }

    if (counterAccountId) {
      items.push({
        account_id: counterAccountId,
        debit: 0,
        credit: amount,
        notes: counterNotes,
        cost_center_id: treasuryData.cost_center_id || treasuryData.branch_id || null
      });
    }
  }

  // Adjustments are already balanced by the sign-based direction above (no extra leg, which would unbalance the entry)

  if (items.length < 2) return null;

  const reference = await generateNextReference('treasury');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد خزينة تلقائي — #${treasuryData.id}`,
    reference,
    source_type: treasuryData.source_type || 'treasury',
    source_id: treasuryData.id,
    status: 'posted',
    branch_id: treasuryData.branch_id,
    period_id: period?.id,
    created_by: treasuryData.created_by,
    items
  });
}

// ═══════════════════════════════════════
// 5. RESTAURANT ORDERS AUTO-POSTING (NEW)
// ═══════════════════════════════════════
export async function postRestaurantOrderEntry(orderData: {
  id: number;
  total: number;
  delivery_fee: number;
  payment_method: string; // cash, visa, wallet, instapay
  order_type: string; // dine_in, takeaway, delivery
  branch_id?: number;
  cost_center_id?: number;
  customer_name?: string;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.cash && !config.food_revenue) return null;

  const period = await getOpenPeriod();
  const items: any[] = [];
  const total = parseFloat(String(orderData.total || 0));
  const deliveryFee = parseFloat(String(orderData.delivery_fee || 0));
  const grandTotal = total + deliveryFee;
  if (grandTotal === 0) return null;

  // Debit: Cash/Bank based on payment method
  const cashAccountId = (orderData.payment_method === 'visa' || orderData.payment_method === 'instapay')
    ? (config.bank || config.cash)
    : config.cash;

  if (cashAccountId) {
    const methodLabel = orderData.payment_method === 'cash' ? 'نقدي' :
                        orderData.payment_method === 'visa' ? 'بطاقة' :
                        orderData.payment_method === 'wallet' ? 'محفظة' : 'إنستاباي';
    items.push({
      account_id: cashAccountId,
      debit: grandTotal,
      credit: 0,
      notes: `${methodLabel} — أمر #${orderData.id} (${orderData.order_type === 'dine_in' ? 'صالة' : orderData.order_type === 'takeaway' ? 'تيك أواي' : 'دليفري'})`,
      cost_center_id: orderData.cost_center_id || null
    });
  }

  // Credit: Food Revenue
  if (config.food_revenue || config.sales_revenue) {
    const revenueAccount = config.food_revenue || config.sales_revenue;
    const typeLabel = orderData.order_type === 'dine_in' ? 'مبيعات صالة' :
                      orderData.order_type === 'takeaway' ? 'مبيعات تيك أواي' : 'مبيعات دليفري';
    items.push({
      account_id: revenueAccount,
      debit: 0,
      credit: total,
      notes: `${typeLabel} — أمر #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  }

  // Credit: Delivery Revenue (separate from food)
  if (deliveryFee > 0 && config.delivery_revenue) {
    items.push({
      account_id: config.delivery_revenue,
      debit: 0,
      credit: deliveryFee,
      notes: `إيراد توصيل — أمر #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  } else if (deliveryFee > 0 && config.sales_revenue) {
    // Fallback: include delivery in sales revenue (already credited total+deliveryFee above won't work, need to adjust)
    // Since we credited `total` to revenue, credit delivery_fee separately
    items.push({
      account_id: config.sales_revenue,
      debit: 0,
      credit: deliveryFee,
      notes: `إيراد توصيل — أمر #${orderData.id}`,
      cost_center_id: orderData.cost_center_id || null
    });
  }

  if (items.length < 2) return null;

  const reference = await generateNextReference('restaurant');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد طلب مطعم تلقائي — أمر #${orderData.id}`,
    reference,
    source_type: 'restaurant',
    source_id: orderData.id,
    status: 'posted',
    branch_id: orderData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 6. CUSTOMER PAYMENT AUTO-POSTING (NEW)
// ═══════════════════════════════════════
export async function postCustomerPaymentEntry(paymentData: {
  customer_id: number;
  customer_name: string;
  amount: number;
  type: 'payment' | 'charge';
  branch_id?: number;
  source_id?: number;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.cash || !config.accounts_receivable) return null;

  const period = await getOpenPeriod();
  const amount = Math.abs(parseFloat(String(paymentData.amount)));
  if (amount === 0) return null;

  const items: any[] = [];

  if (paymentData.type === 'payment') {
    // Customer pays us: DR Cash, CR AR
    items.push({
      account_id: config.cash,
      debit: amount,
      credit: 0,
      notes: `تحصيل من العميل ${paymentData.customer_name}`,
      cost_center_id: paymentData.branch_id || null
    });
    items.push({
      account_id: config.accounts_receivable,
      debit: 0,
      credit: amount,
      notes: `سداد حساب العميل ${paymentData.customer_name}`,
      cost_center_id: paymentData.branch_id || null
    });
  } else {
    // Charge (sale on credit): DR AR, CR Revenue
    items.push({
      account_id: config.accounts_receivable,
      debit: amount,
      credit: 0,
      notes: `مبيعات آجلة — العميل ${paymentData.customer_name}`,
      cost_center_id: paymentData.branch_id || null
    });
    if (config.sales_revenue) {
      items.push({
        account_id: config.sales_revenue,
        debit: 0,
        credit: amount,
        notes: `إيراد مبيعات — العميل ${paymentData.customer_name} (آجل)`,
        cost_center_id: paymentData.branch_id || null
      });
    }
  }

  if (items.length < 2) return null;

  const reference = await generateNextReference('customer_payment');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد عميل تلقائي — ${paymentData.customer_name}`,
    reference,
    source_type: 'customer_payment',
    source_id: paymentData.source_id || paymentData.customer_id,
    status: 'posted',
    branch_id: paymentData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 6.1 SALES DELIVERY NOTE AUTO-POSTING (إذن تسليم وصرف بضاعة للعملاء)
// ═══════════════════════════════════════
export async function postDeliveryEntry(deliveryData: {
  id: number;
  delivery_no: string;
  order_id?: number;
  order_no?: string;
  customer_name?: string;
  total_cost: number;
  total_amount?: number;
  branch_id?: number;
  warehouse_id?: number;
  warehouse_name?: string;
  items?: Array<{ name: string; qty: number; cost?: number }>;
}): Promise<any> {
  const config = await getAccountConfig();
  const cogsAccount = config.cost_of_goods_sold || config.cost_expense;
  const invAccount = config.inventory_asset;

  if (!cogsAccount || !invAccount) return null;

  // Idempotency: verify if already posted
  try {
    const existing = await pool.query(
      `SELECT * FROM journal_entries WHERE source_type IN ('sales_delivery', 'delivery') AND source_id=$1 ORDER BY id DESC LIMIT 1`,
      [deliveryData.id]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (_) {}

  const period = await getOpenPeriod();
  const totalCost = parseFloat(String(deliveryData.total_cost || 0));
  if (totalCost <= 0) return null;

  const items: any[] = [];

  // Debit: Cost of Goods Sold (تكلفة البضاعة المباعة / بضاعة مسلمة للعملاء)
  items.push({
    account_id: cogsAccount,
    debit: totalCost,
    credit: 0,
    notes: `تكلفة بضاعة مباعة — إذن تسليم #${deliveryData.delivery_no || deliveryData.id} (${deliveryData.customer_name || 'عميل'})`,
    cost_center_id: deliveryData.branch_id || null
  });

  // Credit: Inventory Asset (صرف من أصول المخزون السلعي)
  items.push({
    account_id: invAccount,
    debit: 0,
    credit: totalCost,
    notes: `صرف مخزون لتسليم مبيعات — إذن تسليم #${deliveryData.delivery_no || deliveryData.id}${deliveryData.warehouse_name ? ' — ' + deliveryData.warehouse_name : ''}`,
    cost_center_id: deliveryData.branch_id || null
  });

  if (items.length < 2) return null;

  const reference = await generateNextReference('sales_delivery');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد تسليم وصرف مخزني — إذن #${deliveryData.delivery_no || deliveryData.id}${deliveryData.order_no ? ' (أمر بيع #' + deliveryData.order_no + ')' : ''}`,
    reference,
    source_type: 'sales_delivery',
    source_id: deliveryData.id,
    status: 'posted',
    branch_id: deliveryData.branch_id,
    period_id: period?.id,
    created_by: null,
    items
  });
}

// ═══════════════════════════════════════
// 7. COST/EXPENSE AUTO-POSTING (ROBUST & IDEMPOTENT)
// ═══════════════════════════════════════
/** يشتق مفتاح حساب المصروف من نص عربي/إنجليزي (اسم بند التكلفة أو التصنيف). */
function resolveExpenseKeyFromLabel(label: string): string | null {
  const text = String(label || '').toLowerCase();
  if (!text.trim()) return null;
  const rules: Array<[RegExp, string]> = [
    [/(كهرب|مياه|غاز|مرافق|utilit|electric|water|gas)/i, 'utilities_expense'],
    [/(إيجار|ايجار|rent)/i, 'rent_expense'],
    [/(صيان|إصلاح|اصلاح|maintenance|repair)/i, 'maintenance_expense'],
    [/(تسويق|دعاي|إعلان|اعلان|marketing|advert)/i, 'marketing_expense'],
    [/(نقل|مواصلات|توصيل|وقود|بنزين|transport|delivery|fuel)/i, 'transport_expense'],
    [/(تأمين|تامين|insurance)/i, 'insurance_expense'],
    [/(مستلزم|أدوات|ادوات|supplies)/i, 'supplies_expense'],
    [/(مرتب|رواتب|أجور|اجور|salary|payroll|wage)/i, 'payroll_expense'],
  ];
  for (const [pattern, key] of rules) if (pattern.test(text)) return key;
  return null;
}

export async function postCostEntry(costData: {
  id: number;
  category?: string;
  amount: number;
  branch_id?: number;
  notes?: string;
  date?: string;
  cost_center_id?: number;
  payment_method?: string;
  cost_item_id?: number;
  safe?: string;
  safe_id?: number;
  bank_account_id?: number;
  supplier_id?: number;
  accounting_account?: string | number;
  created_by?: number | string;
}, client?: any): Promise<any> {
  const db = client || pool;

  // 1. Idempotency Guard: If journal entry already exists for this cost, return it immediately
  if (costData.id) {
    if (client) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`cost-journal:${costData.id}`]
      );
    }
    const existing = await db.query(
      "SELECT * FROM journal_entries WHERE source_type = 'cost' AND source_id = $1 LIMIT 1",
      [costData.id]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  const amount = Number(Math.abs(parseFloat(String(costData.amount))).toFixed(2));
  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    throw new Error("فشل ترحيل التكلفة: مبلغ التكلفة يجب أن يكون أكبر من صفر");
  }

  const config = await getAccountConfig(db);
  const period = await getOpenPeriod(costData.date, db);
  let categoryLabel = costData.category || 'مصروفات تشغيلية';

  // 2. Resolve Debit Account (Expense Account)
  let expenseAccountId: any = null;

  // First priority: configured account on the cost item
  let costItemLabel = '';
  if (costData.cost_item_id) {
    try {
      // cost_items stores its GL link in accounting_account_id (there is no account_id column)
      const ciRes = await db.query(
        "SELECT accounting_account_id, name, arabic_name, category FROM cost_items WHERE id = $1",
        [costData.cost_item_id]
      );
      const itemRow = ciRes.rows[0];
      costItemLabel = [itemRow?.name, itemRow?.arabic_name, itemRow?.category].filter(Boolean).join(' ');
      const linkedAccount = itemRow?.accounting_account_id;
      if (isValidAccountId(linkedAccount)) {
        const linkedCheck = await db.query("SELECT id FROM accounts WHERE id = $1 AND allow_posting = true LIMIT 1", [Number(linkedAccount)]);
        if (linkedCheck.rows.length > 0) expenseAccountId = linkedCheck.rows[0].id;
      }
    } catch (error) {
      if (client) throw error;
    }
  }

  // Second priority: explicitly provided accounting_account
  if (!expenseAccountId && costData.accounting_account) {
    try {
      const accVal = String(costData.accounting_account).trim();
      const accRes = await db.query(
        "SELECT id FROM accounts WHERE (id = $1 OR code = $2 OR name = $3) AND allow_posting = true LIMIT 1",
        [!isNaN(Number(accVal)) ? Number(accVal) : -1, accVal, accVal]
      );
      if (accRes.rows.length > 0) {
        expenseAccountId = accRes.rows[0].id;
      }
    } catch (error) {
      if (client) throw error;
    }
  }

  // Second-b priority: اشتقاق الحساب من اسم البند/التصنيف العربي (كهرباء/إيجار/صيانة...)
  if (!expenseAccountId && costItemLabel) {
    const derivedKey = resolveExpenseKeyFromLabel(costItemLabel);
    if (derivedKey && isValidAccountId(config[derivedKey])) {
      expenseAccountId = config[derivedKey];
    }
  }

  // Third priority: category map in account_config
  if (!expenseAccountId) {
    const categoryMap: Record<string, string> = {
      'rent': 'rent_expense',
      'utilities': 'utilities_expense',
      'maintenance': 'maintenance_expense',
      'marketing': 'marketing_expense',
      'food_cost': 'cost_of_goods_sold',
      'labor_cost': 'payroll_expense',
      'supplies': 'supplies_expense',
      'insurance': 'insurance_expense',
      'transport': 'transport_expense',
      'other': 'cost_expense',
    };
    const categoryKey = (costData.category || '').toLowerCase().trim();
    const mappedKey = categoryMap[categoryKey] || 'cost_expense';
    if (isValidAccountId(config[mappedKey])) {
      expenseAccountId = config[mappedKey];
    } else if (isValidAccountId(config.cost_expense)) {
      expenseAccountId = config.cost_expense;
    } else if (isValidAccountId(config.operating_expense)) {
      expenseAccountId = config.operating_expense;
    }
  }

  // Fourth priority: active expense account fallback from accounts table
  if (!expenseAccountId) {
    const expFallback = await db.query(
      "SELECT id FROM accounts WHERE (code LIKE '5%' OR type = 'expense') AND allow_posting = true ORDER BY code ASC LIMIT 1"
    );
    if (expFallback.rows.length > 0) {
      expenseAccountId = expFallback.rows[0].id;
    }
  }

  if (!expenseAccountId) {
    throw new Error("فشل ترحيل التكلفة: لم يتم العثور على حساب مصروف صالح بدليل الحسابات");
  }

  // 3. Resolve Credit Account (Payment Source: Cash / Bank / Supplier AP)
  let creditAccountId: any = null;
  const method = (costData.payment_method || 'نقدي').toLowerCase().trim();
  const isCashPayment = ['نقدي', 'cash'].includes(method);
  const isBankPayment = ['بنكي', 'bank', 'شيك', 'تحويل', 'تحويل بنكي', 'bank transfer', 'شبكة', 'card'].includes(method);
  const isCreditPayment = ['آجل', 'اجل', 'credit', 'مورد'].includes(method);

  if (isCashPayment) {
    // NOTE: `safes` (cash boxes) have no per-safe GL column — every cash safe debits the same cash account.
    // We still validate that the requested safe exists so a bad safe id cannot be ignored silently.
    if (costData.safe_id || costData.safe) {
      try {
        const sRes = costData.safe_id
          ? await db.query("SELECT id, name FROM safes WHERE id = $1 LIMIT 1", [costData.safe_id])
          : await db.query("SELECT id, name FROM safes WHERE name = $1 LIMIT 1", [costData.safe]);
        if (sRes.rows.length === 0) {
          if (client) throw new Error(`الخزينة المحددة غير موجودة: ${costData.safe_id || costData.safe}`);
          console.warn(`[AutoPosting] Safe not found (${costData.safe_id || costData.safe}) — falling back to the default cash account`);
        }
      } catch (error) {
        if (client) throw error;
      }
    }
    if (!isValidAccountId(creditAccountId) && isValidAccountId(config.cash)) creditAccountId = config.cash;
    if (!isValidAccountId(creditAccountId)) {
      const cashAcc = await db.query("SELECT id FROM accounts WHERE (code = '111' OR name LIKE '%صندوق%' OR name LIKE '%نقد%') AND allow_posting = true LIMIT 1");
      if (cashAcc.rows.length > 0) creditAccountId = cashAcc.rows[0].id;
    }
  } else if (isBankPayment) {
    if (costData.bank_account_id) {
      // bank_accounts links to the GL through gl_account_id (there is no account_id column)
      const bRes = await db.query("SELECT gl_account_id FROM bank_accounts WHERE id = $1", [costData.bank_account_id]);
      if (bRes.rows.length > 0 && isValidAccountId(bRes.rows[0].gl_account_id)) creditAccountId = bRes.rows[0].gl_account_id;
    }
    if (!isValidAccountId(creditAccountId) && isValidAccountId(config.bank)) creditAccountId = config.bank;
    if (!isValidAccountId(creditAccountId)) {
      const bankAcc = await db.query("SELECT id FROM accounts WHERE (code = '112' OR name LIKE '%بنك%') AND allow_posting = true LIMIT 1");
      if (bankAcc.rows.length > 0) creditAccountId = bankAcc.rows[0].id;
    }
  } else if (isCreditPayment) {
    if (isValidAccountId(config.accounts_payable)) creditAccountId = config.accounts_payable;
    if (!isValidAccountId(creditAccountId)) {
      const apAcc = await db.query("SELECT id FROM accounts WHERE (code = '211' OR name LIKE '%مورد%') AND allow_posting = true LIMIT 1");
      if (apAcc.rows.length > 0) creditAccountId = apAcc.rows[0].id;
    }
  }

  if (client && !isCashPayment && !isBankPayment && !isCreditPayment) {
    throw new Error(`فشل ترحيل التكلفة: طريقة الدفع غير مدعومة (${costData.payment_method || 'غير محددة'})`);
  }

  // Ultimate fallback to cash account if credit account is still unresolved
  if (!isValidAccountId(creditAccountId)) {
    if (client) {
      throw new Error("فشل ترحيل التكلفة: لم يتم العثور على حساب الدفع المطابق لطريقة الدفع");
    }
    if (isValidAccountId(config.cash)) creditAccountId = config.cash;
    if (!isValidAccountId(creditAccountId)) {
      const fallback = await db.query("SELECT id FROM accounts WHERE (code = '1110' OR type = 'asset') AND allow_posting = true ORDER BY code ASC LIMIT 1");
      if (fallback.rows.length > 0) creditAccountId = fallback.rows[0].id;
    }
  }

  if (!creditAccountId) {
    throw new Error("فشل ترحيل التكلفة: لم يتم العثور على حساب دفع (صندوق/بنك/مورد) صالح بدليل الحسابات");
  }

  const items: any[] = [
    {
      account_id: expenseAccountId,
      debit: amount,
      credit: 0,
      notes: costData.notes || `مصروف ${categoryLabel}`,
      cost_center_id: costData.cost_center_id || null
    },
    {
      account_id: creditAccountId,
      debit: 0,
      credit: amount,
      notes: `سداد مصروف ${categoryLabel}`,
      cost_center_id: costData.cost_center_id || null
    }
  ];

  const reference = await generateNextReference('cost', db, costData.date);
  const createdBy = Number(costData.created_by);
  const entry = await repo.createJournalEntry({
    date: costData.date || localTodayYMD(),
    description: `قيد مصروفات تلقائي — ${categoryLabel}`,
    reference,
    source_type: 'cost',
    source_id: costData.id,
    status: 'posted',
    branch_id: costData.branch_id,
    period_id: period?.id,
    created_by: Number.isInteger(createdBy) && createdBy > 0 ? createdBy : null,
    items
  }, client);

  // Link journal_entry_id to operating_costs
  if (entry && entry.id && costData.id) {
    try {
      await db.query(
        "UPDATE operating_costs SET journal_entry_id = $1 WHERE id = $2",
        [entry.id, costData.id]
      );
    } catch (e: any) {
      if (client) throw e;
      console.warn("[AutoPosting] Failed to update operating_costs.journal_entry_id:", e?.message);
    }
  }

  return entry;
}

// ═══════════════════════════════════════
// 8. SALES RETURN AUTO-POSTING (NEW)
// ═══════════════════════════════════════
export async function postReturnEntry(returnData: {
  id: number;
  grand_total: number;
  refund_method: string;
  customer_name: string;
  items_total: number;
  tax_total: number;
  discount_total?: number;
  expenses?: number;
  total_cost?: number;
  branch_id?: number;
}, client?: any): Promise<any> {
  const config = await getAccountConfig();
  const db = client || pool;

  // Idempotency: verify if already posted
  try {
    const existing = await db.query(
      `SELECT * FROM journal_entries WHERE source_type='sales_return' AND source_id=$1 ORDER BY id DESC LIMIT 1`,
      [returnData.id]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (error) {
    if (client) throw error;
  }

  // Helper to resolve an account ID from config or directly from accounts table
  const resolveAcc = async (keys: string[], codes: string[], typeHint?: string): Promise<string | undefined> => {
    for (const k of keys) {
      if (isValidAccountId(config[k])) return String(config[k]);
    }
    try {
      const codeRes = await db.query(
        `SELECT id FROM accounts WHERE code = ANY($1) ORDER BY is_leaf DESC NULLS LAST, id ASC LIMIT 1`,
        [codes]
      );
      if (codeRes.rows[0]?.id) return String(codeRes.rows[0].id);

      if (typeHint) {
        const typeRes = await db.query(
          `SELECT id FROM accounts WHERE (type = $1 OR LOWER(account_type) = $1) ORDER BY is_leaf DESC NULLS LAST, id ASC LIMIT 1`,
          [typeHint.toLowerCase()]
        );
        if (typeRes.rows[0]?.id) return String(typeRes.rows[0].id);
      }

      const anyRes = await db.query(`SELECT id FROM accounts ORDER BY is_leaf DESC NULLS LAST, id ASC LIMIT 1`);
      if (anyRes.rows[0]?.id) return String(anyRes.rows[0].id);
    } catch (_) {}
    return undefined;
  };

  const period = await getOpenPeriod();
  const rawItemsTotal = Math.max(0, parseFloat(String(returnData.items_total || 0)));
  const rawTaxTotal = Math.max(0, parseFloat(String(returnData.tax_total || 0)));
  const rawDiscountTotal = Math.max(0, parseFloat(String(returnData.discount_total || 0)));
  const rawExpenses = Math.max(0, parseFloat(String(returnData.expenses || 0)));
  const rawGrandTotal = Math.max(0, parseFloat(String(returnData.grand_total || 0)));

  const computedNet = Math.max(0, rawItemsTotal + rawTaxTotal - rawDiscountTotal + rawExpenses);
  const totalRefund = Number((rawGrandTotal > 0 ? rawGrandTotal : computedNet).toFixed(2));
  const totalCost = Number(Math.max(0, parseFloat(String(returnData.total_cost || 0))).toFixed(2));

  if (totalRefund === 0 && totalCost === 0) return null;

  const items: any[] = [];

  if (totalRefund > 0) {
    const returnsAccount = await resolveAcc(
      ['sales_returns', 'sales_discount', 'sales_revenue', 'food_revenue', 'refund_expense'],
      ['4202', '4201', '4000', '4102', '4101', '41', '5111'],
      'revenue'
    );
    const taxAccount = rawTaxTotal > 0
      ? await resolveAcc(['tax_payable', 'vat_payable', 'input_vat'], ['2130', '2103', '213', '1107'], 'liability')
      : undefined;

    const refundMethodStr = String(returnData.refund_method || '');
    const isCredit = refundMethodStr.includes('إشعار دائن') || refundMethodStr.includes('دائن') || refundMethodStr.includes('حساب') || refundMethodStr.includes('آجل');
    const isBank = refundMethodStr.includes('بنك') || refundMethodStr.includes('تحويل') || refundMethodStr.includes('شبكة');

    let creditAccount: string | undefined;
    if (isCredit) {
      creditAccount = await resolveAcc(['accounts_receivable', 'customer_receivables', 'cash', 'bank'], ['1130', '1102', '113', '1110', '1101'], 'asset');
    } else if (isBank) {
      creditAccount = await resolveAcc(['bank', 'cash', 'accounts_receivable'], ['1120', '1101', '112', '1110'], 'asset');
    } else {
      creditAccount = await resolveAcc(['cash', 'bank', 'accounts_receivable'], ['1110', '1101', '111', '1120'], 'asset');
    }

    if (returnsAccount && creditAccount) {
      const effectiveTax = taxAccount ? Number(Math.min(rawTaxTotal, totalRefund).toFixed(2)) : 0;
      const effectiveReturnsDebit = Number(Math.max(0, totalRefund - effectiveTax).toFixed(2));

      if (effectiveReturnsDebit > 0) {
        items.push({
          account_id: returnsAccount,
          debit: effectiveReturnsDebit,
          credit: 0,
          notes: `مرتجعات مبيعات — إشعار #${returnData.id} — ${returnData.customer_name}`,
          cost_center_id: returnData.branch_id || null
        });
      }

      if (taxAccount && effectiveTax > 0) {
        items.push({
          account_id: taxAccount,
          debit: effectiveTax,
          credit: 0,
          notes: `ضريبة مستردة — مرتجع #${returnData.id}`,
          cost_center_id: returnData.branch_id || null
        });
      }

      items.push({
        account_id: creditAccount,
        debit: 0,
        credit: totalRefund,
        notes: isCredit
          ? `تخفيض حساب عميل — مرتجع #${returnData.id} — ${returnData.customer_name}`
          : isBank
            ? `مردود بنكي — مرتجع #${returnData.id} — ${returnData.customer_name}`
            : `مردود نقدي — مرتجع #${returnData.id} — ${returnData.customer_name}`,
        cost_center_id: returnData.branch_id || null
      });
    }
  }

  // Inventory Asset & COGS reversal on Return
  if (totalCost > 0) {
    const invAccount = await resolveAcc(
      ['inventory_asset', 'finished_goods_inventory', 'raw_materials_inventory'],
      ['1140', '1103', '1142', '1141', '114'],
      'asset'
    );
    const cogsAccount = await resolveAcc(
      ['cost_of_goods_sold', 'cost_expense', 'operating_expense'],
      ['5100', '5101', '5000', '5110', '51'],
      'expense'
    );
    if (invAccount && cogsAccount) {
      // Debit: Inventory Asset (restoring stock asset)
      items.push({
        account_id: invAccount,
        debit: totalCost,
        credit: 0,
        notes: `إرجاع بضاعة للمخزن — مرتجع #${returnData.id}`,
        cost_center_id: returnData.branch_id || null
      });
      // Credit: COGS (reversing cost)
      items.push({
        account_id: cogsAccount,
        debit: 0,
        credit: totalCost,
        notes: `تخفيض تكلفة البضاعة المباعة — مرتجع #${returnData.id}`,
        cost_center_id: returnData.branch_id || null
      });
    }
  }

  if (items.length < 2) {
    if (client) throw new Error("تعذر إنشاء قيد مرتجع المبيعات من الحسابات المضبوطة");
    return null;
  }

  const reference = await generateNextReference('sales_return');
  const entry = await createSafeEntry({
    date: localTodayYMD(),
    description: `قيد مرتجع مبيعات تلقائي — إشعار #${returnData.id}`,
    reference,
    source_type: 'sales_return',
    source_id: returnData.id,
    status: 'posted',
    branch_id: returnData.branch_id,
    period_id: period?.id,
    items
  }, client);
  if (client && !entry) throw new Error("تعذر إنشاء قيد مرتجع المبيعات");
  return entry;
}

// ═══════════════════════════════════════
// 9. COMPLAINT REFUND AUTO-POSTING (NEW)
// ═══════════════════════════════════════
export async function postComplaintRefundEntry(complaintData: {
  id: number;
  customer_name: string;
  refund_amount: number;
  compensation_amount: number;
  branch_id?: number;
  resolution_text?: string;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.cash) return null;

  const period = await getOpenPeriod();
  const refundAmount = parseFloat(String(complaintData.refund_amount || 0));
  const compensationAmount = parseFloat(String(complaintData.compensation_amount || 0));
  const totalAmount = refundAmount + compensationAmount;
  if (totalAmount === 0) return null;

  const items: any[] = [];

  // Debit: Refund/Compensation Expense
  const expenseAccount = config.refund_expense || config.cost_expense || config.accounts_payable;
  if (expenseAccount) {
    if (refundAmount > 0) {
      items.push({
        account_id: expenseAccount,
        debit: refundAmount,
        credit: 0,
        notes: `مردود شكوى #${complaintData.id} — ${complaintData.customer_name}`,
        cost_center_id: complaintData.branch_id || null
      });
    }
    if (compensationAmount > 0) {
      items.push({
        account_id: expenseAccount,
        debit: compensationAmount,
        credit: 0,
        notes: `تعويض شكوى #${complaintData.id} — ${complaintData.customer_name}`,
        cost_center_id: complaintData.branch_id || null
      });
    }
  }

  // Credit: Cash
  items.push({
    account_id: config.cash,
    debit: 0,
    credit: totalAmount,
    notes: `مردود/تعويض شكوى #${complaintData.id}`,
    cost_center_id: complaintData.branch_id || null
  });

  if (items.length < 2) return null;

  const reference = await generateNextReference('complaint_refund');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد مردود شكوى تلقائي — شكوى #${complaintData.id}`,
    reference,
    source_type: 'complaint_refund',
    source_id: complaintData.id,
    status: 'posted',
    branch_id: complaintData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 10. INVENTORY ADJUSTMENT AUTO-POSTING (NEW)
// ═══════════════════════════════════════
export async function postInventoryAdjustmentEntry(adjData: {
  id: number;
  warehouse_id?: number;
  ingredient_id?: number;
  ingredient_name?: string;
  quantity?: number;
  unit_cost?: number;
  total_value?: number;
  type?: string; // 'in' (gain), 'out' (loss/waste), 'adjustment', 'increase', 'decrease'
  branch_id?: number;
  items?: Array<{
    product_id?: number;
    ingredient_id?: number;
    name?: string;
    adjustment_qty?: number;
    quantity?: number;
    unit_cost?: number;
    total_cost?: number;
  }>;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.inventory_asset && !config.cost_of_goods_sold) return null;

  // Idempotency: verify if already posted
  try {
    const existing = await pool.query(
      `SELECT * FROM journal_entries WHERE source_type='inventory_adjustment' AND source_id=$1 ORDER BY id DESC LIMIT 1`,
      [adjData.id]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (_) {}

  const period = await getOpenPeriod();
  const items: any[] = [];

  // Multi-item adjustment document
  if (Array.isArray(adjData.items) && adjData.items.length > 0) {
    let totalGain = 0;
    let totalLoss = 0;

    for (const it of adjData.items) {
      const qty = Number(it.adjustment_qty ?? it.quantity ?? 0);
      const cost = Number(it.total_cost ?? (qty * Number(it.unit_cost || 0)));
      if (qty > 0) {
        totalGain += Math.abs(cost);
      } else if (qty < 0) {
        totalLoss += Math.abs(cost);
      }
    }

    if (totalGain > 0) {
      if (config.inventory_asset) {
        items.push({
          account_id: config.inventory_asset,
          debit: totalGain,
          credit: 0,
          notes: `إثبات زيادة المخزون — تسوية #${adjData.id}`,
          cost_center_id: adjData.branch_id || null
        });
      }
      const incomeAccount = config.other_income || config.sales_revenue;
      if (incomeAccount) {
        items.push({
          account_id: incomeAccount,
          debit: 0,
          credit: totalGain,
          notes: `إيراد أرباح تسوية مخزون — تسوية #${adjData.id}`,
          cost_center_id: adjData.branch_id || null
        });
      }
    }

    if (totalLoss > 0) {
      const expenseAccount = config.cost_of_goods_sold || config.cost_expense;
      if (expenseAccount) {
        items.push({
          account_id: expenseAccount,
          debit: totalLoss,
          credit: 0,
          notes: `إثبات عجز/هبوط تسوية مخزون — تسوية #${adjData.id}`,
          cost_center_id: adjData.branch_id || null
        });
      }
      if (config.inventory_asset) {
        items.push({
          account_id: config.inventory_asset,
          debit: 0,
          credit: totalLoss,
          notes: `تخفيض المخزون — تسوية #${adjData.id}`,
          cost_center_id: adjData.branch_id || null
        });
      }
    }
  } else {
    // Single item or total-based adjustment
    const unitCost = parseFloat(String(adjData.unit_cost || 0));
    const quantity = parseFloat(String(adjData.quantity || 0));
    const totalValue = Math.abs(adjData.total_value !== undefined ? Number(adjData.total_value) : (quantity * unitCost));
    if (totalValue === 0) return null;

    const isGain = adjData.type === 'in' || adjData.type === 'increase' || (quantity > 0 && adjData.type !== 'out');

    if (isGain) {
      if (config.inventory_asset) {
        items.push({
          account_id: config.inventory_asset,
          debit: totalValue,
          credit: 0,
          notes: `زيادة مخزون — ${adjData.ingredient_name || `مكون #${adjData.ingredient_id || adjData.id}`}`,
          cost_center_id: adjData.branch_id || null
        });
      }
      const incomeAccount = config.other_income || config.sales_revenue;
      if (incomeAccount) {
        items.push({
          account_id: incomeAccount,
          debit: 0,
          credit: totalValue,
          notes: `إيراد زيادة مخزون — ${adjData.ingredient_name || `مكون #${adjData.ingredient_id || adjData.id}`}`,
          cost_center_id: adjData.branch_id || null
        });
      }
    } else {
      const expenseAccount = config.cost_of_goods_sold || config.cost_expense;
      if (expenseAccount) {
        items.push({
          account_id: expenseAccount,
          debit: totalValue,
          credit: 0,
          notes: `عجز تسوية مخزون — ${adjData.ingredient_name || `مكون #${adjData.ingredient_id || adjData.id}`}`,
          cost_center_id: adjData.branch_id || null
        });
      }
      if (config.inventory_asset) {
        items.push({
          account_id: config.inventory_asset,
          debit: 0,
          credit: totalValue,
          notes: `تخفيض مخزون — ${adjData.ingredient_name || `مكون #${adjData.ingredient_id || adjData.id}`}`,
          cost_center_id: adjData.branch_id || null
        });
      }
    }
  }

  if (items.length < 2) return null;

  const reference = await generateNextReference('inventory_adj');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد تسوية مخزنية معتمدة — إذن #${adjData.id}`,
    reference,
    source_type: 'inventory_adjustment',
    source_id: adjData.id,
    status: 'posted',
    branch_id: adjData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 10b. WASTAGE / SPOILAGE AUTO-POSTING
// ═══════════════════════════════════════
export async function postWastageEntry(wastageData: {
  id: number;
  wastage_number?: string;
  total_cost: number;
  warehouse_id?: number;
  branch_id?: number;
  cost_center_id?: number;
  notes?: string;
  items?: Array<{ product_id?: number; name?: string; wastage_qty?: number; total_cost?: number }>;
}): Promise<any> {
  const config = await getAccountConfig();
  const expenseAccount = config.cost_of_goods_sold || config.cost_expense;
  if (!expenseAccount || !config.inventory_asset) return null;
  const total = Math.abs(parseFloat(String(wastageData.total_cost || 0)));
  if (total <= 0) return null;

  try {
    const existing = await pool.query(
      `SELECT * FROM journal_entries WHERE source_type='inventory_wastage' AND source_id=$1 ORDER BY id DESC LIMIT 1`,
      [wastageData.id]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (_) {}

  const period = await getOpenPeriod();
  const items: any[] = [
    {
      account_id: expenseAccount,
      debit: total,
      credit: 0,
      notes: `إثبات تكلفة هالك وتالف مخزني #${wastageData.wastage_number || wastageData.id}`,
      cost_center_id: wastageData.cost_center_id || wastageData.branch_id || null
    },
    {
      account_id: config.inventory_asset,
      debit: 0,
      credit: total,
      notes: `تخفيض المخزون بقيمة الهالك #${wastageData.wastage_number || wastageData.id}`,
      cost_center_id: wastageData.cost_center_id || wastageData.branch_id || null
    }
  ];

  const reference = await generateNextReference('wastage');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد توالف وهوالك مخزنية معتمدة #${wastageData.wastage_number || wastageData.id}`,
    reference,
    source_type: 'inventory_wastage',
    source_id: wastageData.id,
    status: 'posted',
    branch_id: wastageData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 10c. PURCHASE RETURN AUTO-POSTING
// ═══════════════════════════════════════
export async function postPurchaseReturnEntry(returnData: {
  id: number;
  return_number?: string;
  total: number;
  supplier_id?: number;
  supplier_name?: string;
  warehouse_id?: number;
  branch_id?: number;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  cost_center_id?: number;
  notes?: string;
}, client?: any): Promise<any> {
  const config = await getAccountConfig();
  if (!config.accounts_payable || !config.inventory_asset) return null;

  let total = Math.abs(parseFloat(String(returnData.total || 0)));
  let subtotal = Math.abs(parseFloat(String(returnData.subtotal || 0)));
  let taxAmount = Math.abs(parseFloat(String(returnData.tax_amount || 0)));

  // If subtotal or tax_amount not provided directly, lookup from purchase_returns record
  if (returnData.id && (!subtotal || !taxAmount)) {
    try {
      const q = client || pool;
      const retRes = await q.query(
        `SELECT subtotal, tax_amount, total_amount, tax_rate FROM purchase_returns WHERE id = $1`,
        [returnData.id]
      );
      if (retRes.rows[0]) {
        const row = retRes.rows[0];
        taxAmount = Number(row.tax_amount || 0);
        subtotal = Number(row.subtotal || (Number(row.total_amount || total) - taxAmount));
        if (!total) total = Number(row.total_amount || (subtotal + taxAmount));
      }
    } catch (_) {}
  }

  if (total <= 0) return null;
  if (!subtotal) {
    subtotal = taxAmount > 0 ? Math.max(0, total - taxAmount) : total;
  }
  // Ensure mathematical balance: Total = Subtotal + Tax
  if (taxAmount > 0 && Math.abs(total - (subtotal + taxAmount)) > 0.01) {
    total = Math.round((subtotal + taxAmount) * 100) / 100;
  }

  try {
    const existing = await (client || pool).query(
      `SELECT * FROM journal_entries WHERE source_type='purchase_return' AND source_id=$1 ORDER BY id DESC LIMIT 1`,
      [returnData.id]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (_) {}

  const period = await getOpenPeriod();
  const items: any[] = [];

  // 1. Debit: Accounts Payable / الموردين (Gross Total including VAT)
  // Reduces liability to supplier by the full return amount including tax
  items.push({
    account_id: config.accounts_payable,
    debit: total,
    credit: 0,
    notes: `تخفيض حساب المورد ${returnData.supplier_name || '#' + returnData.supplier_id} — إذن مرتجع مشتريات #${returnData.return_number || returnData.id} (إجمالي شامل الضريبة)`,
    cost_center_id: returnData.cost_center_id || returnData.branch_id || null
  });

  // 2. Credit: Inventory Asset / المخزون (Net Goods Subtotal before VAT)
  // Reduces inventory asset by the net cost of returned goods
  items.push({
    account_id: config.inventory_asset,
    debit: 0,
    credit: subtotal,
    notes: `تخفيض المخزون لمرتجع مشتريات #${returnData.return_number || returnData.id} (صافي البضاعة)`,
    cost_center_id: returnData.cost_center_id || returnData.branch_id || null
  });

  // 3. Credit: Input VAT / ضريبة القيمة المضافة مدخلات (Tax Amount)
  // Reverses the recoverable VAT originally claimed on the returned goods
  if (taxAmount > 0) {
    const inputVatAccountId = config.input_vat || config.vat_input || config.tax_receivable || config.tax_payable;
    if (inputVatAccountId) {
      items.push({
        account_id: inputVatAccountId,
        debit: 0,
        credit: taxAmount,
        notes: `عكس وتخفيض ضريبة القيمة المضافة (VAT) لمرتجع مشتريات #${returnData.return_number || returnData.id}`,
        cost_center_id: returnData.cost_center_id || returnData.branch_id || null
      });
    } else {
      // Fallback: If no tax account configured, credit inventory asset for the full amount so entry balances
      items[1].credit = total;
    }
  }

  const reference = await generateNextReference('purchase_return');
  const description = taxAmount > 0
    ? `قيد مرتجع مشتريات #${returnData.return_number || returnData.id} — مورد ${returnData.supplier_name || returnData.supplier_id} (صافي: ${subtotal} + ضريبة: ${taxAmount} = إجمالي: ${total})`
    : `قيد مرتجع مشتريات #${returnData.return_number || returnData.id} — مورد ${returnData.supplier_name || returnData.supplier_id}`;

  return createSafeEntry({
    date: localTodayYMD(),
    description,
    reference,
    source_type: 'purchase_return',
    source_id: returnData.id,
    status: 'posted',
    branch_id: returnData.branch_id,
    period_id: period?.id,
    items
  }, client);
}

// ═══════════════════════════════════════
// 10d. WAREHOUSE TRANSFER AUTO-POSTING
// ═══════════════════════════════════════
export async function postWarehouseTransferEntry(transferData: {
  id: number;
  transfer_number?: string;
  shipping_cost?: number;
  damage_cost?: number;
  from_warehouse_id?: number;
  to_warehouse_id?: number;
  branch_id?: number;
  cost_center_id?: number;
  notes?: string;
}): Promise<any> {
  const config = await getAccountConfig();
  const shippingCost = Math.max(0, parseFloat(String(transferData.shipping_cost || 0)));
  const damageCost = Math.max(0, parseFloat(String(transferData.damage_cost || 0)));
  const totalCost = shippingCost + damageCost;

  if (totalCost <= 0) return null;

  try {
    const existing = await pool.query(
      `SELECT * FROM journal_entries WHERE source_type='warehouse_transfer' AND source_id=$1 ORDER BY id DESC LIMIT 1`,
      [transferData.id]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (_) {}

  const period = await getOpenPeriod();
  const items: any[] = [];

  if (shippingCost > 0) {
    const transportAccount = config.transport_expense || config.cost_expense || config.cost_of_goods_sold;
    const cashAccount = config.cash || config.bank;
    if (transportAccount && cashAccount) {
      items.push({
        account_id: transportAccount,
        debit: shippingCost,
        credit: 0,
        notes: `مصاريف شحن ونقل تحويل مخزني #${transferData.transfer_number || transferData.id}`,
        cost_center_id: transferData.cost_center_id || transferData.branch_id || null
      });
      items.push({
        account_id: cashAccount,
        debit: 0,
        credit: shippingCost,
        notes: `سداد شحن تحويل مخزني #${transferData.transfer_number || transferData.id}`,
        cost_center_id: transferData.cost_center_id || transferData.branch_id || null
      });
    }
  }

  if (damageCost > 0) {
    const expenseAccount = config.cost_of_goods_sold || config.cost_expense;
    if (expenseAccount && config.inventory_asset) {
      items.push({
        account_id: expenseAccount,
        debit: damageCost,
        credit: 0,
        notes: `تلفيات أثناء النقل والتحويل #${transferData.transfer_number || transferData.id}`,
        cost_center_id: transferData.cost_center_id || transferData.branch_id || null
      });
      items.push({
        account_id: config.inventory_asset,
        debit: 0,
        credit: damageCost,
        notes: `تخفيض المخزون للتلف بالتحويل #${transferData.transfer_number || transferData.id}`,
        cost_center_id: transferData.cost_center_id || transferData.branch_id || null
      });
    }
  }

  if (items.length < 2) return null;

  const reference = await generateNextReference('warehouse_transfer');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد تكاليف وتلفيات تحويل مخزني #${transferData.transfer_number || transferData.id}`,
    reference,
    source_type: 'warehouse_transfer',
    source_id: transferData.id,
    status: 'posted',
    branch_id: transferData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 11. EMPLOYEE ADVANCE AUTO-POSTING (NEW)
// ═══════════════════════════════════════
export async function postEmployeeAdvanceEntry(advanceData: {
  id: number;
  employee_id: number;
  employee_name?: string;
  amount: number;
  branch_id?: number;
}): Promise<any> {
  const config = await getAccountConfig();
  if (!config.cash) return null;

  const period = await getOpenPeriod();
  const amount = Math.abs(parseFloat(String(advanceData.amount)));
  if (amount === 0) return null;

  const items: any[] = [];

  // Debit: Employee Advances (asset — owed to us)
  const advanceAccount = config.employee_advances || config.accounts_receivable;
  if (advanceAccount) {
    items.push({
      account_id: advanceAccount,
      debit: amount,
      credit: 0,
      notes: `سلفة للموظف ${advanceData.employee_name || `#${advanceData.employee_id}`}`,
      cost_center_id: advanceData.branch_id || null
    });
  }

  // Credit: Cash
  items.push({
    account_id: config.cash,
    debit: 0,
    credit: amount,
    notes: `صرف سلفة — موظف ${advanceData.employee_name || `#${advanceData.employee_id}`}`,
    cost_center_id: advanceData.branch_id || null
  });

  if (items.length < 2) return null;

  const reference = await generateNextReference('employee_advance');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد سلفة موظف تلقائي — #${advanceData.id}`,
    reference,
    source_type: 'employee_advance',
    source_id: advanceData.id,
    status: 'posted',
    branch_id: advanceData.branch_id,
    period_id: period?.id,
    items
  });
}

// ═══════════════════════════════════════
// 12. PERIOD-END CLOSING (ENHANCED)
// ═══════════════════════════════════════
export async function closePeriod(periodId: number, userId: number): Promise<any> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the period
    const periodResult = await client.query(
      "SELECT * FROM financial_periods WHERE id = $1",
      [periodId]
    );
    const period = periodResult.rows[0];
    if (!period) throw new Error("الفترة المالية غير موجودة");
    if (period.status === 'closed') throw new Error("الفترة المالية مقفلة بالفعل");

    // Get Income Summary and Retained Earnings account IDs from config
    const configResult = await client.query("SELECT key, account_id FROM account_config WHERE account_id IS NOT NULL");
    const config: any = {};
    for (const row of configResult.rows) {
      config[normalizeKey(row.key)] = String(row.account_id);
    }
    // account_config keys are normalised (the "_account" suffix is stripped by normalizeKey)
    const incomeSummaryId = config.income_summary || config.income_summary_account;
    const retainedEarningsId = config.retained_earnings || config.retained_earnings_account;

    if (!incomeSummaryId || !retainedEarningsId) {
      throw new Error("يرجى تكوين حسابات قائمة الدخل وحقوق الملكية في إعدادات الحسابات أولاً");
    }

    // Calculate total revenue and expenses for the period
    const revenueResult = await client.query(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      JOIN accounts a ON ji.account_id = a.id
      WHERE a.type = 'revenue' AND je.period_id = $1 AND je.status = 'posted'
    `, [periodId]);
    const totalRevenue = parseFloat(revenueResult.rows[0].total);

    const expenseResult = await client.query(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      JOIN journal_entries je ON ji.journal_entry_id = je.id
      JOIN accounts a ON ji.account_id = a.id
      WHERE a.type = 'expense' AND je.period_id = $1 AND je.status = 'posted'
    `, [periodId]);
    const totalExpenses = parseFloat(expenseResult.rows[0].total);

    const netIncome = totalRevenue - totalExpenses;

    // Step 1: Close Revenue accounts to Income Summary
    if (totalRevenue > 0) {
      const revRef = `CL-REV-${period.year}${String(period.month).padStart(2, '0')}`;
      await client.query(`
        INSERT INTO journal_entries (date, description, reference, source_type, status, total_debit, total_credit, period_id, created_by)
        VALUES ($1, $2, $3, 'closing', 'posted', $4, $4, $5, $6) RETURNING id
      `, [
        `${period.year}-${String(period.month).padStart(2, '0')}-28`,
        `إقفال حسابات الإيرادات — ${period.month}/${period.year}`,
        revRef, totalRevenue, periodId, userId
      ]);

      const entryResult = await client.query(
        "SELECT id FROM journal_entries WHERE reference = $1 AND period_id = $2 ORDER BY id DESC LIMIT 1",
        [revRef, periodId]
      );
      const entryId = entryResult.rows[0]?.id;
      if (entryId) {
        // Debit each revenue account to zero it
        await client.query(`
          INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
          SELECT $1, ji.account_id, ji.credit - ji.debit, 0,
            'إقفال إيراد — ترحيل لقائمة الدخل'
          FROM journal_items ji
          JOIN journal_entries je ON ji.journal_entry_id = je.id
          JOIN accounts a ON ji.account_id = a.id
          WHERE a.type = 'revenue' AND je.period_id = $2 AND je.status = 'posted'
            AND NOT EXISTS (
              SELECT 1 FROM journal_items ji2
              JOIN journal_entries je2 ON ji2.journal_entry_id = je2.id
              WHERE ji2.account_id = ji.account_id AND je2.source_type = 'closing' AND je2.period_id = $2
            )
          GROUP BY ji.account_id
        `, [entryId, periodId]);

        // Credit Income Summary
        await client.query(`
          INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
          VALUES ($1, $2, 0, $3, 'إقفال — مجموع الإيرادات لقائمة الدخل')
        `, [entryId, incomeSummaryId, totalRevenue]);
      }
    }

    // Step 2: Close Expense accounts to Income Summary
    if (totalExpenses > 0) {
      const expRef = `CL-EXP-${period.year}${String(period.month).padStart(2, '0')}`;
      await client.query(`
        INSERT INTO journal_entries (date, description, reference, source_type, status, total_debit, total_credit, period_id, created_by)
        VALUES ($1, $2, $3, 'closing', 'posted', $4, $4, $5, $6) RETURNING id
      `, [
        `${period.year}-${String(period.month).padStart(2, '0')}-28`,
        `إقفال حسابات المصروفات — ${period.month}/${period.year}`,
        expRef, totalExpenses, periodId, userId
      ]);

      const entryResult = await client.query(
        "SELECT id FROM journal_entries WHERE reference = $1 AND period_id = $2 ORDER BY id DESC LIMIT 1",
        [expRef, periodId]
      );
      const entryId = entryResult.rows[0]?.id;
      if (entryId) {
        // Credit each expense account to zero it
        await client.query(`
          INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
          SELECT $1, ji.account_id, 0, ji.debit - ji.credit,
            'إقفال مصروف — ترحيل لقائمة الدخل'
          FROM journal_items ji
          JOIN journal_entries je ON ji.journal_entry_id = je.id
          JOIN accounts a ON ji.account_id = a.id
          WHERE a.type = 'expense' AND je.period_id = $2 AND je.status = 'posted'
            AND NOT EXISTS (
              SELECT 1 FROM journal_items ji2
              JOIN journal_entries je2 ON ji2.journal_entry_id = je2.id
              WHERE ji2.account_id = ji.account_id AND je2.source_type = 'closing' AND je2.period_id = $2
            )
          GROUP BY ji.account_id
        `, [entryId, periodId]);

        // Debit Income Summary
        await client.query(`
          INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes)
          VALUES ($1, $2, $3, 0, 'إقفال — مجموع المصروفات لقائمة الدخل')
        `, [entryId, incomeSummaryId, totalExpenses]);
      }
    }

    // Step 3: Close Income Summary to Retained Earnings
    if (netIncome !== 0) {
      const netRef = `CL-NET-${period.year}${String(period.month).padStart(2, '0')}`;
      await client.query(`
        INSERT INTO journal_entries (date, description, reference, source_type, status, total_debit, total_credit, period_id, created_by)
        VALUES ($1, $2, $3, 'closing', 'posted', $4, $4, $5, $6) RETURNING id
      `, [
        `${period.year}-${String(period.month).padStart(2, '0')}-28`,
        `ترحيل صافي الربح/الخسارة — ${period.month}/${period.year}`,
        netRef, Math.abs(netIncome), periodId, userId
      ]);

      const entryResult = await client.query(
        "SELECT id FROM journal_entries WHERE reference = $1 AND period_id = $2 ORDER BY id DESC LIMIT 1",
        [netRef, periodId]
      );
      const entryId = entryResult.rows[0]?.id;
      if (entryId) {
        if (netIncome > 0) {
          // Profit: Debit Income Summary, Credit Retained Earnings
          await client.query(`
            INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES
            ($1, $2, $3, 0, 'ترحيل صافي ربح لقائمة الدخل'),
            ($1, $4, 0, $3, 'ترحيل صافي ربح لحقوق الملكية')
          `, [entryId, incomeSummaryId, netIncome, retainedEarningsId]);
        } else {
          // Loss: Debit Retained Earnings, Credit Income Summary
          await client.query(`
            INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES
            ($1, $2, $3, 0, 'ترحيل صافي خسارة لحقوق الملكية'),
            ($1, $4, 0, $3, 'ترحيل صافي خسارة لقائمة الدخل')
          `, [entryId, retainedEarningsId, Math.abs(netIncome), incomeSummaryId]);
        }
      }
    }

    // Close the period
    await client.query(
      "UPDATE financial_periods SET status = 'closed', closed_at = NOW(), closed_by = $1 WHERE id = $2",
      [userId, periodId]
    );

    // Log to GL audit
    await client.query(`
      INSERT INTO gl_audit_logs (table_name, record_id, action, new_values, user_id)
      VALUES ('financial_periods', $1, 'close', $2, $3)
    `, [periodId, JSON.stringify({ period: `${period.month}/${period.year}`, net_income: netIncome }), userId]);

    await client.query("COMMIT");

    ERPEventBus.getInstance().emitEvent("PeriodClosed", {
      periodId,
      month: period.month,
      year: period.year,
      netIncome,
      totalRevenue,
      totalExpenses
    });

    return {
      success: true,
      period: `${period.month}/${period.year}`,
      total_revenue: totalRevenue,
      total_expenses: totalExpenses,
      net_income: netIncome
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ═══════════════════════════════════════
// GL AUDIT LOGGING
// ═══════════════════════════════════════
export async function logGLAudit(
  tableName: string,
  recordId: number,
  action: string,
  userId: number,
  ipAddress?: string,
  oldValues?: any,
  newValues?: any
): Promise<void> {
  try {
    await pool.query(`
      INSERT INTO gl_audit_logs (table_name, record_id, action, old_values, new_values, user_id, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [tableName, recordId, action, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, userId, ipAddress || null]);
  } catch (e) {
    console.error("[AutoPosting] Failed to log GL audit:", e);
  }
}

// ═══════════════════════════════════════
// BUDGET VARIANCE CALCULATOR
// ═══════════════════════════════════════
export async function recalculateBudgetActuals(fiscalYearId: number): Promise<number> {
  try {
    const result = await pool.query(`
      UPDATE budgets b
      SET actual_amount = COALESCE(sub.actual, 0),
          updated_at = NOW()
      FROM (
        SELECT bi.budget_id, SUM(ji.debit - ji.credit) as actual
        FROM budget_items bi
        JOIN journal_items ji ON ji.account_id = bi.account_id
        JOIN journal_entries je ON ji.journal_entry_id = je.id
        JOIN fiscal_years fy ON je.date BETWEEN fy.start_date AND fy.end_date
        WHERE bi.fiscal_year_id = $1 AND fy.id = $1 AND je.status = 'posted'
        GROUP BY bi.budget_id
      ) sub
      WHERE b.id = sub.budget_id
      RETURNING b.id
    `, [fiscalYearId]);

    // Fallback: simple calculation without budget_items table
    await pool.query(`
      UPDATE budgets b
      SET actual_amount = COALESCE(
        (SELECT SUM(CASE WHEN a.type IN ('expense') THEN ji.debit - ji.credit
                          WHEN a.type IN ('revenue') THEN ji.credit - ji.debit
                          ELSE 0 END)
         FROM journal_items ji
         JOIN journal_entries je ON ji.journal_entry_id = je.id
         JOIN accounts a ON ji.account_id = a.id
         WHERE ji.account_id = b.account_id
           AND je.status = 'posted'
           AND je.date >= (SELECT start_date FROM fiscal_years WHERE id = $1)
           AND je.date <= (SELECT end_date FROM fiscal_years WHERE id = $1)
      ), 0),
      updated_at = NOW()
      WHERE b.fiscal_year_id = $1
    `, [fiscalYearId]);

    return result.rows.length;
  } catch (e) {
    console.error("[AutoPosting] Budget recalculation error:", e);
    return 0;
  }
}

// ═══════════════════════════════════════
// 12. PRODUCTION & MANUFACTURING AUTO-POSTING
// ═══════════════════════════════════════
export async function postProductionEntry(data: {
  orderId?: number | string;
  orderNumber?: string;
  productName: string;
  quantity: number;
  rawWarehouseId?: number;
  finishedWarehouseId?: number;
  totalCost: number;
  costPerUnit?: number;
  deductedMaterialsCount?: number;
  executedBy?: string;
}, transactionClient?: any): Promise<any> {
  const config = await getAccountConfig();
  const period = await getOpenPeriod();
  const cost = parseFloat(String(data.totalCost || 0));
  if (!cost || cost <= 0) return null;
  let orderId = Number(data.orderId);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    if (data.orderNumber) {
      try {
        const ordRes = await (transactionClient || pool).query(
          "SELECT id FROM production_orders WHERE order_number = $1 LIMIT 1",
          [data.orderNumber]
        );
        if (ordRes.rows.length > 0 && ordRes.rows[0].id) {
          orderId = Number(ordRes.rows[0].id);
        } else {
          const runRes = await (transactionClient || pool).query(
            "SELECT id FROM production_runs WHERE order_number = $1 LIMIT 1",
            [data.orderNumber]
          );
          if (runRes.rows.length > 0 && runRes.rows[0].id) {
            orderId = Number(runRes.rows[0].id);
          } else {
            const digits = parseInt(String(data.orderNumber).replace(/[^0-9]/g, ""), 10);
            if (Number.isInteger(digits) && digits > 0) {
              orderId = digits % 2147483647;
            }
          }
        }
      } catch (_) {}
    }
  }
  if (!Number.isInteger(orderId) || orderId <= 0) {
    throw new Error("لا يمكن ترحيل تكلفة الإنتاج بدون معرف أمر إنتاج صحيح");
  }

  // Idempotency: prevent duplicate postings for the same production run/order
  const identifier = String(data.orderNumber || data.orderId || data.productName);
  try {
    // Idempotency must key on the explicit production-order id. The previous
    // `reference LIKE '%order%' OR description LIKE '%order%'` fallback was a
    // substring match over free text: it could match an unrelated order whose
    // reference merely contained the same digits, silently suppressing a
    // legitimate posting. Legacy rows are matched by EXACT reference only.
    const existing = await (transactionClient || pool).query(
      `SELECT * FROM journal_entries
        WHERE (source_type = 'production_order' AND source_id = $1)
           OR (source_type = 'production' AND (reference = $2 OR source_id = $1))
        ORDER BY id DESC LIMIT 1`,
      [orderId, identifier]
    );
    if (existing.rows[0]) return existing.rows[0];
  } catch (_) {}

  // Debit: Finished goods inventory (capitalization of manufactured products)
  const debitAccount = config.finished_goods_inventory || config.inventory_asset;
  // Credit: Raw materials inventory (reduction of raw materials consumed)
  const creditAccount = config.raw_materials_inventory || config.inventory_asset;
  if (!isValidAccountId(debitAccount) || !isValidAccountId(creditAccount)) {
    throw new Error("إعداد حساب مخزون الإنتاج التام أو المواد الخام غير مكتمل");
  }
  if (Number(debitAccount) === Number(creditAccount)) {
    throw new Error("يجب ربط مخزون الإنتاج التام ومخزون المواد الخام بحسابين مختلفين");
  }

  const items: any[] = [
    {
      account_id: debitAccount,
      debit: cost,
      credit: 0,
      notes: `إضافة مخزون إنتاج تام — أمر تشغيل ${data.orderNumber || identifier} (${data.productName} × ${data.quantity})`,
      cost_center_id: null
    },
    {
      account_id: creditAccount,
      debit: 0,
      credit: cost,
      notes: `صرف خامات ومواد أولية للتصنيع — أمر تشغيل ${data.orderNumber || identifier} (${data.deductedMaterialsCount || 0} صنف خامات)`,
      cost_center_id: null
    }
  ];

  const reference = await generateNextReference('production');
  return createSafeEntry({
    date: localTodayYMD(),
    description: `قيد تكاليف إنتاج وتصنيع تلقائي — أمر تشغيل ${data.orderNumber || identifier} (${data.productName} × ${data.quantity})`,
    reference,
    source_type: 'production_order',
    source_id: orderId,
    status: 'posted',
    period_id: period?.id,
    items
  }, transactionClient);
}

// ═══════════════════════════════════════
// 13. MASTER BATCH SYNC ENGINE FOR ALL 5 PILLARS
// (Treasury, Purchases, Suppliers, Production, Sales)
// ═══════════════════════════════════════
export async function syncAllUnpostedTransactions(targetModule?: 'treasury' | 'purchases' | 'suppliers' | 'production' | 'sales' | 'warehouses'): Promise<{
  treasuryPosted: number;
  purchasesPosted: number;
  suppliersPosted: number;
  productionPosted: number;
  salesPosted: number;
  warehousesPosted: number;
  totalEntriesCreated: number;
  details: string[];
}> {
  const report = {
    treasuryPosted: 0,
    purchasesPosted: 0,
    suppliersPosted: 0,
    productionPosted: 0,
    salesPosted: 0,
    warehousesPosted: 0,
    totalEntriesCreated: 0,
    details: [] as string[]
  };

  // 1. TREASURY SYNC
  if (!targetModule || targetModule === 'treasury') {
    try {
      // Find safe transactions not yet posted
      try {
        // Only real cash movements that no other module already posted:
        // 'sale' rows come from POS/invoices (posted by their own module), 'transfer' nets out inside the same cash account
        // and 'cash_drop' is covered by the bank movement itself.
        const unpostedSafes = await pool.query(`
          SELECT st.* FROM safe_transactions st
          WHERE st.type IN ('in', 'out', 'deficit', 'petty_cash')
          AND NOT EXISTS (
            SELECT 1 FROM journal_entries je 
            WHERE je.source_type = 'safe_transaction' AND je.source_id = st.id
          )
          ORDER BY st.id ASC LIMIT 50
        `);

        for (const tx of unpostedSafes.rows) {
          const posted = await postTreasuryEntry({
            id: tx.id,
            amount: tx.amount || 0,
            transaction_type: tx.type === 'in' ? 'cash_in' : 'cash_out',
            notes: tx.notes,
            created_by: tx.user_id,
            source_type: 'safe_transaction',
          });
          if (posted) {
            report.treasuryPosted++;
            report.totalEntriesCreated++;
            report.details.push(`تم ترحيل حركة خزانة #${tx.id} بقيمة ${tx.amount} ج.م`);
          }
        }
      } catch (_) {}

      // Also find treasury_transactions not yet posted
      try {
        const unpostedTreasury = await pool.query(`
          SELECT tt.* FROM treasury_transactions tt
          WHERE tt.status = 'approved'
          AND COALESCE(tt.reference_type, 'general') NOT IN (
            'purchase', 'pos_order', 'custody', 'custody_reimbursement', 'custody_settlement',
            'transfer', 'cost', 'payroll', 'sales', 'sales_invoice', 'supplier_payment', 'sales_return'
          )
          AND NOT EXISTS (
            SELECT 1 FROM journal_entries je 
            WHERE je.source_type = 'treasury' AND je.source_id = tt.id
          )
          AND NOT EXISTS (
            SELECT 1 FROM journal_entries je2 WHERE je2.reference = tt.voucher_number
          )
          ORDER BY tt.id ASC LIMIT 50
        `);

        for (const tt of unpostedTreasury.rows) {
          const posted = await postTreasuryEntry({
            id: tt.id,
            amount: Math.abs(tt.amount || 0),
            transaction_type: tt.transaction_type === 'disbursement' || tt.transaction_type === 'cash_out' || tt.amount < 0 ? 'cash_out' : 'cash_in',
            reference_type: tt.reference_type,
            notes: tt.notes || 'حركة خزينة مركزية',
            created_by: tt.created_by,
          });
          if (posted) {
            report.treasuryPosted++;
            report.totalEntriesCreated++;
            report.details.push(`تم ترحيل حركة خزينة عامة #${tt.id} بقيمة ${Math.abs(tt.amount)} ج.م`);
          }
        }
      } catch (_) {}
    } catch (err: any) {
      console.warn("[BatchSync] Treasury sync warning:", err.message);
    }
  }

  // 2. PURCHASES SYNC
  if (!targetModule || targetModule === 'purchases') {
    try {
      const unpostedPurchases = await pool.query(`
        SELECT p.* FROM purchases p
        WHERE NOT EXISTS (
          SELECT 1 FROM journal_entries je 
          WHERE je.source_type = 'purchase' AND je.source_id = p.id
        )
        ORDER BY p.id ASC LIMIT 50
      `);

      for (const p of unpostedPurchases.rows) {
        const posted = await postPurchaseEntry({
          id: p.id,
          total: p.total_amount || p.total || 0,
          supplier_id: p.supplier_id,
          supplier_name: p.supplier_name,
          payment_method: p.payment_method,
          paid_amount: p.paid_amount,
        });
        if (posted) {
          report.purchasesPosted++;
          report.totalEntriesCreated++;
          report.details.push(`تم ترحيل فاتورة مشتريات #${p.id} بقيمة ${p.total_amount || p.total} ج.م`);
        }
      }
    } catch (err: any) {
      console.warn("[BatchSync] Purchases sync warning:", err.message);
    }
  }

  // 3. SUPPLIER PAYMENTS SYNC
  if (!targetModule || targetModule === 'suppliers') {
    try {
      const unpostedSupplierPayments = await pool.query(`
        SELECT st.*, s.name as supplier_name FROM supplier_transactions st
        LEFT JOIN suppliers s ON st.supplier_id = s.id
        WHERE (st.type = 'payment' OR st.type = 'سداد' OR st.amount < 0)
        AND NOT EXISTS (
          SELECT 1 FROM journal_entries je 
          WHERE je.source_type = 'supplier_payment' AND je.source_id = st.id
        )
        ORDER BY st.id ASC LIMIT 50
      `);

      for (const sp of unpostedSupplierPayments.rows) {
        const posted = await postSupplierPaymentEntry({
          supplier_id: sp.supplier_id,
          supplier_name: sp.supplier_name,
          amount: Math.abs(sp.amount || 0),
          payment_method: sp.payment_method || 'cash',
          transaction_id: sp.id,
        });
        if (posted) {
          report.suppliersPosted++;
          report.totalEntriesCreated++;
          report.details.push(`تم ترحيل سداد مورد #${sp.supplier_id} بقيمة ${Math.abs(sp.amount)} ج.م`);
        }
      }
    } catch (err: any) {
      console.warn("[BatchSync] Supplier payments sync warning:", err.message);
    }
  }

  // 4. PRODUCTION SYNC
  if (!targetModule || targetModule === 'production') {
    try {
      const unpostedProduction = await pool.query(`
        SELECT pr.* FROM production_runs pr
        WHERE NOT EXISTS (
          SELECT 1 FROM journal_entries je 
          WHERE je.source_type = 'production' AND (je.source_id = pr.id OR je.reference LIKE '%' || pr.order_number || '%')
        )
        ORDER BY pr.id ASC LIMIT 50
      `);

      for (const pr of unpostedProduction.rows) {
        const cost = pr.total_cost || (pr.quantity * (pr.cost_per_unit || 0)) || 0;
        if (cost > 0) {
          const posted = await postProductionEntry({
            orderId: pr.id,
            orderNumber: pr.order_number || `PR-${pr.id}`,
            productName: pr.product_name || `منتج #${pr.product_id}`,
            quantity: pr.quantity || 1,
            totalCost: cost,
            costPerUnit: pr.cost_per_unit,
          });
          if (posted) {
            report.productionPosted++;
            report.totalEntriesCreated++;
            report.details.push(`تم ترحيل أمر تشغيل إنتاج #${pr.order_number || pr.id} بقيمة ${cost} ج.م`);
          }
        }
      }
    } catch (err: any) {
      console.warn("[BatchSync] Production sync warning:", err.message);
    }
  }

  // 5. SALES SYNC
  if (!targetModule || targetModule === 'sales') {
    try {
      // Check sales invoices
      const unpostedSalesInvoices = await pool.query(`
        SELECT si.* FROM sales_invoices si
        WHERE NOT EXISTS (
          SELECT 1 FROM journal_entries je 
          WHERE je.source_type = 'sales' AND je.source_id = si.id
        )
        ORDER BY si.id ASC LIMIT 50
      `);

      for (const si of unpostedSalesInvoices.rows) {
        const posted = await postSalesEntry({
          id: si.id,
          total: Number(si.subtotal) || 0,
          discount: Number(si.discount_total) || 0,
          tax_amount: Number(si.tax_total) || 0,
          net_total: Number(si.net_amount) || 0,
          total_cost: Number(si.total_cost) || 0,
          payment_method: si.payment_method || 'cash',
          customer_id: si.customer_id,
          customer_name: si.customer_name,
          branch_id: si.branch_id,
        });
        if (posted) {
          // Link the invoice back to its entry so the sales module shows it as posted.
          await pool.query(
            `UPDATE sales_invoices SET journal_entry_id=$1
              WHERE id=$2 AND (journal_entry_id IS NULL OR journal_entry_id NOT IN (SELECT id FROM journal_entries))`,
            [posted.id, si.id]
          );
          report.salesPosted++;
          report.totalEntriesCreated++;
          report.details.push(`تم ترحيل فاتورة مبيعات #${si.id} بقيمة ${si.net_amount || 0} ج.م`);
        }
      }

      // Also check completed restaurant POS orders
      const unpostedOrders = await pool.query(`
        SELECT o.* FROM orders o
        WHERE o.status IN ('completed', 'delivered')
        AND NOT EXISTS (
          SELECT 1 FROM journal_entries je 
          WHERE je.source_type IN ('restaurant', 'pos') AND je.source_id = o.id
        )
        ORDER BY o.id ASC LIMIT 50
      `);

      for (const o of unpostedOrders.rows) {
        const posted = await postRestaurantOrderEntry({
          id: o.id,
          total: o.total || 0,
          delivery_fee: o.delivery_fee || 0,
          payment_method: o.payment_method || 'cash',
          order_type: o.type || 'dine_in',
          branch_id: o.branch_id,
          customer_name: o.customer_name,
        });
        if (posted) {
          report.salesPosted++;
          report.totalEntriesCreated++;
          report.details.push(`تم ترحيل طلب مبيعات/كاشير #${o.id} بقيمة ${o.total} ج.م`);
        }
      }
    } catch (err: any) {
      console.warn("[BatchSync] Sales sync warning:", err.message);
    }
  }

  // 6. WAREHOUSES & PURCHASE RETURNS SYNC
  if (!targetModule || targetModule === 'warehouses' || targetModule === 'purchases') {
    try {
      // 6a. Inventory Adjustments
      try {
        const unpostedAdj = await pool.query(`
          SELECT ia.* FROM inventory_adjustments ia
          WHERE ia.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.source_type = 'inventory_adjustment' AND je.source_id = ia.id
          )
          ORDER BY ia.id ASC LIMIT 50
        `);

        for (const adj of unpostedAdj.rows) {
          const itemsRes = await pool.query(
            `SELECT * FROM inventory_adjustment_items WHERE adjustment_id = $1`,
            [adj.id]
          );
          const posted = await postInventoryAdjustmentEntry({
            id: adj.id,
            warehouse_id: adj.warehouse_id,
            total_value: adj.total_value,
            type: adj.type,
            items: itemsRes.rows
          });
          if (posted) {
            report.warehousesPosted++;
            report.totalEntriesCreated++;
            report.details.push(`تم ترحيل قيد تسوية مخزنية #${adj.id} بقيمة ${adj.total_value || 0} ج.م`);
          }
        }
      } catch (e: any) {
        console.warn("[BatchSync] Adjustment sync warning:", e.message);
      }

      // 6b. Inventory Wastage
      try {
        const unpostedWaste = await pool.query(`
          SELECT iw.* FROM inventory_wastage iw
          WHERE iw.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.source_type = 'inventory_wastage' AND je.source_id = iw.id
          )
          ORDER BY iw.id ASC LIMIT 50
        `);

        for (const wst of unpostedWaste.rows) {
          const itemsRes = await pool.query(
            `SELECT * FROM inventory_wastage_items WHERE wastage_id = $1`,
            [wst.id]
          );
          const totalCost = Number(wst.total_value || wst.total_cost || itemsRes.rows.reduce((s: number, i: any) => s + Number(i.total_cost || 0), 0));
          const posted = await postWastageEntry({
            id: wst.id,
            wastage_number: wst.wastage_number,
            total_cost: totalCost,
            warehouse_id: wst.warehouse_id,
            items: itemsRes.rows
          });
          if (posted) {
            report.warehousesPosted++;
            report.totalEntriesCreated++;
            report.details.push(`تم ترحيل قيد هالك وتالف مخزني #${wst.id} بقيمة ${totalCost} ج.م`);
          }
        }
      } catch (e: any) {
        console.warn("[BatchSync] Wastage sync warning:", e.message);
      }

      // 6c. Purchase Returns
      try {
        const unpostedReturns = await pool.query(`
          SELECT pr.* FROM purchase_returns pr
          WHERE pr.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.source_type = 'purchase_return' AND je.source_id = pr.id
          )
          ORDER BY pr.id ASC LIMIT 50
        `);

        for (const ret of unpostedReturns.rows) {
          const posted = await postPurchaseReturnEntry({
            id: ret.id,
            return_number: ret.return_number,
            total: Number(ret.total_amount || 0),
            supplier_id: ret.supplier_id,
            warehouse_id: ret.warehouse_id,
          });
          if (posted) {
            report.purchasesPosted++;
            report.totalEntriesCreated++;
            report.details.push(`تم ترحيل قيد مرتجع مشتريات #${ret.id} بقيمة ${ret.total_amount} ج.م`);
          }
        }
      } catch (e: any) {
        console.warn("[BatchSync] Purchase returns sync warning:", e.message);
      }

      // 6d. Warehouse Transfers (Freight or Damage costs)
      try {
        const unpostedTransfers = await pool.query(`
          SELECT wt.* FROM warehouse_transfers wt
          WHERE wt.status = 'completed'
          AND (COALESCE(wt.shipping_cost, 0) > 0 OR COALESCE(wt.total_cost, 0) > 0)
          AND NOT EXISTS (
            SELECT 1 FROM journal_entries je
            WHERE je.source_type = 'warehouse_transfer' AND je.source_id = wt.id
          )
          ORDER BY wt.id ASC LIMIT 50
        `);

        for (const trf of unpostedTransfers.rows) {
          const posted = await postWarehouseTransferEntry({
            id: trf.id,
            transfer_number: trf.transfer_number,
            shipping_cost: Number(trf.shipping_cost || 0),
            from_warehouse_id: trf.from_warehouse_id,
            to_warehouse_id: trf.to_warehouse_id,
          });
          if (posted) {
            report.warehousesPosted++;
            report.totalEntriesCreated++;
            report.details.push(`تم ترحيل قيد تكلفة تحويل مخزني #${trf.id}`);
          }
        }
      } catch (e: any) {
        console.warn("[BatchSync] Transfers sync warning:", e.message);
      }
    } catch (err: any) {
      console.warn("[BatchSync] Warehouse module sync error:", err.message);
    }
  }

  return report;
}

export { getAccountConfig, getOpenPeriod, generateNextReference };