-- Supplier Enterprise Upgrade
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS name_en TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS tax_registration_date DATE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS assigned_user_id INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'approved';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS approved_by INTEGER;

ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS document_number TEXT;
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'posted';
ALTER TABLE supplier_transactions ADD COLUMN IF NOT EXISTS created_by INTEGER;

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EGP';
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';

UPDATE suppliers SET supplier_code='SUP-'||LPAD(id::text,6,'0') WHERE supplier_code IS NULL;
UPDATE purchases SET payment_status=CASE WHEN COALESCE(paid_amount,0)>=total_amount THEN 'paid' WHEN COALESCE(paid_amount,0)>0 THEN 'partially_paid' ELSE 'unpaid' END;
UPDATE purchases p SET due_date=CASE s.payment_terms WHEN 'credit_30' THEN p.date::date+30 WHEN 'credit_60' THEN p.date::date+60 WHEN 'credit_90' THEN p.date::date+90 ELSE p.date::date END FROM suppliers s WHERE s.id=p.supplier_id AND p.due_date IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_supplier_code ON suppliers(supplier_code) WHERE supplier_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_due_date ON purchases(supplier_id,due_date);

CREATE TABLE IF NOT EXISTS supplier_contacts (
 id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
 name TEXT NOT NULL, job_title TEXT, phone TEXT, mobile TEXT, email TEXT, is_primary BOOLEAN DEFAULT false, notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supplier_bank_accounts (
 id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
 bank_name TEXT NOT NULL, account_name TEXT, account_number TEXT, iban TEXT, swift TEXT, branch TEXT, currency TEXT DEFAULT 'EGP', is_default BOOLEAN DEFAULT false, notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supplier_documents (
 id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
 document_type TEXT NOT NULL, document_number TEXT, file_name TEXT, file_url TEXT, issue_date DATE, expiry_date DATE, status TEXT DEFAULT 'active', notes TEXT,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
 id SERIAL PRIMARY KEY, payment_transaction_id INTEGER NOT NULL REFERENCES supplier_transactions(id) ON DELETE CASCADE,
 purchase_id INTEGER REFERENCES purchases(id) ON DELETE SET NULL, allocated_amount DECIMAL(12,2) NOT NULL CHECK (allocated_amount>0), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS supplier_evaluations (
 id SERIAL PRIMARY KEY, supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
 evaluation_date DATE DEFAULT CURRENT_DATE, quality_score DECIMAL(5,2) DEFAULT 0, delivery_score DECIMAL(5,2) DEFAULT 0,
 price_score DECIMAL(5,2) DEFAULT 0, service_score DECIMAL(5,2) DEFAULT 0, overall_score DECIMAL(5,2) DEFAULT 0, notes TEXT, created_by INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Supplier document binary storage (database-backed)
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS file_data BYTEA;
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS checksum_sha256 TEXT;
ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS uploaded_by INTEGER;
CREATE INDEX IF NOT EXISTS idx_supplier_documents_supplier_id ON supplier_documents(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_documents_expiry_date ON supplier_documents(expiry_date);
