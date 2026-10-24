-- ═══════════════════════════════════════════════════════════════════════════
-- 2026-10-24 — قفل دائم للحسابات التجريبية عند انتهاء الفترة التجريبية
-- ═══════════════════════════════════════════════════════════════════════════
-- الهدف:
--   * عند انتهاء `trial_ends_at` يُقفل الحساب قفلًا دائمًا (is_locked = true).
--   * القفل لا يُرفع إلا بإجراء صريح من مدير النظام، وليس بتعديل التاريخ.
--   * حساب مدير النظام (role = 'admin') لا يخضع للتجربة إطلاقًا.
--
-- ملاحظة: هذا الملف idempotent — يمكن تشغيله أكثر من مرة بأمان.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_by TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_unlock_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_last_unlocked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_last_unlocked_by INTEGER;

CREATE INDEX IF NOT EXISTS idx_users_trial_lock
  ON users (is_trial, is_locked, trial_ends_at);

COMMENT ON COLUMN users.is_locked IS 'قفل دائم للحساب — لا يُرفع إلا بإجراء إداري صريح عبر /api/users/:id/trial/unlock';
COMMENT ON COLUMN users.locked_reason IS 'TRIAL_EXPIRED | TRIAL_DATE_MISSING | TRIAL_DATE_INVALID | ADMIN_LOCK';
COMMENT ON COLUMN users.locked_by IS 'الجهة التي نفّذت القفل: system:trial-expiry أو اسم/معرّف المدير';
COMMENT ON COLUMN users.trial_unlock_count IS 'عدد مرات إعادة فتح الحساب بعد القفل (للتدقيق)';

-- 1) حسابات مدير النظام لا تخضع للفترة التجريبية (حماية من قفل النظام بالكامل).
UPDATE users
   SET is_trial = false,
       trial_ends_at = NULL
 WHERE LOWER(COALESCE(role, 'user')) = 'admin'
   AND (is_trial = true OR trial_ends_at IS NOT NULL);

-- 2) قفل الحسابات التجريبية المنتهية الموجودة حاليًا (بما فيها بلا تاريخ).
UPDATE users
   SET is_locked = true,
       locked_at = COALESCE(locked_at, NOW()),
       locked_reason = CASE WHEN trial_ends_at IS NULL THEN 'TRIAL_DATE_MISSING' ELSE 'TRIAL_EXPIRED' END,
       locked_by = 'migration:2026-10-24'
 WHERE COALESCE(is_locked, false) = false
   AND is_trial = true
   AND LOWER(COALESCE(role, 'user')) <> 'admin'
   AND (trial_ends_at IS NULL OR trial_ends_at < CURRENT_DATE);

-- 3) قيد وقائي: كل حساب تجريبي جديد يجب أن يحمل تاريخ انتهاء.
--    NOT VALID يمنع الصفوف الجديدة المخالفة دون إفشال الترقية بسبب بيانات قديمة.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_trial_requires_date') THEN
    ALTER TABLE users
      ADD CONSTRAINT users_trial_requires_date
      CHECK (is_trial = false OR trial_ends_at IS NOT NULL) NOT VALID;
  END IF;
END
$$;

COMMIT;

-- للتحقق بعد التنفيذ:
--   SELECT username, is_trial, trial_ends_at, is_locked, locked_reason, trial_unlock_count
--     FROM users WHERE is_trial = true OR is_locked = true ORDER BY id;
