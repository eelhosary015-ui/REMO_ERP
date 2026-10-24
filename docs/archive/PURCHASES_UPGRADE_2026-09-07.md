# Purchases Module Upgrade — 2026-09-07

Implemented without adding a new approval section/workflow to the Purchase Request form.

## Purchase Request
- Request number: PR-YYYYMMDD-######
- Branch and warehouse
- Requesting party/person
- Department
- Required-before date
- Priority: low / normal / high / urgent
- Reason and justification
- Cost center and cost item links
- Currency
- Notes
- Item code, stock snapshot, min/max stock, suggested quantity, quantity, estimated unit price and line total
- Edit draft/pending request
- Duplicate request
- Delete draft request
- Cancel request endpoint
- PostgreSQL attachments (metadata + BYTEA)
- Purchase activity/audit log

## Database / Integration
- Added idempotent schema migrations in `server-db-init.ts`.
- Added normalized `purchase_quotation_items` storage while keeping JSONB compatibility.
- Linked purchase request -> purchase order -> purchase invoice -> goods receipt.
- Added request/quotation/product links to purchase order/invoice item records.
- Linked purchase-related operating costs to request/order/receipt/quotation.
- Added indexes and safe foreign-key creation where legacy data permits.
- Goods receipts remain the canonical stock-receiving document to avoid double stock posting.

## Other Purchases Improvements
- Purchase order creation accepts request/branch/cost-center/currency links.
- Purchase invoice repository preserves request/quotation/product links.
- Purchase invoice links its goods receipt back to the invoice.
- Additional purchase costs can be linked to invoices and purchase orders.

## Verification
- TypeScript parser check completed on the modified frontend/backend/database files with no syntax-level errors detected.
- Full dependency install/build was not available in the isolated environment because `npm install` could not complete within the execution window; no claim of a live PostgreSQL integration test is made here.
