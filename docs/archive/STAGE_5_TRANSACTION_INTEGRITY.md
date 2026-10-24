# Remo Pro — Stage 5: Integration & Transaction Integrity

## Safety-first scope
This stage focuses on concurrency and atomicity in the highest-risk money/order flows. No destructive migration, table drop, data deletion, or automatic data rewrite is included.

## Changes
- Restaurant order creation already ran inside PostgreSQL transactions; daily invoice-number allocation is now serialized per branch/date using transaction-scoped advisory locks.
- Web-order confirmation now uses the same per-branch/date serialization before allocating a daily number.
- Customer lookup/create during POS order creation is serialized by phone to prevent concurrent duplicate customer creation.
- Safe repository balance mutations continue to run atomically with their transaction records and now lock the source safe row.
- Safe-to-safe transfers validate and lock the target safe before applying the transfer.
- Accounting safe transfers lock both involved safes in deterministic ID order to reduce deadlock risk when opposite transfers happen concurrently.
- Existing Stage 1 idempotency and payment protections are preserved.

## Intentionally not changed
- Existing accounting formulas and business rules.
- Existing inventory costing/valuation algorithms.
- Existing POS pricing/tax/discount calculations.
- Existing database data.
- Seed/demo data.

## Validation
Static checks are performed on modified TypeScript source. A full production build requires the project's dependencies (`node_modules`) and a live PostgreSQL environment for integration tests; those are not bundled into the delivery ZIP.
- Safe transaction API now accepts `Idempotency-Key` and replays the original response instead of applying the same financial mutation twice.
