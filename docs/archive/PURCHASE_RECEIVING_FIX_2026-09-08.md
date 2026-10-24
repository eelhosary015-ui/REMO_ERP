# Purchase Invoice / Warehouse Receiving Fix — 2026-09-08

## Fixed

1. Fixed the fatal PostgreSQL bind error when saving a purchase invoice:
   - Error: `bind message supplies 26 parameters, but prepared statement requires 27`
   - Root cause: `purchases.invoice_status` was included in the INSERT column list and `$22..$27` placeholders, but its corresponding parameter was missing.
   - Fix: added the explicit `invoice_status = 'posted'` value so the INSERT now supplies all 27 parameters.

2. Fixed the optional GRNI accounting warning during warehouse posting:
   - Existing `journal_items` schema uses `notes`, not `description`.
   - Updated purchase receiving and enterprise warehouse receiving accounting inserts to use `notes`.
   - This keeps the optional accounting entry compatible with the current database schema.

## Expected result

Clicking **حفظ الفاتورة** should now complete the purchase transaction instead of failing at `PurchaseRepository.create()`.

When no existing goods receipt is supplied, the purchase flow continues through the canonical goods-receipt integration and posts the accepted quantities to warehouse inventory for ingredient-backed items inside the same database transaction.

## Validation

- Purchase INSERT: 27 placeholders and 27 supplied parameters verified statically.
- No remaining `journal_items(... description ...)` inserts in the purchase/enterprise warehouse receiving paths.
- Full TypeScript compilation could not be completed in the isolated repair workspace because `node_modules` is not present; the global TypeScript compiler therefore reports missing external packages. No modified-file syntax error was reported by the repair checks.
