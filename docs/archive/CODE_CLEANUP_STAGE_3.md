# Code Cleanup Stage 3

- Flattened packaging so the project itself is at the archive root.
- Moved the obsolete WhatsApp patch utility into `tools/legacy-maintenance/`.
- Removed the unused duplicate `framer-motion` dependency and migrated the last import to `motion/react`.
- Fixed the broken `npm run migrate` script to use the maintained SQL migration runner.
- Removed the stale `migrate-to-postgres.ts` exclusion from `tsconfig.json`.
- Added `scripts/code-health-check.mjs` for repeatable detection of empty catch blocks and direct inventory writes.
- No broad automated deletion of business logic was performed; risky duplicated business logic remains flagged for controlled refactoring in later stages.
