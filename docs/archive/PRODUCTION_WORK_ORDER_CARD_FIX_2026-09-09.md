# Production Work Order Card Fix — 2026-09-09

- Work Order Card now uses the production order's persisted `bomSnapshot` as its source of truth.
- Removed the incorrect `boms[0]` fallback from the detail card.
- Product name/code/unit are taken from the order snapshot/productName.
- Raw-material rows preserve the exact material name/code/unit and quantities captured when the order was created.
- Raw and finished warehouse selectors are initialized from the selected order, not the current form defaults.
- BOM snapshot now stores product and warehouse metadata plus routings and normalized material details.
- Legacy orders without a snapshot use only their own `bomId`; they are never replaced by the first BOM.
