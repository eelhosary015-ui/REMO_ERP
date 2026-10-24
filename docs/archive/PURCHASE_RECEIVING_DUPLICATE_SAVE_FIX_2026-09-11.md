# Purchase Receiving Duplicate Save Fix — 2026-09-11

## Problem
Clicking **حفظ الفاتورة** multiple times on Purchase Receipts could create multiple goods receipts and purchase invoices, causing repeated stock movements.

## Fix
- Added a synchronous frontend save lock so repeated clicks are ignored immediately.
- Added a per-save idempotency key and reused it for safe retries.
- Added database idempotency columns and unique partial indexes for `goods_receipts` and `purchases`.
- The receiving API now returns the already-created receipt when concurrent requests use the same key.
- Purchase creation now returns the already-created invoice on the same key and does not emit duplicate business events.
- A failed network response can be retried safely with the same key without posting warehouse stock a second time.

## Database
Startup migration automatically adds:
- `goods_receipts.idempotency_key`
- `purchases.idempotency_key`

No manual SQL is required; restart the server once after installing this build so the schema guard applies the columns/indexes.
