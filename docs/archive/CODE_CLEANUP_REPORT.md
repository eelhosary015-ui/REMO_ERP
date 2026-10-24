# Code Cleanup — V10

## Scope
This pass focused on repository hygiene without changing business behavior.

### Changes
- Moved historical one-off patch/fix/update scripts into `tools/legacy-patches/` so they no longer clutter the runtime root.
- Moved manual/diagnostic HTML/JS test artifacts into `tools/manual-tests/`.
- Removed the stale generated `public/zoz9-unified-settings-payroll.zip` bundle; it was an embedded copy of an older system and contained obsolete patch scripts.
- Kept runtime/operations scripts such as service installation, DB checks, migration runners, and startup scripts in the project root.
- Kept `patch-whatsapp.cjs` at the root because `package.json` still invokes it from `postinstall`.

## Safety
No business module source was deleted. Historical tooling was moved, not discarded.
- Removed the obsolete unauthenticated duplicate `/api/vouchers` CRUD block from `modules/accounting/accounting_api.routes.ts`; the authenticated implementation remains as the single source of truth.
