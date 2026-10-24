-- =============================================================================
-- Migration: 001_treasury_closings.sql
-- Module: Treasury & Cash Verification (Remo Pro ERP Enterprise)
-- Description: Daily Treasury Closing and Physical Cash Verification Schema
-- =============================================================================

-- 1. Create Enum for Treasury Closing Status if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'treasury_closing_status') THEN
        CREATE TYPE treasury_closing_status AS ENUM (
            'Matched',
            'Deficit - Pending Review',
            'Surplus - Pending Review',
            'Settled',
            'Reopened'
        );
    END IF;
END $$;

-- 2. Create the treasury_closings Table
CREATE TABLE IF NOT EXISTS treasury_closings (
    id SERIAL PRIMARY KEY,
    treasury_id INTEGER NOT NULL REFERENCES treasury_accounts(id) ON DELETE RESTRICT,
    closing_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_deposits NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    total_withdrawals NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    book_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    actual_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    variance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    responsible_user VARCHAR(150) NOT NULL,
    responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Matched',
    notes TEXT,
    denominations JSONB NOT NULL DEFAULT '{}'::jsonb,
    journal_entry_id INTEGER,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Strategic Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_treasury_closings_treasury_id ON treasury_closings(treasury_id);
CREATE INDEX IF NOT EXISTS idx_treasury_closings_closing_date ON treasury_closings(closing_date DESC);
CREATE INDEX IF NOT EXISTS idx_treasury_closings_status ON treasury_closings(status);
CREATE INDEX IF NOT EXISTS idx_treasury_closings_variance ON treasury_closings(variance);
CREATE INDEX IF NOT EXISTS idx_treasury_closings_combined ON treasury_closings(treasury_id, closing_date DESC);

-- 4. Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_treasury_closings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_treasury_closings_updated_at ON treasury_closings;
CREATE TRIGGER trg_update_treasury_closings_updated_at
BEFORE UPDATE ON treasury_closings
FOR EACH ROW
EXECUTE FUNCTION update_treasury_closings_updated_at();

-- Comment on table and columns
COMMENT ON TABLE treasury_closings IS 'Enterprise Daily Treasury Closing, Cash Denomination Breakdown and Cash Verification Audit Ledger';
COMMENT ON COLUMN treasury_closings.treasury_id IS 'Foreign key to treasury_accounts';
COMMENT ON COLUMN treasury_closings.book_balance IS 'Calculated expected ledger balance from opening + deposits - withdrawals';
COMMENT ON COLUMN treasury_closings.actual_balance IS 'Sum of physical cash counted via denominations';
COMMENT ON COLUMN treasury_closings.variance IS 'actual_balance - book_balance. Zero means Matched, negative is Deficit, positive is Surplus';
COMMENT ON COLUMN treasury_closings.denominations IS 'JSON document storing detailed breakdown count per cash denomination (200, 100, 50, 20, 10, 5, 1, 0.5, coins)';
