# Purchase Return View White Screen Fix — 2026-09-11

## Root cause
The purchase returns list returns a flat record. It does not contain a nested `invoice` object. The View button passed that flat record to `ReturnModal`, while `ReturnModal.loadInitialData()` did `setSelectedInvoice(data.invoice)`. The next render accessed `selectedInvoice.supplier_name`, causing a runtime exception and a white screen.

## Fix
- View now loads `/api/returns/:id` to retrieve return items.
- It loads `/api/purchases/:purchase_id` to retrieve the original invoice and its items.
- Return quantities/reasons/notes are merged onto the original invoice item IDs.
- A safe fallback invoice is used if the linked purchase no longer exists.
- Loading is awaited before switching to the details form.
- The modal is guarded against missing legacy data.

## Result
Clicking `عرض` opens the saved purchase return details instead of leaving the page on a white screen.
