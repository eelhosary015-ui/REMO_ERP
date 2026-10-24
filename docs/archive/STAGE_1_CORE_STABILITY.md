# Stage 1 — Core Stability & Hardening

Implemented in this build:

- Production JWT secret is now mandatory; development uses a per-process random secret when not configured.
- Preview bypass is disabled in production and configurable via `PREVIEW_BYPASS_TOKEN`.
- CORS is restricted in production to `CORS_ORIGIN`; development remains permissive for local tooling.
- Added `api_idempotency_keys` database table for safe retry handling.
- POS order creation now supports `Idempotency-Key` and safely returns the original result on retries.
- POS order creation rejects reuse of an idempotency key with different request data.
- Web-order confirmation locks the row and prevents double confirmation under concurrent requests.
- POS checkout locks the order and prevents double payment / duplicate safe transactions.
- Customer transaction indexes for `timestamp` and `order_id` are now conditional, preventing startup failures on older schemas.
- Added production security environment variables to `.env.example`.

Validation note: dependency installation/build could not be completed within the execution window, so the final TypeScript compile/runtime validation should be run on the target machine with `npm install` followed by `npm run lint` and `npm run build`.
