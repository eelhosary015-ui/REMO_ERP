# Remo Pro — Stage 4: Database & Integration Hardening

## Safety policy
This stage is intentionally non-destructive. It does **not** delete rows, drop business tables, rewrite balances, or automatically repair orphaned data.

## Changes
- Hardened Enterprise migrations against mixed-version installations.
- `ENT_001` now skips optional tables that do not exist instead of aborting the complete migration transaction.
- `ENT_004` now creates company/branch indexes only when the table and every requested column exist.
- `ENT_006` now safely skips audit-log enhancements when the audit table is not present yet.
- Added `ENT_007` with safe performance indexes for high-volume foreign-key lookups.
- Added read-only database health endpoint: `GET /api/enterprise/db-health`.
- The health endpoint checks required core tables and reports orphaned foreign-key references for key ERP relationships.
- Health endpoint is restricted to administrator roles (`admin`, `super_admin`, `owner`).

## Important
The health check reports problems but does not silently modify data. Any orphaned records must be reviewed before a future repair migration is introduced.

## Validation
- Source structure inspected after patching.
- TypeScript compiler is installed globally, but this archive has no `node_modules`; a full project compile cannot be considered verified until dependencies are installed in the target environment.
- No production database was modified by this stage archive creation.
