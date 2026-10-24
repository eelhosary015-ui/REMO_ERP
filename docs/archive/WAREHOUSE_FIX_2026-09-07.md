# Warehouse list / save fix

## Problem
The Warehouse Management page could show an empty table after a successful warehouse creation. The old GET `/api/warehouses` query depended on optional enterprise columns (`is_default`, `is_module_default`, `linked_module`, etc.). If one of those columns was missing or a migration was incomplete, the GET endpoint returned HTTP 500 while the POST endpoint could still succeed.

## Fix
- `/api/warehouses` now loads the base `warehouses` table first with a migration-safe query.
- Optional warehouse fields are normalized in application code.
- Module filtering is applied after loading records.
- Stock summary is isolated so a missing inventory-summary dependency cannot hide warehouses.
- Warehouse GET errors are logged and returned clearly.
- The frontend now displays API errors instead of silently keeping an empty list.
- After saving a warehouse, the returned record is immediately reflected in the table and then refreshed from the server.

## Files changed
- `modules/warehouses/warehouses_api.routes.ts`
- `src/components/Inventory.tsx`
