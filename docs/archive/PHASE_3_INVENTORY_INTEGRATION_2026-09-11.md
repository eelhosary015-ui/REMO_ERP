# REMO PRO – Phase 3 Inventory Integration Hardening

## Scope
This phase progressively routes high-risk stock writes through the central inventory engine without replacing stable UI/API contracts.

### Integrated flows
- Purchase receiving: `modules/purchases/services/purchase-integration.service.ts`
  - quantity mutation now uses `moveStock()`
  - warehouse/item locking is centralized
  - inventory stock ledger and movement are created by the central engine
  - weighted average cost is updated after the authoritative quantity movement
  - purchase inventory transaction remains as the legacy/reporting mirror
- Production completion service: `modules/enterprise/services/productionInventory.service.ts`
  - raw-material consumption uses `moveStock()`
  - finished-goods receipt uses `moveStock()`
  - negative stock is no longer silently clamped to zero by this service
  - legacy inventory transaction is retained for compatibility
  - missing finished-product ingredient is created with `RETURNING id` and the real ID is used
- Production repository was already using the warehouse `applyStockMovement()` adapter, which delegates to the central engine; it was left intact to avoid unnecessary route changes.
- Enterprise warehouse transfers were already using `moveStock()` and were left intact.

## Safety rules
- Do not change frontend contracts.
- Do not delete legacy history tables or existing transaction mirrors.
- Do not acquire `inventory_items` before the warehouse lock in integrated receiving; this avoids lock-order deadlocks with transfers.
- Every central quantity movement is recorded in `inventory_stock_ledger` with a unique event key.
- `ingredients.current_stock` is derived from warehouse balances by the central engine.

## Verification performed
- TypeScript transpilation/syntax diagnostics: PASS for all modified TS files.
- Static inspection of purchase/production integration: PASS.
- Full dependency-based build/E2E could not be executed in this environment because the supplied project does not contain `node_modules` (and therefore Vite/PG runtime tests are unavailable here).

## Remaining progressive migration
Some legacy write paths remain in older/secondary modules (notably restaurant/POS, legacy adjustments/wastage, and older warehouse handlers). They are intentionally not bulk-rewritten in this phase because they have different document lifecycles and schema variants. The next migration should be done route-by-route with regression tests, not by global search/replace.
