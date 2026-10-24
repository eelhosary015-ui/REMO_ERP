# REMO PRO V5 fixes

- Fixed negative `inventory_items` creation when a warehouse does not allow negative stock.
- Converted POS/call-center durable printing to an asynchronous DB-backed worker with `FOR UPDATE SKIP LOCKED`, retry up to 5 attempts, and persisted sent/failed state.
- Added a worker index for print job claiming.
- Preserved synchronous manual `/api/orders/:id/print` behavior for an explicit user-triggered print.
- Kept accounting reference allocation atomic through `accounting_reference_sequences`.
- Removed the unsafe global CHECK constraint attempt because negative stock is a per-warehouse policy and cannot be represented correctly by a simple row CHECK constraint.
- TypeScript was invoked; dependency/type packages are not installed in the archive environment, so missing-module diagnostics remain environment/dependency errors rather than syntax validation failures.
