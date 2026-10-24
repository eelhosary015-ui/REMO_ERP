# Production Orders UI Redesign - 2026-09-10

- Restyled the production orders data table to match the supplier-management ERP visual language.
- Centered table headers and row data without changing production business logic.
- Added English digit normalization for production order quantities, dates, progress, executed dates, and pagination counters.
- Added client-side pagination with 25 / 50 / 100 rows per page, default 50.
- Added first/previous/page numbers/next/last controls and record range display.
- Preserved existing APIs, database schema, production execution/posting behavior, and modal workflows.
