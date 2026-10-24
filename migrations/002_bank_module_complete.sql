-- Complete Bank Management schema for ERP
-- Idempotent migration: safe to run repeatedly.

CREATE TABLE IF NOT EXISTS banks (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) UNIQUE NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  swift_code VARCHAR(20),
  country_code VARCHAR(2) DEFAULT 'EG',
  currency_code VARCHAR(10) DEFAULT 'EGP',
  phone VARCHAR(50),
  email VARCHAR(255),
  website TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_branches (
  id SERIAL PRIMARY KEY,
  bank_id INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  branch_code VARCHAR(50),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  manager_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(bank_id, branch_code)
);

CREATE TABLE IF NOT EXISTS bank_account_types (
  code VARCHAR(30) PRIMARY KEY,
  name_ar VARCHAR(100) NOT NULL,
  name_en VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO bank_account_types(code,name_ar,name_en) VALUES
('current','حساب جاري','Current Account'),
('savings','حساب توفير','Savings Account'),
('deposit','وديعة','Deposit'),
('call_deposit','وديعة تحت الطلب','Call Deposit'),
('credit','حساب ائتماني','Credit Account'),
('loan','حساب قرض','Loan Account'),
('other','أخرى','Other')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS bank_accounts_ext (
  id SERIAL PRIMARY KEY,
  bank_id INTEGER REFERENCES banks(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES bank_branches(id) ON DELETE SET NULL,
  company_id INTEGER,
  system_bank_account_id INTEGER UNIQUE REFERENCES bank_accounts(id) ON DELETE CASCADE,
  account_code VARCHAR(50) UNIQUE,
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(100),
  iban VARCHAR(100),
  swift_code VARCHAR(20),
  account_type VARCHAR(30) NOT NULL DEFAULT 'current' REFERENCES bank_account_types(code),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EGP',
  opening_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  current_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  available_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  credit_limit NUMERIC(20,4) NOT NULL DEFAULT 0,
  overdraft_limit NUMERIC(20,4) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(10,6) NOT NULL DEFAULT 0,
  opening_date DATE,
  closing_date DATE,
  gl_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  branch_company_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_transaction_categories (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name_ar VARCHAR(150) NOT NULL,
  name_en VARCHAR(150),
  direction VARCHAR(10) NOT NULL CHECK(direction IN ('credit','debit','both')),
  accounting_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO bank_transaction_categories(code,name_ar,name_en,direction) VALUES
('deposit','إيداع','Deposit','credit'),
('withdrawal','سحب','Withdrawal','debit'),
('transfer','تحويل بنكي','Bank Transfer','both'),
('customer_receipt','تحصيل عميل','Customer Receipt','credit'),
('supplier_payment','سداد مورد','Supplier Payment','debit'),
('payroll','رواتب','Payroll','debit'),
('bank_fee','عمولة بنكية','Bank Fee','debit'),
('interest_income','فوائد دائنة','Interest Income','credit'),
('interest_expense','فوائد مدينة','Interest Expense','debit'),
('loan_drawdown','سحب قرض','Loan Drawdown','credit'),
('loan_repayment','سداد قرض','Loan Repayment','debit'),
('adjustment','تسوية/تعديل','Adjustment','both'),
('other','أخرى','Other','both')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS bank_transactions_ext (
  id SERIAL PRIMARY KEY,
  bank_transaction_id INTEGER UNIQUE REFERENCES bank_transactions(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  category_id INTEGER REFERENCES bank_transaction_categories(id) ON DELETE SET NULL,
  transaction_no VARCHAR(80) UNIQUE,
  value_date DATE,
  posting_date DATE,
  amount NUMERIC(20,4) NOT NULL CHECK(amount >= 0),
  direction VARCHAR(10) NOT NULL CHECK(direction IN ('credit','debit')),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EGP',
  exchange_rate NUMERIC(20,8) NOT NULL DEFAULT 1,
  base_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  beneficiary_name VARCHAR(255),
  beneficiary_account VARCHAR(100),
  external_reference VARCHAR(150),
  cheque_number VARCHAR(100),
  payment_method VARCHAR(30),
  source_module VARCHAR(50),
  source_type VARCHAR(50),
  source_id INTEGER,
  cost_center_id INTEGER REFERENCES cost_centers(id) ON DELETE SET NULL,
  journal_entry_id INTEGER REFERENCES journal_entries(id) ON DELETE SET NULL,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK(approval_status IN ('draft','pending','approved','rejected','cancelled')),
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_transfers (
  id SERIAL PRIMARY KEY,
  transfer_no VARCHAR(80) UNIQUE NOT NULL,
  from_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  to_account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  amount NUMERIC(20,4) NOT NULL CHECK(amount > 0),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EGP',
  exchange_rate NUMERIC(20,8) NOT NULL DEFAULT 1,
  transfer_date DATE NOT NULL DEFAULT CURRENT_DATE,
  value_date DATE,
  reference VARCHAR(150),
  purpose TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK(status IN ('draft','pending','approved','posted','rejected','cancelled')),
  outgoing_transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL,
  incoming_transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(from_account_id <> to_account_id)
);

CREATE TABLE IF NOT EXISTS bank_beneficiaries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  bank_id INTEGER REFERENCES banks(id) ON DELETE SET NULL,
  branch_id INTEGER REFERENCES bank_branches(id) ON DELETE SET NULL,
  account_number VARCHAR(100),
  iban VARCHAR(100),
  swift_code VARCHAR(20),
  currency_code VARCHAR(10) DEFAULT 'EGP',
  beneficiary_type VARCHAR(30) DEFAULT 'supplier',
  supplier_id INTEGER,
  customer_id INTEGER,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_payment_orders (
  id SERIAL PRIMARY KEY,
  payment_no VARCHAR(80) UNIQUE NOT NULL,
  account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  beneficiary_id INTEGER REFERENCES bank_beneficiaries(id) ON DELETE SET NULL,
  amount NUMERIC(20,4) NOT NULL CHECK(amount > 0),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EGP',
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(30) DEFAULT 'transfer',
  purpose TEXT,
  reference VARCHAR(150),
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','pending','approved','executed','rejected','cancelled')),
  transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_statements (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  statement_no VARCHAR(100),
  statement_date DATE,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  opening_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_credits NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_debits NUMERIC(20,4) NOT NULL DEFAULT 0,
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EGP',
  source VARCHAR(30) DEFAULT 'manual',
  file_name TEXT,
  file_hash VARCHAR(128),
  imported_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  imported_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'imported' CHECK(status IN ('draft','imported','reconciled','closed')),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(account_id, period_from, period_to)
);

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id SERIAL PRIMARY KEY,
  statement_id INTEGER NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  line_no INTEGER,
  transaction_date DATE NOT NULL,
  value_date DATE,
  description TEXT,
  reference VARCHAR(150),
  amount NUMERIC(20,4) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK(direction IN ('credit','debit')),
  running_balance NUMERIC(20,4),
  external_id VARCHAR(150),
  matched_transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL,
  reconciliation_status VARCHAR(20) NOT NULL DEFAULT 'unmatched' CHECK(reconciliation_status IN ('unmatched','matched','ignored','adjustment')),
  raw_data JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(statement_id, line_no)
);

CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id SERIAL PRIMARY KEY,
  reconciliation_no VARCHAR(80) UNIQUE NOT NULL,
  account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  statement_id INTEGER REFERENCES bank_statements(id) ON DELETE SET NULL,
  period_from DATE NOT NULL,
  period_to DATE NOT NULL,
  book_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  bank_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  outstanding_debits NUMERIC(20,4) NOT NULL DEFAULT 0,
  outstanding_credits NUMERIC(20,4) NOT NULL DEFAULT 0,
  adjusted_balance NUMERIC(20,4) NOT NULL DEFAULT 0,
  difference NUMERIC(20,4) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','in_progress','balanced','unbalanced','approved','closed')),
  prepared_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  prepared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
  id SERIAL PRIMARY KEY,
  reconciliation_id INTEGER NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
  system_transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL,
  statement_line_id INTEGER REFERENCES bank_statement_lines(id) ON DELETE SET NULL,
  match_type VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK(match_type IN ('auto','manual','adjustment','excluded')),
  difference NUMERIC(20,4) NOT NULL DEFAULT 0,
  notes TEXT,
  matched_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  matched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reconciliation_id, system_transaction_id, statement_line_id)
);

CREATE TABLE IF NOT EXISTS bank_fees (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL,
  fee_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fee_type VARCHAR(50) NOT NULL,
  description TEXT,
  amount NUMERIC(20,4) NOT NULL CHECK(amount >= 0),
  currency_code VARCHAR(10) NOT NULL DEFAULT 'EGP',
  tax_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  total_amount NUMERIC(20,4) NOT NULL DEFAULT 0,
  reference VARCHAR(150),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_interest_entries (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES bank_accounts(id) ON DELETE RESTRICT,
  transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE SET NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  interest_type VARCHAR(20) NOT NULL CHECK(interest_type IN ('credit','debit')),
  rate NUMERIC(10,6) NOT NULL DEFAULT 0,
  amount NUMERIC(20,4) NOT NULL CHECK(amount >= 0),
  period_from DATE,
  period_to DATE,
  reference VARCHAR(150),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_account_limits (
  id SERIAL PRIMARY KEY,
  account_id INTEGER UNIQUE NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  daily_debit_limit NUMERIC(20,4) DEFAULT 0,
  daily_credit_limit NUMERIC(20,4) DEFAULT 0,
  transaction_limit NUMERIC(20,4) DEFAULT 0,
  require_approval_over NUMERIC(20,4) DEFAULT 0,
  allow_negative_balance BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_audit_log (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  action VARCHAR(30) NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ip_address INET,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Complete the legacy bank_accounts table without breaking existing data.
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_id INTEGER;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS bank_branch_id INTEGER;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS account_code VARCHAR(50);
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10) DEFAULT 'EGP';
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS available_balance NUMERIC(20,4) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(20,4) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS overdraft_limit NUMERIC(20,4) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(10,6) DEFAULT 0;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS opening_date DATE;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS closing_date DATE;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS gl_account_id INTEGER;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_banks_active ON banks(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_branches_bank ON bank_branches(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_bank ON bank_accounts(bank_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_branch ON bank_accounts(bank_branch_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_active ON bank_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_bank_tx_account_date ON bank_transactions(account_id, transaction_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_bank_tx_reference ON bank_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_bank_tx_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_tx_source ON bank_transactions(source);
CREATE INDEX IF NOT EXISTS idx_bank_tx_ext_source ON bank_transactions_ext(source_module, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_date ON bank_transfers(transfer_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_from ON bank_transfers(from_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transfers_to ON bank_transfers(to_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_payment_orders_account ON bank_payment_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_bank_payment_orders_status ON bank_payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_bank_statements_account_period ON bank_statements(account_id, period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_statement ON bank_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_bank_statement_lines_match ON bank_statement_lines(matched_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bank_recon_account_period ON bank_reconciliations(account_id, period_from, period_to);
CREATE INDEX IF NOT EXISTS idx_bank_recon_items_recon ON bank_reconciliation_items(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_bank_fees_account_date ON bank_fees(account_id, fee_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_interest_account_date ON bank_interest_entries(account_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_bank_audit_entity ON bank_audit_log(entity_type, entity_id, created_at DESC);

-- Keep legacy and extended balances initialized consistently.
UPDATE bank_accounts SET available_balance = COALESCE(available_balance, balance, 0), currency_code = COALESCE(currency_code, currency, 'EGP') WHERE available_balance IS NULL OR currency_code IS NULL;

INSERT INTO bank_accounts_ext(system_bank_account_id, account_name, account_number, iban, swift_code, currency_code, opening_balance, current_balance, available_balance, branch_company_id, is_active)
SELECT id, name, account_number, iban, swift_code, COALESCE(currency_code, currency, 'EGP'), COALESCE(opening_balance,0), COALESCE(balance,0), COALESCE(available_balance,balance,0), branch_id, COALESCE(is_active,true)
FROM bank_accounts
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts_ext e WHERE e.system_bank_account_id = bank_accounts.id);
