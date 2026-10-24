-- ═══════════════════════════════════════════════════════════════════════════
-- REMO PRO ERP — سجل الأصول الثابتة المرتبط بالفروع والموظفين ودفتر الأستاذ
-- التاريخ: 2026-10-20
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS fixed_assets (
  id                            SERIAL PRIMARY KEY,
  asset_code                    VARCHAR(60),
  name                          TEXT NOT NULL,
  category                      TEXT,
  serial_number                 TEXT,
  location                      TEXT,
  company_id                    INTEGER,
  branch_id                     INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  employee_id                   INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  cost_center_id                INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
  purchase_date                 DATE,
  operation_date                DATE,
  purchase_cost                 NUMERIC(18,2) DEFAULT 0,
  salvage_value                 NUMERIC(18,2) DEFAULT 0,
  useful_life_years             NUMERIC(6,2) DEFAULT 0,
  depreciation_rate             NUMERIC(6,2) DEFAULT 0,
  depreciation_method           TEXT DEFAULT 'straight_line',
  accumulated_depreciation      NUMERIC(18,2) DEFAULT 0,
  net_value                     NUMERIC(18,2) DEFAULT 0,
  status                        TEXT DEFAULT 'active',
  gl_asset_account_id           INTEGER REFERENCES accounts(id),
  gl_accumulated_id             INTEGER REFERENCES accounts(id),
  gl_depreciation_expense_id    INTEGER REFERENCES accounts(id),
  acquisition_entry_id          INTEGER,
  disposal_entry_id             INTEGER,
  last_depreciation_date        DATE,
  notes                         TEXT,
  created_by                    INTEGER,
  created_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fa_branch  ON fixed_assets (branch_id);
CREATE INDEX IF NOT EXISTS idx_fa_employee ON fixed_assets (employee_id);
CREATE INDEX IF NOT EXISTS idx_fa_status  ON fixed_assets (status);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fa_code ON fixed_assets (asset_code) WHERE asset_code IS NOT NULL;

-- منع تكرار قيود الأصل الواحد
CREATE UNIQUE INDEX IF NOT EXISTS ux_je_asset_acquisition
  ON journal_entries (source_type, source_id) WHERE source_type = 'asset_acquisition';
CREATE UNIQUE INDEX IF NOT EXISTS ux_je_asset_disposal
  ON journal_entries (source_type, source_id) WHERE source_type = 'asset_disposal';
CREATE UNIQUE INDEX IF NOT EXISTS ux_je_asset_depreciation
  ON journal_entries (source_type, reference) WHERE source_type = 'asset_depreciation';

COMMIT;
