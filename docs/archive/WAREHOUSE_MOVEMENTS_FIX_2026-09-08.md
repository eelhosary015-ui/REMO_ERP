# Warehouse Movements Fix — 2026-09-08

## Fixed
- Historical inventory transaction rows that use the legacy one-row-per-item schema no longer display `عدد الأصناف = 0`; they now fall back to 1 when no JSON items array exists.
- Transaction values now fall back to `total_cost` / `quantity × unit_cost` for legacy rows when JSON line items are absent.
- Added normalized `transaction_date` from `date` with `created_at` fallback.
- Frontend transaction dates are rendered as real local dates instead of raw ISO timestamps, preventing the `21:00:00.000Z` / previous-day appearance.
- Audit movement timestamps are rendered with Arabic locale and local time.
- Date filtering uses a normalized local date key, avoiding timezone/string comparison problems.
- Historical audit movements are no longer artificially capped at 200 rows in the Warehouse screen.
- Added `receipt` as a recognized incoming transaction type so purchase receipts display as Arabic `استلام` and count as incoming.
- Updated transaction/adjustment/damaged report exports to use the corrected date format.
- Updated the in-memory compatibility database adapter with the same legacy item-count/value/date fallbacks.

## Compatibility
The changes are defensive and support both:
1. New transactions that store multiple lines in `items` JSON.
2. Existing/legacy transactions stored as individual rows with `quantity`, `unit_cost`, and `total_cost`.

No existing transaction records are deleted or rewritten.
