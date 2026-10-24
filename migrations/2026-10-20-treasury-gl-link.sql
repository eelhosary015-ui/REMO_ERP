-- ═══════════════════════════════════════════════════════════════════════════
-- REMO PRO ERP — ربط سندات الخزينة بالقيد المحاسبي ومنع ازدواج الترحيل
-- التاريخ: 2026-10-20
--
-- الهدف: ضمان أن كل سند خزينة له قيد واحد فقط، حتى لو أُعيد إرسال الطلب
-- أو تكرر الترحيل من أكثر من مسار.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS ux_je_treasury_voucher
  ON journal_entries (source_type, source_id)
  WHERE source_type = 'treasury_voucher';

CREATE INDEX IF NOT EXISTS idx_treasury_tx_fin
  ON treasury_transactions (fin_number)
  WHERE fin_number IS NOT NULL;

COMMIT;
