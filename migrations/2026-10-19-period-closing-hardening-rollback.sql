-- ═══════════════════════════════════════════════════════════════════════════
-- تراجع عن تقوية إقفال الفترات — REMO PRO ERP
--
-- يُزيل طبقة الحماية (triggers/functions/indexes) ويعيد النظام إلى سلوكه
-- السابق في الترحيل. **لا يحذف** سجل الأحداث ولا أعمدة التتبّع، حتى لا تُفقد
-- ذاكرة من أغلق/أعاد فتح أي فترة.
--
-- ملاحظة: تصحيح تواريخ الفترات (start_date/end_date) وتعبئة period_id
-- لا يُعاد إلى الخطأ القديم عمدًا: القيم القديمة كانت خاطئة بيوم واحد.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

DROP TRIGGER IF EXISTS trg_journal_items_period_guard ON journal_items;
DROP TRIGGER IF EXISTS trg_journal_entries_period_guard ON journal_entries;

DROP FUNCTION IF EXISTS fn_journal_items_period_guard();
DROP FUNCTION IF EXISTS fn_journal_entries_period_guard();
DROP FUNCTION IF EXISTS fn_resolve_financial_period(date);

DROP INDEX IF EXISTS ux_je_year_end_closing;
DROP INDEX IF EXISTS ux_je_opening_balance;
DROP INDEX IF EXISTS idx_je_period_date;

COMMIT;

-- لاستعادة السلوك القديم بالكامل (اختياري، يفقد سجل الأحداث):
-- DROP TABLE IF EXISTS financial_period_events;
-- ALTER TABLE financial_periods DROP COLUMN IF EXISTS closed_by, DROP COLUMN IF EXISTS close_reason,
--   DROP COLUMN IF EXISTS reopened_at, DROP COLUMN IF EXISTS reopened_by, DROP COLUMN IF EXISTS reopen_reason;
-- ALTER TABLE fiscal_years DROP COLUMN IF EXISTS closed_by, DROP COLUMN IF EXISTS close_reason,
--   DROP COLUMN IF EXISTS reopened_at, DROP COLUMN IF EXISTS reopened_by, DROP COLUMN IF EXISTS reopen_reason,
--   DROP COLUMN IF EXISTS closing_entry_id, DROP COLUMN IF EXISTS opening_entry_id;
