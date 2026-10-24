# Purchase Request Duplicate Submit Fix — 2026-09-10

## Problem
Clicking "إنشاء طلب الشراء" more than once quickly could send multiple POST requests and create duplicate purchase requests.

## Fix
- Added a synchronous frontend submit lock (`isCreatingRequestRef`) plus the UI state lock, so even extremely fast repeated clicks cannot enter the submit handler twice before React re-renders.
- The submit button is disabled during creation and changes to `جاري إنشاء الطلب...`.
- Added a per-form `Idempotency-Key` generated when opening a new purchase-request form.
- The backend stores the idempotency key on `purchase_requests` and enforces a unique partial index.
- Repeated requests with the same key return the already-created request instead of inserting another one.
- Concurrent duplicate requests are also protected by the database unique index; the losing request returns the existing record.
- Existing edit/update behavior is preserved.

## Database safety
Startup initialization adds the column and unique partial index using `IF NOT EXISTS`, so existing installations are upgraded safely.

## Business logic
No purchase-request approval, item calculation, inventory, supplier, or accounting business rules were changed.
