import { pool } from '../../../server-db.js';

/**
 * Final startup hardening pass.
 *
 * This is intentionally idempotent: it can run on every startup and only
 * repairs deterministic schema/data integrity issues. Business transactions
 * are never recreated here.
 */
export async function runERPHardening(): Promise<void> {
  console.log('🛡️ Running ERP data-integrity hardening...');

  // 1) Financial periods: collapse accidental duplicates before creating the
  // unique business key. Journal entries are repointed to the retained row.
  const periodClient = await pool.connect();
  try {
    await periodClient.query('BEGIN');
    const dupes = await periodClient.query(`
      SELECT month, year, MIN(id) AS keep_id, ARRAY_AGG(id ORDER BY id) AS ids
      FROM financial_periods GROUP BY month, year HAVING COUNT(*) > 1
    `);
    for (const row of dupes.rows) {
      const keepId = Number(row.keep_id);
      const duplicateIds = (row.ids || []).map(Number).filter((id: number) => id !== keepId);
      if (duplicateIds.length) {
        await periodClient.query(`UPDATE journal_entries SET period_id=$1 WHERE period_id = ANY($2::int[])`, [keepId, duplicateIds]);
        await periodClient.query(`DELETE FROM financial_periods WHERE id = ANY($1::int[])`, [duplicateIds]);
      }
    }
    await periodClient.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_periods_month_year ON financial_periods(month, year)`);
    await periodClient.query('COMMIT');
  } catch (e) {
    await periodClient.query('ROLLBACK').catch(() => {});
    console.warn('⚠️ Financial-period hardening skipped:', (e as Error).message);
  } finally {
    periodClient.release();
  }

  // 2) Item master: every ingredient gets a stable unique code. Existing
  // duplicate codes are preserved for the first record and suffixed for later
  // records so references by numeric id remain intact.
  const ingredientClient = await pool.connect();
  try {
    await ingredientClient.query('BEGIN');
    const missingCodes = await ingredientClient.query(`SELECT id FROM ingredients WHERE code IS NULL OR BTRIM(code) = '' ORDER BY id`);
    for (const row of missingCodes.rows) {
      const code = `ITEM-${String(row.id).padStart(6, '0')}`;
      await ingredientClient.query(`UPDATE ingredients SET code=$1, item_code=COALESCE(NULLIF(BTRIM(item_code),''),$1) WHERE id=$2`, [code, row.id]);
    }
    const dupes = await ingredientClient.query(`
      SELECT code, ARRAY_AGG(id ORDER BY id) AS ids
      FROM ingredients WHERE code IS NOT NULL AND BTRIM(code) <> ''
      GROUP BY code HAVING COUNT(*) > 1
    `);
    for (const row of dupes.rows) {
      const ids = (row.ids || []).map(Number);
      for (const id of ids.slice(1)) {
        const newCode = `${String(row.code).slice(0, 38)}-${id}`;
        await ingredientClient.query(`UPDATE ingredients SET code=$1, item_code=CASE WHEN item_code IS NULL OR BTRIM(item_code) = $2 THEN $1 ELSE item_code END WHERE id=$3`, [newCode, String(row.code), id]);
      }
    }
    await ingredientClient.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_ingredients_code ON ingredients(code) WHERE code IS NOT NULL AND BTRIM(code) <> ''`);
    await ingredientClient.query('COMMIT');
  } catch (e) {
    await ingredientClient.query('ROLLBACK').catch(() => {});
    console.warn('⚠️ Ingredient-code hardening skipped:', (e as Error).message);
  } finally {
    ingredientClient.release();
  }

  // 3) Required user fields.
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'`);
    await pool.query(`UPDATE users SET name=COALESCE(NULLIF(BTRIM(name),''), username) WHERE name IS NULL OR BTRIM(name)=''`);
    await pool.query(`UPDATE users SET status='active' WHERE status IS NULL OR BTRIM(status)=''`);
  } catch (e) {
    console.warn('⚠️ User-field hardening skipped:', (e as Error).message);
  }

  // 4) Repair malformed legacy sales invoices. Existing orphan invoices are
  // linked to a dedicated cash customer; new invoices are still validated by
  // the sales repository and cannot be saved without a customer.
  try {
    const cashCustomer = await pool.query(`
      INSERT INTO customers(name, phone) VALUES('عميل نقدي','0000000000')
      ON CONFLICT(phone) DO UPDATE SET name=customers.name
      RETURNING id
    `);
    const cashCustomerId = Number(cashCustomer.rows[0]?.id || 0);
    if (cashCustomerId) {
      await pool.query(`UPDATE sales_invoices SET customer_id=$1 WHERE customer_id IS NULL`, [cashCustomerId]);
    }

    await pool.query(`
      UPDATE sales_invoice_items it
      SET ingredient_id = src.id
      FROM ingredients src
      WHERE it.ingredient_id IS NULL
        AND ((it.code IS NOT NULL AND (src.code=it.code OR src.item_code=it.code OR src.barcode=it.code))
          OR (it.name IS NOT NULL AND src.name ILIKE it.name))
    `);
  } catch (e) {
    console.warn('⚠️ Legacy sales-data hardening skipped:', (e as Error).message);
  }

  // 5) Repair malformed legacy sales-invoice status values. This does not
  // invent accounting transactions; it derives the state from paid/net totals.
  try {
    await pool.query(`
      UPDATE sales_invoices
      SET status = CASE
        WHEN COALESCE(paid_amount,0) >= COALESCE(net_amount,0) AND COALESCE(net_amount,0) > 0 THEN 'مدفوعة'
        WHEN COALESCE(paid_amount,0) > 0 THEN 'مدفوعة جزئياً'
        ELSE 'غير مدفوعة'
      END
      WHERE status ILIKE 'CASE WHEN%' OR status ILIKE '%paid_amount%'
    `);
  } catch (e) {
    console.warn('⚠️ Sales-invoice status hardening skipped:', (e as Error).message);
  }

  // 6) Customer transaction dates must never be null for new/reporting rows.
  try {
    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='customer_transactions' AND column_name IN ('date','created_at','timestamp')`);
    const names = new Set(cols.rows.map((r:any) => r.column_name));
    if (!names.has('date')) {
      await pool.query(`ALTER TABLE customer_transactions ADD COLUMN date TIMESTAMP`);
      names.add('date');
    }
    const fallback = names.has('timestamp') ? 'timestamp' : (names.has('created_at') ? 'created_at' : 'CURRENT_TIMESTAMP');
    await pool.query(`UPDATE customer_transactions SET date=COALESCE(date,${fallback})`);
  } catch (e) {
    console.warn('⚠️ Customer-transaction date hardening skipped:', (e as Error).message);
  }

  // 7) Seed role permissions only when a role has no explicit permissions.
  // Admin remains unrestricted; all other roles receive least-privilege defaults.
  try {
    const roleModules: Record<string, string[]> = {
      manager: ['inventory','warehouses','purchases','suppliers','sales','customers','production','restaurant','pos','reports','treasury'],
      accountant: ['accounting','treasury','costs','reports','customers','suppliers'],
      cashier: ['pos','sales','customers'],
      inventory_keeper: ['inventory','warehouses','products','reports'],
      purchasing: ['purchases','suppliers','inventory','reports'],
      hr_manager: ['hr','payroll','attendance','reports'],
      production_manager: ['production','inventory','warehouses','products','reports'],
      viewer: ['reports'],
    };
    for (const [roleName, modules] of Object.entries(roleModules)) {
      const role = await pool.query(`SELECT id FROM roles WHERE name=$1 LIMIT 1`, [roleName]);
      if (!role.rows.length) continue;
      const roleId = Number(role.rows[0].id);
      const count = await pool.query(`SELECT COUNT(*)::int AS c FROM role_permissions WHERE role_id=$1`, [roleId]);
      if (Number(count.rows[0].c) > 0) continue;

      for (const moduleKey of modules) {
        const actions = moduleKey === 'reports' || roleName === 'viewer'
          ? ['view','export']
          : roleName === 'cashier'
            ? ['view','create','update']
            : ['view','create','update','delete'];
        for (const action of actions) {
          await pool.query(`
            INSERT INTO role_permissions(role_id, permission_key, is_granted)
            VALUES($1,$2,true) ON CONFLICT(role_id,permission_key) DO NOTHING
          `, [roleId, `${moduleKey}.${action}`]);
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ RBAC hardening skipped:', (e as Error).message);
  }

  // 8) Ensure accounting configuration points to real leaf accounts.
  try {
    const mappings: Record<string,string> = {
      cash:'1101', bank:'1101', accounts_receivable:'1102', inventory_asset:'1103',
      employee_advances:'1104', accounts_payable:'2101', tax_payable:'2103',
      sales_revenue:'4102', food_revenue:'4101', delivery_revenue:'4103',
      sales_discount:'4201', sales_returns:'4202', cost_of_goods_sold:'5101',
      payroll_expense:'5102', rent_expense:'5103', utilities_expense:'5104',
      maintenance_expense:'5105', marketing_expense:'5106', supplies_expense:'5107',
      insurance_expense:'5108', transport_expense:'5109', cost_expense:'5110',
      other_expense:'5110', refund_expense:'5111', retained_earnings_account:'3102',
      income_summary_account:'3103'
    };
    for (const [key, code] of Object.entries(mappings)) {
      const acc = await pool.query(`SELECT id FROM accounts WHERE code=$1 LIMIT 1`, [code]);
      if (acc.rows[0]?.id) {
        await pool.query(`INSERT INTO account_config(key,account_id,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET account_id=EXCLUDED.account_id,updated_at=NOW()`, [key, Number(acc.rows[0].id)]);
      }
    }
  } catch (e) {
    console.warn('⚠️ Account-config hardening skipped:', (e as Error).message);
  }

  // 9) Recalculate account balances from posted journal items. This repairs
  // stale zero balances without fabricating entries.
  try {
    await pool.query(`
      UPDATE accounts a
      SET balance = COALESCE(x.balance,0)
      FROM (
        SELECT ji.account_id, SUM(COALESCE(ji.debit,0)-COALESCE(ji.credit,0)) AS balance
        FROM journal_items ji
        JOIN journal_entries je ON je.id=ji.journal_entry_id
        WHERE COALESCE(je.status,'posted')='posted'
        GROUP BY ji.account_id
      ) x
      WHERE a.id=x.account_id
    `);
  } catch (e) {
    console.warn('⚠️ Account-balance recalculation skipped:', (e as Error).message);
  }

  console.log('✅ ERP data-integrity hardening completed.');
}
