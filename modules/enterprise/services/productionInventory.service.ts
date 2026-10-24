import { pool } from '../../../server-db.js';
import { postManufacturingCompletion, postScrap } from './autoPosting.service.js';
import { logStatusChange } from './audit.service.js';
import { moveStock } from '../../warehouses/services/inventory.service.js';

// ═══════════════════════════════════════════════════════════════
// Production-Inventory Integration Service
// Handles inventory movements for manufacturing orders
// ═══════════════════════════════════════════════════════════════

export interface ProductionCompletionResult {
  success: boolean;
  moId: number;
  materialConsumed: Array<{ ingredient_id: number; ingredient_name: string; quantity: number; unit_cost: number; warehouse_id: number }>;
  finishedGoodsAdded?: { product_id: number; product_name: string; quantity: number; unit_cost: number };
  totalMaterialCost: number;
  totalProductionCost: number;
  scrapRecorded?: Array<{ ingredient_id: number; quantity: number; unit_cost: number; reason: string }>;
  journalEntry?: { success: boolean; journal_entry_id?: number; error?: string };
  error?: string;
}

/**
 * Complete a manufacturing order:
 * 1. Consume raw materials from inventory
 * 2. Add finished goods to inventory
 * 3. Record scrap
 * 4. Calculate total production cost
 * 5. Post automatic journal entry
 */
export async function completeManufacturingOrder(
  moId: number,
  quantityProduced: number,
  quantityScrapped: number,
  req?: any
): Promise<ProductionCompletionResult> {
  const client = await pool.connect();
  const result: ProductionCompletionResult = {
    success: false,
    moId,
    materialConsumed: [],
    totalMaterialCost: 0,
    totalProductionCost: 0,
    scrapRecorded: [],
  };

  try {
    await client.query('BEGIN');

    // 1. Get MO details with items
    const { rows: moRows } = await client.query(
      'SELECT * FROM manufacturing_orders WHERE id = $1 FOR UPDATE',
      [moId]
    );

    if (moRows.length === 0) {
      result.error = 'Manufacturing order not found';
      return result;
    }

    const mo = moRows[0];

    // 2. Get MO items (raw materials)
    const { rows: moItems } = await client.query(
      'SELECT * FROM manufacturing_order_items WHERE mo_id = $1',
      [moId]
    );

    // 3. Consume raw materials from inventory
    for (const item of moItems) {
      const consumedQty = (item.consumed_qty || item.planned_qty || 0);
      if (consumedQty <= 0) continue;

      // Deduct through the central inventory engine. This enforces the same
      // locking, negative-stock policy, idempotent movement key and ledger
      // rules used by warehouse transfers and purchase receiving.
      await moveStock(client, {
        warehouse_id: Number(item.warehouse_id),
        ingredient_id: Number(item.ingredient_id),
        delta: -Number(consumedQty),
        field: 'quantity',
        ref_type: 'production_consumption',
        ref_id: Number(moId) * 100000 + Number(item.ingredient_id),
        user: String(req?.user?.name || req?.user?.id || 'system'),
        notes: `استهلاك خامات - أمر إنتاج #${moId}`,
        unit_cost: Number(item.unit_cost) || 0
      });

      // inventory_transactions is written by moveStock for every movement.
      await client.query(
        `UPDATE inventory_transactions SET unit_cost=$1, reference=$2, created_by=$3
          WHERE reference_type='production_consumption' AND reference_id=$4`,
        [
          item.unit_cost || 0,
          `MO-${moId}`,
          req?.user?.id,
          Number(moId) * 100000 + Number(item.ingredient_id),
        ]
      );

      const itemCost = consumedQty * (item.unit_cost || 0);
      result.totalMaterialCost += itemCost;
      result.materialConsumed.push({
        ingredient_id: item.ingredient_id,
        ingredient_name: item.ingredient_name || '',
        quantity: consumedQty,
        unit_cost: item.unit_cost || 0,
        warehouse_id: item.warehouse_id,
      });
    }

    // 4. Add finished goods to inventory (if product is an ingredient)
    if (quantityProduced > 0 && mo.product_id) {
      // Check if the product exists as an ingredient
      const { rows: productIng } = await client.query(
        'SELECT id, cost FROM ingredients WHERE id = $1',
        [mo.product_id]
      );

      // Calculate unit production cost
      const unitCost = quantityProduced > 0 ? result.totalMaterialCost / quantityProduced : 0;

      let finishedIngredientId = Number(mo.product_id);
      if (productIng.length === 0) {
        // Legacy production orders may reference a product that has no
        // ingredient master row yet. Create it and use the returned ID so
        // the stock row and transaction always reference a real ingredient.
        const created = await client.query(
          `INSERT INTO ingredients (name, cost, type, is_product)
           VALUES ($1, $2, 'product', true)
           RETURNING id`,
          [mo.product_name || `منتج-${moId}`, unitCost]
        );
        finishedIngredientId = Number(created.rows[0]?.id);
      }

      // Add finished goods through the central inventory engine.
      await moveStock(client, {
        warehouse_id: Number(mo.branch_id || 1),
        ingredient_id: finishedIngredientId,
        delta: Number(quantityProduced),
        field: 'quantity',
        ref_type: 'production_receipt',
        ref_id: Number(moId),
        user: String(req?.user?.name || req?.user?.id || 'system'),
        notes: `منتج نهائي - أمر إنتاج #${moId}`,
        unit_cost: Number(unitCost) || 0
      });

      // inventory_transactions is written by moveStock for every movement.
      await client.query(
        `UPDATE inventory_transactions SET unit_cost=$1, reference=$2, created_by=$3
          WHERE reference_type='production_receipt' AND reference_id=$4 AND warehouse_id=$5`,
        [
          unitCost,
          `MO-${moId}`,
          req?.user?.id,
          Number(moId),
          Number(mo.branch_id || 1),
        ]
      );

      result.finishedGoodsAdded = {
        product_id: mo.product_id,
        product_name: mo.product_name || '',
        quantity: quantityProduced,
        unit_cost: unitCost,
      };
    }

    // 5. Record scrap if any
    if (quantityScrapped > 0) {
      // Calculate scrap cost proportionally
      const totalPlanned = quantityProduced + quantityScrapped;
      const scrapRatio = totalPlanned > 0 ? quantityScrapped / totalPlanned : 0;
      const scrapCost = result.totalMaterialCost * scrapRatio;

      await client.query(
        `INSERT INTO scrap_records (mo_id, ingredient_id, ingredient_name, warehouse_id, quantity, unit_cost, total_cost, reason, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          moId,
          mo.product_id,
          mo.product_name,
          mo.branch_id || 1,
          quantityScrapped,
          scrapCost / quantityScrapped,
          scrapCost,
          'production_scrap',
          `هالك إنتاج - أمر إنتاج #${moId}`,
        ]
      );

      result.scrapRecorded = [{
        ingredient_id: mo.product_id,
        quantity: quantityScrapped,
        unit_cost: scrapCost / Math.max(quantityScrapped, 1),
        reason: 'production_scrap',
      }];

      // Post scrap journal entry
      if (mo.branch_id) {
        await postScrap({
          recordId: moId,
          totalCost: scrapCost,
          reason: `هالك إنتاج - MO #${moId}`,
          branchId: mo.branch_id,
          companyId: (mo as any).company_id,
        });
      }
    }

    // 6. Update MO status
    result.totalProductionCost = result.totalMaterialCost;
    await client.query(
      `UPDATE manufacturing_orders SET
        status = 'completed',
        quantity_produced = COALESCE($1, quantity_produced),
        quantity_scrapped = COALESCE($2, quantity_scrapped),
        total_material_cost = $3,
        actual_end = COALESCE(actual_end, CURRENT_TIMESTAMP),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4`,
      [quantityProduced, quantityScrapped, result.totalMaterialCost, moId]
    );

    await client.query('COMMIT');

    // 7. Post automatic journal entry (outside transaction)
    if (mo.branch_id) {
      const jeResult = await postManufacturingCompletion({
        moId,
        totalMaterialCost: result.totalMaterialCost,
        totalProductionCost: 0,
        branchId: mo.branch_id,
        companyId: (mo as any).company_id,
      });
      result.journalEntry = jeResult;
    }

    // 8. Audit log
    if (req) {
      await logStatusChange(req, 'production', 'manufacturing_orders', moId, mo.status, 'completed', `MO #${moId} completed: ${quantityProduced} produced, ${quantityScrapped} scrapped`);
    }

    result.success = true;
    return result;
  } catch (error: any) {
    await client.query('ROLLBACK');
    result.error = error.message;
    return result;
  } finally {
    client.release();
  }
}

/**
 * Start a manufacturing order - reserve raw materials (optional)
 */
export async function startManufacturingOrder(moId: number, req?: any): Promise<{ success: boolean; error?: string }> {
  try {
    await pool.query(
      `UPDATE manufacturing_orders SET status = 'in_progress', actual_start = COALESCE(actual_start, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'planned'`,
      [moId]
    );

    if (req) {
      await logStatusChange(req, 'production', 'manufacturing_orders', moId, 'planned', 'in_progress', `MO #${moId} started`);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}