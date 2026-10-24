# Stage 3 — Inventory & Stock Integrity

Implemented:
- Central `changeInventoryQuantity()` service with row locking and warehouse negative-stock policy.
- Warehouse stock movement helper now uses the central service.
- Database trigger blocks negative `inventory_items` quantities when the warehouse does not allow negative stock.
- Database trigger protects legacy `stock_balances` when that table exists.
- `available` is recalculated centrally as `max(quantity-reserved, 0)`.
- Added inventory lookup/ledger indexes.
- Added a real SQL migration runner (`npm run db:migrate`) because the previous package script referenced a missing migration entry point.
- Added migration tracking through `schema_migrations`.

Important:
- Existing duplicate inventory rows are not silently merged. The unique index will stop with a clear database error if duplicates exist, preserving data for deliberate reconciliation.
- Modules that still write inventory directly are protected by the database guardrails; they should be migrated to the central service in later hardening passes.
