# Warehouse Items Excel Import

The **Warehouse > إدارة الأصناف** page now includes a visible **استيراد من Excel** button.

## Excel format
The first row must contain exactly:

- `الصنف`

Each following row contains one item name.

## Behavior
- Creates real records in the `ingredients` master table.
- Generates a unique code such as `ING-000001`.
- Defaults unit to `قطعة`, category to `عام`, and stock/cost thresholds to zero.
- Skips items already present by name instead of creating duplicates.
- Continues processing if one row fails.
- Returns a summary of imported/skipped/problem rows.
- Refreshes the inventory item list after a successful import.
