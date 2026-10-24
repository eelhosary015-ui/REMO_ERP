# Production execution hardening — 2026-09-09

## Fixed
- PostgreSQL `42P08 inconsistent types deduced for parameter` in production execution caused by reusing one parameter across `text/varchar` comparisons.
- Product lookup comparisons now normalize all compared columns/parameters to `text`.
- Production-order lookup/delete comparisons now normalize `id/order_number` to `text`.

## Production flow verified in code
1. Production order is loaded and locked with a transaction-scoped advisory lock.
2. Completed/executed orders and existing production runs are rejected to prevent duplicate execution.
3. Raw and finished warehouses are validated.
4. BOM snapshot is resolved; fallback availability calculation is used when needed.
5. Raw materials are resolved to warehouse ingredients.
6. Stock is checked before deduction when negative stock is disabled.
7. Raw materials are deducted through the inventory movement engine.
8. Finished goods are created/resolved and received into the finished warehouse.
9. Inventory transactions are logged for both issue and receipt.
10. Finished product is synchronized to the POS/products catalog.
11. A completed production run is persisted and the production order is marked executed.
12. All changes are committed atomically; any error rolls back the transaction.

## Note
The project dependencies are not installed in the provided archive, so a full `npm run lint/build` cannot be executed in this environment. The modified TypeScript source was checked structurally and the failing SQL parameter pattern was removed.
