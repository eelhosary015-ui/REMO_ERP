-- ═══════════════════════════════════════════════════════════════════════════
-- Rollback — 2026-10-24 — قفل الحسابات التجريبية
-- ═══════════════════════════════════════════════════════════════════════════
-- تحذير: حذف الأعمدة يُلغي أثر القفل الدائم ويُعيد الحسابات المنتهية إلى
-- الاعتماد على مقارنة التاريخ فقط. لا تستخدمه إلا في بيئة اختبار أو عند
-- التراجع الكامل عن الميزة.

BEGIN;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_trial_requires_date;
DROP INDEX IF EXISTS idx_users_trial_lock;

-- إعادة الحسابات المقفولة إلى حالة "غير مقفولة" قبل إسقاط الأعمدة.
UPDATE users SET is_locked = false WHERE is_locked = true;

ALTER TABLE users DROP COLUMN IF EXISTS trial_last_unlocked_by;
ALTER TABLE users DROP COLUMN IF EXISTS trial_last_unlocked_at;
ALTER TABLE users DROP COLUMN IF EXISTS trial_unlock_count;
ALTER TABLE users DROP COLUMN IF EXISTS locked_by;
ALTER TABLE users DROP COLUMN IF EXISTS locked_reason;
ALTER TABLE users DROP COLUMN IF EXISTS locked_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_locked;

COMMIT;
