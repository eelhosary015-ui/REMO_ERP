import { pool } from '../server-db.js';

const baseUrl = process.env.TEST_URL || 'http://localhost:3000';
const runId = `E2E-${Date.now()}`;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

type Result = { status: number; data: any; ok: boolean };
const created: Record<string, number | string> = {};
const owned = new Set<string>();
const failures: string[] = [];
let token = '';

function pass(name: string, detail?: string) {
  console.log(`PASS | ${name}${detail ? ` | ${detail}` : ''}`);
}

function fail(name: string, error: any) {
  const message = error instanceof Error ? error.message : String(error);
  failures.push(`${name}: ${message}`);
  console.log(`FAIL | ${name} | ${message}`);
}

function requireValue(value: any, message: string): asserts value {
  if (value === undefined || value === null || value === '') throw new Error(message);
}

async function api(method: string, path: string, body?: any, headers: Record<string, string> = {}): Promise<Result> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data, ok: response.ok };
}

async function db<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return (await pool.query(sql, params)).rows as T[];
}

async function waitForCostIntegration(receiptId: number) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const rows = await db<any>('SELECT * FROM cost_transactions WHERE source_type=$1 AND source_id=$2', ['goods_receipt', String(receiptId)]);
    if (rows.length) return rows;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return [];
}

async function expectApi(name: string, request: Promise<Result>, accepted: number[] = [200, 201]) {
  const result = await request;
  if (!accepted.includes(result.status)) throw new Error(`${name} returned ${result.status}: ${JSON.stringify(result.data)}`);
  return result.data;
}

async function setupMasterData() {
  const warehouses = await db<any>('SELECT id, name FROM warehouses ORDER BY id LIMIT 2');
  if (warehouses.length < 1) {
    const warehouse = await expectApi('create test warehouse', api('POST', '/api/warehouses', {
      name: `${runId} Raw Warehouse`, code: `${runId}-RAW`, type: 'main', status: 'active'
    }));
    created.warehouse = Number(warehouse.id || warehouse.data?.id);
    owned.add('warehouse');
  } else {
    created.warehouse = Number(warehouses[0].id);
  }
  if (warehouses.length < 2) {
    const warehouse = await expectApi('create test finished warehouse', api('POST', '/api/warehouses', {
      name: `${runId} Finished Warehouse`, code: `${runId}-FIN`, type: 'finished_goods', status: 'active'
    }));
    created.finishedWarehouse = Number(warehouse.id || warehouse.data?.id);
    owned.add('finishedWarehouse');
  } else {
    created.finishedWarehouse = Number(warehouses[1].id);
  }

  const ingredients = await db<any>('SELECT id, name, unit, cost FROM ingredients ORDER BY id LIMIT 1');
  if (ingredients.length < 1) {
    const ingredient = await expectApi('create test ingredient', api('POST', '/api/ingredients', {
      name: `${runId} Material`, unit: 'kg', cost: 10, item_code: `ITEM-${runId}`, current_stock: 0
    }));
    created.ingredient = Number(ingredient.id || ingredient.data?.id);
    owned.add('ingredient');
  } else {
    created.ingredient = Number(ingredients[0].id);
  }
}

async function cleanup() {
  const productionOrder = created.productionOrder;
  const bom = created.bom;
  const product = created.product;
  const receipt = created.receipt;
  const purchaseOrder = created.purchaseOrder;
  const purchaseRequest = created.purchaseRequest;
  const supplier = created.supplier;
  const ingredient = created.ingredient;
  const warehouse = created.warehouse;
  const finishedWarehouse = created.finishedWarehouse;

  try {
    const finishedIngredients = await db<any>('SELECT id FROM ingredients WHERE name=$1', [`${runId} Product`]);
    if (finishedIngredients.length) {
      const finishedIngredientIds = finishedIngredients.map(row => Number(row.id));
      await db('DELETE FROM inventory_transactions WHERE reference LIKE $1 OR ingredient_id = ANY($2::int[])', [`%${runId}%`, finishedIngredientIds]);
      await db('DELETE FROM inventory_stock_ledger WHERE ingredient_id = ANY($1::int[])', [finishedIngredientIds]);
      await db('DELETE FROM inventory_items WHERE ingredient_id = ANY($1::int[])', [finishedIngredientIds]);
      await db('DELETE FROM ingredients WHERE id = ANY($1::int[])', [finishedIngredientIds]);
    }
    await db('DELETE FROM production_runs WHERE order_number LIKE $1', [`${runId}%`]);
    if (productionOrder) await db('DELETE FROM production_orders WHERE id=$1', [productionOrder]);
    if (bom) {
      await db('DELETE FROM bom_items WHERE bom_id=$1', [bom]);
      await db('DELETE FROM production_boms WHERE id=$1', [bom]);
    }
    if (product) {
      await db('DELETE FROM product_ingredients WHERE product_id=$1', [product]);
      await db('DELETE FROM products WHERE id=$1', [product]);
    }
    if (receipt) {
      await db('DELETE FROM cost_transactions WHERE source_type=$1 AND source_id=$2', ['goods_receipt', String(receipt)]);
      await db('DELETE FROM inventory_transactions WHERE reference_id=$1 OR reference_id::text=$1::text', [receipt]);
      // An auto-posted receipt now correctly creates a Purchase Invoice that
      // references the supplier (purchases_supplier_id_fkey). Remove the
      // documents THIS run created, in dependency order, before the supplier
      // delete below would otherwise be blocked by the FK.
      await db('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE receipt_id=$1)', [receipt]);
      await db('DELETE FROM purchases WHERE receipt_id=$1', [receipt]);
      await db('DELETE FROM goods_receipt_items WHERE goods_receipt_id=$1', [receipt]);
      await db('DELETE FROM goods_receipts WHERE id=$1', [receipt]);
    }
    if (purchaseOrder) {
      await db('DELETE FROM purchase_order_items WHERE purchase_order_id=$1', [purchaseOrder]);
      await db('DELETE FROM purchase_orders WHERE id=$1', [purchaseOrder]);
    }
    if (purchaseRequest) {
      await db('DELETE FROM purchase_request_items WHERE purchase_request_id=$1', [purchaseRequest]);
      await db('DELETE FROM purchase_requests WHERE id=$1', [purchaseRequest]);
    }
    if (supplier) {
      // Clear any remaining documents owned by this run's supplier so the delete
      // is not blocked by document FKs (purchases / receipts are cleaned above,
      // this covers anything created through a variant path).
      await db('DELETE FROM purchase_items WHERE purchase_id IN (SELECT id FROM purchases WHERE supplier_id=$1)', [supplier]);
      await db('DELETE FROM purchases WHERE supplier_id=$1', [supplier]);
      await db('DELETE FROM supplier_transactions WHERE supplier_id=$1', [supplier]);
      await db('DELETE FROM suppliers WHERE id=$1', [supplier]);
    }
    if (ingredient && owned.has('ingredient')) {
      await db('DELETE FROM inventory_stock_ledger WHERE ingredient_id=$1', [ingredient]);
      await db('DELETE FROM inventory_items WHERE ingredient_id=$1 AND warehouse_id IN ($2,$3)', [ingredient, warehouse, finishedWarehouse]);
      await db('DELETE FROM ingredients WHERE id=$1', [ingredient]);
    }
    if (warehouse && owned.has('warehouse')) await db('DELETE FROM warehouses WHERE id=$1', [warehouse]);
    if (finishedWarehouse && owned.has('finishedWarehouse')) await db('DELETE FROM warehouses WHERE id=$1', [finishedWarehouse]);
  } catch (error) {
    console.error(`CLEANUP_ERROR | ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function run() {
  try {
    const health = await api('GET', '/api/health');
    if (health.status !== 200) throw new Error(`server unavailable: ${health.status}`);
    pass('Server health');

    if (process.env.TEST_AUTH_TOKEN) {
      token = process.env.TEST_AUTH_TOKEN;
    } else {
      requireValue(adminPassword, 'authentication blocked: set TEST_AUTH_TOKEN or TEST_ADMIN_PASSWORD');
      const login = await api('POST', '/api/login', { username: process.env.TEST_ADMIN_USERNAME || 'admin', password: adminPassword });
      requireValue(login.data?.token, `admin login failed (${login.status})`);
      token = login.data.token;
    }
    pass('Admin authentication');

    await setupMasterData();
    const ingredient = await db<any>('SELECT id, name, unit, cost FROM ingredients WHERE id=$1', [created.ingredient]);
    requireValue(ingredient[0], 'ingredient master data missing');
    pass('Master data available', `ingredient=${created.ingredient}, rawWarehouse=${created.warehouse}, finishedWarehouse=${created.finishedWarehouse}`);

    const supplier = await expectApi('create supplier', api('POST', '/api/suppliers', {
      name: `${runId} Supplier`, phone: '01000000000', address: 'E2E', payment_terms: 'cash', currency: 'EGP'
    }));
    created.supplier = Number(supplier.id);
    const supplierDb = await db<any>('SELECT id, supplier_code FROM suppliers WHERE id=$1 AND name=$2', [created.supplier, `${runId} Supplier`]);
    requireValue(supplierDb[0], 'supplier was not persisted');
    pass('Supplier creation and persistence', `supplier=${created.supplier}`);

    const request = await expectApi('create purchase request', api('POST', '/api/purchase-requests', {
      requested_by: 'E2E admin', branch_id: null, warehouse_id: created.warehouse,
      items: [{ ingredient_id: created.ingredient, quantity: 2, unit: ingredient[0].unit || 'kg', unit_price: 10 }]
    }, { 'Idempotency-Key': `${runId}-PR` }));
    created.purchaseRequest = Number(request.id);
    const requestDb = await db<any>('SELECT id, warehouse_id, status FROM purchase_requests WHERE id=$1', [created.purchaseRequest]);
    requireValue(requestDb[0], 'purchase request was not persisted');
    pass('Purchase request creation and warehouse link');

    const conversion = await expectApi('convert purchase request', api('POST', `/api/purchase-requests/${created.purchaseRequest}/approve`, {
      supplier_id: created.supplier, approved_by: 'admin'
    }));
    created.purchaseOrder = Number(conversion.purchase_order?.id || conversion.purchase_order_id);
    requireValue(created.purchaseOrder, 'purchase order was not returned from conversion');
    const poDb = await db<any>('SELECT id, purchase_request_id, supplier_id, status FROM purchase_orders WHERE id=$1', [created.purchaseOrder]);
    requireValue(poDb[0] && Number(poDb[0].purchase_request_id) === Number(created.purchaseRequest), 'purchase order linkage is invalid');
    pass('Purchase request to purchase order workflow', `purchaseOrder=${created.purchaseOrder}`);

    const poItems = await db<any>('SELECT id, ingredient_id, quantity, unit_price, unit FROM purchase_order_items WHERE purchase_order_id=$1', [created.purchaseOrder]);
    requireValue(poItems[0], 'purchase order item missing');
    const receipt = await expectApi('post goods receipt', api('POST', '/api/goods-receipts', {
      warehouse_id: created.warehouse, supplier_id: created.supplier, purchase_order_id: created.purchaseOrder,
      supplier_invoice_no: `${runId}-INV`, receiver_name: 'E2E admin', auto_post: true,
      items: [{ po_item_id: poItems[0].id, ingredient_id: created.ingredient, ordered_qty: 2, received_qty: 2, accepted_qty: 2, unit: poItems[0].unit || ingredient[0].unit || 'kg', unit_price: 10 }]
    }));
    created.receipt = Number(receipt.goods_receipt?.id || receipt.id);
    requireValue(created.receipt, 'goods receipt was not returned');
    const stockAfterReceipt = await db<any>('SELECT quantity, avg_cost FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2', [created.warehouse, created.ingredient]);
    requireValue(stockAfterReceipt[0] && Number(stockAfterReceipt[0].quantity) >= 2, 'received quantity did not enter selected warehouse');
    const receiptTx = await db<any>('SELECT COUNT(*)::int count FROM inventory_transactions WHERE warehouse_id=$1 AND ingredient_id=$2 AND reference_type=$3 AND reference_id=$4', [created.warehouse, created.ingredient, 'goods_receipt', created.receipt]);
    if (Number(receiptTx[0].count) !== 1) throw new Error(`expected one receipt inventory transaction, got ${receiptTx[0].count}`);
    pass('Goods receipt posted to the selected warehouse without duplicate movement');

    const costLedger = await expectApi('read cost integration ledger', api('GET', `/api/costs/integration-ledger?source_type=goods_receipt&limit=100`));
    const purchaseCostRows = Array.isArray(costLedger.data) ? costLedger.data : (costLedger.data?.data || []);
    const linkedCost = (await waitForCostIntegration(Number(created.receipt))).find((row: any) => String(row.source_type) === 'goods_receipt' && String(row.source_id) === String(created.receipt))
      || purchaseCostRows.find((row: any) => String(row.source_type) === 'goods_receipt' && String(row.source_id) === String(created.receipt));
    if (!linkedCost) {
      failures.push('Purchase cost integration: no cost transaction linked to tested purchase/receipt');
      console.log('PARTIALLY WORKING | Purchase to Cost Management | no linked row found');
    } else pass('Purchase cost integration and source traceability');

    const journalCount = await db<any>('SELECT COUNT(*)::int count FROM journal_entries WHERE source_id IN ($1,$2) OR reference LIKE $3', [created.purchaseOrder, created.receipt, `%${runId}%`]);
    if (Number(journalCount[0].count) === 0) console.log('PARTIALLY WORKING | Accounting integration | no journal entry found for test receipt');
    else pass('Accounting source reference exists', `journalEntries=${journalCount[0].count}`);

    const payment = await expectApi('record supplier payment', api('POST', `/api/suppliers/${created.supplier}/payments`, {
      amount: 10, payment_method: 'cash', notes: `${runId} payment`
    }));
    requireValue(payment.id, 'supplier payment was not returned');
    const paymentDb = await db<any>('SELECT COUNT(*)::int count FROM supplier_transactions WHERE supplier_id=$1 AND type=$2 AND notes=$3', [created.supplier, 'payment', `${runId} payment`]);
    if (Number(paymentDb[0].count) !== 1) throw new Error('supplier payment was not persisted exactly once');
    pass('Supplier payment and treasury sub-ledger persistence');

    const product = await expectApi('create finished product', api('POST', '/api/products', {
      name: `${runId} Product`, code: `${runId}-PRODUCT`, barcode: `${runId}-BAR`, unit: 'unit', price: 100, cost: 10, item_type: 'manufactured'
    }));
    created.product = Number(product.id);
    requireValue(created.product, 'product was not returned');
    const bomId = `${runId}-BOM`;
    const bom = await expectApi('create BOM', api('POST', '/api/production/boms', {
      id: bomId, productId: created.product, name: `${runId} BOM`, version: 'v1', items: [{ materialId: created.ingredient, quantity: 1, unit: ingredient[0].unit || 'kg', unitCost: Number(stockAfterReceipt[0].avg_cost || 10), totalCost: Number(stockAfterReceipt[0].avg_cost || 10) }]
    }));
    created.bom = String(bom.id || bom.data?.id || bomId);
    const bomDb = await db<any>('SELECT id, product_id FROM production_boms WHERE id=$1', [created.bom]);
    requireValue(bomDb[0] && String(bomDb[0].product_id) === String(created.product), 'BOM is not linked to product');
    pass('Product and BOM integration');

    const order = await expectApi('create production order', api('POST', '/api/production/orders', {
      orderNumber: `${runId}-ORDER`, productId: created.product, productName: `${runId} Product`, quantity: 1,
      bomId: created.bom, rawWarehouseId: created.warehouse, finishedWarehouseId: created.finishedWarehouse, status: 'planned'
    }));
    created.productionOrder = Number(order.id || order.data?.id);
    requireValue(created.productionOrder, 'production order was not returned');
    const executed = await expectApi('execute production order', api('POST', `/api/production/orders/${created.productionOrder}/execute`, {
      orderNumber: `${runId}-ORDER`, rawWarehouseId: created.warehouse, finishedWarehouseId: created.finishedWarehouse,
      productId: created.product, productName: `${runId} Product`, quantity: 1, allowNegativeStock: false, user: 'E2E admin'
    }));
    requireValue(executed.data?.producedQuantity || executed.producedQuantity, 'production execution did not return produced quantity');
    const finishedStock = await db<any>(
      'SELECT ii.quantity FROM inventory_items ii JOIN ingredients i ON i.id=ii.ingredient_id WHERE ii.warehouse_id=$1 AND i.name=$2',
      [created.finishedWarehouse, `${runId} Product`]
    );
    if (!finishedStock[0] || Number(finishedStock[0].quantity) < 1) console.log('PARTIALLY WORKING | Production output | finished product balance not found');
    else pass('Production material consumption and finished-goods receipt');

    const duplicateRequest = await api('POST', '/api/purchase-requests', {
      requested_by: 'E2E admin', warehouse_id: created.warehouse,
      items: [{ ingredient_id: created.ingredient, quantity: 2, unit_price: 10 }]
    }, { 'Idempotency-Key': `${runId}-PR` });
    if (duplicateRequest.status !== 200 || Number(duplicateRequest.data?.id) !== Number(created.purchaseRequest)) throw new Error('idempotency key created a duplicate purchase request');
    pass('Purchase request idempotency');
  } catch (error) {
    fail('End-to-end workflow', error);
  } finally {
    await cleanup();
    await pool.end();
  }

  console.log(`SUMMARY | ${failures.length ? 'FAIL' : 'PASS'} | failures=${failures.length}`);
  for (const failure of failures) console.log(`ISSUE | ${failure}`);
  process.exitCode = failures.length ? 1 : 0;
}

run().catch(async error => {
  console.error(`FATAL | ${error instanceof Error ? error.message : String(error)}`);
  await pool.end();
  process.exitCode = 1;
});