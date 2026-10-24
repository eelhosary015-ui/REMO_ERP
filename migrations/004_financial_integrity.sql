-- Stage 4: Accounting / Treasury integrity guardrails.
-- These constraints are intentionally conservative and do not rewrite historical data.

DO $$
BEGIN
  IF to_regclass('public.journal_items') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_journal_items_nonnegative') THEN
      ALTER TABLE journal_items ADD CONSTRAINT ck_journal_items_nonnegative
        CHECK (COALESCE(debit,0) >= 0 AND COALESCE(credit,0) >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_journal_items_one_side') THEN
      ALTER TABLE journal_items ADD CONSTRAINT ck_journal_items_one_side
        CHECK (NOT (COALESCE(debit,0) > 0 AND COALESCE(credit,0) > 0));
    END IF;
  END IF;

  IF to_regclass('public.safe_transactions') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_safe_transactions_amount_nonnegative') THEN
      ALTER TABLE safe_transactions ADD CONSTRAINT ck_safe_transactions_amount_nonnegative
        CHECK (amount >= 0);
    END IF;
  END IF;

  IF to_regclass('public.treasury_transactions') IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_treasury_transactions_amount_finite') THEN
      ALTER TABLE treasury_transactions ADD CONSTRAINT ck_treasury_transactions_amount_finite
        CHECK (amount = amount);
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_journal_entries_source
  ON journal_entries (source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_safe_transactions_reference
  ON safe_transactions (reference_id, timestamp DESC)
  WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_treasury_transactions_reference
  ON treasury_transactions (reference_type, reference_id, created_at DESC)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;
