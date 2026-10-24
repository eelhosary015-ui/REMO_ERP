import type { PoolClient } from "pg";

export type InventoryQuantityChange = {
  warehouseId: number;
  ingredientId: number;
  delta: number;
  allowNegativeOverride?: boolean;
};

export async function changeInventoryQuantity(client: PoolClient, input: InventoryQuantityChange) {
  const warehouseId = Number(input.warehouseId);
  const ingredientId = Number(input.ingredientId);
  const delta = Number(input.delta);
  if (!Number.isInteger(warehouseId) || warehouseId <= 0) throw new Error("Invalid warehouseId");
  if (!Number.isInteger(ingredientId) || ingredientId <= 0) throw new Error("Invalid ingredientId");
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Inventory delta must be a finite non-zero number");

  const wh = await client.query(
    `SELECT COALESCE(allow_negative_stock, false) AS allow_negative_stock,
            COALESCE(allow_negative, false) AS allow_negative
       FROM warehouses WHERE id = $1 FOR SHARE`,
    [warehouseId]
  );
  if (!wh.rows[0]) throw new Error(`Warehouse ${warehouseId} not found`);
  const allowNegative = input.allowNegativeOverride === true ||
    Boolean(wh.rows[0].allow_negative_stock) || Boolean(wh.rows[0].allow_negative);

  const current = await client.query(
    `SELECT id, quantity, reserved, in_transit, avg_cost, last_cost
       FROM inventory_items
      WHERE warehouse_id = $1 AND ingredient_id = $2
      FOR UPDATE`,
    [warehouseId, ingredientId]
  );

  const before = current.rows[0] ? Number(current.rows[0].quantity || 0) : 0;
  const after = before + delta;
  if (!allowNegative && after < 0) {
    throw new Error(`Insufficient stock for ingredient ${ingredientId} in warehouse ${warehouseId}: available ${before}, requested ${Math.abs(delta)}`);
  }

  let id: number;
  if (current.rows[0]) {
    id = Number(current.rows[0].id);
    await client.query(
      `UPDATE inventory_items
          SET quantity = $1,
              available = GREATEST($2::numeric - COALESCE(reserved, 0), 0),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [after, after, id]
    );
  } else {
    const inserted = await client.query(
      `INSERT INTO inventory_items
          (warehouse_id, ingredient_id, quantity, reserved, in_transit, available, updated_at)
       VALUES ($1, $2, $3, 0, 0, GREATEST($4::numeric, 0), CURRENT_TIMESTAMP)
       RETURNING id`,
      [warehouseId, ingredientId, delta, delta]
    );
    id = Number(inserted.rows[0].id);
  }

  return { id, before, after, delta, allowNegative };
}
