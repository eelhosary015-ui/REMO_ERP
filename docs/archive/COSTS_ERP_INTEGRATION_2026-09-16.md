# Costs ERP Integration — 2026-09-16

## Scope
The Costs module is now connected to the existing Suppliers, Purchases, Warehouses, Production/Manufacturing and database layers without replacing their source-of-truth transactions.

## Flow
- Supplier -> Purchase Request/Order -> Goods Receipt -> Purchase Invoice -> Warehouse valuation -> Costs analytical ledger.
- Warehouse receipt updates quantity and weighted average/last cost; Costs records the same landed acquisition value without creating a second operating expense.
- Production Order -> BOM/raw-material consumption -> finished-goods receipt -> production cost record in Costs.
- Operating expenses remain in `operating_costs` and are not duplicated as inventory costs.
- Supplier payments remain treasury/supplier-liability activity, not material cost.
- Warehouse transfers do not create artificial costs because ownership/value stays inside inventory.

## New analytical ledger
`cost_transactions` stores source-linked cost transactions with:
source module/type, source id, date, amount, quantity, unit cost, ingredient/product/warehouse/supplier/cost center, notes and metadata.

The ledger is idempotent by source + transaction type + line key.

## APIs
- GET `/api/costs/integration-summary`
- GET `/api/costs/integration-ledger`
- POST `/api/costs/integration/rebuild-purchase/:id`
- POST `/api/costs/integration/rebuild-production/:orderNumber`
- POST `/api/costs/integration/rebuild-all`

## Existing data
`rebuild-all` can rebuild the analytical ledger from posted purchases and completed production orders. It does not create demo/master data.

## Validation
The modified TypeScript files were syntax-transpiled successfully with TypeScript 5.8.3. Full project type-check/build was not possible in the sandbox because project dependencies were not installed; an attempted dependency installation timed out.
