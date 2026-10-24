# Warehouse Transfer UI & Posting Fix — 2026-09-10

- Enlarged the enterprise warehouse transfer creation modal to use a wider desktop layout and taller viewport.
- Improved item table width for the larger layout.
- Fixed the "تقديم طلب تحويل معتمد" action so it submits an approved transfer with `auto_post=true`.
- Added an atomic server-side direct-post path: validate source available quantities, deduct source stock, add destination stock, update transfer to `completed`, write inventory ledger entries, and audit the operation in one DB transaction.
- Existing request -> approve -> dispatch -> receive workflow remains available for normal requests.
- Duplicate/insufficient stock validation is performed before any direct-post stock movement.
- Duplicate item lines are aggregated before stock movement so the idempotent ledger posts their full combined quantity.
- The create screen confirms when an approved transfer has been fully posted to the destination warehouse.
- Submission errors are shown inside the open transfer modal, and network failures are surfaced instead of being returned as fake successful responses.
