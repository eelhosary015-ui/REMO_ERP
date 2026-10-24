-- ═══════════════════════════════════════════════════════════════════════════
-- REMO PRO ERP — إقرارات الفترات الضريبية (صفحة الضرائب — الحسابات العامة)
-- التاريخ: 2026-10-22
-- الغرض: حفظ حالة كل فترة ضريبية (شهر) وملاحظاتها وتاريخ تقديمها وأرقامها
-- اليدوية، بدلاً من تعديل الواجهة في الذاكرة فقط وفقدان البيانات عند التحديث.
-- إضافي وآمن بالكامل: CREATE TABLE/INDEX IF NOT EXISTS — لا يمس أي جدول قائم.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS tax_period_declarations (
  id                    SERIAL PRIMARY KEY,
  period_year           INTEGER NOT NULL,
  period_month          INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status                VARCHAR(20) NOT NULL DEFAULT 'not_submitted'
                        CHECK (status IN ('not_submitted','submitted','paid')),
  submission_date       DATE,
  output_tax            NUMERIC(18,2) NOT NULL DEFAULT 0,
  input_tax             NUMERIC(18,2) NOT NULL DEFAULT 0,
  sales_return_tax      NUMERIC(18,2) NOT NULL DEFAULT 0,
  purchases_return_tax  NUMERIC(18,2) NOT NULL DEFAULT 0,
  notes                 TEXT,
  is_manual             BOOLEAN NOT NULL DEFAULT false,
  created_by            INTEGER,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_tax_period_declaration UNIQUE (period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_tax_period_declarations_year
  ON tax_period_declarations (period_year);

COMMIT;
