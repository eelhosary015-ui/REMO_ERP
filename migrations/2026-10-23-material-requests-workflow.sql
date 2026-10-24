-- ═══════════════════════════════════════════════════════════════════════
-- Material Requests (Material Issue Requests) — approval workflow columns
-- ───────────────────────────────────────────────────────────────────────
-- The warehouse module's pages (طلبات وصرف المواد) depend on these columns
-- for the two-step approval (department → warehouse) and for the issue
-- (posting) step. They were missing from legacy databases, which made every
-- approval/issue call fail with "column does not exist".
--
-- Safe to re-run: every statement is IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_by_dept VARCHAR(150);
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_dept_at TIMESTAMP;
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_by_wh   VARCHAR(150);
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_wh_at   TIMESTAMP;
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS issued_at        TIMESTAMP;
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS issued_by        VARCHAR(150);
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS recipient_name   VARCHAR(150);
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS requested_by_name VARCHAR(150);

ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(14,4) DEFAULT 0;
ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS purpose   TEXT;
ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS line_no   INTEGER;
-- The approval/issue handlers stamp each line when the approved/issued
-- quantities change; without this column both steps failed with
-- "column updated_at of relation material_request_items does not exist".
ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_mat_req_items_request ON material_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_mat_req_created       ON material_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mat_req_needed_date   ON material_requests(needed_date);

COMMIT;
