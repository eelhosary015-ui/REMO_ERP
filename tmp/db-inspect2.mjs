import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const q = async (label, sql, params = []) => {
  try {
    const r = await pool.query(sql, params);
    console.log(`\n=== ${label} ===`);
    console.table(r.rows);
  } catch (e) {
    console.log(`\n=== ${label} ERROR: ${e.message}`);
  }
};

await q('products', `SELECT id, name, unit, cost_price, cost, stock, ingredient_id, track_inventory, is_active FROM products ORDER BY id LIMIT 20`);
await q('ingredients', `SELECT id, name, unit, cost, avg_cost, current_stock, is_product FROM ingredients ORDER BY id LIMIT 20`);
await q('inventory_items', `SELECT id, warehouse_id, ingredient_id, quantity, reserved, available, avg_cost, cost FROM inventory_items ORDER BY id LIMIT 20`);
await q('warehouses', `SELECT id, name, code, allow_negative_stock FROM warehouses ORDER BY id LIMIT 20`);
await pool.end();
