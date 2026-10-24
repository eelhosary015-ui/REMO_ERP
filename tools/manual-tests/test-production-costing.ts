import pg from "pg";
import dotenv from "dotenv";
import { ProductionRepository } from "./modules/production/repositories/production.repository.js";
import { applyStockMovement } from "./modules/warehouses/warehouses_api.routes.js";
import { pool } from "./server-db.js";

dotenv.config();

async function runTest() {
  console.log("==================================================");
  console.log("RUNNING PROGRAMMATIC PRODUCTION COSTING INTEGRATION TEST");
  console.log("==================================================");

  const client = await pool.connect();
  const repo = new ProductionRepository();

  try {
    // --------------------------------------------------
    // STEP 1 & 2: Create raw materials & purchase/receive them
    // --------------------------------------------------
    console.log("\n[TEST] Step 1: Creating test raw materials...");
    
    // Clear old test ingredients if any
    await client.query("DELETE FROM ingredients WHERE name IN ('خامة اختبارية قماش', 'خامة اختبارية خيط')");
    
    const mat1Res = await client.query(`
      INSERT INTO ingredients (name, code, item_code, barcode, unit, cost, avg_cost, last_purchase_price, category, allow_sales, allow_purchase)
      VALUES ('خامة اختبارية قماش', 'RAW-FABRIC-TST', 'RAW-FABRIC-TST', 'BAR-FABRIC-TST', 'كجم', 0, 0, 0, 'خامات', 0, 1)
      RETURNING id
    `);
    const fabricId = Number(mat1Res.rows[0].id);

    const mat2Res = await client.query(`
      INSERT INTO ingredients (name, code, item_code, barcode, unit, cost, avg_cost, last_purchase_price, category, allow_sales, allow_purchase)
      VALUES ('خامة اختبارية خيط', 'RAW-THREAD-TST', 'RAW-THREAD-TST', 'BAR-THREAD-TST', 'بكرة', 0, 0, 0, 'خامات', 0, 1)
      RETURNING id
    `);
    const threadId = Number(mat2Res.rows[0].id);

    console.log(`- Created raw material Fabric with ID: ${fabricId}`);
    console.log(`- Created raw material Thread with ID: ${threadId}`);

    // Create / get a test warehouse
    console.log("\n[TEST] Step 2: Resolving test warehouses...");
    const whRes = await client.query("SELECT id FROM warehouses WHERE status='active' ORDER BY id LIMIT 1");
    let testWarehouseId = Number(whRes.rows[0]?.id || 1);
    console.log(`- Using Warehouse ID: ${testWarehouseId}`);

    // Clear old stock for test ingredients in warehouse
    await client.query("DELETE FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id IN ($2, $3)", [testWarehouseId, fabricId, threadId]);

    // Receive raw materials into the warehouse
    console.log("\n[TEST] Step 3: Receiving raw materials into inventory with costs...");
    
    // Fabric: 20 KG at 300 EGP/KG
    await applyStockMovement(client, {
      warehouse_id: testWarehouseId,
      ingredient_id: fabricId,
      delta: 20,
      field: "quantity",
      ref_type: "goods_receipt",
      ref_id: 111,
      unit_cost: 300,
      notes: "شراء وتوريد قماش اختباري"
    });

    // Thread: 10 Rolls at 200 EGP/Roll
    await applyStockMovement(client, {
      warehouse_id: testWarehouseId,
      ingredient_id: threadId,
      delta: 10,
      field: "quantity",
      ref_type: "goods_receipt",
      ref_id: 222,
      unit_cost: 200,
      notes: "شراء وتوريد خيط اختباري"
    });

    // --------------------------------------------------
    // STEP 3: Verify raw material inventory valuation
    // --------------------------------------------------
    console.log("\n[TEST] Step 4: Verifying raw material stock and costs in DB...");
    const fabricItem = (await client.query("SELECT quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2", [testWarehouseId, fabricId])).rows[0];
    const threadItem = (await client.query("SELECT quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2", [testWarehouseId, threadId])).rows[0];

    console.log(`- Fabric on hand: ${fabricItem?.quantity} KG, Avg Cost: ${fabricItem?.avg_cost} EGP`);
    console.log(`- Thread on hand: ${threadItem?.quantity} Rolls, Avg Cost: ${threadItem?.avg_cost} EGP`);

    if (Number(fabricItem?.quantity) !== 20 || Number(fabricItem?.avg_cost) !== 300) {
      throw new Error(`Fabric stock validation failed! Expected 20 KG at 300 EGP, got ${fabricItem?.quantity} at ${fabricItem?.avg_cost}`);
    }
    if (Number(threadItem?.quantity) !== 10 || Number(threadItem?.avg_cost) !== 200) {
      throw new Error(`Thread stock validation failed! Expected 10 Rolls at 200 EGP, got ${threadItem?.quantity} at ${threadItem?.avg_cost}`);
    }
    console.log("✅ Raw material stock & valuation verified perfectly!");

    // --------------------------------------------------
    // STEP 4: Create BOM / Recipe for "منتج كابتن"
    // --------------------------------------------------
    console.log("\n[TEST] Step 5: Creating BOM / Recipe for 'منتج كابتن'...");
    
    // Clear old finished product and BOM
    await client.query("DELETE FROM products WHERE name = 'منتج كابتن'");
    await client.query("DELETE FROM ingredients WHERE name = 'منتج كابتن'");
    await client.query("DELETE FROM production_boms WHERE name = 'وصفة منتج كابتن'");

    const prodRes = await client.query(`
      INSERT INTO products (name, code, barcode, unit, cost, cost_price, price, is_active)
      VALUES ('منتج كابتن', 'ITEM-1093', 'ITEM-1093', 'وحدة', 0, 0, 1500, true)
      RETURNING id
    `);
    const finishedProductId = Number(prodRes.rows[0].id);

    const bomData = {
      id: "bom-test-captain",
      productId: finishedProductId,
      productName: "منتج كابتن",
      name: "وصفة منتج كابتن",
      version: "v1.0",
      scrapPercentage: 0,
      totalCost: 8000,
      items: [
        {
          materialId: fabricId,
          ingredientId: fabricId,
          name: "قماش اختباري",
          quantity: 2, // 2 KG per unit
          unit: "كجم",
          unitCost: 300,
          totalCost: 600
        },
        {
          materialId: threadId,
          ingredientId: threadId,
          name: "خيط اختباري",
          quantity: 1, // 1 Roll per unit
          unit: "بكرة",
          unitCost: 200,
          totalCost: 200
        }
      ],
      routings: [
        { name: "قص وتفصيل", duration: 30, cost: 0 }
      ]
    };

    const savedBom = await repo.saveBOM(bomData);
    console.log(`- Created BOM for product '${bomData.productName}' with ID: ${savedBom.id}`);

    // Update product to link to its ingredient row if auto-created
    const linkIng = (await client.query("SELECT id FROM ingredients WHERE name = 'منتج كابتن' LIMIT 1")).rows[0];
    const finishedIngredientId = Number(linkIng?.id);
    if (finishedIngredientId) {
      await client.query("UPDATE products SET ingredient_id = $1 WHERE id = $2", [finishedIngredientId, finishedProductId]);
      console.log(`- Linked Product to Finished Ingredient Row ID: ${finishedIngredientId}`);
    }

    // --------------------------------------------------
    // STEP 5: Create Production Order
    // --------------------------------------------------
    console.log("\n[TEST] Step 6: Creating Production Order for 10 units...");
    const orderNo = `PRD-TST-${Date.now().toString().slice(-4)}`;
    
    const savedOrder = await repo.saveOrder({
      orderNumber: orderNo,
      productId: finishedProductId,
      productName: "منتج كابتن",
      quantity: 10,
      bomId: savedBom.id,
      rawWarehouseId: testWarehouseId,
      finishedWarehouseId: testWarehouseId,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      priority: "high",
      status: "planned",
      progress: 0,
      notes: "أمر إنتاج تجريبي للتحقق من التكلفة",
      bomSnapshot: bomData
    });

    console.log(`- Created Production Order: ${savedOrder.order_number}`);

    // --------------------------------------------------
    // STEP 6: Execute & Complete Production Order
    // --------------------------------------------------
    console.log("\n[TEST] Step 7: Executing Production Order (Consuming materials & producing 10 finished units)...");
    
    // We pass Direct Labor Cost = 1,000 EGP, Manufacturing Overhead = 500 EGP
    const executionResult = await repo.executeProductionOrder({
      orderNumber: orderNo,
      rawWarehouseId: testWarehouseId,
      finishedWarehouseId: testWarehouseId,
      allowNegativeStock: false,
      user: "مهندس الإنتاج الاختباري",
      laborCost: 1000,
      overheadCost: 500,
      otherCost: 0,
      notes: "تنفيذ واحتساب تكاليف الإنتاج"
    });

    console.log("✅ Production Order execution response received!");
    console.log(`- Total Material Cost calculated: ${executionResult.totalMaterialCost} EGP`);
    console.log(`- Total Production Cost calculated: ${executionResult.totalProductionCost} EGP`);
    console.log(`- Unit Cost calculated: ${executionResult.costPerUnit} EGP`);

    // --------------------------------------------------
    // STEP 7-15: Cost and Quantity Assertions
    // --------------------------------------------------
    console.log("\n[TEST] Step 8: Asserting and Verifying Finished Product Stock & Cost...");
    
    const finishedStock = (await client.query(
      "SELECT quantity, available, avg_cost, last_cost, cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
      [testWarehouseId, finishedIngredientId]
    )).rows[0];

    const finishedIngRow = (await client.query(
      "SELECT current_stock, avg_cost, cost, last_purchase_price, is_manufactured FROM ingredients WHERE id = $1",
      [finishedIngredientId]
    )).rows[0];

    console.log(`\n--- FINISHED GOODS STOCK IN WAREHOUSE ---`);
    console.log(`Quantity: ${finishedStock?.quantity}`);
    console.log(`Available: ${finishedStock?.available}`);
    console.log(`Average Cost: ${finishedStock?.avg_cost} EGP`);
    console.log(`Last Cost: ${finishedStock?.last_cost} EGP`);
    console.log(`Valuation/Cost column: ${finishedStock?.cost} EGP`);
    console.log(`Calculated Inventory Value: ${Number(finishedStock?.quantity) * Number(finishedStock?.avg_cost)} EGP`);

    console.log(`\n--- FINISHED GOODS MASTER CATALOG (INGREDIENTS) ---`);
    console.log(`Current Stock: ${finishedIngRow?.current_stock}`);
    console.log(`Average Cost: ${finishedIngRow?.avg_cost} EGP`);
    console.log(`Standard Cost: ${finishedIngRow?.cost} EGP`);
    console.log(`Last Purchase Price: ${finishedIngRow?.last_purchase_price} EGP`);
    console.log(`Is Manufactured: ${finishedIngRow?.is_manufactured}`);

    // Assertions
    if (Number(finishedStock?.quantity) !== 10) {
      throw new Error(`Assertion failed: Expected finished quantity = 10, got ${finishedStock?.quantity}`);
    }
    if (Number(finishedStock?.avg_cost) !== 950) {
      throw new Error(`Assertion failed: Expected finished average cost = 950, got ${finishedStock?.avg_cost}`);
    }
    if (Number(finishedStock?.quantity) * Number(finishedStock?.avg_cost) !== 9500) {
      throw new Error(`Assertion failed: Expected finished inventory value = 9500, got ${Number(finishedStock?.quantity) * Number(finishedStock?.avg_cost)}`);
    }
    if (Number(finishedIngRow?.is_manufactured) !== 1) {
      throw new Error(`Assertion failed: Expected is_manufactured = 1, got ${finishedIngRow?.is_manufactured}`);
    }

    console.log("\n✅ Step 8 Assertions: Stock quantity, average cost, and inventory value are perfectly correct!");

    // Recalculated moving average cost assertion
    console.log("\n[TEST] Step 9: Testing Moving Average Recalculation with a second execution...");
    
    // Second execution with a different cost (e.g. 5 units at unit cost of 800 EGP, total 4,000 EGP)
    const secondOrderNo = `PRD-TST-2-${Date.now().toString().slice(-4)}`;
    
    // Artificially create a second order for 5 units
    const secondOrder = await repo.saveOrder({
      orderNumber: secondOrderNo,
      productId: finishedProductId,
      productName: "منتج كابتن",
      quantity: 5,
      bomId: savedBom.id,
      rawWarehouseId: testWarehouseId,
      finishedWarehouseId: testWarehouseId,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      priority: "normal",
      status: "planned",
      progress: 0,
      notes: "أمر إنتاج تجريبي ثاني",
      bomSnapshot: bomData
    });

    // Make sure we have raw materials (Fabric = 10 KG, Thread = 5 Rolls)
    // Add raw materials stock
    await applyStockMovement(client, {
      warehouse_id: testWarehouseId,
      ingredient_id: fabricId,
      delta: 10,
      field: "quantity",
      ref_type: "goods_receipt",
      ref_id: 1112,
      unit_cost: 300,
      notes: "شراء وتوريد قماش إضافي"
    });
    await applyStockMovement(client, {
      warehouse_id: testWarehouseId,
      ingredient_id: threadId,
      delta: 5,
      field: "quantity",
      ref_type: "goods_receipt",
      ref_id: 2223,
      unit_cost: 200,
      notes: "شراء وتوريد خيط إضافي"
    });

    // Execute with lower labor and overhead cost: Labor = 0, Overhead = 0
    // Material Cost = (5 * 2 * 300) + (5 * 1 * 200) = 3,000 + 1,000 = 4,000 EGP.
    // Labor = 0, Overhead = 0. Total cost = 4,000 EGP. Unit cost = 4000/5 = 800 EGP.
    const secondResult = await repo.executeProductionOrder({
      orderNumber: secondOrderNo,
      rawWarehouseId: testWarehouseId,
      finishedWarehouseId: testWarehouseId,
      allowNegativeStock: false,
      user: "مهندس الإنتاج الاختباري",
      laborCost: 0,
      overheadCost: 0,
      notes: "تنفيذ إضافي منخفض التكلفة"
    });

    console.log(`- Second Production Cost: ${secondResult.totalProductionCost} EGP, Unit Cost: ${secondResult.costPerUnit} EGP`);

    // Verify moving average on inventory row
    const stockAfterSecond = (await client.query(
      "SELECT quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
      [testWarehouseId, finishedIngredientId]
    )).rows[0];

    const valueAfterSecond = Number(stockAfterSecond.quantity) * Number(stockAfterSecond.avg_cost);
    console.log(`- New stock after second receipt: Quantity = ${stockAfterSecond.quantity}, Avg Cost = ${stockAfterSecond.avg_cost} EGP`);
    console.log(`- Recalculated total inventory value: ${valueAfterSecond} EGP`);

    // Expected quantity: 15
    // Expected value: 10 * 950 + 5 * 800 = 9,500 + 4,000 = 13,500 EGP
    // Expected avg cost: 13,500 / 15 = 900 EGP!
    if (Number(stockAfterSecond.quantity) !== 15) {
      throw new Error(`Assertion failed: Expected quantity = 15, got ${stockAfterSecond.quantity}`);
    }
    if (Number(stockAfterSecond.avg_cost) !== 900) {
      throw new Error(`Assertion failed: Expected average cost = 900, got ${stockAfterSecond.avg_cost}`);
    }
    if (valueAfterSecond !== 13500) {
      throw new Error(`Assertion failed: Expected inventory value = 13,500 EGP, got ${valueAfterSecond}`);
    }
    console.log("✅ Step 9 Assertions: Weighted moving average cost recalculated perfectly on sequential production receipts!");

    // Verify Cost Engine (cost_transactions)
    console.log("\n[TEST] Step 10: Verifying Cost Engine (cost_transactions) integration...");
    const costTx = (await client.query("SELECT * FROM cost_transactions WHERE source_type='production_order' AND source_id=$1", [orderNo])).rows[0];
    console.log(`- Cost Transaction found: Type = ${costTx?.transaction_type}, Amount = ${costTx?.amount} EGP`);
    if (!costTx || Number(costTx.amount) !== 9500) {
      throw new Error(`Assertion failed: Expected cost transaction amount = 9500, got ${costTx?.amount}`);
    }
    console.log("✅ Step 10: Cost Engine integration verified!");

    // Verify Accounting integration
    console.log("\n[TEST] Step 11: Verifying GL Journal Entry auto-posting integration...");
    const journal = (await client.query("SELECT * FROM journal_entries WHERE source_type='production_order' AND source_id=$1", [savedOrder.id])).rows[0];
    if (!journal) {
      throw new Error("Assertion failed: No journal entry found for production order!");
    }
    const journalLines = (await client.query("SELECT * FROM journal_entry_items WHERE journal_entry_id=$1", [journal.id])).rows;
    console.log(`- Journal Entry found: Reference = ${journal.reference}, Description = ${journal.description}`);
    for (const line of journalLines) {
      console.log(`  - Account Code: ${line.account_id}, Debit: ${line.debit}, Credit: ${line.credit}, Note: ${line.notes}`);
    }
    
    const debitLine = journalLines.find(l => Number(lineAmount(l.debit)) > 0);
    const creditLine = journalLines.find(l => Number(lineAmount(l.credit)) > 0);
    
    if (Number(lineAmount(debitLine?.debit)) !== 9500 || Number(lineAmount(creditLine?.credit)) !== 9500) {
      throw new Error(`Assertion failed: Expected Debit and Credit of 9500, got Debit = ${debitLine?.debit}, Credit = ${creditLine?.credit}`);
    }
    console.log("✅ Step 11: Accounting journal entry and double-entry balance verified perfectly!");

    // Verify trace link to Production Order
    console.log("\n[TEST] Step 12: Verifying traceability...");
    const receiptTx = (await client.query("SELECT * FROM inventory_transactions WHERE reference=$1 AND type='receive'", [orderNo])).rows[0];
    console.log(`- Inventory Receipt Ledger: Tx No = ${receiptTx?.transaction_number}, Reference Order = ${receiptTx?.reference}, Unit Cost = ${receiptTx?.unit_cost} EGP`);
    if (!receiptTx || Number(receiptTx.unit_cost) !== 950) {
      throw new Error(`Assertion failed: Expected inventory transaction unit cost = 950, got ${receiptTx?.unit_cost}`);
    }
    console.log("✅ Traceability links between inventory receipt, cost transaction, journal entry and Production Order verified perfectly!");

    // Clean up test data
    console.log("\n[TEST] Step 13: Cleaning up test data...");
    await client.query("DELETE FROM journal_entry_items WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE source_type='production_order' AND source_id IN ($1, $2))", [savedOrder.id, secondOrder.id]);
    await client.query("DELETE FROM journal_entries WHERE source_type='production_order' AND source_id IN ($1, $2)", [savedOrder.id, secondOrder.id]);
    await client.query("DELETE FROM cost_transactions WHERE source_type='production_order' AND source_id IN ($1, $2)", [orderNo, secondOrderNo]);
    await client.query("DELETE FROM inventory_transactions WHERE reference IN ($1, $2)", [orderNo, secondOrderNo]);
    await client.query("DELETE FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id IN ($2, $3, $4)", [testWarehouseId, fabricId, threadId, finishedIngredientId]);
    await client.query("DELETE FROM production_runs WHERE order_number IN ($1, $2)", [orderNo, secondOrderNo]);
    await client.query("DELETE FROM production_orders WHERE order_number IN ($1, $2)", [orderNo, secondOrderNo]);
    await client.query("DELETE FROM bom_items WHERE bom_id = $1", [savedBom.id]);
    await client.query("DELETE FROM production_boms WHERE id = $1", [savedBom.id]);
    await client.query("DELETE FROM products WHERE id = $1", [finishedProductId]);
    await client.query("DELETE FROM ingredients WHERE id IN ($1, $2, $3)", [fabricId, threadId, finishedIngredientId]);

    console.log("==================================================");
    console.log("🎉 ALL INTEGRATION TEST ASSERTIONS PASSED SUCCESSFULLY!");
    console.log("==================================================");

  } catch (err: any) {
    console.error("\n❌ TEST FAILED:", err.message || err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

function lineAmount(v: any) {
  return Number(v) || 0;
}

runTest().catch(() => process.exit(1));
