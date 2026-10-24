import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const tables = ['products', 'ingredients', 'inventory_items', 'stock_balances', 'inventory_transactions', 'inventory_stock_ledger', 'inventory_movements', 'inventory_wastage', 'inventory_wastage_items', 'wastage_reasons', 'inventory_settings'];

for (const t of tables) {
  try {
    const cols = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
      [t]
    );
    if (cols.rows.length === 0) {
      console.log(`\n[${t}] MISSING`);
      continue;
    }
    const cnt = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
    console.log(`\n[${t}] rows=${cnt.rows[0].c}`);
    console.log('  ' + cols.rows.map(r => r.column_name).join(', '));
  } catch (e) {
    console.log(`\n[${t}] ERROR ${e.message}`);
  }
}
await pool.end();
