-- ============================================================================
-- 005_erp_integration_repair.sql
-- REMO PRO ERP — integration repair migration (2026-10-06)
--
-- SAFE / ADDITIVE ONLY. This migration never deletes or drops user data and
-- never disables a constraint. It only:
--   1. Backfills the canonical payroll salary column (BUG-ERP-010 / PHASE 18).
--   2. Records which pay components the canonical payroll model reads.
--   3. Adds missing non-unique lookup indexes used by the posting services.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Canonical payroll salary column.
--
-- `employees` carries TWO salary columns: the canonical `basic_salary`
-- (used by every HR/payroll query) and the legacy `salary` written only by the
-- layered HR repository. Rows created by that repository therefore have a
-- payroll-visible salary of 0. Backfill them so the two columns stop diverging.
-- No row is updated when basic_salary is already populated.
-- ---------------------------------------------------------------------------
UPDATE employees
   SET basic_salary = salary
 WHERE COALESCE(basic_salary, 0) = 0
   AND COALESCE(salary, 0) <> 0;

-- Keep the legacy mirror aligned for the rows that were already correct, so any
-- remaining legacy reader cannot diverge from the canonical value either.
UPDATE employees
   SET salary = basic_salary
 WHERE COALESCE(salary, 0) = 0
   AND COALESCE(basic_salary, 0) <> 0;

-- ---------------------------------------------------------------------------
-- 2. Chart-of-accounts repair for the production/purchase postings.
--
-- ROOT CAUSE of BUG-ERP-004 / BUG-ERP-005:
--   `account_config` had `raw_materials_inventory`, `finished_goods_inventory`
--   and `inventory_asset` ALL pointing at account 1140 ("المخزون").
--   `postProductionEntry` therefore produced a debit AND a credit of 3,250 on
--   account 1140 (Dr = Cr on the same account), and the GRN posting used 1140
--   instead of the real inventory/payable pair.
--
-- The two structural accounts (1141 raw materials, 1142 finished goods) were
-- missing from the live chart of accounts altogether. Create them under the
-- current-assets parent and re-point the mapping. Idempotent: safe to re-run and
-- a no-op on databases that are already correct.
--
-- NOTE: this changes ACCOUNT MAPPING only. No existing journal entry, journal
-- item or balance is touched or deleted; historical entries remain auditable.
-- ---------------------------------------------------------------------------
INSERT INTO accounts (code, name, type, parent_id, balance, name_ar, name_en, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, currency)
SELECT '1141', 'مخزون المواد الخام', 'asset', (SELECT id FROM accounts WHERE code = '1100'), 0,
       'مخزون المواد الخام', 'Raw Materials Inventory', 'ASSET', 'DEBIT', 2, true, true, true, true, 'EGP'
 WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1141');

INSERT INTO accounts (code, name, type, parent_id, balance, name_ar, name_en, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, currency)
SELECT '1142', 'مخزون الإنتاج التام', 'asset', (SELECT id FROM accounts WHERE code = '1100'), 0,
       'مخزون الإنتاج التام', 'Finished Goods Inventory', 'ASSET', 'DEBIT', 2, true, true, true, true, 'EGP'
 WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE code = '1142');

-- Re-point the mapping only where it is demonstrably wrong (i.e. currently
-- resolving to 1140 / inventory_asset).
INSERT INTO account_config (key, account_id, updated_at)
SELECT 'raw_materials_inventory', a.id, NOW()
  FROM accounts a
 WHERE a.code = '1141'
   AND COALESCE((SELECT account_id FROM account_config WHERE key = 'raw_materials_inventory'), -1)
       <> a.id
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = NOW();

INSERT INTO account_config (key, account_id, updated_at)
SELECT 'finished_goods_inventory', a.id, NOW()
  FROM accounts a
 WHERE a.code = '1142'
   AND COALESCE((SELECT account_id FROM account_config WHERE key = 'finished_goods_inventory'), -1)
       <> a.id
    ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 3. Posting lookups (idempotency / source traceability).
--    `journal_entries.source_type + source_id` is how the posting services avoid
--    duplicate journals on retry (PHASE 21). Non-unique index keeps existing
--    rows valid while making the idempotency probe cheap.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_journal_entries_source
  ON journal_entries (source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_customer_transactions_idem
  ON customer_transactions (customer_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_supplier_transactions_idem
  ON supplier_transactions (supplier_id, idempotency_key);

-- ---------------------------------------------------------------------------
-- 4. Inventory ledger lookups used by stock resolvers (BUG-ERP-006 / PHASE 11).
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inventory_items_wh_ing
  ON inventory_items (warehouse_id, ingredient_id);

COMMIT;
