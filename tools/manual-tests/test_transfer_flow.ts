import { pool } from './server-db.ts';

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const trfNo = 'TRF-TEST-0001';
    const from_warehouse_id = 1;
    const to_warehouse_id = 2;
    const date = '2026-09-12';
    const type = 'standard';
    const priority = 'normal';
    const department = null;
    const purpose = null;
    const status = 'approved';
    const user_name = 'admin';
    const notes = '';
    const formattedItems = [{
      ingredient_id: 1,
      name: 'طماطم',
      code: '1',
      unit: 'كجم',
      barcode: '',
      requested_qty: 250,
      approved_qty: 250,
      dispatched_qty: 0,
      received_qty: 0,
      damaged_qty: 0,
      variance_qty: 0,
      unit_cost: 88.125,
      batch_number: '',
      expiry_date: null,
      serial_number: '',
      source_location_code: '',
      target_location_code: '',
      notes: ''
    }];
    const statusHistory = [{
      status: 'approved',
      action: 'تقديم طلب تحويل مخزني',
      user: 'admin',
      timestamp: new Date().toISOString(),
      notes: ''
    }];

    console.log('Step 1: Insert warehouse_transfers...');
    const result = await client.query(`
      INSERT INTO warehouse_transfers (
        transfer_number, transfer_no, date, from_warehouse_id, to_warehouse_id,
        type, priority, department, purpose, status, "user", notes,
        items, status_history, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING id
    `, [
      trfNo, trfNo, date, from_warehouse_id, to_warehouse_id,
      type, priority, department, purpose, status, user_name, notes,
      JSON.stringify(formattedItems), JSON.stringify(statusHistory)
    ]);
    const trfId = result.rows[0].id;
    console.log('Step 1 OK, trfId:', trfId);

    console.log('Step 2: Check stock...');
    const stockRes = await client.query(
      `SELECT quantity, available FROM inventory_items
       WHERE warehouse_id=$1 AND ingredient_id=$2
       FOR UPDATE`,
      [from_warehouse_id, 1]
    );
    console.log('Step 2 OK, stock:', stockRes.rows[0]);

    console.log('Step 3: Update inventory_items for warehouse 1...');
    const existing1 = await client.query(
      `SELECT id, quantity, reserved, in_transit FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2`,
      [from_warehouse_id, 1]
    );
    const beforeQty1 = Number(existing1.rows[0].quantity || 0);
    const newQty1 = beforeQty1 - 250;
    await client.query(
      `UPDATE inventory_items SET quantity=$1, available = GREATEST(quantity - COALESCE(reserved,0), 0) WHERE id=$2`,
      [newQty1, existing1.rows[0].id]
    );
    console.log('Step 3 OK, updated warehouse 1');

    console.log('Step 4: Update inventory_items for warehouse 2...');
    const existing2 = await client.query(
      `SELECT id, quantity, reserved, in_transit FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2`,
      [to_warehouse_id, 1]
    );
    if (existing2.rows.length > 0) {
      const beforeQty2 = Number(existing2.rows[0].quantity || 0);
      const newQty2 = beforeQty2 + 250;
      await client.query(
        `UPDATE inventory_items SET quantity=$1, available = GREATEST(quantity - COALESCE(reserved,0), 0) WHERE id=$2`,
        [newQty2, existing2.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, reserved, in_transit, available)
         VALUES ($1,$2,$3,$4,$5,GREATEST($3::numeric - $4::numeric, 0))`,
        [to_warehouse_id, 1, 250, 0, 0]
      );
    }
    console.log('Step 4 OK, updated warehouse 2');

    console.log('Step 5: Update warehouse_transfers status...');
    await client.query(`
      UPDATE warehouse_transfers
      SET status = 'completed',
          approved_at = NOW(),
          approved_by = $1,
          dispatched_at = NOW(),
          dispatched_by = $1,
          dispatch_date = NOW(),
          received_at = NOW(),
          received_date = NOW(),
          received_by = $1,
          driver_name = $2,
          vehicle_no = $3,
          shipping_cost = $4,
          items = $5,
          status_history = $6,
          updated_at = NOW()
      WHERE id = $7
    `, [
      user_name, 'jhjkhkj', '598', 50,
      JSON.stringify(formattedItems), JSON.stringify(statusHistory), trfId
    ]);
    console.log('Step 5 OK');

    console.log('Step 6: Insert ledger in inventory_transactions...');
    const txNumber = `TX-TRF-POST-${trfNo}`;
    const ledgerItems = JSON.stringify(formattedItems.map((i: any) => ({
      ingredient_id: i.ingredient_id,
      name: i.name,
      quantity: i.requested_qty,
      unit: i.unit,
      price: i.unit_cost || 0
    })));
    await client.query(`
      INSERT INTO inventory_transactions
        (transaction_number, date, warehouse_id, type, reason, reference, "user", status, notes, items)
      VALUES ($1, CURRENT_DATE, $2, 'transfer', $3, $4, $5, 'approved', $6, $7)
    `, [
      txNumber,
      from_warehouse_id,
      `ترحيل تحويل إلى مخزن #${to_warehouse_id}`,
      trfNo,
      user_name,
      `تحويل مخزني معتمد ومُرحّل إلى المخزن #${to_warehouse_id}`,
      ledgerItems
    ]);
    console.log('Step 6 OK');

    await client.query('ROLLBACK');
    console.log('ALL STEPS PASSED SUCCESSFULLY (ROLLED BACK FOR TEST)');
  } catch (err) {
    console.error('FAILED AT STEP:', err);
    await client.query('ROLLBACK');
  } finally {
    client.release();
    process.exit(0);
  }
})();
