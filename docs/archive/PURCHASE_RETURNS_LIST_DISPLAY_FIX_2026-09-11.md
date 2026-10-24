# Purchase Returns List Display Fix — 2026-09-11

- Fixed the returns tab filtering bug: API returns `supplier_name`, while the UI was filtering on `supplier`, causing the list to appear empty even when records existed.
- Returns can now be searched by supplier, return number, invoice number, purchase ID, warehouse, or status.
- Empty-state is based on filtered results and clearly distinguishes "no matching returns".
- Added display labels for `pending_approval`, `rejected`, and `cancelled` statuses.
- Existing approval/stock-posting logic was preserved.

Note: the project dependencies are not included in this archive; run `npm install` before building.
