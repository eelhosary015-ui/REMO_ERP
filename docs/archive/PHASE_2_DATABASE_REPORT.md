# Phase 2 — Database & Data Integrity

Implemented in `ENT_006`.

## Changes
- Backfill `company_id` from `branch_id` for supported tenant-scoped tables.
- Backfill users' `company_id` from their branch.
- Add composite indexes for branch-scoped operational queries.
- Keep `customer_transactions.timestamp` as the canonical timestamp and synchronize `created_at` with a trigger for backward compatibility.
- Add a partial unique index on `(warehouse_id, ingredient_id)` after checking for duplicate inventory keys.
- Refuse to silently merge duplicate inventory rows because other records may reference the individual inventory row ID.

## Audit
Run:

`npm run db:integrity`

This is read-only and reports duplicate inventory keys, missing branch/company scope, and timestamp drift.
