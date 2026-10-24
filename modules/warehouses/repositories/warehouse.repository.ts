import { erpPool } from "../../../server-erp-core.js";
import { CreateWarehouseDTO, AdjustStockDTO } from "../dto/warehouse.dto.js";

export class WarehouseRepository {
  async getAll(): Promise<any[]> {
    const result = await erpPool.query("SELECT * FROM warehouses ORDER BY is_main DESC, id ASC");
    return result.rows;
  }

  async create(wh: CreateWarehouseDTO): Promise<any> {
    // BUG-ERP-014b: the previous INSERT referenced a `location` column that does
    // not exist on `warehouses` (the real columns are address1/address/city),
    // and passed a boolean to the integer `is_main` column. Both caused the
    // insert to fail with a PostgreSQL error -> HTTP 500.
    const query = `
      INSERT INTO warehouses (name, address, is_main, branch_id, company_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      wh.name,
      (wh as any).location || (wh as any).address || null,
      (wh as any).is_main ? 1 : 0,
      (wh as any).branch_id ?? null,
      (wh as any).company_id ?? null
    ]);
    return result.rows[0];
  }

  async getInventory(warehouseId: number): Promise<any[]> {
    const query = `
      SELECT ii.*, i.name as ingredient_name, i.unit 
      FROM inventory_items ii
      JOIN ingredients i ON ii.ingredient_id = i.id
      WHERE ii.warehouse_id = $1
    `;
    const result = await erpPool.query(query, [warehouseId]);
    return result.rows;
  }

  async adjustStock(adj: AdjustStockDTO): Promise<void> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      const delta = adj.type === "addition" ? adj.quantity : -adj.quantity;

      // Update inventory items
      await client.query(`
        INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity)
        VALUES ($1, $2, $3)
        ON CONFLICT (warehouse_id, ingredient_id)
        DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity
      `, [adj.warehouse_id, adj.ingredient_id, delta]);

      // Record transaction
      await client.query(`
        INSERT INTO inventory_transactions (warehouse_id, ingredient_id, quantity, type, notes)
        VALUES ($1, $2, $3, 'manual_adjustment', $4)
      `, [adj.warehouse_id, adj.ingredient_id, delta, adj.notes || "تعديل يدوي للمخزن"]);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
