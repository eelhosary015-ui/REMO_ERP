# Purchases Module UI Redesign — 2026-09-10

Implemented on top of the latest REMO PRO production/supplier UI build.

## Scope
- Standardized the Purchases module visual language to match the enterprise Supplier/Production list design.
- Main purchasing list tables are centered with consistent row spacing, borders, sticky blue headers, and hover states.
- Added a shared pagination bar to the main purchasing lists:
  - 25 / 50 / 100 rows per page
  - First / Previous / numbered pages / Next / Last
  - English/Latin page and range numbers
  - Pagination resets when changing tab, search, or page size.
- Pagination applies to:
  - Purchase Receipts
  - Purchase Orders
  - Purchase Requests
  - Quotations
  - Purchase Invoices
  - Purchase Returns
  - Additional Expenses
- Main table dates and numeric values are displayed with English/Latin digits.
- Invoice row numbering continues correctly across pages.
- Purchase module report table and embedded purchase item tables were aligned to the centered table style.
- Purchase module tabs and primary action button use the same blue enterprise language as the Supplier UI.

## Business Logic
No database schema, API workflow, purchase posting, receiving, approval, accounting, supplier, warehouse, or inventory business logic was changed by this UI update.
