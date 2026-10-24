import "dotenv/config";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q = async (label, sql) => {
  const r = await pool.query(sql);
  console.log(label, JSON.stringify(r.rows));
};
await q("reasons:", `SELECT id, name_ar, type FROM wastage_reasons ORDER BY id`);
await q("wastage docs:", `SELECT COUNT(*)::int c FROM inventory_wastage`);
await q("wastage items:", `SELECT COUNT(*)::int c FROM inventory_wastage_items`);
await q("stock:", `SELECT warehouse_id, ingredient_id, quantity FROM inventory_items ORDER BY id`);
await q("ledger wastage:", `SELECT COUNT(*)::int c FROM inventory_stock_ledger WHERE ref_type IN ('wastage','wastage_cancel')`);
await q("cols:", `SELECT column_name FROM information_schema.columns WHERE table_name='inventory_wastage' AND column_name IN ('total_qty','branch_id','journal_entry_id','cancelled_at','cancel_reason')`);
await pool.end();
