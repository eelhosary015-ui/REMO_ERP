-- =============================================================================
-- Migration: 003_inventory_integrity.sql
-- Stage 3: Central Inventory Integrity & Concurrency Guardrails
-- =============================================================================

-- Canonical uniqueness for ingredient stock per warehouse.
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_items_warehouse_ingredient
  ON inventory_items (warehouse_id, ingredient_id);

-- Fast lookups used by stock movement and ledger reporting.
CREATE INDEX IF NOT EXISTS idx_inventory_items_warehouse_ingredient
  ON inventory_items (warehouse_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_warehouse_ingredient_created
  ON inventory_movements (warehouse_id, ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_warehouse_ingredient_date
  ON inventory_transactions (warehouse_id, ingredient_id, date DESC);

-- Never allow a stock mutation to create negative quantity unless the warehouse
-- explicitly allows negative stock. This protects every module, including old
-- routes that still write inventory_items directly.
CREATE OR REPLACE FUNCTION guard_inventory_items_integrity()
RETURNS TRIGGER AS $$
DECLARE
  allow_negative BOOLEAN := FALSE;
BEGIN
  IF NEW.quantity IS NULL THEN NEW.quantity := 0; END IF;
  IF NEW.reserved IS NULL THEN NEW.reserved := 0; END IF;
  IF NEW.in_transit IS NULL THEN NEW.in_transit := 0; END IF;

  IF NEW.quantity < 0 THEN
    -- NOTE: the warehouse flags must stay table-qualified. An unqualified
    -- `allow_negative` is ambiguous with the variable of the same name and makes
    -- every negative-quantity write fail with "column reference ... is ambiguous".
    SELECT (COALESCE(w.allow_negative_stock, FALSE) OR COALESCE(w.allow_negative, FALSE))
      INTO allow_negative
      FROM warehouses w WHERE w.id = NEW.warehouse_id;
    IF NOT COALESCE(allow_negative, FALSE) THEN
      RAISE EXCEPTION 'Negative inventory is not allowed for warehouse %, ingredient % (attempted %)',
        NEW.warehouse_id, NEW.ingredient_id, NEW.quantity
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.reserved < 0 OR NEW.in_transit < 0 THEN
    RAISE EXCEPTION 'Reserved and in_transit inventory quantities cannot be negative'
      USING ERRCODE = '23514';
  END IF;

  NEW.available := GREATEST(COALESCE(NEW.quantity, 0) - COALESCE(NEW.reserved, 0), 0);
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_inventory_items_integrity ON inventory_items;
CREATE TRIGGER trg_guard_inventory_items_integrity
BEFORE INSERT OR UPDATE
ON inventory_items
FOR EACH ROW EXECUTE FUNCTION guard_inventory_items_integrity();

-- Repair obviously inconsistent available values without changing quantity.
UPDATE inventory_items
   SET available = GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0),
       updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)
 WHERE available IS DISTINCT FROM GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0);

-- stock_balances is a legacy/product-level inventory surface. If the table exists,
-- apply the same warehouse-level negative-stock policy to it.
DO $$
BEGIN
  IF to_regclass('public.stock_balances') IS NOT NULL THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION guard_stock_balances_integrity()
      RETURNS TRIGGER AS $body$
      DECLARE allow_negative BOOLEAN := FALSE;
      BEGIN
        IF NEW.quantity IS NULL THEN NEW.quantity := 0; END IF;
        IF NEW.quantity < 0 THEN
          SELECT (COALESCE(w.allow_negative_stock, FALSE) OR COALESCE(w.allow_negative, FALSE))
            INTO allow_negative FROM warehouses w WHERE w.id = NEW.warehouse_id;
          IF NOT COALESCE(allow_negative, FALSE) THEN
            RAISE EXCEPTION 'Negative stock_balances quantity is not allowed for warehouse %, product %',
              NEW.warehouse_id, NEW.product_id USING ERRCODE = '23514';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $body$ LANGUAGE plpgsql;
    $fn$;
    EXECUTE 'DROP TRIGGER IF EXISTS trg_guard_stock_balances_integrity ON stock_balances';
    EXECUTE 'CREATE TRIGGER trg_guard_stock_balances_integrity BEFORE INSERT OR UPDATE ON stock_balances FOR EACH ROW EXECUTE FUNCTION guard_stock_balances_integrity()';
  END IF;
END $$;
