# REMO PRO — Phase 2: Central Inventory Engine

Implemented as an additive stabilization layer.

- Centralized `moveStock` engine with row locking and warehouse negative-stock policy.
- Centralized transfer adapter used by warehouse transfer flows.
- Persistent `inventory_stock_ledger` with unique event keys to prevent duplicate stock application on retries.
- Existing `inventory_movements` remains as audit history.
- Transfer approve/dispatch/receive/cancel rows use `FOR UPDATE` to prevent concurrent state transitions.
- Approval rejects already-processed/non-request states.
- Existing purchase receiving/returns fixes are preserved.

Verification performed: TypeScript syntax/transpile checks on changed files. Full dependency build/E2E requires the project's `node_modules` and a configured PostgreSQL environment; these were not present in the working runtime, so no false claim of full runtime verification is made.
