import { pool } from './server-db.ts';
(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO warehouse_transfers (
        transfer_number, transfer_no, date, from_warehouse_id, to_warehouse_id,
        type, priority, department, purpose, status, user, notes,
        items, status_history, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
    `, ['T1', 'T1', '2026-09-12', 1, 2, 'standard', 'normal', null, null, 'approved', 'admin', '', '[]', '[]']);
    console.log('Unquoted user in warehouse_transfers OK');
    await client.query('ROLLBACK');
  } catch(e) {
    console.error('Error with unquoted user in warehouse_transfers:', e.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit(0);
  }
})();
