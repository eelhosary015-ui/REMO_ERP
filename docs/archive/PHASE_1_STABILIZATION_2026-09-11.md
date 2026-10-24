# REMO PRO — Phase 1 Stabilization

Implemented as an additive/non-breaking foundation.

## Included
- Shared PostgreSQL transaction helper on `pool.transaction(...)`.
- Reusable `withTransaction(...)` service with COMMIT/ROLLBACK and optional isolation level.
- Persistent `erp_idempotency_keys` table with a unique `(scope, idempotency_key)` constraint.
- Reusable idempotency service with payload hashing, replay protection, in-progress protection, completion and failure cleanup.
- Request correlation IDs via `X-Request-ID` for traceable support/debugging without changing API payloads.
- Existing purchase receiving/return idempotency protections remain intact.
- Existing business tables are not rewritten or migrated destructively.

## Safety
The new components are additive. Existing routes continue to work exactly as before. The new transaction/idempotency services are available for progressive adoption by each business write endpoint.

## Verification
TypeScript source syntax was checked using the installed TypeScript compiler's transpilation diagnostics for all changed TypeScript files. A full project type-check/build could not be completed in this environment because the project's `node_modules` are not installed in the provided source tree.
