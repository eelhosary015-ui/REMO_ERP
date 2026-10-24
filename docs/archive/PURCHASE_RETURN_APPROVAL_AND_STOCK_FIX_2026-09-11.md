# Purchase Returns – Approval / Save / Stock Fix – 2026-09-11

## Changes
- Improved the purchase return modal workflow layout with a clear 3-step flow.
- Added a client-side operation lock so repeated clicks on **اعتماد وحفظ المرتجع** cannot send concurrent save requests.
- Added idempotency protection for purchase return creation using `idempotency_key` and a unique partial index.
- If a draft was saved first, the same modal now updates/approves the existing return instead of trying to create a second return.
- Approval is transactional and locks the return row and warehouse stock rows.
- Repeated approval of an already-posted return is idempotent and does not deduct stock again.
- Approval validates warehouse available stock before posting.
- Approval validates that the return quantity does not exceed received quantity minus previously approved returns.
- Warehouse quantity, available quantity, ingredient total stock, inventory transaction, and inventory movement are updated in the same transaction.
- Supplier balance/sub-ledger return transaction remains part of the same approval transaction.
- Added `purchase_returns.idempotency_key` schema guard.

## Important behavior
- **Save draft**: stores the return only; no stock deduction.
- **Approve and save**: validates stock, posts the return, deducts warehouse stock, and updates supplier balance.
- **Double-click / retry**: must not create a second return or deduct stock twice.
