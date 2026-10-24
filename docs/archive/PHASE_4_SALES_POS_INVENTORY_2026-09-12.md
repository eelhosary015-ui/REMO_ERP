# REMO PRO – Phase 4: Sales / POS / Inventory Stabilization

Date: 2026-09-12

## Scope
This phase progressively routes high-risk restaurant/POS stock mutations through the central inventory engine introduced in Phase 2/3, without changing frontend contracts.

## Implemented
- POS order creation now aggregates recipe consumption by warehouse + ingredient and posts through `moveStock`.
- POS order creation marks `orders.is_deducted` only after the inventory movement succeeds.
- Kitchen `preparing` status locks the order row and only deducts when `is_deducted` is false, preventing duplicate deduction.
- Call-center confirmation uses the central inventory engine and order row locking.
- Web-order confirmation uses the central inventory engine.
- Order editing reverses the old recipe and applies the new recipe through separate idempotent movement references.
- Adding items to an already-deducted order uses a unique `order_modifications` reference and the central engine.
- Checkout locks the order and returns an idempotent success when it is already paid, preventing duplicate safe collection.
- Cancellation locks the order, becomes a no-op when already cancelled, and reverses stock once through the central engine.
- Legacy `inventory_transactions` entries are retained as a compatibility/reporting mirror.
- Existing UI/API response shapes are preserved.

## Safety model
All central stock changes occur inside the route's existing database transaction. The central engine locks warehouse/item rows and uses its persistent event ledger to prevent replay.

## Validation
- TypeScript parser check of the modified restaurant route completed with no syntax/parse errors.
- Remaining TypeScript diagnostics are dependency/environment diagnostics (missing installed packages/types in this build workspace), not syntax errors in the modified route.
- Full production E2E against PostgreSQL was not executed in this environment because the project's runtime dependencies/database are not available here.
