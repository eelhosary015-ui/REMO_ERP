/**
 * Shared, trigger-safe schema repairs for legacy integer quantity/cost columns.
 *
 * Why this exists
 * ---------------
 * PostgreSQL refuses `ALTER TABLE ... ALTER COLUMN ... TYPE ...` with
 * "cannot alter type of a column used in a trigger definition" whenever a
 * trigger on that table depends on the column being converted (for example a
 * `BEFORE UPDATE OF quantity, reserved` trigger).
 *
 * Throwing the triggers away is not acceptable: audit, stock-alert and
 * integrity triggers would silently disappear. Instead this helper:
 *   1. looks at which columns genuinely still need a NUMERIC conversion,
 *   2. does nothing at all when every column is already numeric,
 *   3. otherwise snapshots every trigger definition on the affected tables,
 *   4. drops them, converts the columns, then restores each trigger verbatim
 *      (including its ENABLE/DISABLE/REPLICA/ALWAYS state).
 */

export interface DecimalColumnRepair {
  table: string;
  column: string;
  /** e.g. '14,4' -> NUMERIC(14,4) */
  precision: string;
  /** App restores this default after the conversion. */
  defaultValue?: string;
}

interface TriggerSnapshot {
  name: string;
  /** pg_trigger.tgenabled: O = origin, D = disabled, R = replica, A = always */
  enabled: string;
  definition: string;
}

/** Quantity/cost columns that must be decimal on every ERP database. */
export const DECIMAL_COLUMN_REPAIRS: ReadonlyArray<DecimalColumnRepair> = [
  { table: 'ingredients', column: 'cost', precision: '14,4' },
  { table: 'ingredients', column: 'avg_cost', precision: '14,4' },
  { table: 'ingredients', column: 'last_purchase_price', precision: '14,4' },
  { table: 'ingredients', column: 'current_stock', precision: '14,4' },
  { table: 'ingredients', column: 'min_stock', precision: '12,3' },
  { table: 'inventory_items', column: 'quantity', precision: '14,4' },
  { table: 'inventory_items', column: 'min_quantity', precision: '14,4' },
  { table: 'inventory_items', column: 'reserved', precision: '14,4' },
  { table: 'inventory_items', column: 'in_transit', precision: '14,4' },
  { table: 'inventory_items', column: 'available', precision: '14,4' },
  { table: 'inventory_items', column: 'avg_cost', precision: '14,4' },
  { table: 'inventory_items', column: 'cost', precision: '14,4' },
];

async function snapshotTriggers(db: any, table: string): Promise<TriggerSnapshot[]> {
  const result = await db.query(
    `SELECT t.tgname AS name,
            t.tgenabled AS enabled,
            pg_get_triggerdef(t.oid) AS definition
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = $1 AND n.nspname = 'public' AND NOT t.tgisinternal
      ORDER BY t.tgname`,
    [table]
  );
  return result.rows ?? [];
}

async function convertColumn(db: any, repair: DecimalColumnRepair): Promise<void> {
  const { table, column, precision, defaultValue = '0' } = repair;
  try {
    await db.query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`);
  } catch (_) {}
  await db.query(
    `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE NUMERIC(${precision}) USING COALESCE(NULLIF(TRIM(${column}::text), ''), '0')::numeric`
  );
  try {
    await db.query(`ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${defaultValue}`);
  } catch (_) {}
}

/**
 * Converts legacy integer/varchar quantity & cost columns to NUMERIC while
 * preserving every trigger on the affected tables.
 */
export async function repairDecimalColumns(
  db: any,
  repairs: ReadonlyArray<DecimalColumnRepair> = DECIMAL_COLUMN_REPAIRS
): Promise<void> {
  const pending: DecimalColumnRepair[] = [];
  for (const repair of repairs) {
    try {
      const result = await db.query(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        [repair.table, repair.column]
      );
      const dataType: string | undefined = result.rows?.[0]?.data_type;
      if (!dataType || dataType === 'numeric') continue; // missing, or already correct
      pending.push(repair);
    } catch (err: any) {
      console.warn(`[Schema Repair] Could not inspect ${repair.table}.${repair.column}:`, err?.message || err);
    }
  }

  // Nothing to convert -> never touch a single trigger.
  if (pending.length === 0) return;

  const tables = [...new Set(pending.map((r) => r.table))];
  const savedTriggers: Array<{ table: string; triggers: TriggerSnapshot[] }> = [];
  const failedRestores: string[] = [];

  try {
    for (const table of tables) {
      let triggers: TriggerSnapshot[] = [];
      try {
        triggers = await snapshotTriggers(db, table);
      } catch (err: any) {
        console.warn(`[Schema Repair] Could not read triggers for ${table}:`, err?.message || err);
      }
      for (const trigger of triggers) {
        try {
          await db.query(`DROP TRIGGER IF EXISTS "${trigger.name}" ON ${table}`);
        } catch (err: any) {
          console.warn(`[Schema Repair] Could not drop trigger ${trigger.name} on ${table}:`, err?.message || err);
        }
      }
      if (triggers.length > 0) savedTriggers.push({ table, triggers });
    }

    for (const repair of pending) {
      await convertColumn(db, repair);
      console.log(`✅ [Schema Repair] ${repair.table}.${repair.column} converted to NUMERIC(${repair.precision}).`);
    }
  } finally {
    for (const { table, triggers } of savedTriggers) {
      for (const trigger of triggers) {
        try {
          await db.query(`DROP TRIGGER IF EXISTS "${trigger.name}" ON ${table}`);
          await db.query(trigger.definition);
          if (trigger.enabled === 'D') {
            await db.query(`ALTER TABLE ${table} DISABLE TRIGGER "${trigger.name}"`);
          } else if (trigger.enabled === 'R') {
            await db.query(`ALTER TABLE ${table} ENABLE REPLICA TRIGGER "${trigger.name}"`);
          } else if (trigger.enabled === 'A') {
            await db.query(`ALTER TABLE ${table} ENABLE ALWAYS TRIGGER "${trigger.name}"`);
          }
        } catch (err: any) {
          failedRestores.push(`${trigger.name} ON ${table}`);
          console.error(`❌ [Schema Repair] Failed to restore trigger ${trigger.name} on ${table}:`, err?.message || err);
          console.error(`   Restore manually with: ${trigger.definition}`);
        }
      }
      console.log(`✅ [Schema Repair] Restored ${triggers.length} trigger(s) on ${table}.`);
    }
  }

  if (failedRestores.length > 0) {
    throw new Error(`Failed to restore triggers after column conversion: ${failedRestores.join(', ')}`);
  }
}

/**
 * Canonical body of the inventory integrity guard (mirrors
 * migrations/003_inventory_integrity.sql).
 *
 * The warehouse flags MUST be table-qualified: an unqualified `allow_negative`
 * is ambiguous between the plpgsql variable of the same name and the
 * `warehouses.allow_negative` column, so every negative-quantity write used to
 * fail with `column reference "allow_negative" is ambiguous` instead of the
 * intended business error.
 */
const INVENTORY_GUARD_FUNCTION = `
  CREATE OR REPLACE FUNCTION guard_inventory_items_integrity()
  RETURNS TRIGGER AS $guard$
  DECLARE
    allow_negative BOOLEAN := FALSE;
  BEGIN
    IF NEW.quantity IS NULL THEN NEW.quantity := 0; END IF;
    IF NEW.reserved IS NULL THEN NEW.reserved := 0; END IF;
    IF NEW.in_transit IS NULL THEN NEW.in_transit := 0; END IF;

    IF NEW.quantity < 0 THEN
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
  $guard$ LANGUAGE plpgsql;
`;

/**
 * Makes sure the inventory integrity guard function and trigger exist with the
 * corrected body, without touching any other trigger on the table.
 */
export async function ensureInventoryIntegrityGuard(db: any): Promise<void> {
  try {
    await db.query(INVENTORY_GUARD_FUNCTION);
  } catch (err: any) {
    console.warn('[Schema Repair] Could not install inventory integrity guard function:', err?.message || err);
  }
  try {
    await db.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'guard_inventory_items_integrity')
           AND to_regclass('public.inventory_items') IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM pg_trigger t
             JOIN pg_class c ON c.oid = t.tgrelid
             WHERE c.relname = 'inventory_items'
               AND t.tgname = 'trg_guard_inventory_items_integrity'
               AND NOT t.tgisinternal
           ) THEN
          CREATE TRIGGER trg_guard_inventory_items_integrity
          BEFORE INSERT OR UPDATE ON inventory_items
          FOR EACH ROW EXECUTE FUNCTION guard_inventory_items_integrity();
        END IF;
      END $$;
    `);
  } catch (err: any) {
    console.warn('[Schema Repair] Could not ensure inventory integrity trigger:', err?.message || err);
  }
}
