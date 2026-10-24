# Code Cleanup – Stage 2

- Removed the obsolete `postinstall` hook that attempted to patch `whatsapp-rust-bridge`, a package not declared by the project.
- Moved historical/manual root-level repair utilities into `tools/legacy-maintenance/` so they cannot be mistaken for runtime code.
- Kept database/offline support files because they are referenced by the application.
- Kept legacy patches under `tools/legacy-patches/` as reference only.
- No application module source was deleted in this stage.
