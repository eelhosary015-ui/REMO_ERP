-- ============================================================
-- إصلاحات الفحص التقني الشامل — 2026-10-21
-- الغرض: إنشاء الجداول المفقودة وإضافة الأعمدة الناقصة
-- آمن: كله إضافي (IF NOT EXISTS) ولا يحذف أي بيانات
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- ISSUE-09: أعمدة ناقصة في bank_beneficiaries
-- (الاستعلامات تستخدم code, bank_id, branch_id … وهي غير موجودة)
-- ────────────────────────────────────────────────────────────
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS code VARCHAR(50);
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS bank_id INTEGER;
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS branch_id INTEGER;
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'EGP';
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS supplier_id INTEGER;
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS customer_id INTEGER;
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS email VARCHAR(150);
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE bank_beneficiaries ADD COLUMN IF NOT EXISTS created_by INTEGER;

-- ────────────────────────────────────────────────────────────
-- ISSUE-04: stock_batches — تتبّع دفعات المخزون والصلاحية
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_batches (
  id SERIAL PRIMARY KEY,
  ingredient_id INTEGER,
  warehouse_id INTEGER,
  batch_number VARCHAR(120),
  received_date DATE,
  expiry_date DATE,
  quantity NUMERIC(14,4) DEFAULT 0,
  original_quantity NUMERIC(14,4) DEFAULT 0,
  cost NUMERIC(14,4) DEFAULT 0,
  supplier_id INTEGER,
  status VARCHAR(30) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_stock_batches_ingredient ON stock_batches(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_warehouse ON stock_batches(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_batches_expiry ON stock_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_stock_batches_status ON stock_batches(status);

-- ────────────────────────────────────────────────────────────
-- ISSUE-04: stock_balances — أرصدة المخزون لكل مخزن/صنف
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_balances (
  id SERIAL PRIMARY KEY,
  warehouse_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_stock_balances_wh_product UNIQUE (warehouse_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_balances_warehouse ON stock_balances(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_balances_product ON stock_balances(product_id);

-- ────────────────────────────────────────────────────────────
-- ISSUE-04: inventory_notifications — إشعارات نقص المخزون والصلاحية
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  ingredient_id INTEGER,
  warehouse_id INTEGER,
  batch_id INTEGER,
  message TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_notifications_unread ON inventory_notifications(read);
CREATE INDEX IF NOT EXISTS idx_inventory_notifications_ingredient ON inventory_notifications(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_notifications_batch ON inventory_notifications(batch_id);

-- ────────────────────────────────────────────────────────────
-- ISSUE-04: supplier_ratings — تقييم الموردين
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_ratings (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL,
  rating NUMERIC(3,2),
  criteria JSONB,
  comment TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_supplier_ratings_supplier ON supplier_ratings(supplier_id);

-- ────────────────────────────────────────────────────────────
-- ISSUE-04: customer_ratings — تقييم العملاء (المطاعم)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_ratings (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER,
  table_number VARCHAR(30),
  rating INTEGER,
  feedback TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_ratings_branch ON customer_ratings(branch_id);

COMMIT;
