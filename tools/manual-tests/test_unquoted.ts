import { pool } from './server-db.ts';
(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO inventory_transactions
        (transaction_number, date, warehouse_id, type, reason, reference, user, status, notes, items)
      VALUES ($1, CURRENT_DATE, $2, 'transfer', $3, $4, $5, 'approved', $6, $7)
    `, ['TX-TEST', 1, 'reason', 'ref', 'admin', 'notes', '[]']);
    console.log('Unquoted user OK');
    await client.query('ROLLBACK');
  } catch(e) {
    console.error('Error with unquoted user:', e.message);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit(0);
  }
})();
