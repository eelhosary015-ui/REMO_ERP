# Production Raw-Material Warehouse Fix — 2026-09-09

Implemented in the Production Work Order module:

- The raw-material sheet now resolves BOM material references using `materialId`, `ingredientId`, `material_id`, `ingredient_id`, code/item-code, and name.
- The sheet displays the actual raw-material name instead of a numeric ID such as `1`.
- The selected **Raw Material Issue Warehouse** is stored on the production order and shown on the raw-material sheet.
- The stock shown for each material is the balance from the selected issue warehouse only (`inventory_items.warehouse_id`), not the global ingredient stock.
- The sheet displays the issue warehouse name beside each material and the selected warehouse in the sheet header.
- Production execution is locked to the warehouse saved on the order. If a different issue warehouse is submitted at execution time, the server rejects the operation instead of silently switching warehouses.
- Stock validation and actual stock deduction continue to use the same saved issue warehouse, so insufficient stock blocks execution.
- Fixed the production-run duplicate check to use columns that actually exist in `production_runs` (`order_number`, `id`, `created_at`) instead of nonexistent `run_number`/`order_id` fields.
- The frontend stock loader now prefers the warehouse item's `available` balance when available.

## Expected behavior

Example: if the order selects **مخزن الخامات** as the issue warehouse and the recipe contains 5 kg of a raw material:

1. The sheet shows the raw-material name and code.
2. The sheet shows **مخزن الخامات** as the issue warehouse.
3. The stock column shows the quantity of that raw material inside **مخزن الخامات** only.
4. When the order is executed, 5 kg is deducted from **مخزن الخامات** only.
5. If the selected warehouse has less than 5 kg, execution is rejected and no partial production posting is made.
