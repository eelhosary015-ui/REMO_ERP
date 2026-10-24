import { erpPool } from "../../../server-erp-core.js";
import { 
  CreateProductionRunDTO, 
  ExecuteProductionOrderDTO, 
  CheckAvailabilityResponse, 
  CheckAvailabilityItemResult 
} from "../dto/production.dto.js";
import { applyStockMovement } from "../../warehouses/warehouses_api.routes.js";
import { UnitConversionService } from "../../common/services/unit_conversion.service.js";
import { postProductionEntry } from "../../accounts/services/auto-posting.service.js";
import { recordProductionCost } from "../../costs/services/cost.integration.service.js";

export class ProductionRepository {
  private static initialized: boolean = false;
  private static initPromise: Promise<void> | null = null;

  constructor() {
    this.ensureTableExists();
  }

  private async ensureTableExists(): Promise<void> {
    if (ProductionRepository.initialized) return;
    if (ProductionRepository.initPromise) return ProductionRepository.initPromise;

    ProductionRepository.initPromise = (async () => {
      try {
        // 1. Production Runs Table
      await erpPool.query(`
        CREATE TABLE IF NOT EXISTS production_runs (
          id SERIAL PRIMARY KEY,
          order_number VARCHAR(100),
          product_id INTEGER,
          warehouse_id INTEGER,
          finished_warehouse_id INTEGER,
          quantity DECIMAL(12,2) NOT NULL,
          status TEXT DEFAULT 'completed',
          total_cost DECIMAL(12,2) DEFAULT 0,
          unit_cost DECIMAL(12,2) DEFAULT 0,
          bom_id TEXT,
          bom_snapshot TEXT,
          notes TEXT,
          executed_by TEXT,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. Production Orders Table
      await erpPool.query(`
        CREATE TABLE IF NOT EXISTS production_orders (
          id SERIAL PRIMARY KEY,
          order_number VARCHAR(100) UNIQUE NOT NULL,
          product_id VARCHAR(100) NOT NULL,
          product_name VARCHAR(255),
          quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
          bom_id VARCHAR(100),
          raw_warehouse_id INTEGER,
          finished_warehouse_id INTEGER,
          start_date VARCHAR(50),
          end_date VARCHAR(50),
          priority VARCHAR(50) DEFAULT 'normal',
          status VARCHAR(50) DEFAULT 'planned',
          progress INTEGER DEFAULT 0,
          sales_reference VARCHAR(100),
          work_center_id VARCHAR(100),
          supervisor VARCHAR(100),
          notes TEXT,
          bom_snapshot TEXT,
          total_cost DECIMAL(12,2) DEFAULT 0,
          cost_per_unit DECIMAL(12,2) DEFAULT 0,
          executed_by VARCHAR(100),
          executed_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 3. Production BOMs Table
      await erpPool.query(`
        CREATE TABLE IF NOT EXISTS production_boms (
          id VARCHAR(100) PRIMARY KEY,
          product_id VARCHAR(100) NOT NULL,
          name VARCHAR(255) NOT NULL,
          version VARCHAR(50) DEFAULT 'v1.0',
          scrap_percentage DECIMAL(5,2) DEFAULT 0,
          items_json TEXT NOT NULL,
          routings_json TEXT,
          total_cost DECIMAL(12,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Alter columns safely if they were created earlier
      try {
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS order_number VARCHAR(100)");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS finished_warehouse_id INTEGER");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS total_cost DECIMAL(12,2) DEFAULT 0");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(12,2) DEFAULT 0");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS bom_id TEXT");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS bom_snapshot TEXT");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS executed_by TEXT");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(12,2) DEFAULT 0");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS overhead_cost DECIMAL(12,2) DEFAULT 0");
        await erpPool.query("ALTER TABLE production_runs ADD COLUMN IF NOT EXISTS other_cost DECIMAL(12,2) DEFAULT 0");
        await erpPool.query("ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS is_executed BOOLEAN DEFAULT false");
        await erpPool.query("ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS executed_by VARCHAR(100)");
        await erpPool.query("ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS executed_at TIMESTAMP");
        await erpPool.query("ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(12,2) DEFAULT 0");
        await erpPool.query("ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS overhead_cost DECIMAL(12,2) DEFAULT 0");
        await erpPool.query("ALTER TABLE production_orders ADD COLUMN IF NOT EXISTS other_cost DECIMAL(12,2) DEFAULT 0");
        try {
          // Legacy databases may keep both BOM identifiers as INTEGER while the
          // production service accepts stable string IDs. Drop and restore the
          // FK around the coordinated type conversion.
          await erpPool.query("ALTER TABLE bom_items DROP CONSTRAINT IF EXISTS bom_items_bom_id_fkey");
          await erpPool.query("ALTER TABLE bom_items DROP CONSTRAINT IF EXISTS bom_items_ingredient_id_fkey");
          await erpPool.query("ALTER TABLE production_boms ALTER COLUMN id TYPE TEXT USING id::text");
          await erpPool.query("ALTER TABLE production_boms ALTER COLUMN product_id TYPE TEXT USING product_id::text");
          await erpPool.query("ALTER TABLE production_boms ALTER COLUMN product_id DROP NOT NULL");
          await erpPool.query("ALTER TABLE production_boms ALTER COLUMN version TYPE TEXT USING version::text");
          await erpPool.query("ALTER TABLE bom_items ALTER COLUMN bom_id TYPE TEXT USING bom_id::text");
          await erpPool.query("ALTER TABLE bom_items ALTER COLUMN ingredient_id TYPE TEXT USING ingredient_id::text");
          await erpPool.query("ALTER TABLE production_orders ALTER COLUMN product_id TYPE TEXT USING product_id::text");
          await erpPool.query("ALTER TABLE production_runs ALTER COLUMN product_id TYPE TEXT USING product_id::text");
          await erpPool.query("ALTER TABLE bom_items ADD CONSTRAINT bom_items_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES production_boms(id) ON DELETE CASCADE");
        } catch (bomSchemaError: any) {
          console.error("[Production Schema] BOM identifier migration failed:", bomSchemaError?.message || bomSchemaError);
        }
        await erpPool.query("ALTER TABLE production_boms ADD COLUMN IF NOT EXISTS items_json TEXT");
        await erpPool.query("ALTER TABLE production_boms ADD COLUMN IF NOT EXISTS routings_json TEXT");
        try { await erpPool.query("ALTER TABLE bom_items ALTER COLUMN bom_id TYPE TEXT"); } catch (_) {}
        await erpPool.query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS reserved DECIMAL(14,4) DEFAULT 0");
        await erpPool.query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS in_transit DECIMAL(14,4) DEFAULT 0");
        await erpPool.query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS available DECIMAL(14,4) DEFAULT 0");
        await erpPool.query("UPDATE inventory_items SET available = GREATEST(COALESCE(quantity,0) - COALESCE(reserved,0), 0)");
        
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS code TEXT");
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS item_code TEXT");
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS category TEXT");
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(14,4) DEFAULT 0");
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS last_purchase_price DECIMAL(14,4) DEFAULT 0");
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS current_stock DECIMAL(14,4) DEFAULT 0");
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS min_stock DECIMAL(12,3) DEFAULT 0");
        await erpPool.query("ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS is_manufactured INTEGER DEFAULT 0");
        await erpPool.query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS avg_cost DECIMAL(14,4) DEFAULT 0");
        await erpPool.query("ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS cost DECIMAL(14,4) DEFAULT 0");
        // The production sync must use the actual products schema. Some older
        // databases have neither `active` nor `is_active`; create the canonical
        // column once and never write to the obsolete `active` column.
        try { await erpPool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true"); } catch (_) {}

        // IMPORTANT: repair legacy INTEGER cost/quantity columns instead of merely
        // adding missing columns. PostgreSQL error 22P02 occurs when a decimal such
        // as 10.15 is sent to an INTEGER column. The helper also removes an old
        // incompatible default before changing the type, then restores a numeric
        // default. Each column is repaired independently so one legacy column cannot
        // prevent the remaining production schema repairs from running.
        try {
          await erpPool.query(`
            DO $$
            DECLARE r RECORD;
            BEGIN
              FOR r IN (
                SELECT t.tgname FROM pg_trigger t
                JOIN pg_class c ON t.tgrelid = c.oid
                WHERE c.relname = 'inventory_items' AND NOT t.tgisinternal
              ) LOOP
                EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON inventory_items';
              END LOOP;
            END $$;
          `);
        } catch (_) {
          try { await erpPool.query("DROP TRIGGER IF EXISTS trg_guard_inventory_items_integrity ON inventory_items"); } catch (__) {}
        }

        const repairDecimalColumn = async (table: string, column: string, precision: string, defaultValue = '0') => {
          try {
            const colCheck = await erpPool.query(
              `SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
              [table, column]
            );
            if (colCheck.rows?.[0]?.data_type === 'numeric') {
              return;
            }
          } catch (_) {}
          try {
            await erpPool.query(`ALTER TABLE ${table} ALTER COLUMN ${column} DROP DEFAULT`);
          } catch (_) {}
          await erpPool.query(
            `ALTER TABLE ${table} ALTER COLUMN ${column} TYPE NUMERIC(${precision}) USING COALESCE(NULLIF(TRIM(${column}::text), ''), '0')::numeric`
          );
          try {
            await erpPool.query(`ALTER TABLE ${table} ALTER COLUMN ${column} SET DEFAULT ${defaultValue}`);
          } catch (_) {}
        };

        for (const [table, column, precision] of [
          ['ingredients', 'cost', '14,4'],
          ['ingredients', 'avg_cost', '14,4'],
          ['ingredients', 'last_purchase_price', '14,4'],
          ['ingredients', 'current_stock', '14,4'],
          ['ingredients', 'min_stock', '12,3'],
          ['inventory_items', 'quantity', '14,4'],
          ['inventory_items', 'min_quantity', '14,4'],
          ['inventory_items', 'reserved', '14,4'],
          ['inventory_items', 'in_transit', '14,4'],
          ['inventory_items', 'available', '14,4'],
          ['inventory_items', 'avg_cost', '14,4'],
          ['inventory_items', 'cost', '14,4']
        ] as const) {
          // Repair each legacy column independently. One optional legacy column
          // must never prevent the remaining production schema from being fixed.
          try { await repairDecimalColumn(table, column, precision); } catch (err: any) {
            console.warn(`[Production Schema] Skipped ${table}.${column}:`, err?.message || err);
          }
        }

        try {
          await erpPool.query(`
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'guard_inventory_items_integrity') THEN
                DROP TRIGGER IF EXISTS trg_guard_inventory_items_integrity ON inventory_items;
                CREATE TRIGGER trg_guard_inventory_items_integrity
                BEFORE INSERT OR UPDATE ON inventory_items
                FOR EACH ROW EXECUTE FUNCTION guard_inventory_items_integrity();
              END IF;
            END $$;
          `);
        } catch (_) {}

        // Reconcile any completed production runs whose finished items have 0 cost or missing stock_valuation records
        try {
          const completedRunsRes = await erpPool.query(`
            SELECT pr.id, pr.order_number, pr.product_id, pr.finished_warehouse_id, pr.warehouse_id,
                   pr.quantity, pr.total_cost, pr.unit_cost, pr.labor_cost, pr.overhead_cost, pr.other_cost,
                   po.id as order_id, po.product_name, po.cost_per_unit as order_unit_cost, po.total_cost as order_total_cost
            FROM production_runs pr
            LEFT JOIN production_orders po ON po.order_number = pr.order_number
            WHERE pr.status = 'completed'
            ORDER BY pr.id ASC
          `);
          for (const run of completedRunsRes.rows) {
            const qty = Number(run.quantity || 1);
            const totalCost = Number(run.total_cost || run.order_total_cost || 0);
            const unitCost = Number(run.unit_cost || run.order_unit_cost || (qty > 0 ? totalCost / qty : 0));
            if (unitCost > 0) {
              const whId = Number(run.finished_warehouse_id || run.warehouse_id || 1);
              const prodName = String(run.product_name || '').trim();
              if (prodName) {
                const matchIngRes = await erpPool.query(
                  `SELECT id FROM ingredients WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) OR barcode = $2 OR code = $2`,
                  [prodName, String(run.product_id || '')]
                );
                for (const ingRow of matchIngRes.rows) {
                  await erpPool.query(
                    `UPDATE ingredients SET cost = CASE WHEN COALESCE(cost, 0) <= 0 THEN $1 ELSE cost END, avg_cost = CASE WHEN COALESCE(avg_cost, 0) <= 0 THEN $1 ELSE avg_cost END WHERE id = $2`,
                    [unitCost, ingRow.id]
                  ).catch(() => {});
                  await erpPool.query(
                    `UPDATE inventory_items SET avg_cost = CASE WHEN COALESCE(avg_cost, 0) <= 0 THEN $1 ELSE avg_cost END, cost = CASE WHEN COALESCE(cost, 0) <= 0 THEN $1 ELSE cost END, last_cost = CASE WHEN COALESCE(last_cost, 0) <= 0 THEN $1 ELSE last_cost END WHERE ingredient_id = $2`,
                    [unitCost, ingRow.id]
                  ).catch(() => {});

                  const valCheck = await erpPool.query(
                    `SELECT id FROM stock_valuation WHERE ingredient_id = $1 AND production_order = $2 LIMIT 1`,
                    [ingRow.id, run.order_number]
                  ).catch(() => ({ rows: [] }));
                  if (valCheck.rows.length === 0) {
                    const orderRef = Number(run.order_id || run.id || 1);
                    const rcTx = `TXN-PRD-REC-${orderRef}`;
                    const labor = Number(run.labor_cost || 0);
                    const overhead = Number(run.overhead_cost || 0);
                    const other = Number(run.other_cost || 0);
                    const directMat = Math.max(0, totalCost - labor - overhead - other);
                    await erpPool.query(
                      `INSERT INTO stock_valuation (
                        ingredient_id, warehouse_id, valuation_date, quantity_on_hand, unit_cost, total_value,
                        valuation_method, reference_type, reference_id, production_order, production_receipt, cost_components, notes
                      ) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, 'weighted_average', 'production_receipt', $6, $7, $8, $9, $10)`,
                      [
                        ingRow.id,
                        whId,
                        qty,
                        unitCost,
                        Math.round(qty * unitCost * 100) / 100,
                        String(orderRef),
                        run.order_number,
                        rcTx,
                        JSON.stringify({
                          direct_materials: directMat,
                          direct_labor: labor,
                          overhead: overhead,
                          other: other,
                          total_production_cost: totalCost,
                          unit_cost: unitCost,
                          produced_quantity: qty
                        }),
                        `تقييم مخزون استلام إنتاج تام لأمر الإنتاج رقم ${run.order_number} - سند استلام ${rcTx}`
                      ]
                    ).catch(() => {});
                  }
                }
              }
            }
          }
        } catch (_) {}
      } catch (_) {}

      ProductionRepository.initialized = true;
    } catch (err: any) {
      console.error("Failed to ensure production tables exist:", err.message);
    } finally {
      ProductionRepository.initPromise = null;
    }
    })();
    return ProductionRepository.initPromise;
  }

  // ─────────────────────────────────────────────────────────────
  // PRODUCTION RUNS
  // ─────────────────────────────────────────────────────────────
  async getAll(): Promise<any[]> {
    await this.ensureTableExists();
    const query = `
      SELECT pr.*, p.name as product_name, w.name as warehouse_name, fw.name as finished_warehouse_name
      FROM production_runs pr
      LEFT JOIN products p ON pr.product_id = p.id
      LEFT JOIN warehouses w ON pr.warehouse_id = w.id
      LEFT JOIN warehouses fw ON pr.finished_warehouse_id = fw.id
      ORDER BY pr.created_at DESC
    `;
    const result = await erpPool.query(query);
    return result.rows;
  }

  async findById(id: number): Promise<any> {
    await this.ensureTableExists();
    const query = `
      SELECT pr.*, p.name as product_name, w.name as warehouse_name, fw.name as finished_warehouse_name
      FROM production_runs pr
      LEFT JOIN products p ON pr.product_id = p.id
      LEFT JOIN warehouses w ON pr.warehouse_id = w.id
      LEFT JOIN warehouses fw ON pr.finished_warehouse_id = fw.id
      WHERE pr.id = $1
    `;
    const result = await erpPool.query(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // ─────────────────────────────────────────────────────────────
  // BOM / RECIPES REPOSITORY
  // ─────────────────────────────────────────────────────────────
  async getBOMs(): Promise<any[]> {
    await this.ensureTableExists();
    try {
      const res = await erpPool.query("SELECT * FROM production_boms ORDER BY created_at DESC");
      if (res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          id: row.id,
          productId: row.product_id,
          name: row.name,
          version: row.version,
          scrapPercentage: parseFloat(row.scrap_percentage) || 0,
          totalCost: parseFloat(row.total_cost) || 0,
          items: typeof row.items_json === 'string' ? JSON.parse(row.items_json || '[]') : (row.items_json || []),
          routings: typeof row.routings_json === 'string' ? JSON.parse(row.routings_json || '[]') : (row.routings_json || [])
        }));
      }
    } catch (e) {
      console.warn("Failed to query production_boms from database, using fallback:", e);
    }
    return [];
  }

  async saveBOM(bom: any): Promise<any> {
    await this.ensureTableExists();
    const bomId = bom.id || `bom-${Date.now()}`;
    const itemsJson = JSON.stringify(bom.items || []);
    const routingsJson = JSON.stringify(bom.routings || []);
    const scrap = Number(bom.scrapPercentage) || 0;
    const totalCost = Number(bom.totalCost) || 0;

    const query = `
      INSERT INTO production_boms (id, product_id, product_name, name, version, scrap_percentage, items_json, routings_json, total_cost)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id)
      DO UPDATE SET
        product_id = EXCLUDED.product_id,
        product_name = EXCLUDED.product_name,
        name = EXCLUDED.name,
        version = EXCLUDED.version,
        scrap_percentage = EXCLUDED.scrap_percentage,
        items_json = EXCLUDED.items_json,
        routings_json = EXCLUDED.routings_json,
        total_cost = EXCLUDED.total_cost,
        updated_at = NOW()
      RETURNING *
    `;

    const res = await erpPool.query(query, [
      bomId,
      String(bom.productId || ''),
      bom.productName || bom.name || 'منتج تصنيع',
      bom.name || 'وصفة تصنيع',
      bom.version || 'v1.0',
      scrap,
      itemsJson,
      routingsJson,
      totalCost
    ]);

    // Also sync the legacy bom_items table so the costing engine and other modules can count ingredients
    try {
      await erpPool.query("DELETE FROM bom_items WHERE bom_id = $1", [bomId]);
      let sortOrder = 1;
      for (const item of (bom.items || [])) {
        const materialId = item.materialId || item.ingredient_id || item.ingredientId || item.id;
        if (materialId) {
          await erpPool.query(
            `INSERT INTO bom_items (bom_id, ingredient_id, quantity, unit, unit_cost, total_cost, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              bomId,
              String(materialId),
              Number(item.quantity) || 0,
              item.unit || 'وحدة',
              Number(item.unitCost) || 0,
              Number(item.totalCost) || 0,
              sortOrder++
            ]
          );
        }
      }
    } catch (e) {
      console.warn("Failed to sync bom_items:", e);
    }

    // Also sync with product_ingredients for backward compatibility with restaurant/recipes module
    const numericProdId = parseInt(String(bom.productId).replace(/[^0-9]/g, ''));
    if (!isNaN(numericProdId) && numericProdId > 0 && Array.isArray(bom.items)) {
      try {
        const prodCheck = await erpPool.query("SELECT id FROM products WHERE id = $1", [numericProdId]);
        if (prodCheck.rows.length > 0) {
          await erpPool.query("DELETE FROM product_ingredients WHERE product_id = $1", [numericProdId]);
          for (const it of bom.items) {
            const rawId = String(it.materialId || it.ingredient_id || it.id || '');
            const ingId = parseInt(rawId.replace(/[^0-9]/g, ''));
            if (!isNaN(ingId) && ingId > 0) {
              const ingCheck = await erpPool.query("SELECT id FROM ingredients WHERE id = $1", [ingId]);
              if (ingCheck.rows.length > 0) {
                await erpPool.query(
                  "INSERT INTO product_ingredients (product_id, ingredient_id, quantity, waste_percent, size_name) VALUES ($1, $2, $3, $4, $5)",
                  [numericProdId, ingId, Number(it.quantity) || 1, scrap, '']
                );
              }
            }
          }
        }
      } catch (err) {
        console.warn("Could not sync product_ingredients:", err);
      }
    }

    return res.rows[0] || bom;
  }

  // ─────────────────────────────────────────────────────────────
  // PRODUCTION ORDERS REPOSITORY
  // ─────────────────────────────────────────────────────────────
  async getOrders(): Promise<any[]> {
    await this.ensureTableExists();
    try {
      const res = await erpPool.query("SELECT * FROM production_orders ORDER BY created_at DESC");
      if (res.rows.length > 0) {
        return res.rows.map((row: any) => ({
          id: String(row.id),
          orderNumber: row.order_number,
          productId: row.product_id,
          productName: row.product_name,
          quantity: parseFloat(row.quantity) || 0,
          bomId: row.bom_id,
          rawWarehouseId: row.raw_warehouse_id,
          finishedWarehouseId: row.finished_warehouse_id,
          startDate: row.start_date,
          endDate: row.end_date,
          priority: row.priority,
          status: row.status,
          progress: parseInt(row.progress) || 0,
          salesReference: row.sales_reference,
          workCenterId: row.work_center_id,
          supervisor: row.supervisor,
          notes: row.notes,
          bomSnapshot: typeof row.bom_snapshot === 'string' ? JSON.parse(row.bom_snapshot || '{}') : (row.bom_snapshot || {}),
          totalCost: parseFloat(row.total_cost) || 0,
          costPerUnit: parseFloat(row.cost_per_unit) || 0,
          laborCost: parseFloat(row.labor_cost) || 0,
          overheadCost: parseFloat(row.overhead_cost) || 0,
          otherCost: parseFloat(row.other_cost) || 0,
          executedBy: row.executed_by,
          executedAt: row.executed_at,
          createdAt: row.created_at
        }));
      }
    } catch (e) {
      console.warn("Failed to load production_orders from database, checking settings:", e);
    }
    return [];
  }

  async saveOrder(order: any): Promise<any> {
    await this.ensureTableExists();
    const orderNumber = order.orderNumber || `PRD-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    const snapshotStr = JSON.stringify(order.bomSnapshot || {});
    const qty = Number(order.quantity) || 1;
    const laborCost = Number(order.laborCost ?? order.labor_cost ?? 0);
    const overheadCost = Number(order.overheadCost ?? order.overhead_cost ?? 0);
    const otherCost = Number(order.otherCost ?? order.other_cost ?? 0);
    const totalCost = Number(order.totalCost) || 0;
    const costPerUnit = qty > 0 ? totalCost / qty : 0;

    const query = `
      INSERT INTO production_orders (
        order_number, product_id, product_name, quantity, bom_id,
        raw_warehouse_id, finished_warehouse_id, start_date, end_date,
        priority, status, progress, sales_reference, work_center_id,
        supervisor, notes, bom_snapshot, total_cost, cost_per_unit,
        labor_cost, overhead_cost, other_cost
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      ON CONFLICT (order_number)
      DO UPDATE SET
        product_id = EXCLUDED.product_id,
        product_name = EXCLUDED.product_name,
        quantity = EXCLUDED.quantity,
        bom_id = EXCLUDED.bom_id,
        raw_warehouse_id = EXCLUDED.raw_warehouse_id,
        finished_warehouse_id = EXCLUDED.finished_warehouse_id,
        start_date = EXCLUDED.start_date,
        end_date = EXCLUDED.end_date,
        priority = EXCLUDED.priority,
        status = EXCLUDED.status,
        progress = EXCLUDED.progress,
        sales_reference = EXCLUDED.sales_reference,
        work_center_id = EXCLUDED.work_center_id,
        supervisor = EXCLUDED.supervisor,
        notes = EXCLUDED.notes,
        bom_snapshot = EXCLUDED.bom_snapshot,
        total_cost = EXCLUDED.total_cost,
        cost_per_unit = EXCLUDED.cost_per_unit,
        labor_cost = EXCLUDED.labor_cost,
        overhead_cost = EXCLUDED.overhead_cost,
        other_cost = EXCLUDED.other_cost,
        updated_at = NOW()
      RETURNING *
    `;

    const res = await erpPool.query(query, [
      orderNumber,
      String(order.productId || ''),
      order.productName || '',
      qty,
      order.bomId || '',
      order.rawWarehouseId || null,
      order.finishedWarehouseId || null,
      order.startDate || '',
      order.endDate || '',
      order.priority || 'normal',
      order.status || 'planned',
      order.progress || 0,
      order.salesReference || '',
      order.workCenterId || '',
      order.supervisor || '',
      order.notes || '',
      snapshotStr,
      totalCost,
      costPerUnit,
      laborCost,
      overheadCost,
      otherCost
    ]);

    return res.rows[0];
  }

  // ─────────────────────────────────────────────────────────────
  // CHECK MATERIAL AVAILABILITY IN REAL-TIME
  // ─────────────────────────────────────────────────────────────
  async checkAvailability(
    productId: string | number,
    bomId: string | undefined,
    quantity: number,
    rawWarehouseId: number
  ): Promise<CheckAvailabilityResponse> {
    await this.ensureTableExists();
    const qty = Math.max(1, Number(quantity) || 1);

    // 1. Get warehouse name
    const whRes = await erpPool.query("SELECT name FROM warehouses WHERE id = $1", [rawWarehouseId]);
    const rawWarehouseName = whRes.rows[0]?.name || `مخزن #${rawWarehouseId}`;

    // 2. Resolve Product Details
    let productName = `منتج #${productId}`;
    const prodRes = await erpPool.query(
      "SELECT id, name, code, unit, cost, price FROM products WHERE id::text = $1::text OR code::text = $1::text OR barcode::text = $1::text OR name::text = $1::text",
      [String(productId)]
    );
    if (prodRes.rows.length > 0) {
      productName = prodRes.rows[0].name;
    } else {
      try {
        const spRes = await erpPool.query(
          "SELECT id, name, code, sku, barcode, unit, COALESCE(retail_price, base_price, 0) as price, COALESCE(base_price, 0) as cost FROM sales_products WHERE id::text = $1::text OR code::text = $1::text OR sku::text = $1::text OR barcode::text = $1::text OR name::text = $1::text",
          [String(productId)]
        );
        if (spRes.rows.length > 0) {
          productName = spRes.rows[0].name;
        } else {
          const settingsRes = await erpPool.query("SELECT value FROM settings WHERE key = 'remo_production_products'");
          if (settingsRes.rows.length > 0 && settingsRes.rows[0].value) {
            const list = typeof settingsRes.rows[0].value === 'string' ? JSON.parse(settingsRes.rows[0].value) : settingsRes.rows[0].value;
            if (Array.isArray(list)) {
              const found = list.find((p: any) => p && (String(p.id) === String(productId) || p.code === String(productId) || p.name === String(productId)));
              if (found) productName = found.name;
            }
          }
        }
      } catch (_) {}
    }

    // 3. Resolve BOM and items
    let bomItems: Array<{ materialId: any; quantity: number }> = [];
    let scrapPercentage = 0;

    if (bomId) {
      const bomRes = await erpPool.query("SELECT * FROM production_boms WHERE id::text = $1::text", [String(bomId)]);
      if (bomRes.rows.length > 0) {
        const b = bomRes.rows[0];
        scrapPercentage = parseFloat(b.scrap_percentage) || 0;
        if (b.items_json) {
          try { bomItems = typeof b.items_json === 'string' ? JSON.parse(b.items_json) : (b.items_json || []); } catch (_) { bomItems = []; }
        }
        // Legacy/enterprise schema stores BOM lines in bom_items instead of items_json.
        if (!Array.isArray(bomItems) || bomItems.length === 0) {
          const biRes = await erpPool.query(
            `SELECT bi.ingredient_id, bi.quantity, bi.unit, bi.unit_cost, i.name AS ingredient_name,
                    i.code AS ingredient_code
             FROM bom_items bi
             LEFT JOIN ingredients i ON i.id = bi.ingredient_id
             WHERE bi.bom_id::text = $1::text
             ORDER BY bi.sort_order, bi.id`,
            [String(b.id)]
          );
          bomItems = biRes.rows.map((r: any) => ({
            materialId: r.ingredient_id,
            ingredientId: r.ingredient_id,
            materialName: r.ingredient_name,
            code: r.ingredient_code,
            quantity: Number(r.quantity) || 0,
            quantityPerUnit: Number(r.quantity) || 0,
            unit: r.unit,
            unitCost: Number(r.unit_cost) || 0
          }));
        }
      }
    }

    // If no BOM items found yet, check by product_id
    if (bomItems.length === 0) {
      const bomByProd = await erpPool.query("SELECT * FROM production_boms WHERE product_id::text = $1::text LIMIT 1", [String(productId)]);
      if (bomByProd.rows.length > 0) {
        const b = bomByProd.rows[0];
        scrapPercentage = parseFloat(b.scrap_percentage) || 0;
        if (b.items_json) {
          try { bomItems = typeof b.items_json === 'string' ? JSON.parse(b.items_json) : (b.items_json || []); } catch (_) { bomItems = []; }
        }
        if (!Array.isArray(bomItems) || bomItems.length === 0) {
          const biRes = await erpPool.query(
            `SELECT bi.ingredient_id, bi.quantity, bi.unit, bi.unit_cost, i.name AS ingredient_name,
                    i.code AS ingredient_code
             FROM bom_items bi
             LEFT JOIN ingredients i ON i.id = bi.ingredient_id
             WHERE bi.bom_id::text = $1::text
             ORDER BY bi.sort_order, bi.id`,
            [String(b.id)]
          );
          bomItems = biRes.rows.map((r: any) => ({
            materialId: r.ingredient_id,
            ingredientId: r.ingredient_id,
            materialName: r.ingredient_name,
            code: r.ingredient_code,
            quantity: Number(r.quantity) || 0,
            quantityPerUnit: Number(r.quantity) || 0,
            unit: r.unit,
            unitCost: Number(r.unit_cost) || 0
          }));
        }
      }
    }

    // If still no items, fallback to product_ingredients
    if (bomItems.length === 0 && prodRes.rows.length > 0) {
      const numProdId = prodRes.rows[0].id;
      const piRes = await erpPool.query("SELECT ingredient_id, quantity, waste_percent FROM product_ingredients WHERE product_id::text = $1::text", [String(numProdId)]);
      if (piRes.rows.length > 0) {
        bomItems = piRes.rows.map((r: any) => ({
          materialId: r.ingredient_id,
          quantity: parseFloat(r.quantity) || 1
        }));
        scrapPercentage = parseFloat(piRes.rows[0].waste_percent) || 0;
      }
    }

    // 4. Fetch all ingredients to cross-reference
    const allIngredientsRes = await erpPool.query("SELECT id, name, code, item_code, unit, cost, avg_cost, last_purchase_price FROM ingredients");
    const ingredientsList = allIngredientsRes.rows;

    // 5. Fetch current stock in the rawWarehouseId (aggregating across all locations/rows in warehouse)
    const stockRes = await erpPool.query(`
      SELECT 
        ingredient_id, 
        COALESCE(SUM(quantity), 0) AS total_quantity, 
        COALESCE(SUM(reserved), 0) AS total_reserved,
        COALESCE(SUM(GREATEST(COALESCE(quantity, 0) - COALESCE(reserved, 0), 0)), 0) AS total_available
      FROM inventory_items 
      WHERE warehouse_id = $1 
      GROUP BY ingredient_id
    `, [rawWarehouseId]);
    const stockMap: Record<number, number> = {};
    stockRes.rows.forEach((row: any) => {
      const ingId = Number(row.ingredient_id);
      const quantityInWarehouse = Number(row.total_quantity) || 0;
      const reserved = Number(row.total_reserved) || 0;
      const totalAvailable = Number(row.total_available);
      const effectiveAvail = Number.isFinite(totalAvailable) && totalAvailable > 0
        ? totalAvailable
        : Math.max(quantityInWarehouse - reserved, 0);
      stockMap[ingId] = (stockMap[ingId] || 0) + effectiveAvail;
    });

    // 6. Calculate requirements and availability for each raw material
    const itemsResult: CheckAvailabilityItemResult[] = [];
    let totalMaterialCost = 0;
    let missingCount = 0;

    for (const item of bomItems) {
      // Find matching ingredient by specific fields (prioritize ingredientId / materialId / code / name)
      // NEVER use BOM item row index 'id' as an ingredient id.
      const explicitIngId = (item as any).ingredient_id ?? (item as any).ingredientId;
      const matIdRef = (item as any).material_id ?? (item as any).materialId ?? (item as any).materialCode ?? '';
      const itemCodeRef = String((item as any).code ?? (item as any).ingredientCode ?? (item as any).item_code ?? matIdRef ?? '').trim();
      const itemNameRef = String((item as any).materialName ?? (item as any).ingredientName ?? (item as any).name ?? '').trim();

      const normalizedName = itemNameRef.toLowerCase().replace(/\s+/g, ' ');
      const normalizedCode = itemCodeRef.toLowerCase();
      const cleanCode = normalizedCode.replace(/^item-/, '');

      const ing = ingredientsList.find((g: any) => {
        if (explicitIngId != null && Number(g.id) === Number(explicitIngId)) return true;
        const gName = String(g.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const gCode = String(g.code || '').trim().toLowerCase();
        const gItemCode = String(g.item_code || '').trim().toLowerCase();
        const gCleanCode = gCode.replace(/^item-/, '') || gItemCode.replace(/^item-/, '');
        
        if (normalizedCode && (gCode === normalizedCode || gItemCode === normalizedCode || (cleanCode && gCleanCode === cleanCode))) {
          return true;
        }
        if (matIdRef && (String(g.id) === String(matIdRef) || gCode === String(matIdRef).toLowerCase())) {
          return true;
        }
        if (normalizedName && gName === normalizedName) {
          return true;
        }
        return false;
      });

      const ingredientId = ing ? Number(ing.id) : (Number(explicitIngId) || 0);
      const ingredientName = ing?.name || itemNameRef || `خامة #${ingredientId || itemCodeRef || '-'}`;
      const ingredientCode = ing ? (ing.code || ing.item_code || `ITEM-${ingredientId}`) : (itemCodeRef || `ITEM-${ingredientId}`);
      const recipeUnit = (item as any).unit || (item as any).recipe_unit || ing?.unit || 'وحدة';
      // Prefer explicit recipe unit over generic default 'قطعة' if the ingredient hasn't been configured with a weight/volume unit
      const rawIngUnit = String(ing?.unit || '').trim();
      const isGenericPiece = (rawIngUnit === 'قطعة' || rawIngUnit === 'وحدة' || rawIngUnit === 'pcs' || rawIngUnit === 'piece');
      const isRecipeWeightOrVol = ['كجم', 'كيلو', 'جم', 'جرام', 'لتر', 'مل', 'kg', 'g', 'l', 'ml', 'liter', 'gram'].includes(String(recipeUnit || '').trim().toLowerCase());
      const baseUnit = (isGenericPiece && isRecipeWeightOrVol) ? recipeUnit : (rawIngUnit || recipeUnit);
      const baseUnitCost = ing ? (parseFloat(ing.avg_cost) || parseFloat(ing.cost) || parseFloat(ing.last_purchase_price) || 0) : 0;

      const qtyPerUnit = Number(item.quantity ?? (item as any).quantityPerUnit ?? (item as any).requiredPerUnit ?? 0) || 0;
      // Deduct and require the exact recipe quantity without any scrap markup
      const totalRequiredRecipeQty = Math.round(qtyPerUnit * qty * 1000000) / 1000000;

      // ── UNIVERSAL UNIT CONVERSION TO WAREHOUSE BASE UNIT ──
      const conversion = await UnitConversionService.convertItemQuantity(erpPool, {
        ingredientId,
        quantity: totalRequiredRecipeQty,
        fromUnit: recipeUnit,
        toUnit: baseUnit,
        context: 'consumption'
      });

      const totalRequiredBaseQty = conversion.success ? conversion.toQuantity : totalRequiredRecipeQty;
      const recipeUnitCost = Math.round((baseUnitCost / (conversion.factor || 1)) * 10000) / 10000;
      const itemCost = Math.round(totalRequiredBaseQty * baseUnitCost * 100) / 100;

      // IMPORTANT: production availability is warehouse-specific.
      // Also aggregate stock if duplicate ingredient records exist with the exact same normalized name in the same warehouse.
      let currentStock = Number(stockMap[ingredientId] || 0);
      const targetNormName = String(ingredientName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (targetNormName) {
        for (const g of ingredientsList) {
          const gId = Number(g.id);
          if (gId !== ingredientId) {
            const gNorm = String(g.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
            if (gNorm === targetNormName && (stockMap[gId] || 0) > 0) {
              currentStock += Number(stockMap[gId] || 0);
            }
          }
        }
      }

      const remainingStock = Math.round((currentStock - totalRequiredBaseQty) * 10000) / 10000;
      const isAvailable = currentStock >= totalRequiredBaseQty;
      const shortage = isAvailable ? 0 : Math.round((totalRequiredBaseQty - currentStock) * 10000) / 10000;

      totalMaterialCost += itemCost;
      if (!isAvailable) missingCount++;

      itemsResult.push({
        ingredientId,
        ingredientCode,
        ingredientName,
        unit: recipeUnit,
        recipeUnit,
        baseUnit,
        quantityPerUnit: qtyPerUnit,
        totalRequiredQty: totalRequiredRecipeQty,
        totalRequiredBaseQty,
        currentStock,
        remainingStock,
        unitCost: recipeUnitCost,
        baseUnitCost,
        totalCost: itemCost,
        isAvailable,
        shortage,
        conversionFactor: conversion.factor,
        conversionEquation: conversion.explanation,
        rawWarehouseId,
        rawWarehouseName
      });
    }

    totalMaterialCost = Math.round(totalMaterialCost * 100) / 100;
    const costPerUnit = qty > 0 ? Math.round((totalMaterialCost / qty) * 100) / 100 : 0;

    return {
      canProduce: missingCount === 0,
      productId,
      productName,
      quantity: qty,
      rawWarehouseId,
      rawWarehouseName,
      totalMaterialCost,
      costPerUnit,
      // Return the canonical fields plus legacy aliases consumed by older
      // production-sheet builds. Keeping both prevents a valid warehouse
      // balance from being rendered as 0 or the material id as its name.
      items: itemsResult.map((it: any) => ({
        ...it,
        materialId: it.ingredientId,
        materialName: it.ingredientName,
        code: it.ingredientCode,
        requiredPerUnit: it.quantityPerUnit,
        totalQuantityWithScrap: it.totalRequiredQty,
        currentStock: it.currentStock,
        unitCost: it.unitCost,
        totalItemCost: it.totalCost
      })),
      missingCount
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EXECUTE PRODUCTION ORDER (SINGLE ATOMIC TRANSACTION)
  // ─────────────────────────────────────────────────────────────
  async executeProductionOrder(dto: ExecuteProductionOrderDTO): Promise<any> {
    await this.ensureTableExists();

    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // 1. Fetch Order Record
      let order: any = null;
      if (dto.orderId) {
        const ordRes = await client.query("SELECT * FROM production_orders WHERE id::text = $1::text OR order_number::text = $1::text LIMIT 1", [String(dto.orderId)]);
        if (ordRes.rows.length > 0) order = ordRes.rows[0];
      } else if (dto.orderNumber) {
        const ordRes = await client.query("SELECT * FROM production_orders WHERE order_number = $1 LIMIT 1", [dto.orderNumber]);
        if (ordRes.rows.length > 0) order = ordRes.rows[0];
      }

      // The production order MUST exist in the relational database before any
      // inventory movement is posted. Older builds could keep the order only
      // in localStorage/settings, which made execution non-deterministic.
      // If the client has supplied a complete order payload, persist it now;
      // otherwise fail before touching inventory.
      if (!order) {
        const orderNumber = String(dto.orderNumber || '').trim();
        const productId = String(dto.productId || '').trim();
        const quantity = Number(dto.quantity);
        if (!orderNumber || !productId || !Number.isFinite(quantity) || quantity <= 0) {
          throw new Error(`أمر الإنتاج غير محفوظ في قاعدة البيانات، ولا يمكن ترحيله بدون رقم أمر ومنتج وكمية صحيحة.`);
        }

        const upsertRes = await client.query(
          `INSERT INTO production_orders (
             order_number, product_id, product_name, quantity, bom_id,
             raw_warehouse_id, finished_warehouse_id, status, progress,
             notes, bom_snapshot, labor_cost, overhead_cost, other_cost
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,'planned',0,$8,$9,$10,$11,$12)
           ON CONFLICT (order_number) DO UPDATE SET
             product_id = EXCLUDED.product_id,
             product_name = COALESCE(NULLIF(EXCLUDED.product_name,''), production_orders.product_name),
             quantity = EXCLUDED.quantity,
             raw_warehouse_id = COALESCE(EXCLUDED.raw_warehouse_id, production_orders.raw_warehouse_id),
             finished_warehouse_id = COALESCE(EXCLUDED.finished_warehouse_id, production_orders.finished_warehouse_id),
             notes = COALESCE(EXCLUDED.notes, production_orders.notes),
             bom_snapshot = CASE
               WHEN EXCLUDED.bom_snapshot IS NOT NULL AND EXCLUDED.bom_snapshot <> '{}' THEN EXCLUDED.bom_snapshot
               ELSE production_orders.bom_snapshot
             END,
             labor_cost = COALESCE(NULLIF(EXCLUDED.labor_cost, 0), production_orders.labor_cost, 0),
             overhead_cost = COALESCE(NULLIF(EXCLUDED.overhead_cost, 0), production_orders.overhead_cost, 0),
             other_cost = COALESCE(NULLIF(EXCLUDED.other_cost, 0), production_orders.other_cost, 0),
             updated_at = NOW()
           RETURNING *`,
          [
            orderNumber,
            productId,
            String(dto.productName || ''),
            quantity,
            '',
            Number(dto.rawWarehouseId) || null,
            Number(dto.finishedWarehouseId) || null,
            dto.notes || '',
            '{}',
            Number(dto.laborCost || 0),
            Number(dto.overheadCost || 0),
            Number(dto.otherCost || 0)
          ]
        );
        order = upsertRes.rows[0] || null;
      }

      if (!order) {
        throw new Error(`تعذر حفظ أمر الإنتاج [${dto.orderNumber || dto.orderId}] في قاعدة البيانات.`);
      }

      // Serialize execution attempts for the same production order, then lock the actual DB row.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(order.order_number)]);
      const lockedOrderRes = await client.query(
        "SELECT * FROM production_orders WHERE order_number = $1 FOR UPDATE",
        [String(order.order_number)]
      );
      if (lockedOrderRes.rows.length > 0) order = lockedOrderRes.rows[0];

      // 2. IDEMPOTENCY CHECK - Prevent Double Execution
      if (order.status === 'completed' || order.is_executed || order.isExecuted) {
        throw new Error(`أمر الإنتاج رقم [${order.order_number}] مكتمل ومرحل بالفعل إلى المخازن مسبقاً، لا يمكن إعادة تنفيذه أو بدء تشغيله مرة أخرى منعاً لتكرار الصرف وازدواجية القيود.`);
      }

      // Also check production_runs table if a run for this orderNumber already exists
      const existingRun = await client.query(
        "SELECT id, created_at FROM production_runs WHERE order_number = $1 LIMIT 1",
        [order.order_number]
      );
      if (existingRun.rows.length > 0) {
        throw new Error(`أمر الإنتاج رقم [${order.order_number}] تم ترحيله مسبقاً (سند تشغيل رقم: ${existingRun.rows[0].id}). لا يمكن إعادة الترحيل.`);
      }

      const orderNumber = order.order_number;
      const parsedOrderReference = parseInt(orderNumber.replace(/[^0-9]/g, ''), 10);
      const orderNumericRef = Number(order.id) > 0
        ? Number(order.id)
        : (Number.isFinite(parsedOrderReference) ? parsedOrderReference % 2147483647 : 0);

      // The production order is permanently linked to its issue warehouse.
      // Never silently switch the source warehouse at execution time.
      const storedRawWarehouseId = Number(order.raw_warehouse_id || 0);
      const requestedRawWarehouseId = Number(dto.rawWarehouseId || 0);
      if (storedRawWarehouseId > 0 && requestedRawWarehouseId > 0 && storedRawWarehouseId !== requestedRawWarehouseId) {
        throw new Error(`مخزن صرف الخامات لأمر الإنتاج [${orderNumber}] هو المخزن رقم ${storedRawWarehouseId}، ولا يمكن تنفيذ الأمر من مخزن صرف مختلف.`);
      }
      let rawWarehouseId = storedRawWarehouseId || requestedRawWarehouseId;
      let finishedWarehouseId = Number(order.finished_warehouse_id || dto.finishedWarehouseId || rawWarehouseId);
      const producedQty = parseFloat(order.quantity) || 1;
      const user = dto.user || "مسؤول الإنتاج";

      if (!rawWarehouseId || !finishedWarehouseId) {
        const defaultWhRes = await client.query("SELECT id FROM warehouses WHERE is_main = 1 OR type = 'main' ORDER BY id ASC LIMIT 1");
        const fallbackWhId = Number(defaultWhRes.rows?.[0]?.id) || Number((await client.query("SELECT id FROM warehouses ORDER BY id ASC LIMIT 1")).rows?.[0]?.id) || 1;
        rawWarehouseId = rawWarehouseId || fallbackWhId;
        finishedWarehouseId = finishedWarehouseId || rawWarehouseId;
      }

      if (!rawWarehouseId || !finishedWarehouseId) {
        throw new Error("يجب تحديد كل من مخزن صرف المواد الخام ومخزن استلام المنتج النهائي.");
      }

      const warehouseRes = await client.query(
        "SELECT id, name FROM warehouses WHERE id = ANY($1::int[])",
        [[rawWarehouseId, finishedWarehouseId]]
      );
      const warehouseIdsFound = new Set(warehouseRes.rows.map((r: any) => Number(r.id)));
      if (!warehouseIdsFound.has(rawWarehouseId)) {
        throw new Error(`مخزن صرف المواد الخام رقم ${rawWarehouseId} غير موجود.`);
      }
      if (!warehouseIdsFound.has(finishedWarehouseId)) {
        throw new Error(`مخزن استلام المنتج النهائي رقم ${finishedWarehouseId} غير موجود.`);
      }

      // 3. Resolve BOM and Snapshot Materials
      let snapshotItems: any[] = [];
      let scrapPercentage = 0;

      if (order.bom_snapshot) {
        try {
          const snap = typeof order.bom_snapshot === 'string' ? JSON.parse(order.bom_snapshot) : order.bom_snapshot;
          if (Array.isArray(snap.items) && snap.items.length > 0) {
            snapshotItems = snap.items;
            scrapPercentage = snap.scrapPercentage || 0;
          }
        } catch (e) {}
      }

      // Fallback: check availability engine to compute current BOM items
      if (snapshotItems.length === 0) {
        const avail = await this.checkAvailability(order.product_id, order.bom_id, producedQty, rawWarehouseId);
        snapshotItems = avail.items.map(it => ({
          materialId: it.ingredientId,
          ingredientId: it.ingredientId,
          materialName: it.ingredientName,
          quantityPerUnit: it.quantityPerUnit,
          totalRequiredQty: it.totalRequiredQty,
          unit: it.unit,
          unitCost: it.unitCost,
          totalCost: it.totalCost
        }));
      }

      // Pre-resolve all snapshot items to actual database ingredients in warehouse
      const allIngredientsRes = await client.query("SELECT id, name, code, item_code, unit, cost, avg_cost, last_purchase_price, current_stock FROM ingredients");
      const ingredientsList = allIngredientsRes.rows;

      const resolvedItems: any[] = [];
      for (const item of snapshotItems) {
        const rawItemIngId = item.ingredientId || item.ingredient_id || item.materialId || item.material_id;
        const matIdStr = String(rawItemIngId || '').trim();
        const matName = String(item.materialName || item.name || '').trim();
        const matCode = String(item.code || item.ingredientCode || item.item_code || '').trim();

        let ing = ingredientsList.find((g: any) => {
          const gIdStr = String(g.id || '').trim();
          const gCode = String(g.code || g.item_code || '').trim().toLowerCase();
          const gName = String(g.name || '').trim().toLowerCase();

          if (rawItemIngId && Number(g.id) === Number(rawItemIngId)) return true;
          if (matIdStr && gIdStr === matIdStr) return true;
          if (matCode && gCode && gCode === matCode.toLowerCase()) return true;
          if (matIdStr && gCode && gCode === matIdStr.toLowerCase()) return true;
          if (matName && gName && gName === matName.toLowerCase()) return true;
          if (matName && gName && (gName.includes(matName.toLowerCase()) || matName.toLowerCase().includes(gName))) return true;
          return false;
        });

        // A production execution must never invent a new raw material. A missing
        // master-data link is a configuration error and must be reported before
        // inventory is touched.
        const ingId = ing ? Number(ing.id) : (parseInt(matIdStr.replace(/[^0-9]/g, '')) || 0);
        const name = item.materialName || item.name || (ing ? ing.name : `خامة #${matIdStr}`);
        const recipeUnit = item.unit || (item as any).recipe_unit || (ing ? ing.unit : 'وحدة') || 'وحدة';
        const rawIngUnit = String(ing ? ing.unit : '').trim();
        const isGenericPiece = (rawIngUnit === 'قطعة' || rawIngUnit === 'وحدة' || rawIngUnit === 'pcs' || rawIngUnit === 'piece');
        const isRecipeWeightOrVol = ['كجم', 'كيلو', 'جم', 'جرام', 'لتر', 'مل', 'kg', 'g', 'l', 'ml', 'liter', 'gram'].includes(String(recipeUnit || '').trim().toLowerCase());
        const baseUnit = (isGenericPiece && isRecipeWeightOrVol) ? recipeUnit : (rawIngUnit || recipeUnit);

        // Fetch warehouse-specific unit cost if available
        let warehouseUnitCost = 0;
        if (ingId > 0) {
          const whStockRes = await client.query(
            "SELECT COALESCE(avg_cost, cost, last_cost, 0) as unit_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 LIMIT 1",
            [rawWarehouseId, ingId]
          );
          if (whStockRes.rows.length > 0) {
            warehouseUnitCost = Number(whStockRes.rows[0].unit_cost) || 0;
          }
        }

        const safeNum = (v: any) => {
          const n = parseFloat(v);
          return Number.isFinite(n) ? n : 0;
        };

        let resolvedBaseUnitCost = warehouseUnitCost;
        if (resolvedBaseUnitCost <= 0 && ing) {
          for (const f of ['avg_cost', 'cost', 'last_purchase_price', 'cost_price', 'price']) {
            const val = safeNum(ing[f]);
            if (val > 0) {
              resolvedBaseUnitCost = val;
              break;
            }
          }
        }
        if (resolvedBaseUnitCost <= 0 && item) {
          for (const f of ['unitCost', 'unit_cost', 'cost', 'price', 'rate']) {
            const val = safeNum(item[f]);
            if (val > 0) {
              resolvedBaseUnitCost = val;
              break;
            }
          }
        }
        if (resolvedBaseUnitCost <= 0 && ingId > 0) {
          // Look up any previous purchase or receipt unit_cost
          const lastTx = await client.query(
            `SELECT unit_cost FROM inventory_transactions 
             WHERE ingredient_id = $1 AND type IN ('receipt', 'receive', 'in') AND unit_cost > 0 
             ORDER BY id DESC LIMIT 1`,
            [ingId]
          );
          if (lastTx.rows.length > 0) {
            resolvedBaseUnitCost = safeNum(lastTx.rows[0].unit_cost);
          }
        }
        if (resolvedBaseUnitCost <= 0 && ingId > 0) {
          // Look up cost_transactions
          const lastCostTx = await client.query(
            `SELECT unit_cost FROM cost_transactions 
             WHERE ingredient_id = $1 AND unit_cost > 0 
             ORDER BY id DESC LIMIT 1`,
            [ingId]
          );
          if (lastCostTx.rows.length > 0) {
            resolvedBaseUnitCost = safeNum(lastCostTx.rows[0].unit_cost);
          }
        }

        const baseUnitCost = resolvedBaseUnitCost;

        const perUnitQty = Number(item.quantityPerUnit ?? item.requiredPerUnit ?? item.quantity ?? 0) || 0;
        const exactRecipeQty = Math.round(perUnitQty * producedQty * 1000000) / 1000000;
        // The user strictly wants to deduct from warehouse the exact value in the recipe converted to base unit
        const reqRecipeQty = (perUnitQty > 0 && producedQty > 0)
          ? exactRecipeQty
          : (Number(item.totalRequiredQty ?? item.totalQuantityWithScrap ?? 0) || exactRecipeQty);

        if (!ing || ingId <= 0 || !Number.isFinite(reqRecipeQty) || reqRecipeQty <= 0) {
          throw new Error(
            `تعذر ربط خامة أمر الإنتاج [${orderNumber}] بالمادة الخام في دليل الأصناف. ` +
            `راجع وصفة التصنيع وتأكد أن كل خامة مرتبطة بصنف خام صحيح.`
          );
        }

        // Convert recipe quantity to warehouse base unit
        const conversion = await UnitConversionService.convertItemQuantity(client, {
          ingredientId: ingId,
          quantity: reqRecipeQty,
          fromUnit: recipeUnit,
          toUnit: baseUnit,
          context: 'consumption'
        });

        const reqBaseQty = Number(conversion.success ? conversion.toQuantity : reqRecipeQty) || 0;
        const recipeUnitCost = Math.round((baseUnitCost / (conversion.factor || 1)) * 10000) / 10000;
        const itemTotalCost = Math.round((reqBaseQty * baseUnitCost) * 100) / 100;

        resolvedItems.push({
          ...item,
          ingredientId: ingId,
          materialId: ingId,
          materialName: name,
          unit: recipeUnit,
          recipeUnit,
          baseUnit,
          unitCost: recipeUnitCost,
          baseUnitCost,
          reqQty: reqRecipeQty,
          reqBaseQty,
          itemTotalCost,
          conversionFactor: conversion.factor,
          conversionEquation: conversion.explanation
        });
      }

      // 4. Validate stock availability if allowNegativeStock is false
      if (!dto.allowNegativeStock) {
        const missingItems: string[] = [];
        for (const item of resolvedItems) {
          const ingId = item.ingredientId;
          const reqBaseQty = item.reqBaseQty;

          let currentStock = 0;
          if (ingId > 0) {
            // If duplicate ingredient records exist with the exact same normalized name, consolidate their stock in this warehouse into the canonical ingId
            const targetNormName = String(item.materialName || '').trim().toLowerCase().replace(/\s+/g, ' ');
            if (targetNormName) {
              const dupIds = ingredientsList
                .filter((g: any) => Number(g.id) !== ingId && String(g.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === targetNormName)
                .map((g: any) => Number(g.id));
              for (const dupId of dupIds) {
                const dupStock = await client.query(
                  "SELECT id, quantity, available, reserved, avg_cost, last_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
                  [rawWarehouseId, dupId]
                );
                for (const dRow of dupStock.rows) {
                  const dQty = Number(dRow.quantity || 0);
                  if (dQty > 0) {
                    const existCanon = await client.query(
                      "SELECT id, quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
                      [rawWarehouseId, ingId]
                    );
                    if (existCanon.rows.length > 0) {
                      const cQty = Number(existCanon.rows[0].quantity || 0);
                      const nQty = cQty + dQty;
                      await client.query(
                        "UPDATE inventory_items SET quantity = $1, available = GREATEST($2::numeric - COALESCE(reserved, 0), 0), updated_at = CURRENT_TIMESTAMP WHERE id = $3",
                        [nQty, nQty, existCanon.rows[0].id]
                      );
                    } else {
                      await client.query(
                        "INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, available, avg_cost, last_cost) VALUES ($1, $2, $3, GREATEST($4::numeric, 0), $5, $6)",
                        [rawWarehouseId, ingId, dQty, dQty, Number(dRow.avg_cost || 0), Number(dRow.last_cost || 0)]
                      );
                    }
                    await client.query("UPDATE inventory_items SET quantity = 0, available = 0 WHERE id = $1", [dRow.id]);
                  }
                }
              }
            }

            const stockCheck = await client.query(
              "SELECT available, quantity, reserved FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
              [rawWarehouseId, ingId]
            );

            if (stockCheck.rows.length > 0) {
              let totalQty = 0;
              let totalReserved = 0;
              for (const r of stockCheck.rows) {
                totalQty += Number(r.quantity || 0);
                totalReserved += Number(r.reserved || 0);
              }
              currentStock = Math.max(totalQty - totalReserved, 0);
            }
          }

          if (currentStock < reqBaseQty) {
            const equationNote = item.unit !== item.baseUnit ? ` (${item.reqQty} ${item.unit} = ${reqBaseQty} ${item.baseUnit})` : '';
            missingItems.push(`[${item.materialName}]: المتوفر بالمخزن ${currentStock} ${item.baseUnit} والمطلوب ${reqBaseQty} ${item.baseUnit}${equationNote}`);
          }
        }

        if (missingItems.length > 0) {
          throw new Error(`رصيد المواد الخام غير كافٍ في المخزن المحدد:\n` + missingItems.join("\n"));
        }
      }

      // 5. STEP A: Deduct consumed raw materials from warehouse (Movement ref_type: "production_consumption")
      const deductedItems: any[] = [];
      let calculatedTotalCost = 0;

      for (const item of resolvedItems) {
        const ingId = item.ingredientId;
        const reqRecipeQty = item.reqQty;
        const reqBaseQty = item.reqBaseQty;
        const itemTotalCost = item.itemTotalCost;
        calculatedTotalCost += itemTotalCost;

        if (ingId > 0) {
          const movementNotes = item.unit !== item.baseUnit
            ? `صرف واستهلاك مواد خام من المخزن لأمر إنتاج رقم ${orderNumber} - خامة: ${item.materialName} (الوصفة: ${reqRecipeQty} ${item.unit} = ${reqBaseQty} ${item.baseUnit} من المخزن)`
            : `صرف واستهلاك مواد خام من المخزن لأمر إنتاج رقم ${orderNumber} - خامة: ${item.materialName} (${reqBaseQty} ${item.baseUnit})`;

          await applyStockMovement(client, {
            warehouse_id: rawWarehouseId,
            ingredient_id: ingId,
            delta: -reqBaseQty, // Deduct the exact converted base quantity (e.g. -0.250 KG)
            field: "quantity",
            ref_type: "production_consumption",
            ref_id: orderNumericRef,
            user: user,
            notes: movementNotes,
            unit_cost: item.baseUnitCost,
            ingredient_name: item.materialName
          });

          const sumRes = await client.query(
            "SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_items WHERE ingredient_id = $1",
            [ingId]
          );
          const totalStock = Number(sumRes.rows[0]?.total || 0);
          await client.query(
            "UPDATE ingredients SET current_stock = $1 WHERE id = $2",
            [totalStock, ingId]
          );
        }

        deductedItems.push({
          ingredientId: ingId,
          name: item.materialName,
          quantity: reqRecipeQty,
          unit: item.unit,
          baseQuantity: reqBaseQty,
          baseUnit: item.baseUnit,
          unitCost: item.unitCost,
          baseUnitCost: item.baseUnitCost,
          totalCost: itemTotalCost,
          conversionEquation: item.conversionEquation
        });
      }

      // 6. STEP B: Add finished goods produced to Finished Warehouse (Movement ref_type: "production_receipt")
      // Resolve or insert matching ingredient for finished product
      let finishedProductName = dto.productName || order.product_name;
      let finishedUnit = 'وحدة';
      let finishedProductCode = String(dto.productId || order.product_id || '');

      // Cost Components Resolution
      let laborCost = Number(dto.laborCost ?? order.labor_cost ?? 0);
      let overheadCost = Number(dto.overheadCost ?? order.overhead_cost ?? 0);
      let otherCost = Number(dto.otherCost ?? order.other_cost ?? 0);

      let routingsCost = 0;
      if (order.bom_snapshot) {
        try {
          const snap = typeof order.bom_snapshot === 'string' ? JSON.parse(order.bom_snapshot) : order.bom_snapshot;
          if (!laborCost && Number(snap.laborCost || snap.labor_cost) > 0) {
            laborCost = Number(snap.laborCost || snap.labor_cost);
          }
          if (!overheadCost && Number(snap.overheadCost || snap.overhead_cost) > 0) {
            overheadCost = Number(snap.overheadCost || snap.overhead_cost);
          }
          if (!otherCost && Number(snap.otherCost || snap.other_cost) > 0) {
            otherCost = Number(snap.otherCost || snap.other_cost);
          }
          if (Array.isArray(snap.routings)) {
            for (const r of snap.routings) {
              routingsCost += Number(r.cost || r.total_cost || r.totalCost || 0);
            }
          } else if (Array.isArray(snap.operations)) {
            for (const op of snap.operations) {
              routingsCost += Number(op.cost || op.total_cost || op.totalCost || 0);
            }
          }
        } catch (e) {}
      }

      // If direct material cost is still 0 (e.g. BOM items had 0 cost in master data), fallback to BOM total_cost or order total_cost
      if (calculatedTotalCost <= 0) {
        try {
          if (order.bom_snapshot) {
            const snap = typeof order.bom_snapshot === 'string' ? JSON.parse(order.bom_snapshot) : order.bom_snapshot;
            const snapCost = Number(snap.totalCost || snap.total_cost || 0);
            if (snapCost > 0) calculatedTotalCost = snapCost;
          }
          if (calculatedTotalCost <= 0 && order.bom_id) {
            const bomCostRes = await client.query("SELECT total_cost FROM production_boms WHERE id::text = $1::text LIMIT 1", [String(order.bom_id)]);
            if (bomCostRes.rows.length > 0 && Number(bomCostRes.rows[0].total_cost) > 0) {
              calculatedTotalCost = Number(bomCostRes.rows[0].total_cost) * producedQty;
            }
          }
        } catch (_) {}
      }

      const totalLaborCost = laborCost;
      const totalOverheadCost = overheadCost + routingsCost;
      const totalOtherCost = otherCost;
      const totalProductionCost = calculatedTotalCost + totalLaborCost + totalOverheadCost + totalOtherCost;
      let finishedCost = producedQty > 0 ? Math.round((totalProductionCost / producedQty) * 10000) / 10000 : 0;

      const prodRes = await client.query(
        "SELECT id, name, code, barcode, unit, cost, cost_price, price, category_id, ingredient_id FROM products WHERE id::text = $1::text OR code::text = $1::text OR barcode::text = $1::text OR name::text = $1::text",
        [String(dto.productId || order.product_id)]
      );
      if (prodRes.rows.length > 0) {
        const p = prodRes.rows[0];
        if (!finishedProductName || finishedProductName.startsWith('منتج #')) {
          finishedProductName = p.name;
        }
        finishedUnit = p.unit || finishedUnit;
        finishedProductCode = p.code || p.barcode || finishedProductCode;
        if (!Number.isFinite(finishedCost) || finishedCost <= 0) {
          finishedCost = Number(p.cost_price) || Number(p.cost) || Number(p.price) || 0;
        }
      } else {
        try {
          const spRes = await client.query(
            "SELECT id, name, code, sku, barcode, unit, COALESCE(base_price, 0) as cost, retail_price, base_price FROM sales_products WHERE id::text = $1::text OR code::text = $1::text OR sku::text = $1::text OR barcode::text = $1::text OR name::text = $1::text",
            [String(dto.productId || order.product_id)]
          );
          if (spRes.rows.length > 0) {
            const sp = spRes.rows[0];
            if (!finishedProductName || finishedProductName.startsWith('منتج #')) {
              finishedProductName = sp.name;
            }
            finishedUnit = sp.unit || finishedUnit;
            finishedProductCode = sp.code || sp.sku || sp.barcode || finishedProductCode;
            if (!Number.isFinite(finishedCost) || finishedCost <= 0) {
              finishedCost = Number(sp.cost) || Number(sp.retail_price) || Number(sp.base_price) || 0;
            }
          }
        } catch (_) {}
      }
      if (!Number.isFinite(finishedCost) || finishedCost <= 0) {
        finishedCost = Number(order.cost_per_unit) || (Number(order.total_cost) && producedQty > 0 ? Number(order.total_cost) / producedQty : 0) || 0;
      }
      if (!Number.isFinite(finishedCost) || finishedCost <= 0) {
        try {
          const lastRun = await client.query(
            "SELECT unit_cost FROM production_runs WHERE product_id = $1 AND unit_cost > 0 ORDER BY id DESC LIMIT 1",
            [String(dto.productId || order.product_id)]
          );
          if (lastRun.rows.length > 0) {
            finishedCost = Number(lastRun.rows[0].unit_cost) || 0;
          }
        } catch (_) {}
      }
      if (!Number.isFinite(finishedCost)) finishedCost = 0;

      // Check settings/remo_production_products if name is still placeholder
      if (!finishedProductName || finishedProductName.startsWith('منتج #')) {
        try {
          const settingsRes = await client.query("SELECT value FROM settings WHERE key = 'remo_production_products'");
          if (settingsRes.rows.length > 0) {
            const list = JSON.parse(settingsRes.rows[0].value || '[]');
            const found = list.find((p: any) => p.id === order.product_id || p.code === order.product_id || p.name === order.product_id);
            if (found) {
              finishedProductName = found.name;
              finishedUnit = found.unit || finishedUnit;
              finishedProductCode = found.code || finishedProductCode;
            }
          }
        } catch (e) {}
      }

      if (!finishedProductName || finishedProductName.startsWith('منتج #')) {
        finishedProductName = finishedProductCode ? `منتج تام (${finishedProductCode})` : `منتج أمر الإنتاج ${orderNumber}`;
      }

      // BUG-ERP-002 / PHASE 8 — resolve the finished-goods inventory item by an
      // EXPLICIT link, never by name substring.
      //
      // The previous matcher used `ingName.includes(normFinishedName) ||
      // normFinishedName.includes(ingName)`, so producing "TEST-ERP-MANGO-JUICE"
      // matched the raw-material ingredient "TEST-ERP-MANGO" (184) instead of the
      // linked finished product ingredient (188). Finished output was therefore
      // credited to a raw material and the finished warehouse never received
      // stock.
      //
      // Resolution priority:
      //   1. products.ingredient_id            (authoritative FK)
      //   2. exact code / item_code / barcode  (exact equality only)
      //   3. exact normalized name             (exact equality only)
      //   4. auto-create a dedicated item
      const allIngsRes = await client.query("SELECT id, name, code, item_code, barcode, current_stock FROM ingredients");
      const normFinishedName = (finishedProductName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const normCode = (v: any) => String(v ?? '').trim().toLowerCase();

      const linkedIngredientId = Number(prodRes.rows[0]?.ingredient_id) || null;
      let matchedIng: any;

      // 1) authoritative product -> ingredient link
      if (linkedIngredientId) {
        matchedIng = allIngsRes.rows.find((ing: any) => Number(ing.id) === linkedIngredientId);
      }

      // 2) exact identifier equality (no substring, no LIKE)
      if (!matchedIng && finishedProductCode) {
        matchedIng = allIngsRes.rows.find((ing: any) =>
          [ing.code, ing.item_code, ing.barcode].some(
            (v: any) => v !== null && v !== undefined && normCode(v) !== '' && normCode(v) === normCode(finishedProductCode)
          )
        );
      }

      // 3) exact normalized name equality only
      if (!matchedIng && normFinishedName) {
        matchedIng = allIngsRes.rows.find(
          (ing: any) => (ing.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === normFinishedName
        );
      }

      let finishedIngredientId = matchedIng?.id;

      if (!finishedIngredientId) {
        // Auto-create ingredient record with standard warehouse ITEM-XXXX code
        const maxIdRes = await client.query("SELECT MAX(id) as max_id FROM ingredients");
        const nextId = (maxIdRes.rows[0]?.max_id || 0) + 1;
        const codeToUse = `ITEM-${1000 + nextId}`;
        const newIng = await client.query(
          `INSERT INTO ingredients (
            name, code, item_code, barcode, unit, cost, avg_cost, last_purchase_price,
            item_group, category, allow_sales, allow_purchase, current_stock, is_manufactured
          )
          VALUES ($1::text, $2::text, $3::text, $4::text, $5::text, $6::numeric, $7::numeric, $8::numeric, 'منتجات تامة الصنع', 'منتجات تامة الصنع', 1, 0, 0, 1)
          RETURNING id`,
          [finishedProductName, codeToUse, codeToUse, finishedProductCode || null, finishedUnit, finishedCost, finishedCost, finishedCost]
        );
        finishedIngredientId = newIng.rows[0]?.id;
      } else {
        // Cost is decimal by contract. Use a schema-aware fallback for databases
        // that were created with legacy INTEGER columns and could not be migrated
        // yet; this keeps posting functional while the startup repair fixes the schema.
        const costTypeRes = await client.query(
          `SELECT data_type FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name = 'ingredients' AND column_name = 'cost'`
        );
        const avgCostTypeRes = await client.query(
          `SELECT data_type FROM information_schema.columns
           WHERE table_schema = current_schema() AND table_name = 'ingredients' AND column_name = 'avg_cost'`
        );
        const costIsInteger = ['integer', 'bigint', 'smallint'].includes(String(costTypeRes.rows[0]?.data_type || '').toLowerCase());
        const avgCostIsInteger = ['integer', 'bigint', 'smallint'].includes(String(avgCostTypeRes.rows[0]?.data_type || '').toLowerCase());

        if (costIsInteger || avgCostIsInteger) {
          await client.query(
            `UPDATE ingredients
             SET cost = CASE WHEN $1::numeric > 0 THEN ROUND($1::numeric) ELSE cost END,
                 avg_cost = CASE WHEN $1::numeric > 0 THEN ROUND($1::numeric) ELSE avg_cost END,
                 is_manufactured = 1
             WHERE id = $2::integer`,
            [finishedCost, finishedIngredientId]
          );
        } else {
          await client.query(
            `UPDATE ingredients
             SET cost = CASE WHEN $1::numeric > 0 THEN $1::numeric ELSE cost END,
                 avg_cost = CASE WHEN $1::numeric > 0 THEN $1::numeric ELSE avg_cost END,
                 is_manufactured = 1
             WHERE id = $2::integer`,
            [finishedCost, finishedIngredientId]
          );
        }
      }

      // Apply movement to inventory_items
      await applyStockMovement(client, {
        warehouse_id: finishedWarehouseId,
        ingredient_id: finishedIngredientId,
        delta: producedQty,
        field: "quantity",
        ref_type: "production_receipt",
        ref_id: orderNumericRef,
        user: user,
        notes: `استلام منتج تام الصنع من أمر إنتاج رقم ${orderNumber} - كمية: ${producedQty} ${finishedUnit}`,
        unit_cost: finishedCost,
        ingredient_name: finishedProductName
      });

      // Synchronize cost across any duplicate ingredient records with the same normalized name or code
      // so that no duplicate finished product row in inventory_items displays avg_cost = 0
      if (finishedCost > 0) {
        const dupFinIngs = allIngsRes.rows.filter((ing: any) =>
          Number(ing.id) !== Number(finishedIngredientId) && (
            (normFinishedName && (ing.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === normFinishedName) ||
            (finishedProductCode && [ing.code, ing.item_code, ing.barcode].some((v: any) => v && normCode(v) === normCode(finishedProductCode)))
          )
        );
        for (const dupIng of dupFinIngs) {
          try {
            await client.query(
              `UPDATE ingredients SET cost = CASE WHEN COALESCE(cost, 0) <= 0 THEN $1 ELSE cost END, avg_cost = CASE WHEN COALESCE(avg_cost, 0) <= 0 THEN $1 ELSE avg_cost END WHERE id = $2`,
              [finishedCost, dupIng.id]
            );
            await client.query(
              `UPDATE inventory_items SET avg_cost = CASE WHEN COALESCE(avg_cost, 0) <= 0 THEN $1 ELSE avg_cost END, cost = CASE WHEN COALESCE(cost, 0) <= 0 THEN $1 ELSE cost END, last_cost = CASE WHEN COALESCE(last_cost, 0) <= 0 THEN $1 ELSE last_cost END WHERE ingredient_id = $2`,
              [finishedCost, dupIng.id]
            );
          } catch (_) {}
        }
      }

      // Update total current_stock in ingredients table
      const finSumRes = await client.query(
        "SELECT COALESCE(SUM(quantity), 0) as total, COALESCE(AVG(NULLIF(avg_cost, 0)), $2) as eff_avg_cost FROM inventory_items WHERE ingredient_id = $1",
        [finishedIngredientId, finishedCost]
      );
      const finTotalStock = Number(finSumRes.rows[0]?.total || 0);
      const effectiveFinishedAvgCost = Number(finSumRes.rows[0]?.eff_avg_cost || finishedCost || 0);
      await client.query(
        "UPDATE ingredients SET current_stock = $1 WHERE id = $2",
        [finTotalStock, finishedIngredientId]
      );

      // Record official Inventory Valuation Transaction in stock_valuation table
      const rcTxNumber = `TXN-PRD-REC-${orderNumericRef}`;
      const costComponentsMeta = {
        direct_materials: calculatedTotalCost,
        direct_labor: totalLaborCost,
        overhead: totalOverheadCost,
        other: totalOtherCost,
        total_production_cost: totalProductionCost,
        unit_cost: finishedCost,
        produced_quantity: producedQty
      };
      try {
        const whFinStockRes = await client.query(
          "SELECT COALESCE(SUM(quantity), 0) as wh_qty, COALESCE(MAX(avg_cost), $3) as wh_avg FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
          [finishedWarehouseId, finishedIngredientId, effectiveFinishedAvgCost]
        );
        const whQtyOnHand = Number(whFinStockRes.rows[0]?.wh_qty || producedQty);
        const whAvgCost = Number(whFinStockRes.rows[0]?.wh_avg || effectiveFinishedAvgCost || finishedCost);
        const whTotalVal = Math.round(whQtyOnHand * whAvgCost * 100) / 100;

        await client.query(
          `INSERT INTO stock_valuation (
            ingredient_id, warehouse_id, valuation_date, quantity_on_hand, unit_cost, total_value,
            valuation_method, reference_type, reference_id, production_order, production_receipt, cost_components, notes
          )
          VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, 'weighted_average', 'production_receipt', $6, $7, $8, $9, $10)`,
          [
            finishedIngredientId,
            finishedWarehouseId,
            whQtyOnHand,
            whAvgCost,
            whTotalVal,
            String(order.id || orderNumericRef),
            orderNumber,
            rcTxNumber,
            JSON.stringify(costComponentsMeta),
            `تقييم مخزون استلام إنتاج تام لأمر الإنتاج رقم ${orderNumber} - سند استلام ${rcTxNumber}`
          ]
        );
      } catch (valErr) {
        console.warn("Stock valuation insert warning (non-blocking):", valErr);
      }

      // Update products table if matched or by ID
      const targetProdId = dto.productId || order.product_id;
      if (targetProdId) {
        await client.query(
          `UPDATE products 
           SET stock = COALESCE(stock, 0) + $1, 
               cost_price = CASE WHEN $2::numeric > 0 THEN $2::numeric ELSE cost_price END 
           WHERE id::text = $3::text OR code::text = $3::text`,
          [producedQty, finishedCost, String(targetProdId)]
        );
      }

      for (const item of resolvedItems) {
        if (item.ingredientId > 0) {
          const itemSumRes = await client.query(
            "SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_items WHERE ingredient_id = $1",
            [item.ingredientId]
          );
          const itemTotal = Number(itemSumRes.rows[0]?.total || 0);
          await client.query(
            "UPDATE ingredients SET current_stock = $1 WHERE id = $2",
            [itemTotal, item.ingredientId]
          );
        }
      }

      // Official Inventory Transactions Logging (non-blocking audit mirror).
      // Savepoints prevent a legacy audit-table schema from aborting production.
      await client.query("ALTER TABLE inventory_transactions ALTER COLUMN quantity DROP NOT NULL").catch(() => {});
      await client.query("ALTER TABLE inventory_transactions ALTER COLUMN quantity SET DEFAULT 0").catch(() => {});
      await client.query("SAVEPOINT production_inventory_logs");
      try {
        await client.query(
          `INSERT INTO inventory_transactions (
            transaction_number, date, warehouse_id, ingredient_id, quantity, unit_cost, total_cost, type, reason, reference, "user", status, notes, items
          )
          VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, 'receive', 'استلام إنتاج تام', $7, $8, 'approved', $9, $10)
          ON CONFLICT DO NOTHING`,
          [
            rcTxNumber,
            finishedWarehouseId,
            finishedIngredientId || null,
            Number(producedQty) || 0,
            Number(finishedCost) || 0,
            Math.round((Number(producedQty) || 0) * (Number(finishedCost) || 0) * 100) / 100,
            orderNumber,
            user,
            `استلام وتوريد منتج تام الصنع [${finishedProductName}] من أمر إنتاج رقم ${orderNumber}`,
            JSON.stringify([{
              ingredient_id: finishedIngredientId,
              name: finishedProductName,
              unit: finishedUnit,
              quantity: producedQty,
              price: finishedCost,
              total: Math.round((Number(producedQty) || 0) * (Number(finishedCost) || 0) * 100) / 100,
              production_order: orderNumber,
              production_receipt: rcTxNumber,
              cost_components: costComponentsMeta
            }])
          ]
        );
      } catch (txErr) {
        try { await client.query("ROLLBACK TO SAVEPOINT production_inventory_logs"); } catch (_) {}
        console.warn("Receipt transaction logging warning:", txErr);
      }

      try {
        if (deductedItems.length > 0) {
          const isTxNumber = `TXN-PRD-ISS-${orderNumericRef}`;
          const totalIssueQty = deductedItems.reduce((acc, d) => acc + (Number(d.quantity) || 0), 0);
          const totalIssueCost = deductedItems.reduce((acc, d) => acc + (Number(d.totalCost) || 0), 0);
          const singleIngredientId = deductedItems.length === 1 ? deductedItems[0].ingredientId : null;
          await client.query(
            `INSERT INTO inventory_transactions (
              transaction_number, date, warehouse_id, ingredient_id, quantity, total_cost, type, reason, reference, "user", status, notes, items
            )
            VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, 'issue', 'صرف خامات لأمر إنتاج', $6, $7, 'approved', $8, $9)
            ON CONFLICT DO NOTHING`,
            [
              isTxNumber,
              rawWarehouseId,
              singleIngredientId,
              totalIssueQty,
              totalIssueCost,
              orderNumber,
              user,
              `صرف واستهلاك خامات ومكونات لتشغيل أمر الإنتاج رقم ${orderNumber}`,
              JSON.stringify(deductedItems.map(d => ({
                ingredient_id: d.ingredientId,
                name: d.name,
                unit: d.unit,
                quantity: d.quantity,
                price: d.unitCost,
                total: d.totalCost
              })))
            ]
          );
        }
      } catch (txErr) {
        try { await client.query("ROLLBACK TO SAVEPOINT production_inventory_logs"); } catch (_) {}
        console.warn("Issue transaction logging warning:", txErr);
      }
      try {
        await client.query("RELEASE SAVEPOINT production_inventory_logs");
      } catch (_) {}

      // Sync Products Table (for POS and Sales catalog). This is secondary to
      // the warehouse receipt, so isolate it with a savepoint: an old products
      // schema can never abort the main production transaction.
      await client.query("SAVEPOINT production_products_sync");
      try {
        // Ensure the canonical active flag exists on legacy databases.
        await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true");
        const prodCheck = await client.query(
          "SELECT id FROM products WHERE id::text = $1::text OR code::text = $1::text OR name::text = $2::text",
          [String(order.product_id), finishedProductName]
        );
        if (prodCheck.rows.length === 0) {
          const prodCode = finishedProductCode || `PROD-${order.product_id}`;
          await client.query(
            `INSERT INTO products (name, code, barcode, unit, cost, price, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             ON CONFLICT DO NOTHING`,
            [
              finishedProductName,
              prodCode,
              prodCode,
              finishedUnit,
              finishedCost,
              Math.round(finishedCost * 1.25 * 100) / 100
            ]
          );
        }
        await client.query("RELEASE SAVEPOINT production_products_sync");
      } catch (prodErr) {
        await client.query("ROLLBACK TO SAVEPOINT production_products_sync");
        await client.query("RELEASE SAVEPOINT production_products_sync");
        console.warn("Products sync warning (non-blocking):", prodErr);
      }

      // 7. Insert official record into production_runs
      const runRes = await client.query(
        `INSERT INTO production_runs (
          order_number, product_id, warehouse_id, finished_warehouse_id,
          quantity, status, total_cost, unit_cost, bom_id, bom_snapshot,
          notes, executed_by, executed_at, labor_cost, overhead_cost, other_cost
        )
        VALUES ($1, $2, $3, $4, $5, 'completed', $6, $7, $8, $9, $10, $11, NOW(), $12, $13, $14)
        RETURNING *`,
        [
          orderNumber,
          prodRes.rows[0]?.id || parseInt(String(order.product_id).replace(/[^0-9]/g, '')) || 1,
          rawWarehouseId,
          finishedWarehouseId,
          producedQty,
          totalProductionCost,
          finishedCost,
          order.bom_id || '',
          JSON.stringify(snapshotItems),
          dto.notes || `تنفيذ وترحيل أمر الإنتاج رقم ${orderNumber} بنجاح`,
          user,
          totalLaborCost,
          totalOverheadCost,
          totalOtherCost
        ]
      );
      const newRun = runRes.rows[0];

      // 8. Update Order status in database
      await client.query(
        `UPDATE production_orders 
         SET status = 'completed', progress = 100, is_executed = true, executed_by = $1, executed_at = NOW(),
             raw_warehouse_id = $2, finished_warehouse_id = $3, total_cost = $4, cost_per_unit = $5,
             labor_cost = $6, overhead_cost = $7, other_cost = $8
         WHERE order_number = $9`,
        [user, rawWarehouseId, finishedWarehouseId, totalProductionCost, finishedCost, totalLaborCost, totalOverheadCost, totalOtherCost, orderNumber]
      );

      // 9. Sync with remo_production_orders in settings table for frontend/other components
      try {
        const curSettings = await client.query("SELECT value FROM settings WHERE key = 'remo_production_orders'");
        if (curSettings.rows.length > 0) {
          const list = JSON.parse(curSettings.rows[0].value || '[]');
          const updatedList = list.map((o: any) => {
            if (o.orderNumber === orderNumber || o.id === order.id) {
              return {
                ...o,
                status: 'completed',
                progress: 100,
                is_executed: true,
                isExecuted: true,
                executedBy: user,
                executedAt: new Date().toISOString(),
                rawWarehouseId,
                finishedWarehouseId,
                totalCost: totalProductionCost,
                costPerUnit: finishedCost,
                laborCost: totalLaborCost,
                overheadCost: totalOverheadCost,
                otherCost: totalOtherCost
              };
            }
            return o;
          });
          await client.query("UPDATE settings SET value = $1 WHERE key = 'remo_production_orders'", [JSON.stringify(updatedList)]);
        }
      } catch (syncErr) {
        console.warn("Could not sync remo_production_orders settings:", syncErr);
      }

      const journalEntry = await postProductionEntry({
        orderId: Number(order.id),
        orderNumber,
        productName: finishedProductName,
        quantity: producedQty,
        rawWarehouseId,
        finishedWarehouseId,
        totalCost: totalProductionCost,
        costPerUnit: finishedCost,
        deductedMaterialsCount: deductedItems.length,
        executedBy: user,
      }, client);
      if (!journalEntry?.id) throw new Error("تعذر إنشاء قيد محاسبي لأمر الإنتاج");

      await client.query("COMMIT");

      // Idempotent direct Cost Engine Integration
      try {
        await recordProductionCost(orderNumber);
      } catch (costErr) {
        console.warn("Could not record production cost in Cost Engine:", costErr);
      }

      return {
        success: true,
        orderId: Number(order.id),
        orderNumber,
        status: 'completed',
        producedQuantity: producedQty,
        productName: finishedProductName,
        rawWarehouseId,
        finishedWarehouseId,
        deductedMaterialsCount: deductedItems.length,
        deductedItems,
        totalMaterialCost: calculatedTotalCost,
        totalProductionCost,
        costPerUnit: finishedCost,
        journalEntryId: journalEntry.id,
        runId: newRun?.id,
        executedAt: new Date().toISOString(),
        executedBy: user,
        message: `تم تنفيذ وترحيل أمر الإنتاج [${orderNumber}] بنجاح، وخصم المواد الخام، وإضافة المنتج التام للمخازن.`
      };

    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteOrder(id: string): Promise<boolean> {
    await this.ensureTableExists();
    try {
      await erpPool.query("DELETE FROM production_orders WHERE id::text = $1::text OR order_number::text = $1::text", [id]);
      return true;
    } catch (e) {
      console.error("Error deleting production order:", e);
      return false;
    }
  }

  async clearOrders(): Promise<boolean> {
    await this.ensureTableExists();
    try {
      await erpPool.query("DELETE FROM production_orders");
      await erpPool.query("DELETE FROM production_runs");
      return true;
    } catch (e) {
      console.error("Error clearing production orders:", e);
      return false;
    }
  }

  async deleteBOM(id: string): Promise<boolean> {
    await this.ensureTableExists();
    try {
      await erpPool.query("DELETE FROM production_boms WHERE id = $1", [id]);
      return true;
    } catch (e) {
      console.error("Error deleting BOM:", e);
      return false;
    }
  }

  async clearBOMs(): Promise<boolean> {
    await this.ensureTableExists();
    try {
      await erpPool.query("DELETE FROM production_boms");
      return true;
    } catch (e) {
      console.error("Error clearing BOMs:", e);
      return false;
    }
  }

  // Legacy fallback for simple production run record
  async create(run: CreateProductionRunDTO): Promise<any> {
    return this.executeProductionOrder({
      orderNumber: `RUN-${Date.now()}`,
      rawWarehouseId: run.warehouse_id,
      finishedWarehouseId: run.finished_warehouse_id || run.warehouse_id,
      allowNegativeStock: true,
      notes: run.notes
    });
  }

  // Unified Shared Products across POS, Sales, and Production
  async getSharedProducts(): Promise<any[]> {
    await this.ensureTableExists();
    const result: any[] = [];
    const seen = new Set<string>();

    // 1. Fetch POS / Restaurant products
    try {
      const posRes = await erpPool.query(`
        SELECT 
          p.id, p.name, p.code, p.barcode, p.price, p.cost, p.cost_price, p.unit, p.is_active, p.image,
          c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        ORDER BY p.id ASC
      `);
      for (const row of posRes.rows) {
        const code = row.code || row.barcode || (row.id ? `POS-${row.id}` : '');
        const key = `pos:${row.id}:${code || row.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            id: `pos-${row.id}`,
            rawId: row.id,
            code: code || row.name,
            name: row.name,
            unit: row.unit || 'قطعة',
            category: row.category_name || 'منتجات نقطة البيع (POS)',
            source: 'pos',
            sourceLabel: 'نقاط البيع (POS)',
            price: parseFloat(row.price || '0'),
            cost: parseFloat(row.cost_price || row.cost || '0'),
            image: row.image || '',
            type: 'finished',
            isActive: row.is_active !== false
          });
        }
      }
    } catch (e) {
      console.error("Error fetching POS products for shared production catalog:", e);
    }

    // 2. Fetch Sales Module products
    try {
      const salesRes = await erpPool.query(`
        SELECT 
          sp.id, sp.name, sp.code, sp.sku, sp.barcode, sp.base_price, sp.wholesale_price, sp.retail_price,
          COALESCE(ing.cost, ing.avg_cost, ing.last_purchase_price, 0) as inventory_cost,
          sp.unit, sp.category, sp.is_active, sp.image
        FROM sales_products sp
        LEFT JOIN ingredients ing ON COALESCE(sp.master_item_id, sp.inventory_item_id) = ing.id
        ORDER BY sp.id ASC
      `);
      for (const row of salesRes.rows) {
        const code = row.code || row.sku || row.barcode || (row.id ? `SPRD-${row.id}` : '');
        const key = `sales:${row.id}:${code || row.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({
            id: `sales-${row.id}`,
            rawId: row.id,
            code: code || row.name,
            name: row.name,
            unit: row.unit || 'قطعة',
            category: row.category || 'منتجات المبيعات',
            source: 'sales',
            sourceLabel: 'مديول المبيعات (Sales)',
            price: parseFloat(row.retail_price || row.base_price || '0'),
            cost: parseFloat(row.inventory_cost || '0'),
            image: row.image || '',
            type: 'finished',
            isActive: row.is_active !== false
          });
        }
      }
    } catch (e) {
      console.error("Error fetching Sales products for shared production catalog:", e);
    }

    // 3. Fetch Production products from settings (remo_production_products)
    try {
      const prodRes = await erpPool.query("SELECT value FROM settings WHERE key = 'remo_production_products'");
      if (prodRes.rows.length > 0 && prodRes.rows[0].value) {
        const parsed = typeof prodRes.rows[0].value === 'string' ? JSON.parse(prodRes.rows[0].value) : prodRes.rows[0].value;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (!item || !item.name) continue;
            const code = item.code || (item.id ? `PROD-${item.id}` : '');
            const key = `prod:${code || item.name}`;
            if (!seen.has(key)) {
              seen.add(key);
              result.push({
                id: String(item.id || `prod-${code}`),
                rawId: item.id,
                code: code || item.name,
                name: item.name,
                unit: item.unit || 'قطعة',
                category: item.category || 'دليل الإنتاج والتصنيع',
                source: 'production',
                sourceLabel: 'دليل الإنتاج والتصنيع (Production)',
                price: parseFloat(item.price || '0'),
                cost: parseFloat(item.cost || '0'),
                image: item.image || '',
                type: item.type || 'finished',
                isActive: true
              });
            }
          }
        }
      }
    } catch (e) {
      console.error("Error fetching production definitions for shared production catalog:", e);
    }

    return result;
  }
}
