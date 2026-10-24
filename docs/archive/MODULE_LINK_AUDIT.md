# ERP Module Link & Integration Audit

## Scope
Static audit of module routing, permission routing, database relationships, and cross-module persistence paths in the supplied ERP build.

## Findings fixed
1. Real-estate navigation was defined in the module catalogue and rendered by `App.tsx`, but the central module click handler had no `real-estate` branch. Added it so feature/settings/report selections open the real-estate module.
2. Server-side permission routing classified `/api/banks/*` as `accounting`, which could bypass the dedicated bank permission namespace. It now maps bank endpoints to `banks` and real-estate endpoints to `real-estate`.
3. Added explicit advanced permission groups for `banks` and `real-estate`, covering their feature-level operations.
4. Bank transfers were creating two bank transaction rows and changing both balances, but were not persisting the parent `bank_transfers` record. The transfer endpoint now persists the transfer header and links both transaction IDs atomically.
5. Real-estate collection records already had bank/treasury linkage columns in the hardened schema; collection POST/PUT now persist those fields and receipt number.
6. Added migration `ENT_008` for real-estate expense links to bank accounts, treasury accounts and GL accounts, with indexes. The migration is idempotent.

## Important architectural observations
- The system has strong module event infrastructure for several modules, but not every financial operation automatically creates a GL journal entry.
- Bank setting `auto_post_to_accounting` exists, but the bank transaction endpoint does not itself create a journal entry; this should be implemented as an explicit accounting posting workflow rather than inferred from the setting.
- Real-estate collection/expense payment links are now represented at DB level, but automatic creation of bank/treasury movements and GL journals should be implemented transactionally in a later finance-integration layer.
- Full runtime validation against the production PostgreSQL database was not possible because no live database connection/credentials are available in the artifact.

## Validation
- ZIP integrity check passed: no errors detected in compressed data.
- TypeScript compiler was invoked. Dependency packages are not installed in the artifact, so semantic errors such as missing `express` types are expected; no TS1000-series syntax/parse errors were reported by the compiler invocation.
