-- ═══════════════════════════════════════════════════════════════════════════
-- REMO PRO ERP — تقوية إقفال الفترات المالية والسنة المالية
-- التاريخ: 2026-10-19
--
-- هذا الملف idempotent: يمكن تشغيله أكثر من مرة بأمان.
-- لا يحذف أي قيد ولا يغيّر أي مبلغ؛ العمليات على البيانات محدودة بـ:
--   1) تصحيح start_date/end_date للفترات لتطابق حدود الشهر الميلادي.
--   2) تعبئة journal_entries.period_id حيث كان NULL ومطابقًا لفترة معروفة.
--
-- التراجع: migrations/2026-10-19-period-closing-hardening-rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────
-- 1) سجل أحداث الإقفال وإعادة الفتح (من يحتاج ماذا ومتى ولماذا)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS financial_period_events (
  id              SERIAL PRIMARY KEY,
  scope           VARCHAR(20) NOT NULL,           -- 'period' | 'fiscal_year'
  period_id       INTEGER REFERENCES financial_periods(id) ON DELETE SET NULL,
  fiscal_year_id  INTEGER REFERENCES fiscal_years(id) ON DELETE SET NULL,
  action          VARCHAR(30) NOT NULL,           -- close | reopen | year_close | year_reopen | close_blocked
  from_status     VARCHAR(20),
  to_status       VARCHAR(20),
  reason          TEXT,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name       TEXT,
  amount          NUMERIC(18, 2),                 -- نتيجة السنة عند الإقفال السنوي
  entry_ids       INTEGER[],                      -- القيود التي أنشأها الإجراء
  details         JSONB DEFAULT '{}'::jsonb,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fpe_period      ON financial_period_events (period_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fpe_fiscal_year ON financial_period_events (fiscal_year_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fpe_action      ON financial_period_events (action, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 2) أعمدة تتبّع الإقفال وإعادة الفتح
-- ─────────────────────────────────────────────────────────────
ALTER TABLE financial_periods ADD COLUMN IF NOT EXISTS closed_by     INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE financial_periods ADD COLUMN IF NOT EXISTS close_reason  TEXT;
ALTER TABLE financial_periods ADD COLUMN IF NOT EXISTS reopened_at   TIMESTAMP;
ALTER TABLE financial_periods ADD COLUMN IF NOT EXISTS reopened_by   INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE financial_periods ADD COLUMN IF NOT EXISTS reopen_reason TEXT;

ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS closed_by       INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS close_reason    TEXT;
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS reopened_at     TIMESTAMP;
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS reopened_by     INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS reopen_reason   TEXT;
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS closing_entry_id INTEGER;
ALTER TABLE fiscal_years ADD COLUMN IF NOT EXISTS opening_entry_id INTEGER;

-- ─────────────────────────────────────────────────────────────
-- 3) تصحيح تواريخ الفترات
--    السبب: التوليد كان يستخدم toISOString() على توقيت القاهرة (UTC+3)،
--    فكانت end_date تنتهي قبل آخر يوم من الشهر (مثال: 31/10 ← 30/10)،
--    وبالتالي تسقط حركات آخر يوم خارج أي فترة.
-- ─────────────────────────────────────────────────────────────
UPDATE financial_periods
   SET start_date = make_date(year, month, 1)
 WHERE start_date IS DISTINCT FROM make_date(year, month, 1);

UPDATE financial_periods
   SET end_date = (make_date(year, month, 1) + INTERVAL '1 month - 1 day')::date
 WHERE end_date IS DISTINCT FROM (make_date(year, month, 1) + INTERVAL '1 month - 1 day')::date;

-- ─────────────────────────────────────────────────────────────
-- 4) تعبئة period_id الناقص (لا يُغيَّر أي period_id موجود)
-- ─────────────────────────────────────────────────────────────
UPDATE journal_entries je
   SET period_id = fp.id
  FROM financial_periods fp
 WHERE je.period_id IS NULL
   AND je.date IS NOT NULL
   AND je.date::date BETWEEN COALESCE(fp.start_date, make_date(fp.year, fp.month, 1))
                         AND COALESCE(fp.end_date, (make_date(fp.year, fp.month, 1) + INTERVAL '1 month - 1 day')::date);

-- ─────────────────────────────────────────────────────────────
-- 5) فهارس تمنع تكرار قيود الإقفال والأرصدة الافتتاحية
-- ─────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS ux_je_year_end_closing;
CREATE UNIQUE INDEX IF NOT EXISTS ux_je_year_end_closing
  ON journal_entries (source_type, reference)
  WHERE source_type = 'year_end_closing';

CREATE UNIQUE INDEX IF NOT EXISTS ux_je_opening_balance
  ON journal_entries (source_type, source_id)
  WHERE source_type = 'opening_balance';

CREATE INDEX IF NOT EXISTS idx_je_period_date ON journal_entries (period_id, date);

-- ─────────────────────────────────────────────────────────────
-- 6) دالة حل الفترة من تاريخ
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_resolve_financial_period(p_date date)
RETURNS financial_periods
LANGUAGE sql
STABLE
AS $$
  SELECT fp.*
    FROM financial_periods fp
   WHERE p_date BETWEEN COALESCE(fp.start_date, make_date(fp.year, fp.month, 1))
                    AND COALESCE(fp.end_date, (make_date(fp.year, fp.month, 1) + INTERVAL '1 month - 1 day')::date)
   ORDER BY fp.start_date NULLS LAST, fp.id
   LIMIT 1
$$;

-- ─────────────────────────────────────────────────────────────
-- 7) حماية القيود اليومية على مستوى قاعدة البيانات
--    تعمل حتى مع INSERT مباشر من أي مسار أو أي عميل SQL.
--    التجاوز الوحيد: SET LOCAL app.period_lock_bypass = 'on'
--    داخل معاملة إقفال السنة المالية.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_journal_entries_period_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_period  financial_periods;
  v_old     financial_periods;
  v_bypass  TEXT;
  v_label   TEXT;
  v_status  TEXT;
BEGIN
  IF NEW.date IS NULL THEN
    RETURN NEW;
  END IF;

  v_bypass := current_setting('app.period_lock_bypass', true);
  v_period := fn_resolve_financial_period(NEW.date::date);

  IF v_period.id IS NULL THEN
    SELECT fp.* INTO v_period
      FROM financial_periods fp
     WHERE fp.month = EXTRACT(MONTH FROM NEW.date::date)
       AND fp.year  = EXTRACT(YEAR  FROM NEW.date::date)
     ORDER BY fp.id DESC
     LIMIT 1;
  END IF;

  IF v_period.id IS NULL THEN
    -- داخل معاملة الإقفال السنوي لا نُفشل الإدراج إن لم تُعرَّف الفترة بعد.
    IF COALESCE(v_bypass, '') = 'on' THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION USING
      MESSAGE = format('PERIOD_NOT_FOUND|لا توجد فترة مالية معرّفة تغطي تاريخ %s؛ أنشئ الفترة المالية أولاً.',
                       to_char(NEW.date::date, 'YYYY-MM-DD')),
      ERRCODE = 'P0001',
      DETAIL  = 'PERIOD_NOT_FOUND';
  END IF;

  -- التجاوز المصرّح به يسمح بالكتابة داخل فترة مغلقة (قيود الإقفال السنوي فقط)
  -- لكنه لا يعفي القيد من ربطه بفترته الصحيحة.
  IF COALESCE(v_bypass, '') <> 'on' THEN
    -- قفل الصف قبل قراءة الحالة: يمنع أن تُقفل الفترة بين قرار الترحيل وCOMMIT.
    -- القراءة بعد انتظار القفل تُرجِع أحدث نسخة ملتزمة للصف.
    PERFORM 1 FROM financial_periods WHERE id = v_period.id FOR SHARE;
    SELECT status INTO v_status FROM financial_periods WHERE id = v_period.id;
    v_period.status := COALESCE(v_status, v_period.status);

    -- منع تحريك قيد خارج فترة مغلقة (تغيير التاريخ بأثر رجعي)
    IF TG_OP = 'UPDATE' AND OLD.date IS NOT NULL AND OLD.date::date IS DISTINCT FROM NEW.date::date THEN
      v_old := fn_resolve_financial_period(OLD.date::date);
      IF v_old.id IS NOT NULL AND lower(COALESCE(v_old.status, 'open')) IN ('closed', 'frozen') THEN
        v_label := lpad(v_old.month::text, 2, '0') || '/' || v_old.year::text;
        RAISE EXCEPTION USING
          MESSAGE = format('PERIOD_CLOSED|لا يمكن نقل القيد من تاريخ %s داخل الفترة المغلقة %s. اطلب إعادة فتح الفترة أو استخدم قيد تسوية معتمد.',
                           to_char(OLD.date::date, 'YYYY-MM-DD'), v_label),
          ERRCODE = 'P0001',
          DETAIL  = 'PERIOD_CLOSED';
      END IF;
    END IF;

    IF lower(COALESCE(v_period.status, 'open')) IN ('closed', 'frozen') THEN
      v_label := lpad(v_period.month::text, 2, '0') || '/' || v_period.year::text;
      RAISE EXCEPTION USING
        MESSAGE = format('PERIOD_CLOSED|لا يمكن الترحيل بتاريخ %s: الفترة المالية %s %s. اطلب إعادة فتح الفترة بصلاحية معتمدة أو استخدم إجراء تسوية مصرّح به.',
                         to_char(NEW.date::date, 'YYYY-MM-DD'), v_label,
                         CASE lower(v_period.status) WHEN 'closed' THEN 'مغلقة' ELSE 'مجمدة للمراجعة' END),
        ERRCODE = 'P0001',
        DETAIL  = 'PERIOD_CLOSED';
    END IF;
  END IF;

  -- ضبط period_id دائمًا من تاريخ القيد حتى لا يبقى NULL أو مخالفًا
  NEW.period_id := v_period.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_entries_period_guard ON journal_entries;
CREATE TRIGGER trg_journal_entries_period_guard
  BEFORE INSERT OR UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION fn_journal_entries_period_guard();

-- حماية بنود القيود: لا تعديل/إضافة/حذف على قيد يقع داخل فترة مغلقة
CREATE OR REPLACE FUNCTION fn_journal_items_period_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id INTEGER;
  v_date     DATE;
  v_period   financial_periods;
  v_bypass   TEXT;
  v_label    TEXT;
BEGIN
  v_entry_id := COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
  IF v_entry_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_bypass := current_setting('app.period_lock_bypass', true);
  IF COALESCE(v_bypass, '') = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT je.date INTO v_date FROM journal_entries je WHERE je.id = v_entry_id;
  IF v_date IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_period := fn_resolve_financial_period(v_date);
  IF v_period.id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF lower(COALESCE(v_period.status, 'open')) IN ('closed', 'frozen') THEN
    v_label := lpad(v_period.month::text, 2, '0') || '/' || v_period.year::text;
    RAISE EXCEPTION USING
      MESSAGE = format('PERIOD_CLOSED|لا يمكن تعديل بنود قيد بتاريخ %s داخل الفترة المالية المغلقة %s.',
                       to_char(v_date, 'YYYY-MM-DD'), v_label),
      ERRCODE = 'P0001',
      DETAIL  = 'PERIOD_CLOSED';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_journal_items_period_guard ON journal_items;
CREATE TRIGGER trg_journal_items_period_guard
  BEFORE INSERT OR UPDATE OR DELETE ON journal_items
  FOR EACH ROW
  EXECUTE FUNCTION fn_journal_items_period_guard();

COMMIT;
