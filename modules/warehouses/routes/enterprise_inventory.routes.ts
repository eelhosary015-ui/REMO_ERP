import { Router, Request, Response } from "express";
import { pool } from "../../../server-db.js";
import { ERPEventBus } from "../../../server-erp-core.js";
import { moveStock } from "../services/inventory.service.js";
import { recordGoodsReceiptCost, recordPurchaseCost, recordWarehouseTransferCost } from "../../costs/services/cost.integration.service.js";
import { postWarehouseTransferEntry } from "../../accounts/services/auto-posting.service.js";
import { GoodsReceiptPostingService } from "../services/grn_posting.service.js";
import { UnitConversionService } from "../../common/services/unit_conversion.service.js";

const router = Router();

// Helper to log audit trail
async function logAudit(client: any, data: {
  entity_type: string;
  entity_id?: number;
  action: string;
  user_id?: number;
  user_name?: string;
  before_data?: any;
  after_data?: any;
  details?: string;
  ip_address?: string;
}) {
  try {
    await client.query(`
      INSERT INTO inventory_audit_trail (
        entity_type, entity_id, action, user_id, user_name, before_data, after_data, details, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      data.entity_type,
      data.entity_id || null,
      data.action,
      data.user_id || null,
      data.user_name || "System",
      data.before_data ? JSON.stringify(data.before_data) : null,
      data.after_data ? JSON.stringify(data.after_data) : null,
      data.details || null,
      data.ip_address || "127.0.0.1"
    ]);
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

// Ensure batch_tracking unique constraint for ON CONFLICT (ingredient_id, warehouse_id, batch_number)
(async () => {
  try {
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_batch_tracking_ing_wh_batch ON batch_tracking(ingredient_id, warehouse_id, batch_number)`);
  } catch (_) {}
})();

// ═══════════════════════════════════════════════════════════════
// 1. WAREHOUSE LOCATIONS & HIERARCHY (Zones, Racks, Shelves, Bins)
// ═══════════════════════════════════════════════════════════════

router.get("/api/warehouse-locations", async (req: Request, res: Response) => {
  try {
    const { warehouse_id, parent_id, type } = req.query;
    let query = `
      SELECT wl.*, w.name as warehouse_name, p.name as parent_name
      FROM warehouse_locations wl
      JOIN warehouses w ON wl.warehouse_id = w.id
      LEFT JOIN warehouse_locations p ON wl.parent_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id) {
      params.push(Number(warehouse_id));
      query += ` AND wl.warehouse_id = $${params.length}`;
    }
    if (parent_id) {
      params.push(Number(parent_id));
      query += ` AND wl.parent_id = $${params.length}`;
    }
    if (type) {
      params.push(String(type));
      query += ` AND wl.type = $${params.length}`;
    }
    query += ` ORDER BY wl.zone ASC, wl.rack ASC, wl.shelf ASC, wl.bin ASC, wl.code ASC`;
    const result = await pool.query(query, params);
    res.json({ success: true, locations: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/api/warehouse-locations", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      warehouse_id, parent_id, code, name, type, zone, rack, shelf, bin,
      barcode, max_weight, max_volume, notes, user
    } = req.body;

    if (!warehouse_id || !code || !name) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "المخزن والكود والاسم حقول مطلوبة" });
    }

    const check = await client.query(
      "SELECT id FROM warehouse_locations WHERE warehouse_id = $1 AND code = $2",
      [warehouse_id, code]
    );
    if (check.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "كود الموقع مستخدم بالفعل في هذا المخزن" });
    }

    const result = await client.query(`
      INSERT INTO warehouse_locations (
        warehouse_id, parent_id, code, name, type, zone, rack, shelf, bin,
        barcode, max_weight, max_volume, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      warehouse_id, parent_id || null, code, name, type || 'bin',
      zone || null, rack || null, shelf || null, bin || null,
      barcode || code, Number(max_weight || 0), Number(max_volume || 0), notes || null
    ]);

    await logAudit(client, {
      entity_type: "warehouse_location",
      entity_id: result.rows[0].id,
      action: "create",
      user_name: user || "admin",
      after_data: result.rows[0],
      details: `إنشاء موقع تخزين جديد: ${code} - ${name}`
    });

    await client.query("COMMIT");
    res.json({ success: true, location: result.rows[0], message: "تم إنشاء موقع التخزين بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

router.put("/api/warehouse-locations/:id", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const { name, type, zone, rack, shelf, bin, barcode, max_weight, max_volume, is_active, notes, user } = req.body;

    const beforeRes = await client.query("SELECT * FROM warehouse_locations WHERE id = $1", [id]);
    if (beforeRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "الموقع غير موجود" });
    }

    const result = await client.query(`
      UPDATE warehouse_locations SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        zone = COALESCE($3, zone),
        rack = COALESCE($4, rack),
        shelf = COALESCE($5, shelf),
        bin = COALESCE($6, bin),
        barcode = COALESCE($7, barcode),
        max_weight = COALESCE($8, max_weight),
        max_volume = COALESCE($9, max_volume),
        is_active = COALESCE($10, is_active),
        notes = COALESCE($11, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *
    `, [name, type, zone, rack, shelf, bin, barcode, max_weight, max_volume, is_active, notes, id]);

    await logAudit(client, {
      entity_type: "warehouse_location",
      entity_id: id,
      action: "update",
      user_name: user || "admin",
      before_data: beforeRes.rows[0],
      after_data: result.rows[0],
      details: `تحديث موقع التخزين: ${result.rows[0].code}`
    });

    await client.query("COMMIT");
    res.json({ success: true, location: result.rows[0], message: "تم تحديث الموقع بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

router.delete("/api/warehouse-locations/:id", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const beforeRes = await client.query("SELECT * FROM warehouse_locations WHERE id = $1", [id]);
    if (beforeRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "الموقع غير موجود" });
    }

    // Check if child locations or stock exists
    const children = await client.query("SELECT id FROM warehouse_locations WHERE parent_id = $1", [id]);
    if (children.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن حذف الموقع لوجود مواقع فرعية تابعة له" });
    }

    await client.query("DELETE FROM warehouse_locations WHERE id = $1", [id]);

    await logAudit(client, {
      entity_type: "warehouse_location",
      entity_id: id,
      action: "delete",
      before_data: beforeRes.rows[0],
      details: `حذف موقع التخزين: ${beforeRes.rows[0].code}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم حذف الموقع بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Full Location Hierarchy Tree for a Warehouse
router.get("/api/warehouse-locations/tree/:warehouseId", async (req: Request, res: Response) => {
  try {
    const warehouseId = Number(req.params.warehouseId);
    const result = await pool.query(`
      SELECT wl.*, 
        COALESCE((SELECT COUNT(*) FROM warehouse_locations sub WHERE sub.parent_id = wl.id), 0) as child_count
      FROM warehouse_locations wl
      WHERE wl.warehouse_id = $1
      ORDER BY wl.type = 'zone' DESC, wl.type = 'rack' DESC, wl.type = 'shelf' DESC, wl.code ASC
    `, [warehouseId]);

    const all = result.rows;
    // Build tree
    const rootNodes = all.filter((l: any) => !l.parent_id);
    const buildTree = (nodes: any[]): any[] => {
      return nodes.map((node: any) => ({
        ...node,
        children: buildTree(all.filter((child: any) => child.parent_id === node.id))
      }));
    };

    res.json({ success: true, tree: buildTree(rootNodes), total_locations: all.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. ADVANCED ITEM MASTER & MULTI-UOM & BARCODES
// ═══════════════════════════════════════════════════════════════

// Comprehensive Item Catalog
router.get("/api/items", async (req: Request, res: Response) => {
  try {
    const { search, category, item_type, tracking_type, is_active, page, limit } = req.query;
    let baseQuery = `
      SELECT ing.*,
        COALESCE(sup.name, ing.supplier) as preferred_supplier_name,
        COALESCE((SELECT SUM(ii.quantity) FROM inventory_items ii WHERE ii.ingredient_id = ing.id), 0) as total_on_hand,
        COALESCE((SELECT SUM(ii.reserved) FROM inventory_items ii WHERE ii.ingredient_id = ing.id), 0) as total_reserved,
        COALESCE((SELECT SUM(ii.in_transit) FROM inventory_items ii WHERE ii.ingredient_id = ing.id), 0) as total_in_transit,
        (
          SELECT json_agg(json_build_object('id', ib.id, 'barcode', ib.barcode, 'type', ib.barcode_type, 'uom', ib.uom, 'is_primary', ib.is_primary))
          FROM item_barcodes ib WHERE ib.ingredient_id = ing.id
        ) as barcodes,
        (
          SELECT json_agg(json_build_object('id', uom.id, 'from_uom', uom.from_uom, 'to_uom', uom.to_uom, 'factor', uom.conversion_factor))
          FROM item_uom_conversions uom WHERE uom.ingredient_id = ing.id
        ) as uom_conversions
      FROM ingredients ing
      LEFT JOIN suppliers sup ON ing.preferred_supplier_id = sup.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      baseQuery += ` AND (ing.name ILIKE $${params.length} OR ing.name_en ILIKE $${params.length} OR ing.item_code ILIKE $${params.length} OR ing.sku ILIKE $${params.length} OR ing.barcode ILIKE $${params.length} OR EXISTS (SELECT 1 FROM item_barcodes ib WHERE ib.ingredient_id = ing.id AND ib.barcode ILIKE $${params.length}))`;
    }
    if (category && category !== "all") {
      params.push(category);
      baseQuery += ` AND (ing.category = $${params.length} OR ing.item_group = $${params.length})`;
    }
    if (item_type && item_type !== "all") {
      params.push(item_type);
      baseQuery += ` AND ing.item_type = $${params.length}`;
    }
    if (tracking_type && tracking_type !== "all") {
      params.push(tracking_type);
      baseQuery += ` AND ing.tracking_type = $${params.length}`;
    }
    if (is_active !== undefined) {
      params.push(is_active === "true" || is_active === "1");
      baseQuery += ` AND ing.is_active = $${params.length}`;
    }

    baseQuery += ` ORDER BY ing.id DESC`;

    const p = Math.max(1, Number(page || 1));
    const l = Math.min(200, Math.max(1, Number(limit || 50)));
    const offset = (p - 1) * l;

    // Count
    const countRes = await pool.query(`SELECT COUNT(*) FROM (${baseQuery}) as count_tbl`, params);
    const total = Number(countRes.rows[0].count);

    baseQuery += ` LIMIT ${l} OFFSET ${offset}`;
    const result = await pool.query(baseQuery, params);

    res.json({
      success: true,
      items: result.rows,
      pagination: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l)
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Barcode Lookup for Scanners (Fast lookup across items, batches, and serials)
router.get("/api/barcode-lookup/:code", async (req: Request, res: Response) => {
  try {
    const code = String(req.params.code).trim();
    if (!code) {
      return res.status(400).json({ success: false, error: "كود الباركود مطلوب" });
    }

    // 1. Check item primary/secondary barcodes
    const itemRes = await pool.query(`
      SELECT ing.*, ib.barcode_type, ib.uom as barcode_uom
      FROM ingredients ing
      LEFT JOIN item_barcodes ib ON ib.ingredient_id = ing.id
      WHERE ing.barcode = $1 OR ing.item_code = $2 OR ing.sku = $3 OR ib.barcode = $4
      LIMIT 1
    `, [code, code, code, code]);

    if (itemRes.rows.length > 0) {
      const item = itemRes.rows[0];
      // Fetch current stock across warehouses
      const stockRes = await pool.query(`
        SELECT ii.*, w.name as warehouse_name, w.code as warehouse_code
        FROM inventory_items ii
        JOIN warehouses w ON ii.warehouse_id = w.id
        WHERE ii.ingredient_id = $1
      `, [item.id]);

      return res.json({
        success: true,
        match_type: "item",
        item,
        stocks: stockRes.rows
      });
    }

    // 2. Check Serial Numbers
    const serialRes = await pool.query(`
      SELECT s.*, ing.name as item_name, ing.item_code, w.name as warehouse_name
      FROM item_serials s
      JOIN ingredients ing ON s.ingredient_id = ing.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      WHERE s.serial_number = $1
      LIMIT 1
    `, [code]);

    if (serialRes.rows.length > 0) {
      return res.json({
        success: true,
        match_type: "serial",
        serial: serialRes.rows[0]
      });
    }

    // 3. Check Batch Numbers
    const batchRes = await pool.query(`
      SELECT b.*, ing.name as item_name, ing.item_code, w.name as warehouse_name
      FROM batch_tracking b
      JOIN ingredients ing ON b.ingredient_id = ing.id
      LEFT JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.batch_number = $1
      LIMIT 1
    `, [code]);

    if (batchRes.rows.length > 0) {
      return res.json({
        success: true,
        match_type: "batch",
        batch: batchRes.rows[0]
      });
    }

    // 4. Check Warehouse Locations
    const locRes = await pool.query(`
      SELECT wl.*, w.name as warehouse_name
      FROM warehouse_locations wl
      JOIN warehouses w ON wl.warehouse_id = w.id
      WHERE wl.barcode = $1 OR wl.code = $2
      LIMIT 1
    `, [code, code]);

    if (locRes.rows.length > 0) {
      return res.json({
        success: true,
        match_type: "location",
        location: locRes.rows[0]
      });
    }

    res.status(404).json({ success: false, error: "لم يتم العثور على أي صنف أو تشغيلة أو سيريال بهذا الباركود" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Manage Item Barcodes
router.post("/api/item-barcodes", async (req: Request, res: Response) => {
  try {
    const { ingredient_id, barcode, barcode_type, uom, is_primary, notes } = req.body;
    if (!ingredient_id || !barcode) {
      return res.status(400).json({ success: false, error: "الصنف والباركود حقول مطلوبة" });
    }

    if (is_primary) {
      await pool.query("UPDATE item_barcodes SET is_primary = false WHERE ingredient_id = $1", [ingredient_id]);
      await pool.query("UPDATE ingredients SET barcode = $1 WHERE id = $2", [barcode, ingredient_id]);
    }

    const result = await pool.query(`
      INSERT INTO item_barcodes (ingredient_id, barcode, barcode_type, uom, is_primary, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (barcode) DO UPDATE SET
        barcode_type = EXCLUDED.barcode_type,
        uom = EXCLUDED.uom,
        is_primary = EXCLUDED.is_primary,
        notes = EXCLUDED.notes
      RETURNING *
    `, [ingredient_id, barcode, barcode_type || 'code128', uom || null, !!is_primary, notes || null]);

    res.json({ success: true, barcode: result.rows[0], message: "تم حفظ الباركود بنجاح" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/api/item-barcodes/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM item_barcodes WHERE id = $1", [id]);
    res.json({ success: true, message: "تم حذف الباركود" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Multi-UOM Conversions
router.get("/api/item-uom/:itemId", async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.itemId);
    const result = await pool.query(
      "SELECT * FROM item_uom_conversions WHERE ingredient_id = $1 ORDER BY id ASC",
      [itemId]
    );
    res.json({ success: true, conversions: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/api/item-uom", async (req: Request, res: Response) => {
  try {
    const { ingredient_id, from_uom, to_uom, conversion_factor, operator, is_purchase_default, is_sales_default, is_consumption_default, notes } = req.body;
    if (!ingredient_id || !from_uom || !to_uom || !conversion_factor) {
      return res.status(400).json({ success: false, error: "بيانات التحويل غير مكتملة" });
    }

    const result = await pool.query(`
      INSERT INTO item_uom_conversions (
        ingredient_id, from_uom, to_uom, conversion_factor, operator,
        is_purchase_default, is_sales_default, is_consumption_default, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      ingredient_id, from_uom, to_uom, Number(conversion_factor), operator || 'multiply',
      !!is_purchase_default, !!is_sales_default, !!is_consumption_default, notes || null
    ]);

    res.json({ success: true, conversion: result.rows[0], message: "تمت إضافة معامل تحويل الوحدة" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/api/item-uom/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM item_uom_conversions WHERE id = $1", [id]);
    res.json({ success: true, message: "تم حذف معامل التحويل" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. SERIAL NUMBER & BATCH TRACEABILITY
// ═══════════════════════════════════════════════════════════════

router.get("/api/serials", async (req: Request, res: Response) => {
  try {
    const { ingredient_id, warehouse_id, status, search } = req.query;
    let query = `
      SELECT s.*, ing.name as item_name, ing.item_code, w.name as warehouse_name, wl.name as location_name
      FROM item_serials s
      JOIN ingredients ing ON s.ingredient_id = ing.id
      LEFT JOIN warehouses w ON s.warehouse_id = w.id
      LEFT JOIN warehouse_locations wl ON s.location_id = wl.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (ingredient_id) {
      params.push(Number(ingredient_id));
      query += ` AND s.ingredient_id = $${params.length}`;
    }
    if (warehouse_id) {
      params.push(Number(warehouse_id));
      query += ` AND s.warehouse_id = $${params.length}`;
    }
    if (status && status !== "all") {
      params.push(status);
      query += ` AND s.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (s.serial_number ILIKE $${params.length} OR s.batch_number ILIKE $${params.length} OR ing.name ILIKE $${params.length})`;
    }
    query += ` ORDER BY s.id DESC LIMIT 200`;
    const result = await pool.query(query, params);
    res.json({ success: true, serials: result.rows, total: result.rows.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/api/serials", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { ingredient_id, warehouse_id, location_id, serials, batch_number, purchase_cost, warranty_start_date, warranty_end_date, supplier_id, notes, user } = req.body;

    if (!ingredient_id || !serials || !Array.isArray(serials) || serials.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "الصنف وقائمة الأرقام التسلسلية مطلوبة" });
    }

    const inserted = [];
    for (const sn of serials) {
      const cleanSn = String(sn).trim();
      if (!cleanSn) continue;

      const res = await client.query(`
        INSERT INTO item_serials (
          ingredient_id, warehouse_id, location_id, serial_number, batch_number,
          purchase_cost, warranty_start_date, warranty_end_date, supplier_id, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'in_stock')
        ON CONFLICT (serial_number) DO UPDATE SET
          warehouse_id = EXCLUDED.warehouse_id,
          location_id = EXCLUDED.location_id,
          status = 'in_stock',
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `, [
        ingredient_id, warehouse_id || null, location_id || null, cleanSn, batch_number || null,
        Number(purchase_cost || 0), warranty_start_date || null, warranty_end_date || null,
        supplier_id || null, notes || null
      ]);
      inserted.push(res.rows[0]);
    }

    await logAudit(client, {
      entity_type: "serial_numbers",
      action: "create",
      user_name: user || "admin",
      details: `تسجيل ${inserted.length} رقم تسلسلي للصنف رقم ${ingredient_id}`
    });

    await client.query("COMMIT");
    res.json({ success: true, count: inserted.length, serials: inserted, message: `تم تسجيل ${inserted.length} رقم تسلسلي بنجاح` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// FEFO Suggestions (First Expiry, First Out)
router.get("/api/batches/fefo", async (req: Request, res: Response) => {
  try {
    const { ingredient_id, warehouse_id, required_qty } = req.query;
    if (!ingredient_id) {
      return res.status(400).json({ success: false, error: "الصنف مطلوب" });
    }

    let query = `
      SELECT b.*, ing.name as ingredient_name, w.name as warehouse_name
      FROM batch_tracking b
      JOIN ingredients ing ON b.ingredient_id = ing.id
      JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.ingredient_id = $1 AND b.remaining_quantity > 0
    `;
    const params: any[] = [Number(ingredient_id)];

    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      query += ` AND b.warehouse_id = $${params.length}`;
    }

    // Sort by FEFO (closest expiry date first, nulls last)
    query += ` ORDER BY b.expiry_date ASC NULLS LAST, b.id ASC`;
    const result = await pool.query(query, params);

    // Calculate allocation plan if required_qty is provided
    let allocationPlan: any[] = [];
    if (required_qty) {
      let needed = Number(required_qty);
      for (const batch of result.rows) {
        if (needed <= 0) break;
        const avail = Number(batch.remaining_quantity);
        const take = Math.min(needed, avail);
        allocationPlan.push({
          batch_id: batch.id,
          batch_number: batch.batch_number,
          warehouse_id: batch.warehouse_id,
          warehouse_name: batch.warehouse_name,
          expiry_date: batch.expiry_date,
          unit_cost: batch.unit_cost,
          available_qty: avail,
          allocated_qty: take
        });
        needed -= take;
      }
    }

    res.json({
      success: true,
      batches: result.rows,
      allocation_plan: allocationPlan,
      shortage: required_qty ? Math.max(0, Number(required_qty) - allocationPlan.reduce((acc, p) => acc + p.allocated_qty, 0)) : 0
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Expiry Alert Buckets (Expired, <7 days, <30 days, <60 days, <90 days)
router.get("/api/batches/expiry-alerts", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT b.*, ing.name as ingredient_name, ing.item_code, w.name as warehouse_name,
        (b.expiry_date - CURRENT_DATE) as days_remaining,
        CASE
          WHEN b.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN b.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
          WHEN b.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'warning_30'
          WHEN b.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'warning_60'
          WHEN b.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'warning_90'
          ELSE 'safe'
        END as alert_level
      FROM batch_tracking b
      JOIN ingredients ing ON b.ingredient_id = ing.id
      JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.remaining_quantity > 0 AND b.expiry_date IS NOT NULL AND b.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
      ORDER BY b.expiry_date ASC
    `);

    const expired = result.rows.filter((r: any) => r.alert_level === 'expired');
    const critical = result.rows.filter((r: any) => r.alert_level === 'critical');
    const warning30 = result.rows.filter((r: any) => r.alert_level === 'warning_30');
    const warning60 = result.rows.filter((r: any) => r.alert_level === 'warning_60');
    const warning90 = result.rows.filter((r: any) => r.alert_level === 'warning_90');

    res.json({
      success: true,
      counts: {
        expired: expired.length,
        critical_7d: critical.length,
        warning_30d: warning30.length,
        warning_60d: warning60.length,
        warning_90d: warning90.length,
        total_at_risk: result.rows.length
      },
      expired,
      critical,
      warning30,
      warning60,
      warning90
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// 4. ENTERPRISE GOODS RECEIPT NOTE (GRN) & QC INBOUND WORKFLOW
// ═══════════════════════════════════════════════════════════════

// List Goods Receipts with KPIs, Filters & Pagination
router.get("/api/goods-receipts", async (req: Request, res: Response) => {
  try {
    const {
      warehouse_id, status, supplier_id, qc_status, is_posted,
      purchase_order_id, search, date_from, date_to, has_rejections,
      page = "1", limit = "25", sort_field = "id", sort_order = "desc"
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 25));
    const offset = (pageNum - 1) * limitNum;

    // 1. Calculate KPI summary metrics
    const kpiQuery = `
      SELECT
        COUNT(*) as total_count,
        COUNT(CASE WHEN gr.date = CURRENT_DATE THEN 1 END) as total_today,
        COUNT(CASE WHEN gr.status IN ('qc_pending', 'submitted') OR gr.qc_status = 'pending' THEN 1 END) as qc_pending,
        COUNT(CASE WHEN gr.status IN ('posted', 'completed') THEN 1 END) as completed,
        COUNT(CASE WHEN gr.status = 'rejected' OR gr.qc_status = 'failed' OR EXISTS (SELECT 1 FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id AND gri.rejected_qty > 0) THEN 1 END) as rejected,
        COUNT(CASE WHEN EXISTS (
          SELECT 1 FROM goods_receipt_items gri 
          WHERE gri.goods_receipt_id = gr.id AND gri.ordered_qty > 0 AND (gri.received_qty != gri.ordered_qty)
        ) THEN 1 END) as discrepancy_count,
        COALESCE(SUM(CASE WHEN gr.date = CURRENT_DATE THEN (SELECT SUM(received_qty) FROM goods_receipt_items WHERE goods_receipt_id = gr.id) ELSE 0 END), 0) as today_received_qty,
        COALESCE(SUM(CASE WHEN gr.date = CURRENT_DATE THEN gr.total_amount ELSE 0 END), 0) as today_received_value,
        COUNT(CASE WHEN gr.qc_status = 'pending' THEN 1 END) as needs_qc_count,
        COUNT(CASE WHEN gr.qc_status = 'quarantine' OR EXISTS (SELECT 1 FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id AND gri.quarantine_qty > 0) THEN 1 END) as quarantine_items_count,
        COUNT(CASE WHEN gr.status = 'submitted' THEN 1 END) as waiting_approval_count
      FROM goods_receipts gr
    `;
    const kpiResult = await pool.query(kpiQuery);
    const kpis = kpiResult.rows[0] || {};

    // 2. Build filtered data query
    let whereClause = "WHERE 1=1";
    const params: any[] = [];

    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      whereClause += ` AND gr.warehouse_id = $${params.length}`;
    }
    if (status && status !== "all") {
      params.push(status);
      whereClause += ` AND gr.status = $${params.length}`;
    }
    if (qc_status && qc_status !== "all") {
      params.push(qc_status);
      whereClause += ` AND gr.qc_status = $${params.length}`;
    }
    if (supplier_id && supplier_id !== "all") {
      params.push(Number(supplier_id));
      whereClause += ` AND gr.supplier_id = $${params.length}`;
    }
    if (purchase_order_id && purchase_order_id !== "all") {
      params.push(Number(purchase_order_id));
      whereClause += ` AND gr.purchase_order_id = $${params.length}`;
    }
    if (is_posted !== undefined && is_posted !== "all") {
      params.push(is_posted === "true" || is_posted === "1");
      whereClause += ` AND gr.is_posted = $${params.length}`;
    }
    if (date_from) {
      params.push(date_from);
      whereClause += ` AND gr.date >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      whereClause += ` AND gr.date <= $${params.length}`;
    }
    if (has_rejections === "true") {
      whereClause += ` AND EXISTS (SELECT 1 FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id AND gri.rejected_qty > 0)`;
    }
    if (search) {
      params.push(`%${search}%`);
      whereClause += ` AND (
        gr.receipt_no ILIKE $${params.length} OR
        gr.supplier_invoice_no ILIKE $${params.length} OR
        gr.delivery_note_no ILIKE $${params.length} OR
        gr.reference ILIKE $${params.length} OR
        gr.notes ILIKE $${params.length} OR
        sup.name ILIKE $${params.length} OR
        w.name ILIKE $${params.length} OR
        EXIStS (SELECT 1 FROM goods_receipt_items gri JOIN ingredients ing ON gri.ingredient_id = ing.id WHERE gri.goods_receipt_id = gr.id AND (ing.name ILIKE $${params.length} OR ing.item_code ILIKE $${params.length} OR ing.barcode ILIKE $${params.length}))
      )`;
    }

    // Count query
    const countQuery = `
      SELECT COUNT(*) as count
      FROM goods_receipts gr
      JOIN warehouses w ON gr.warehouse_id = w.id
      LEFT JOIN suppliers sup ON gr.supplier_id = sup.id
      ${whereClause}
    `;
    const countRes = await pool.query(countQuery, params);
    const totalCount = parseInt(countRes.rows[0]?.count || "0");

    // Order mapping
    const validSortFields: Record<string, string> = {
      id: "gr.id",
      receipt_no: "gr.receipt_no",
      date: "gr.date",
      supplier_name: "sup.name",
      warehouse_name: "w.name",
      total_amount: "gr.total_amount",
      status: "gr.status",
      qc_status: "gr.qc_status"
    };
    const orderField = validSortFields[String(sort_field)] || "gr.id";
    const orderDir = String(sort_order).toLowerCase() === "asc" ? "ASC" : "DESC";

    const dataQuery = `
      SELECT 
        gr.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        sup.name as supplier_name,
        sup.phone as supplier_phone,
        u.username as creator_name,
        app_u.username as approver_name,
        po.id as po_id,
        (SELECT COUNT(*) FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id) as items_count,
        (SELECT COALESCE(SUM(gri.received_qty), 0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id) as total_received_qty,
        (SELECT COALESCE(SUM(gri.accepted_qty), 0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id) as total_accepted_qty,
        (SELECT COALESCE(SUM(gri.rejected_qty), 0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id) as total_rejected_qty,
        (SELECT COALESCE(SUM(gri.quarantine_qty), 0) FROM goods_receipt_items gri WHERE gri.goods_receipt_id = gr.id) as total_quarantine_qty,
        (SELECT COUNT(*) FROM goods_receipt_attachments gra WHERE gra.goods_receipt_id = gr.id) as attachments_count,
        (SELECT COUNT(*) FROM qc_inspection_records qcr WHERE qcr.goods_receipt_id = gr.id) as qc_records_count
      FROM goods_receipts gr
      JOIN warehouses w ON gr.warehouse_id = w.id
      LEFT JOIN suppliers sup ON gr.supplier_id = sup.id
      LEFT JOIN users u ON gr.created_by = u.id
      LEFT JOIN users app_u ON gr.approved_by = app_u.id
      LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
      ${whereClause}
      ORDER BY ${orderField} ${orderDir}
      LIMIT ${limitNum} OFFSET ${offset}
    `;

    const result = await pool.query(dataQuery, params);

    res.json({
      success: true,
      goods_receipts: result.rows,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      },
      kpis
    });
  } catch (err: any) {
    console.error("Error in GET /api/goods-receipts:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Single Goods Receipt with complete deep details
router.get("/api/goods-receipts/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const grRes = await pool.query(`
      SELECT 
        gr.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        sup.name as supplier_name,
        sup.supplier_code as supplier_code,
        sup.phone as supplier_phone,
        sup.email as supplier_email,
        sup.tax_number as supplier_tax_no,
        u.username as creator_name,
        app_u.username as approver_name,
        post_u.username as poster_name,
        po.id as po_id,
        po.date as po_date,
        po.total_amount as po_total_amount,
        po.status as po_status
      FROM goods_receipts gr
      JOIN warehouses w ON gr.warehouse_id = w.id
      LEFT JOIN suppliers sup ON gr.supplier_id = sup.id
      LEFT JOIN users u ON gr.created_by = u.id
      LEFT JOIN users app_u ON gr.approved_by = app_u.id
      LEFT JOIN users post_u ON gr.posted_by = post_u.id
      LEFT JOIN purchase_orders po ON gr.purchase_order_id = po.id
      WHERE gr.id = $1
    `, [id]);

    if (grRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "سند الاستلام غير موجود" });
    }

    const gr = grRes.rows[0];

    // Items with full enrichment
    const itemsRes = await pool.query(`
      SELECT 
        gri.*,
        ing.name as item_name,
        ing.item_code,
        ing.barcode,
        ing.sku,
        ing.category as item_category,
        ing.brand as item_brand,
        ing.unit as base_unit,
        ing.tracking_type,
        wl.name as location_name,
        wl.code as location_code,
        wl.zone,
        wl.rack,
        wl.shelf,
        wl.bin,
        (SELECT COALESCE(SUM(quantity), 0) FROM goods_receipt_putaway grp WHERE grp.goods_receipt_item_id = gri.id) as putaway_quantity
      FROM goods_receipt_items gri
      JOIN ingredients ing ON gri.ingredient_id = ing.id
      LEFT JOIN warehouse_locations wl ON gri.location_id = wl.id
      WHERE gri.goods_receipt_id = $1
      ORDER BY gri.id ASC
    `, [id]);

    // QC Inspection Records
    const qcRes = await pool.query(`
      SELECT qcr.*, u.username as inspector_user_name
      FROM qc_inspection_records qcr
      LEFT JOIN users u ON qcr.inspector_id = u.id
      WHERE qcr.goods_receipt_id = $1
      ORDER BY qcr.id DESC
    `, [id]);

    // Attachments
    const attachRes = await pool.query(`
      SELECT * FROM goods_receipt_attachments
      WHERE goods_receipt_id = $1
      ORDER BY id DESC
    `, [id]);

    // Put Away Locations
    const putawayRes = await pool.query(`
      SELECT grp.*, ing.name as item_name, ing.item_code, wl.name as location_name, wl.code as location_code
      FROM goods_receipt_putaway grp
      JOIN ingredients ing ON grp.ingredient_id = ing.id
      JOIN warehouse_locations wl ON grp.location_id = wl.id
      WHERE grp.goods_receipt_id = $1
      ORDER BY grp.id ASC
    `, [id]);

    // Journal Entry Details if posted
    let journalEntry = null;
    if (gr.journal_entry_id) {
      const jeRes = await pool.query(`
        SELECT je.*,
          (SELECT json_agg(json_build_object(
            'id', ji.id,
            'account_id', ji.account_id,
            'account_name', acc.name,
            'account_code', acc.code,
            'debit', ji.debit,
            'credit', ji.credit,
            'description', ji.description
          )) FROM journal_items ji LEFT JOIN accounts acc ON ji.account_id = acc.id WHERE ji.journal_entry_id = je.id) as lines
        FROM journal_entries je
        WHERE je.id = $1
      `, [gr.journal_entry_id]);
      journalEntry = jeRes.rows[0] || null;
    }

    // Stock Ledger Transactions
    const txnRes = await pool.query(`
      SELECT it.*, ing.name as item_name, ing.item_code
      FROM inventory_transactions it
      JOIN ingredients ing ON it.ingredient_id = ing.id
      WHERE it.reference_type = 'goods_receipt' AND it.reference_id = $1
      ORDER BY it.id ASC
    `, [id]);

    // Supplier Return Requests if any
    const retRes = await pool.query(`
      SELECT srr.*,
        (SELECT json_agg(sri.*) FROM supplier_return_items sri WHERE sri.return_id = srr.id) as return_items
      FROM supplier_return_requests srr
      WHERE srr.goods_receipt_id = $1
      ORDER BY srr.id DESC
    `, [id]);

    // Audit Trail
    const auditRes = await pool.query(`
      SELECT * FROM inventory_audit_trail
      WHERE entity_type = 'goods_receipt' AND entity_id = $1
      ORDER BY id DESC
    `, [id]);

    res.json({
      success: true,
      goods_receipt: gr,
      items: itemsRes.rows,
      qc_records: qcRes.rows,
      attachments: attachRes.rows,
      putaway_locations: putawayRes.rows,
      journal_entry: journalEntry,
      stock_transactions: txnRes.rows,
      supplier_returns: retRes.rows,
      audit_logs: auditRes.rows
    });
  } catch (err: any) {
    console.error("Error in GET /api/goods-receipts/:id:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Enterprise Goods Receipt (Inbound)
router.post("/api/goods-receipts", async (req: Request, res: Response) => {
  // Defensive schema check for databases upgraded from older Purchases versions.
  // This is intentionally idempotent and runs before the receiving transaction.
  try {
    await pool.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await pool.query(`ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity DECIMAL(12,3) DEFAULT 0`);
  } catch (schemaError: any) {
    console.error("Purchases receiving schema check failed:", schemaError.message);
    return res.status(500).json({ success: false, error: `تعذر تجهيز قاعدة بيانات الاستلام: ${schemaError.message}` });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      warehouse_id, supplier_id, purchase_order_id, supplier_invoice_no, delivery_note_no,
      date, posting_date, currency = "EGP", exchange_rate = 1.0, receiver_name, reference,
      freight_charges = 0, customs_charges = 0, other_charges = 0, landed_cost_allocation = "value",
      items, notes, user, status = "draft", auto_post = false, attachments = []
    } = req.body;

    let effectiveWarehouseId = Number(warehouse_id || 0);
    if (!effectiveWarehouseId) {
      const defaultWhRes = await client.query("SELECT id FROM warehouses WHERE is_main = 1 OR type = 'main' ORDER BY id ASC LIMIT 1");
      effectiveWarehouseId = Number(defaultWhRes.rows?.[0]?.id) || Number((await client.query("SELECT id FROM warehouses ORDER BY id ASC LIMIT 1")).rows?.[0]?.id) || 1;
    }

    if (!effectiveWarehouseId || !items || !Array.isArray(items) || items.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "المخزن وقائمة الأصناف مطلوبة لإتمام السند" });
    }

    // Generate unique sequential receipt number GRN-YYYYMM-XXXX
    const dateStr = (date || new Date().toISOString().split("T")[0]).replace(/-/g, "").slice(0, 6);
    const countToday = await client.query(
      "SELECT COUNT(*) FROM goods_receipts WHERE receipt_no LIKE $1",
      [`GRN-${dateStr}%`]
    );
    const seq = (parseInt(countToday.rows[0].count) + 1).toString().padStart(4, "0");
    const receiptNo = `GRN-${dateStr}-${seq}`;

    // Calculate item values and landed cost distribution (Recoverable VAT excluded from inventory cost)
    let grossTotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalQty = 0;

    for (const it of items) {
      const rQty = Number(it.received_qty || 0);
      const uPrice = Number(it.unit_price || it.unit_cost || 0);
      const discRate = Number(it.discount_rate || 0);
      const taxRate = Number(it.tax_rate || 0);

      const lineGross = rQty * uPrice;
      const lineDisc = lineGross * (discRate / 100);
      const lineNet = lineGross - lineDisc;
      const lineTax = lineNet * (taxRate / 100);

      grossTotal += lineGross;
      totalDiscount += lineDisc;
      totalTax += lineTax;
      totalQty += rQty;
    }

    const netAmount = grossTotal - totalDiscount;
    const totalExtraLanded = Number(freight_charges || 0) + Number(customs_charges || 0) + Number(other_charges || 0);
    const totalLandedCost = netAmount + totalExtraLanded; // Inventory valuation: Net purchase + freight/customs, NOT VAT

    // Check for Over-Receipt vs PO
    let hasOverReceipt = false;
    if (purchase_order_id) {
      for (const it of items) {
        if (it.ordered_qty && Number(it.received_qty) > Number(it.ordered_qty) * 1.05) {
          hasOverReceipt = true;
        }
      }
    }

    // Determine initial status
    const initialStatus = auto_post ? "posted" : (status || "draft");
    const isPosted = initialStatus === "posted";

    const grRes = await client.query(`
      INSERT INTO goods_receipts (
        receipt_no, date, posting_date, warehouse_id, supplier_id, purchase_order_id,
        supplier_invoice_no, delivery_note_no, status, qc_status, currency, exchange_rate,
        receiver_name, reference, total_amount, discount_amount, tax_amount, net_amount,
        freight_charges, customs_charges, other_charges, total_landed_cost, landed_cost_allocation,
        is_posted, posted_at, notes, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      receiptNo, date || new Date().toISOString().split("T")[0], posting_date || date || new Date().toISOString().split("T")[0],
      Number(effectiveWarehouseId), supplier_id ? Number(supplier_id) : null, purchase_order_id ? Number(purchase_order_id) : null,
      supplier_invoice_no || null, delivery_note_no || null, initialStatus,
      auto_post ? "passed" : "pending", currency, exchange_rate,
      receiver_name || user || null, reference || null, grossTotal, totalDiscount, totalTax, netAmount,
      Number(freight_charges || 0), Number(customs_charges || 0), Number(other_charges || 0), totalLandedCost, landed_cost_allocation,
      isPosted, isPosted ? new Date() : null, notes || null
    ]);

    const grId = grRes.rows[0].id;

    // Insert Items
    for (const it of items) {
      const rQty = Number(it.received_qty || 0);
      const freeQty = Number(it.free_qty || 0);
      const totalRecvQty = rQty + freeQty;
      const rejQty = Number(it.rejected_qty || 0);
      const guarQty = Number(it.quarantine_qty || 0);
      const damQty = Number(it.damaged_qty || 0);
      const accQty = Number(
        it.accepted_qty !== undefined && Number(it.accepted_qty) > 0
          ? it.accepted_qty
          : Math.max(0, totalRecvQty - rejQty - guarQty - damQty)
      );
      const uPrice = Number(it.unit_price || it.unit_cost || 0);
      const discRate = Number(it.discount_rate || 0);
      const taxRate = Number(it.tax_rate || 0);
      const lineGross = rQty * uPrice;
      const lineDisc = lineGross * (discRate / 100);
      const lineNet = lineGross - lineDisc; // Net of line without tax

      // Landed cost allocation per item (freight/customs allocated onto net value)
      let lineExtraLanded = 0;
      if (totalExtraLanded > 0) {
        if (landed_cost_allocation === "quantity" && totalQty > 0) {
          lineExtraLanded = (rQty / totalQty) * totalExtraLanded;
        } else if (netAmount > 0) {
          lineExtraLanded = (lineNet / netAmount) * totalExtraLanded;
        }
      }
      const itemTotalLanded = lineNet + lineExtraLanded; // Recoverable VAT is NOT included in landed cost
      const itemUnitLandedCost = rQty > 0 ? (itemTotalLanded / rQty) : uPrice;

      const griRes = await client.query(`
        INSERT INTO goods_receipt_items (
          goods_receipt_id, ingredient_id, po_item_id, ordered_qty, previously_received_qty,
          expected_qty, received_qty, free_qty, accepted_qty, rejected_qty, quarantine_qty,
          damaged_qty, unit_price, unit_cost, discount_rate, tax_rate, net_price, total_cost,
          landed_unit_cost, total_landed_cost, uom, batch_number, lot_number, expiry_date,
          manufacturing_date, supplier_batch, serial_numbers, location_id, qc_status,
          rejection_reason, putaway_status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
        RETURNING id
      `, [
        grId, it.ingredient_id, it.po_item_id || null, Number(it.ordered_qty || 0),
        Number(it.previously_received_qty || 0), Number(it.expected_qty || it.ordered_qty || rQty),
        rQty, freeQty, accQty, rejQty, guarQty, damQty, uPrice, uPrice,
        discRate, taxRate, (rQty > 0 ? lineNet / rQty : uPrice), lineNet,
        itemUnitLandedCost, itemTotalLanded, it.uom || it.unit || null,
        it.batch_number || null, it.lot_number || null, it.expiry_date || null,
        it.manufacturing_date || null, it.supplier_batch || null,
        it.serial_numbers ? (Array.isArray(it.serial_numbers) ? it.serial_numbers.join(",") : String(it.serial_numbers)) : null,
        it.location_id || null, auto_post ? "passed" : (it.qc_status || "pending"),
        it.rejection_reason || null, it.location_id ? "completed" : "pending", it.notes || null
      ]);

      const griId = griRes.rows[0].id;

      // Handle Putaway location record if specified
      if (it.location_id && accQty > 0) {
        await client.query(`
          INSERT INTO goods_receipt_putaway (goods_receipt_id, goods_receipt_item_id, ingredient_id, warehouse_id, location_id, quantity, batch_number)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [grId, griId, it.ingredient_id, effectiveWarehouseId, it.location_id, accQty, it.batch_number || null]);
      }

      // If immediate auto-post requested
      if (isPosted && accQty > 0) {
        const ingUnitRes = await client.query("SELECT unit FROM ingredients WHERE id = $1", [it.ingredient_id]);
        const baseUnit = ingUnitRes.rows[0]?.unit || it.uom || it.unit || "وحدة";
        const receiptUom = it.uom || it.unit || baseUnit;
        const conv = await UnitConversionService.convertItemQuantity(client, {
          ingredientId: Number(it.ingredient_id),
          quantity: accQty,
          fromUnit: receiptUom,
          toUnit: baseUnit,
          context: 'purchase'
        });
        const baseAccQty = conv.success && conv.toQuantity > 0 ? conv.toQuantity : accQty;
        const baseLandedUnitCost = (conv.success && conv.factor > 0) ? (itemUnitLandedCost / conv.factor) : itemUnitLandedCost;

        // 1. Lock and Update Stock Balance
        const curStock = await client.query(
          "SELECT id, quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
          [effectiveWarehouseId, it.ingredient_id]
        );

        let beforeQty = 0;
        let beforeAvgCost = 0;
        if (curStock.rows.length > 0) {
          beforeQty = Number(curStock.rows[0].quantity || 0);
          beforeAvgCost = Number(curStock.rows[0].avg_cost || 0);
          const newQty = beforeQty + baseAccQty;
          const newAvgCost = (newQty > 0 && beforeQty > 0 && beforeAvgCost > 0) 
            ? ((beforeQty * beforeAvgCost) + (baseAccQty * baseLandedUnitCost)) / newQty 
            : baseLandedUnitCost;

          await client.query(`
            UPDATE inventory_items SET
              quantity = $1,
              available = GREATEST($2::numeric - COALESCE(reserved, 0), 0),
              avg_cost = $3, last_cost = $4, updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
          `, [newQty, newQty, newAvgCost, baseLandedUnitCost, curStock.rows[0].id]);
        } else {
          await client.query(`
            INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, available, avg_cost, last_cost)
            VALUES ($1, $2, $3, GREATEST($4::numeric, 0), $5, $6)
          `, [effectiveWarehouseId, it.ingredient_id, baseAccQty, baseAccQty, baseLandedUnitCost, baseLandedUnitCost]);
        }

        await client.query(`
          UPDATE ingredients 
          SET last_purchase_price = $1, 
              cost = COALESCE(NULLIF($2::numeric, 0), cost),
              avg_cost = COALESCE(
                (SELECT SUM(COALESCE(ii.quantity, 0) * COALESCE(NULLIF(ii.avg_cost, 0), $3::numeric)) / NULLIF(SUM(COALESCE(ii.quantity, 0)), 0) FROM inventory_items ii WHERE ii.ingredient_id = $4),
                $5::numeric
              ),
              current_stock = COALESCE((SELECT SUM(quantity) FROM inventory_items WHERE ingredient_id = $6), 0)
          WHERE id = $7
        `, [baseLandedUnitCost, baseLandedUnitCost, baseLandedUnitCost, it.ingredient_id, baseLandedUnitCost, it.ingredient_id, it.ingredient_id]);

        // 2. Insert into Stock Ledger (inventory_transactions)
        await client.query(`
          INSERT INTO inventory_transactions (
            transaction_number, warehouse_id, ingredient_id, quantity, type,
            unit_cost, total_cost, balance_before, balance_after, batch_number,
            expiry_date, location_id, reference_type, reference_id, reference_no,
            status, notes, date
          ) VALUES ($1, $2, $3, $4, 'receipt', $5, $6, $7, $8, $9, $10, $11, 'goods_receipt', $12, $13, 'posted', $14, $15)
        `, [
          `TXN-IN-${Date.now().toString().slice(-6)}-${it.ingredient_id}`,
          effectiveWarehouseId, it.ingredient_id, baseAccQty, baseLandedUnitCost, baseAccQty * baseLandedUnitCost,
          beforeQty, beforeQty + baseAccQty, it.batch_number || null,
          it.expiry_date || null, it.location_id || null, grId, receiptNo,
          `استلام وارد بموجب سند ${receiptNo}`, date || new Date().toISOString().split("T")[0]
        ]);

        // 3. Batch Tracking
        if (it.batch_number) {
          await client.query(`
            INSERT INTO batch_tracking (
              ingredient_id, warehouse_id, batch_number, quantity, remaining_quantity,
              unit_cost, expiry_date, manufacturing_date, supplier_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (ingredient_id, warehouse_id, batch_number)
            DO UPDATE SET remaining_quantity = batch_tracking.remaining_quantity + EXCLUDED.remaining_quantity
          `, [
            it.ingredient_id, effectiveWarehouseId, it.batch_number, baseAccQty, baseAccQty,
            baseLandedUnitCost, it.expiry_date || null, it.manufacturing_date || null,
            supplier_id ? Number(supplier_id) : null, `استلام GRN ${receiptNo}`
          ]);
        }

        // 4. Serial Numbers
        if (it.serial_numbers) {
          const serialList = Array.isArray(it.serial_numbers) 
            ? it.serial_numbers 
            : String(it.serial_numbers).split(/[\n,]+/).map(s => s.trim()).filter(Boolean);

          for (const sNum of serialList) {
            await client.query(`
              INSERT INTO item_serials (ingredient_id, warehouse_id, serial_number, status, unit_cost, notes)
              VALUES ($1, $2, $3, 'in_stock', $4, $5)
              ON CONFLICT (ingredient_id, serial_number) DO NOTHING
            `, [it.ingredient_id, effectiveWarehouseId, sNum, baseLandedUnitCost, `استلام GRN ${receiptNo}`]);
          }
        }

        // 5. Cost Layer (FIFO)
        await client.query(`
          INSERT INTO stock_cost_layers (
            ingredient_id, warehouse_id, batch_number, quantity_received, quantity_remaining,
            unit_cost, total_cost, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
        `, [
          it.ingredient_id, effectiveWarehouseId, it.batch_number || null,
          baseAccQty, baseAccQty, baseLandedUnitCost, baseAccQty * baseLandedUnitCost
        ]);

        // 6. Update PO Items received qty if linked
        if (purchase_order_id && it.po_item_id) {
          await client.query(`
            UPDATE purchase_order_items
            SET received_quantity = COALESCE(received_quantity, 0) + $1
            WHERE id = $2
          `, [accQty, it.po_item_id]);
        }
      }
    }

    // Save Attachments if provided
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (att.file_name && att.file_url) {
          await client.query(`
            INSERT INTO goods_receipt_attachments (goods_receipt_id, file_name, file_url, doc_type, uploaded_by, file_size)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [grId, att.file_name, att.file_url, att.doc_type || "invoice", user || "admin", att.file_size || 0]);
        }
      }
    }

    // If PO linked, update PO header status
    if (purchase_order_id && isPosted) {
      const poCheck = await client.query(`
        SELECT 
          SUM(quantity) as total_ordered,
          SUM(COALESCE(received_quantity, 0)) as total_received
        FROM purchase_order_items
        WHERE purchase_order_id = $1
      `, [purchase_order_id]);

      const tOrd = Number(poCheck.rows[0]?.total_ordered || 0);
      const tRec = Number(poCheck.rows[0]?.total_received || 0);

      const newPoStatus = tRec >= tOrd ? "received" : (tRec > 0 ? "partially_received" : "approved");
      await client.query("UPDATE purchase_orders SET status = $1 WHERE id = $2", [newPoStatus, purchase_order_id]);
    }

    let grnJournalEntryId: number | null = null;
    if (isPosted) {
      await client.query("SAVEPOINT sp_grn_create_post");
      try {
        const posting = await GoodsReceiptPostingService.postAccounting(client, {
          receiptId: grId,
          effectiveDate: posting_date || date || new Date().toISOString().split("T")[0],
          createdBy: null
        });
        grnJournalEntryId = posting.journalEntryId;
        if (posting.journalEntryId) {
          await client.query(`UPDATE goods_receipts SET journal_entry_id = $1 WHERE id = $2`, [
            posting.journalEntryId,
            grId
          ]);
        }
        await client.query("RELEASE SAVEPOINT sp_grn_create_post");
      } catch (postAccErr: any) {
        await client.query("ROLLBACK TO SAVEPOINT sp_grn_create_post").catch(() => {});
        console.warn("Accounting auto-posting note on GRN create:", postAccErr.message);
      }
    }

    // Log Audit Trail
    await logAudit(client, {
      entity_type: "goods_receipt",
      entity_id: grId,
      action: "create",
      user_name: user || "admin",
      details: `إنشاء سند استلام رقم ${receiptNo} بمبلغ ${netAmount} ج.م ومجموع ${items.length} أصناف (الحالة: ${initialStatus})`
    });

    await client.query("COMMIT");

    if (isPosted) {
      try {
        await recordGoodsReceiptCost(grId);
      } catch (costError: any) {
        console.error(`[Costs Integration] Goods receipt #${grId} direct sync failed:`, costError?.message || costError);
      }
      ERPEventBus.getInstance().emitEvent("GoodsReceiptPosted", {
        receiptId: grId,
        receiptNo,
        purchaseOrderId: purchase_order_id ? Number(purchase_order_id) : null,
        warehouseId: Number(warehouse_id),
        supplierId: supplier_id ? Number(supplier_id) : null,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      goods_receipt: { ...grRes.rows[0], receipt_no: receiptNo },
      journal_entry_id: grnJournalEntryId,
      message: `تم إنشاء سند الاستلام ${receiptNo} بنجاح`
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in POST /api/goods-receipts:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Update Goods Receipt (Only if draft or submitted)
router.put("/api/goods-receipts/:id", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);

    const existingRes = await client.query("SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE", [id]);
    if (existingRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "سند الاستلام غير موجود" });
    }

    const existing = existingRes.rows[0];
    if (existing.is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن تعديل سند استلام تم اعتماده وترحيله محاسبياً ومخزنياً (Posted)" });
    }

    const {
      warehouse_id, supplier_id, supplier_invoice_no, delivery_note_no,
      date, posting_date, receiver_name, reference, notes, items, user
    } = req.body;

    // Update Header
    await client.query(`
      UPDATE goods_receipts SET
        warehouse_id = COALESCE($1, warehouse_id),
        supplier_id = COALESCE($2, supplier_id),
        supplier_invoice_no = COALESCE($3, supplier_invoice_no),
        delivery_note_no = COALESCE($4, delivery_note_no),
        date = COALESCE($5, date),
        posting_date = COALESCE($6, posting_date),
        receiver_name = COALESCE($7, receiver_name),
        reference = COALESCE($8, reference),
        notes = COALESCE($9, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
    `, [
      warehouse_id ? Number(warehouse_id) : null,
      supplier_id ? Number(supplier_id) : null,
      supplier_invoice_no, delivery_note_no,
      date, posting_date, receiver_name, reference, notes, id
    ]);

    // If items provided, replace items
    if (Array.isArray(items) && items.length > 0) {
      await client.query("DELETE FROM goods_receipt_items WHERE goods_receipt_id = $1", [id]);

      let grossTotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      for (const it of items) {
        const rQty = Number(it.received_qty || 0);
        const uPrice = Number(it.unit_price || it.unit_cost || 0);
        const discRate = Number(it.discount_rate || 0);
        const taxRate = Number(it.tax_rate || 0);
        const lineGross = rQty * uPrice;
        const lineDisc = lineGross * (discRate / 100);
        const lineNet = lineGross - lineDisc;
        const lineTax = lineNet * (taxRate / 100);

        grossTotal += lineGross;
        totalDiscount += lineDisc;
        totalTax += lineTax;

        await client.query(`
          INSERT INTO goods_receipt_items (
            goods_receipt_id, ingredient_id, po_item_id, ordered_qty, received_qty,
            accepted_qty, rejected_qty, quarantine_qty, unit_price, unit_cost,
            discount_rate, tax_rate, net_price, total_cost, uom, batch_number, lot_number,
            expiry_date, manufacturing_date, supplier_batch, serial_numbers, location_id,
            qc_status, rejection_reason, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
        `, [
          id, it.ingredient_id, it.po_item_id || null, Number(it.ordered_qty || 0), rQty,
          Number(it.accepted_qty || 0), Number(it.rejected_qty || 0), Number(it.quarantine_qty || 0),
          uPrice, uPrice, discRate, taxRate, (rQty > 0 ? lineNet / rQty : uPrice), lineNet,
          it.uom || null, it.batch_number || null, it.lot_number || null,
          it.expiry_date || null, it.manufacturing_date || null, it.supplier_batch || null,
          it.serial_numbers ? (Array.isArray(it.serial_numbers) ? it.serial_numbers.join(",") : String(it.serial_numbers)) : null,
          it.location_id || null, it.qc_status || "pending", it.rejection_reason || null, it.notes || null
        ]);
      }

      const netAmount = grossTotal - totalDiscount;
      await client.query(
        "UPDATE goods_receipts SET total_amount = $1, discount_amount = $2, tax_amount = $3, net_amount = $4 WHERE id = $5",
        [grossTotal, totalDiscount, totalTax, netAmount, id]
      );
    }

    await logAudit(client, {
      entity_type: "goods_receipt",
      entity_id: id,
      action: "update",
      user_name: user || "admin",
      details: `تحديث بيانات سند الاستلام رقم ${existing.receipt_no}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم تحديث سند الاستلام بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in PUT /api/goods-receipts/:id:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Quality Inspection (QC) Execution Endpoint
router.post("/api/goods-receipts/:id/qc-inspect", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const {
      overall_result, inspector_name, qc_notes, template_type = "general",
      temperature, hygiene_score, packaging_condition, physical_condition,
      items_results = [], user
    } = req.body;

    const grRes = await client.query("SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE", [id]);
    if (grRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "سند الاستلام غير موجود" });
    }

    const gr = grRes.rows[0];
    if (gr.is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "تم ترحيل السند مسبقاً ولا يمكن تعديل نتائج الفحص" });
    }

    // Process each item's QC inspection outcome
    let allPassed = true;
    let anyPassed = false;
    let anyFailed = false;
    let anyQuarantine = false;

    for (const itemRes of items_results) {
      const itemId = Number(itemRes.item_id || itemRes.goods_receipt_item_id);
      const accQty = Number(itemRes.accepted_qty || 0);
      const rejQty = Number(itemRes.rejected_qty || 0);
      const quarQty = Number(itemRes.quarantine_qty || 0);
      const itemQcStatus = itemRes.qc_status || (rejQty > 0 ? (accQty > 0 ? "partial" : "failed") : (quarQty > 0 ? "quarantine" : "passed"));

      if (itemQcStatus === "passed") anyPassed = true;
      if (itemQcStatus === "failed" || rejQty > 0) { anyFailed = true; allPassed = false; }
      if (itemQcStatus === "partial") { anyPassed = true; anyFailed = true; allPassed = false; }
      if (itemQcStatus === "quarantine" || quarQty > 0) { anyQuarantine = true; allPassed = false; }

      // Update goods_receipt_items
      await client.query(`
        UPDATE goods_receipt_items SET
          accepted_qty = $1,
          rejected_qty = $2,
          quarantine_qty = $3,
          qc_status = $4,
          rejection_reason = $5,
          qc_sample_size = $6,
          qc_defects_count = $7
        WHERE id = $8 AND goods_receipt_id = $9
      `, [
        accQty, rejQty, quarQty, itemQcStatus,
        itemRes.rejection_reason || null,
        Number(itemRes.sample_size || 0),
        Number(itemRes.defects_count || 0),
        itemId, id
      ]);

      // Record detailed QC Inspection entry
      await client.query(`
        INSERT INTO qc_inspection_records (
          goods_receipt_id, goods_receipt_item_id, template_type, checklist_data,
          temperature, hygiene_score, packaging_condition, physical_condition,
          sample_size_inspected, defects_found, inspector_name, result,
          action_taken, rejection_reason, notes, inspection_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, CURRENT_TIMESTAMP)
      `, [
        id, itemId, template_type,
        itemRes.checklist ? JSON.stringify(itemRes.checklist) : null,
        itemRes.temperature ? Number(itemRes.temperature) : (temperature ? Number(temperature) : null),
        itemRes.hygiene_score ? Number(itemRes.hygiene_score) : (hygiene_score ? Number(hygiene_score) : null),
        itemRes.packaging_condition || packaging_condition || "good",
        itemRes.physical_condition || physical_condition || "intact",
        Number(itemRes.sample_size || 0),
        Number(itemRes.defects_count || 0),
        inspector_name || user || "فاحص الجودة",
        itemQcStatus,
        accQty > 0 ? (rejQty > 0 ? "reject_partial" : "accept") : (quarQty > 0 ? "quarantine" : "reject_full"),
        itemRes.rejection_reason || null,
        itemRes.notes || qc_notes || null
      ]);
    }

    // Determine final overall QC status
    let finalQcStatus = overall_result;
    if (!finalQcStatus) {
      if (allPassed && anyPassed) finalQcStatus = "passed";
      else if (anyQuarantine) finalQcStatus = "quarantine";
      else if (anyPassed && anyFailed) finalQcStatus = "partial";
      else if (anyFailed && !anyPassed) finalQcStatus = "failed";
      else finalQcStatus = "passed";
    }

    // Update GRN header QC status
    const newGrStatus = (finalQcStatus === "passed" || finalQcStatus === "partial") ? "qc_approved" : (finalQcStatus === "failed" ? "rejected" : "qc_pending");

    await client.query(`
      UPDATE goods_receipts SET
        qc_status = $1,
        status = $2,
        qc_inspector = $3,
        qc_inspection_date = CURRENT_TIMESTAMP,
        qc_notes = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `, [finalQcStatus, newGrStatus, inspector_name || user || "فاحص الجودة", qc_notes || null, id]);

    await logAudit(client, {
      entity_type: "goods_receipt",
      entity_id: id,
      action: "qc_inspection",
      user_name: user || inspector_name || "admin",
      details: `إجراء فحص الجودة لسند الاستلام ${gr.receipt_no} (النتيجة: ${finalQcStatus})`
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      qc_status: finalQcStatus,
      gr_status: newGrStatus,
      message: `تم حفظ نتائج فحص الجودة بنجاح (${finalQcStatus})`
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in POST /api/goods-receipts/:id/qc-inspect:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Put Away Multi-Location Allocation
router.post("/api/goods-receipts/:id/putaway", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const { locations = [], user } = req.body;

    const grRes = await client.query("SELECT * FROM goods_receipts WHERE id = $1", [id]);
    if (grRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "سند الاستلام غير موجود" });
    }

    // Delete existing putaway records for this GRN
    await client.query("DELETE FROM goods_receipt_putaway WHERE goods_receipt_id = $1", [id]);

    for (const loc of locations) {
      await client.query(`
        INSERT INTO goods_receipt_putaway (goods_receipt_id, goods_receipt_item_id, ingredient_id, warehouse_id, location_id, quantity, batch_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        id, loc.goods_receipt_item_id, loc.ingredient_id,
        grRes.rows[0].warehouse_id, loc.location_id,
        Number(loc.quantity || 0), loc.batch_number || null
      ]);

      // Update primary location_id on item
      await client.query(`
        UPDATE goods_receipt_items SET
          location_id = $1,
          putaway_status = 'completed'
        WHERE id = $2
      `, [loc.location_id, loc.goods_receipt_item_id]);
    }

    await logAudit(client, {
      entity_type: "goods_receipt",
      entity_id: id,
      action: "putaway",
      user_name: user || "admin",
      details: `تسكين الأصناف في مواقع التخزين بسند الاستلام ${grRes.rows[0].receipt_no}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم حفظ توزيع مواقع التخزين (Put Away) بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in POST /api/goods-receipts/:id/putaway:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Post Goods Receipt (Stock Ledger + Accounting Journal Entry)
router.post("/api/goods-receipts/:id/post", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const { user, posting_date } = req.body;

    const grRes = await client.query("SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE", [id]);
    if (grRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "سند الاستلام غير موجود" });
    }

    const gr = grRes.rows[0];
    if (gr.is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "سند الاستلام مرحل بالفعل مسبقاً" });
    }

    const itemsRes = await client.query("SELECT * FROM goods_receipt_items WHERE goods_receipt_id = $1", [id]);
    if (itemsRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "سند الاستلام لا يحتوي على أي أصناف" });
    }

    const effectiveDate = posting_date || gr.posting_date || gr.date || new Date().toISOString().split("T")[0];
    let totalAcceptedValue = 0;

    for (const it of itemsRes.rows) {
      const rQty = Number(it.received_qty || 0);
      const freeQty = Number(it.free_qty || 0);
      const rejQty = Number(it.rejected_qty || 0);
      const quarQty = Number(it.quarantine_qty || 0);
      const damQty = Number(it.damaged_qty || 0);
      const accQty = Number(
        Number(it.accepted_qty) > 0
          ? it.accepted_qty
          : (it.qc_status !== "failed" ? Math.max(0, rQty + freeQty - rejQty - quarQty - damQty) : 0)
      );
      if (accQty <= 0) continue;

      if (Number(it.accepted_qty || 0) <= 0 || it.qc_status === "pending") {
        await client.query(
          "UPDATE goods_receipt_items SET accepted_qty = $1, qc_status = CASE WHEN qc_status = 'pending' THEN 'passed' ELSE qc_status END WHERE id = $2",
          [accQty, it.id]
        );
      }

      const rawUnitCost = Number(it.landed_unit_cost > 0 ? it.landed_unit_cost : (it.unit_cost || it.unit_price || 0));
      const lineCost = accQty * rawUnitCost;
      totalAcceptedValue += lineCost;

      const ingUnitRes = await client.query("SELECT unit FROM ingredients WHERE id = $1", [it.ingredient_id]);
      const baseUnit = ingUnitRes.rows[0]?.unit || it.uom || "وحدة";
      const receiptUom = it.uom || baseUnit;
      const conv = await UnitConversionService.convertItemQuantity(client, {
        ingredientId: Number(it.ingredient_id),
        quantity: accQty,
        fromUnit: receiptUom,
        toUnit: baseUnit,
        context: 'purchase'
      });
      const baseAccQty = conv.success && conv.toQuantity > 0 ? conv.toQuantity : accQty;
      const unitCost = (conv.success && conv.factor > 0) ? (rawUnitCost / conv.factor) : rawUnitCost;

      // 1. Lock and Update Stock Balance in inventory_items
      const curStock = await client.query(
        "SELECT id, quantity, avg_cost FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
        [gr.warehouse_id, it.ingredient_id]
      );

      let beforeQty = 0;
      let beforeAvgCost = 0;
      if (curStock.rows.length > 0) {
        beforeQty = Number(curStock.rows[0].quantity || 0);
        beforeAvgCost = Number(curStock.rows[0].avg_cost || 0);
        const newQty = beforeQty + baseAccQty;
        const newAvgCost = (newQty > 0 && beforeQty > 0 && beforeAvgCost > 0) 
          ? ((beforeQty * beforeAvgCost) + (baseAccQty * unitCost)) / newQty 
          : unitCost;

        await client.query(`
          UPDATE inventory_items SET
            quantity = $1,
            available = GREATEST($2::numeric - COALESCE(reserved, 0), 0),
            avg_cost = $3, last_cost = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
        `, [newQty, newQty, newAvgCost, unitCost, curStock.rows[0].id]);
      } else {
        await client.query(`
          INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, available, avg_cost, last_cost)
          VALUES ($1, $2, $3, GREATEST($4::numeric, 0), $5, $6)
        `, [gr.warehouse_id, it.ingredient_id, baseAccQty, baseAccQty, unitCost, unitCost]);
      }

      await client.query(`
        UPDATE ingredients 
        SET last_purchase_price = $1, 
            cost = COALESCE(NULLIF($2::numeric, 0), cost),
            avg_cost = COALESCE(
              (SELECT SUM(COALESCE(ii.quantity, 0) * COALESCE(NULLIF(ii.avg_cost, 0), $3::numeric)) / NULLIF(SUM(COALESCE(ii.quantity, 0)), 0) FROM inventory_items ii WHERE ii.ingredient_id = $4),
              $5::numeric
            ),
            current_stock = COALESCE((SELECT SUM(quantity) FROM inventory_items WHERE ingredient_id = $6), 0)
        WHERE id = $7
      `, [unitCost, unitCost, unitCost, it.ingredient_id, unitCost, it.ingredient_id, it.ingredient_id]);

      // 2. Insert into Stock Ledger (inventory_transactions)
      await client.query(`
        INSERT INTO inventory_transactions (
          transaction_number, warehouse_id, ingredient_id, quantity, type,
          unit_cost, total_cost, balance_before, balance_after, batch_number,
          expiry_date, location_id, reference_type, reference_id, reference_no,
          status, notes, date
        ) VALUES ($1, $2, $3, $4, 'receipt', $5, $6, $7, $8, $9, $10, $11, 'goods_receipt', $12, $13, 'posted', $14, $15)
      `, [
        `TXN-IN-${Date.now().toString().slice(-6)}-${it.ingredient_id}`,
        gr.warehouse_id, it.ingredient_id, baseAccQty, unitCost, lineCost,
        beforeQty, beforeQty + baseAccQty, it.batch_number || null,
        it.expiry_date || null, it.location_id || null, id, gr.receipt_no,
        `اعتماد استلام وارد ${gr.receipt_no}`, effectiveDate
      ]);

      // 3. Batch Tracking
      if (it.batch_number) {
        await client.query(`
          INSERT INTO batch_tracking (
            ingredient_id, warehouse_id, batch_number, quantity, remaining_quantity,
            unit_cost, expiry_date, manufacturing_date, supplier_id, notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (ingredient_id, warehouse_id, batch_number)
          DO UPDATE SET remaining_quantity = batch_tracking.remaining_quantity + EXCLUDED.remaining_quantity
        `, [
          it.ingredient_id, gr.warehouse_id, it.batch_number, baseAccQty, baseAccQty,
          unitCost, it.expiry_date || null, it.manufacturing_date || null,
          gr.supplier_id, `استلام GRN ${gr.receipt_no}`
        ]);
      }

      // 4. Serial Numbers
      if (it.serial_numbers) {
        const serialList = String(it.serial_numbers).split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        for (const sNum of serialList) {
          await client.query(`
            INSERT INTO item_serials (ingredient_id, warehouse_id, serial_number, status, unit_cost, notes)
            VALUES ($1, $2, $3, 'in_stock', $4, $5)
            ON CONFLICT (ingredient_id, serial_number) DO NOTHING
          `, [it.ingredient_id, gr.warehouse_id, sNum, unitCost, `استلام GRN ${gr.receipt_no}`]);
        }
      }

      // 5. Cost Layer
      await client.query(`
        INSERT INTO stock_cost_layers (
          ingredient_id, warehouse_id, batch_number, quantity_received, quantity_remaining,
          unit_cost, total_cost, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'open')
      `, [
        it.ingredient_id, gr.warehouse_id, it.batch_number || null,
        baseAccQty, baseAccQty, unitCost, lineCost
      ]);

      // 6. Update PO Items
      if (gr.purchase_order_id && it.po_item_id) {
        await client.query(`
          UPDATE purchase_order_items
          SET received_quantity = COALESCE(received_quantity, 0) + $1
          WHERE id = $2
        `, [accQty, it.po_item_id]);
      }
    }

    // 7. Update PO Status
    if (gr.purchase_order_id) {
      const poCheck = await client.query(`
        SELECT 
          SUM(quantity) as total_ordered,
          SUM(COALESCE(received_quantity, 0)) as total_received
        FROM purchase_order_items
        WHERE purchase_order_id = $1
      `, [gr.purchase_order_id]);

      const tOrd = Number(poCheck.rows[0]?.total_ordered || 0);
      const tRec = Number(poCheck.rows[0]?.total_received || 0);
      const newPoStatus = tRec >= tOrd ? "received" : (tRec > 0 ? "partially_received" : "approved");
      await client.query("UPDATE purchase_orders SET status = $1 WHERE id = $2", [newPoStatus, gr.purchase_order_id]);
    }

    // 8 & 9.5 Accounting Integration + Auto-generate Purchase Invoice & Supplier Sub-Ledger (with Tax)
    let journalEntryId: number | null = null;
    try {
      await client.query("SAVEPOINT sp_grn_post_accounting");
      const postingResult = await GoodsReceiptPostingService.postAccounting(client, {
        receiptId: id,
        effectiveDate,
        createdBy: null
      });
      journalEntryId = postingResult.journalEntryId;
      await client.query("RELEASE SAVEPOINT sp_grn_post_accounting");
    } catch (jeErr: any) {
      await client.query("ROLLBACK TO SAVEPOINT sp_grn_post_accounting").catch(() => {});
      journalEntryId = null;
      console.warn("Accounting auto-posting note:", jeErr?.message || jeErr);
    }

    try {
      await recordGoodsReceiptCost(id);
    } catch (cstErr) {
      console.warn("Cost integration note:", cstErr);
    }

    // 9. Update GRN Header
    await client.query(`
      UPDATE goods_receipts SET
        status = 'posted',
        is_posted = true,
        posted_at = CURRENT_TIMESTAMP,
        posted_by = $1,
        journal_entry_id = COALESCE($2, journal_entry_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [null, journalEntryId, id]);

    await logAudit(client, {
      entity_type: "goods_receipt",
      entity_id: id,
      action: "post",
      user_name: user || "admin",
      details: `ترحيل سند الاستلام ${gr.receipt_no} وتحديث المخزون بقيمة ${totalAcceptedValue} ج.م مع إنشاء القيد المحاسبي`
    });

    await client.query("COMMIT");

    // 10. Costing Module Integration
    try {
      await recordGoodsReceiptCost(id);
      if (gr.purchase_order_id) {
        await recordPurchaseCost(Number(gr.purchase_order_id));
      }
    } catch (costErr) {
      console.warn("Cost integration error on GRN post:", costErr);
    }

    try {
      ERPEventBus.getInstance().emitEvent("GoodsReceiptPosted", {
        receiptId: id,
        receiptNo: gr.receipt_no,
        purchaseOrderId: gr.purchase_order_id ? Number(gr.purchase_order_id) : null,
        warehouseId: Number(gr.warehouse_id),
        supplierId: gr.supplier_id ? Number(gr.supplier_id) : null,
        timestamp: new Date()
      });
    } catch (busErr) {
      console.warn("EventBus notification note:", busErr);
    }

    res.json({
      success: true,
      journal_entry_id: journalEntryId,
      message: `تم اعتماد وترحيل سند الاستلام ${gr.receipt_no} وتحديث الأرصدة والقيود المحاسبية بنجاح`
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in POST /api/goods-receipts/:id/post:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Reverse Posted Goods Receipt
router.post("/api/goods-receipts/:id/reverse", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const { reason, user } = req.body;

    const grRes = await client.query("SELECT * FROM goods_receipts WHERE id = $1 FOR UPDATE", [id]);
    if (grRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "سند الاستلام غير موجود" });
    }

    const gr = grRes.rows[0];
    if (!gr.is_posted) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن عكس سند غير مرحل" });
    }
    if (gr.status === "reversed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "تم عكس هذا السند مسبقاً" });
    }

    const itemsRes = await client.query("SELECT * FROM goods_receipt_items WHERE goods_receipt_id = $1", [id]);

    // Verify stock availability before reversal
    for (const it of itemsRes.rows) {
      const accQty = Number(it.accepted_qty || 0);
      if (accQty <= 0) continue;

      const curStock = await client.query(
        "SELECT quantity FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2",
        [gr.warehouse_id, it.ingredient_id]
      );
      const availableQty = Number(curStock.rows[0]?.quantity || 0);
      if (availableQty < accQty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          error: `لا يمكن عكس السند: الرصيد الحالي (${availableQty}) أقل من الكمية المستلمة المراد عكسها (${accQty}) للصنف ID ${it.ingredient_id}`
        });
      }
    }

    // Perform Stock Reversal
    for (const it of itemsRes.rows) {
      const accQty = Number(it.accepted_qty || 0);
      if (accQty <= 0) continue;

      const unitCost = Number(it.landed_unit_cost || it.unit_cost || 0);

      // Decrement inventory_items
      await client.query(`
        UPDATE inventory_items SET
          quantity = quantity - $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = $2 AND ingredient_id = $3
      `, [accQty, gr.warehouse_id, it.ingredient_id]);

      // Insert reversal into Stock Ledger
      await client.query(`
        INSERT INTO inventory_transactions (
          transaction_number, warehouse_id, ingredient_id, quantity, type,
          unit_cost, total_cost, reference_type, reference_id, reference_no,
          status, notes
        ) VALUES ($1, $2, $3, $4, 'issue', $5, $6, 'goods_receipt_reversal', $7, $8, 'posted', $9)
      `, [
        `TXN-REV-${Date.now().toString().slice(-6)}-${it.ingredient_id}`,
        gr.warehouse_id, it.ingredient_id, accQty, unitCost, accQty * unitCost,
        id, gr.receipt_no, `عكس استلام وارد ${gr.receipt_no}: ${reason || "إلغاء السند"}`
      ]);

      // Decrement PO received qty if linked
      if (gr.purchase_order_id && it.po_item_id) {
        await client.query(`
          UPDATE purchase_order_items
          SET received_quantity = GREATEST(0, COALESCE(received_quantity, 0) - $1)
          WHERE id = $2
        `, [accQty, it.po_item_id]);
      }
    }

    // Cancel Journal Entry if exists
    if (gr.journal_entry_id) {
      await client.query("UPDATE journal_entries SET status = 'canceled' WHERE id = $1", [gr.journal_entry_id]);
    }

    // Mark GRN as reversed
    await client.query(`
      UPDATE goods_receipts SET
        status = 'reversed',
        notes = COALESCE(notes, '') || E'\n[تم عكس السند]: ' || $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [reason || "تم عكس السند", id]);

    await logAudit(client, {
      entity_type: "goods_receipt",
      entity_id: id,
      action: "reverse",
      user_name: user || "admin",
      details: `عكس وإلغاء ترحيل سند الاستلام ${gr.receipt_no} لسبب: ${reason || "إلغاء السند"}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: `تم عكس سند الاستلام ${gr.receipt_no} وتحديث الأرصدة بنجاح` });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in POST /api/goods-receipts/:id/reverse:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Create Supplier Return Request for Rejected Items
router.post("/api/goods-receipts/:id/supplier-return", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const { items = [], reason, user } = req.body;

    const grRes = await client.query("SELECT * FROM goods_receipts WHERE id = $1", [id]);
    if (grRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "سند الاستلام غير موجود" });
    }

    const gr = grRes.rows[0];
    const returnNo = `SRT-${Date.now().toString().slice(-6)}`;
    let totalReturnAmount = 0;

    const srrRes = await client.query(`
      INSERT INTO supplier_return_requests (
        return_no, goods_receipt_id, purchase_order_id, supplier_id,
        warehouse_id, return_date, status, reason, notes
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, 'approved', $6, $7)
      RETURNING id
    `, [
      returnNo, id, gr.purchase_order_id || null, gr.supplier_id,
      gr.warehouse_id, reason || "بضاعة مرفوضة في فحص الجودة QC",
      `مرتجع من سند استلام ${gr.receipt_no}`
    ]);

    const returnId = srrRes.rows[0].id;

    for (const it of items) {
      const qty = Number(it.quantity || it.rejected_qty || 0);
      const unitCost = Number(it.unit_cost || it.unit_price || 0);
      const lineCost = qty * unitCost;
      totalReturnAmount += lineCost;

      await client.query(`
        INSERT INTO supplier_return_items (
          return_id, goods_receipt_item_id, ingredient_id, quantity,
          unit_cost, total_cost, batch_number, serial_numbers, rejection_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        returnId, it.goods_receipt_item_id || null, it.ingredient_id, qty,
        unitCost, lineCost, it.batch_number || null, it.serial_numbers || null,
        it.rejection_reason || reason || "مرفوض في الجودة"
      ]);
    }

    await client.query("UPDATE supplier_return_requests SET total_amount = $1 WHERE id = $2", [totalReturnAmount, returnId]);

    await logAudit(client, {
      entity_type: "supplier_return",
      entity_id: returnId,
      action: "create",
      user_name: user || "admin",
      details: `إنشاء إذن إرجاع بضاعة للمورد رقم ${returnNo} بمبلغ ${totalReturnAmount} ج.م لسند الاستلام ${gr.receipt_no}`
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      return_no: returnNo,
      return_id: returnId,
      message: `تم إنشاء طلب مرتجع المورد ${returnNo} للأصناف المرفوضة بنجاح`
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Error in POST /api/goods-receipts/:id/supplier-return:", err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Check Supplier Invoice Uniqueness
router.get("/api/grn/check-invoice-unique", async (req: Request, res: Response) => {
  try {
    const { supplier_id, invoice_no } = req.query;
    if (!supplier_id || !invoice_no) {
      return res.json({ success: true, is_unique: true });
    }
    const result = await pool.query(
      `SELECT id, receipt_no, date FROM goods_receipts 
       WHERE supplier_id = $1 AND LOWER(TRIM(supplier_invoice_no)) = LOWER(TRIM($2))
       LIMIT 1`,
      [Number(supplier_id), String(invoice_no)]
    );
    if (result.rows.length > 0) {
      return res.json({
        success: true,
        is_unique: false,
        existing_grn: result.rows[0].receipt_no,
        receipt_date: result.rows[0].date
      });
    }
    return res.json({ success: true, is_unique: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Pending Approved Purchase Orders ready for Receipt
router.get("/api/goods-receipts-po/pending", async (req: Request, res: Response) => {
  try {
    const { supplier_id } = req.query;
    let query = `
      SELECT 
        po.*,
        sup.name as supplier_name,
        sup.supplier_code as supplier_code,
        (SELECT COUNT(*) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) as items_count,
        (SELECT COALESCE(SUM(quantity), 0) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) as total_ordered_qty,
        (SELECT COALESCE(SUM(received_quantity), 0) FROM purchase_order_items poi WHERE poi.purchase_order_id = po.id) as total_received_qty
      FROM purchase_orders po
      LEFT JOIN suppliers sup ON po.supplier_id = sup.id
      WHERE po.status IN ('approved', 'partially_received', 'pending')
    `;
    const params: any[] = [];
    if (supplier_id && supplier_id !== "all") {
      params.push(Number(supplier_id));
      query += ` AND po.supplier_id = $${params.length}`;
    }
    query += ` ORDER BY po.id DESC LIMIT 50`;
    const result = await pool.query(query, params);
    res.json({ success: true, purchase_orders: result.rows });
  } catch (err: any) {
    console.error("Error in GET /api/goods-receipts-po/pending:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get PO Items with Remaining Quantities for Auto-Fill
router.get("/api/goods-receipts-po/:id/items", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const poRes = await pool.query(`
      SELECT po.*, sup.name as supplier_name, sup.id as sup_id
      FROM purchase_orders po
      LEFT JOIN suppliers sup ON po.supplier_id = sup.id
      WHERE po.id = $1
    `, [id]);

    if (poRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "أمر الشراء غير موجود" });
    }

    const itemsRes = await pool.query(`
      SELECT 
        poi.id as po_item_id,
        poi.ingredient_id,
        poi.quantity as ordered_qty,
        COALESCE(poi.received_quantity, 0) as previously_received_qty,
        GREATEST(0, poi.quantity - COALESCE(poi.received_quantity, 0)) as remaining_qty,
        poi.unit_price,
        COALESCE(poi.tax_rate, po.tax_rate, 0) as tax_rate,
        COALESCE(poi.tax_amount, 0) as tax_amount,
        poi.total_price,
        poi.expiry_date,
        poi.batch_number,
        ing.name as item_name,
        ing.item_code,
        ing.barcode,
        ing.unit as base_unit,
        ing.tracking_type,
        ing.category as item_category
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.purchase_order_id
      JOIN ingredients ing ON poi.ingredient_id = ing.id
      WHERE poi.purchase_order_id = $1
      ORDER BY poi.id ASC
    `, [id]);

    res.json({
      success: true,
      purchase_order: poRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err: any) {
    console.error("Error in GET /api/goods-receipts-po/:id/items:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save Attachments to Goods Receipt
router.post("/api/goods-receipts/:id/attachments", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { file_name, file_url, doc_type = "invoice", user, file_size = 0 } = req.body;

    if (!file_name || !file_url) {
      return res.status(400).json({ success: false, error: "اسم الملف والرابط مطلوبان" });
    }

    const result = await pool.query(`
      INSERT INTO goods_receipt_attachments (goods_receipt_id, file_name, file_url, doc_type, uploaded_by, file_size)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [id, file_name, file_url, doc_type, user || "admin", file_size]);

    res.json({ success: true, attachment: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Supplier Receiving Performance Analytics
router.get("/api/goods-receipts/analytics/supplier-performance", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        sup.id as supplier_id,
        sup.name as supplier_name,
        sup.supplier_code as supplier_code,
        COUNT(DISTINCT gr.id) as total_grn_count,
        COALESCE(SUM(gr.total_amount), 0) as total_received_value,
        COALESCE(SUM((SELECT SUM(received_qty) FROM goods_receipt_items WHERE goods_receipt_id = gr.id)), 0) as total_qty_received,
        COALESCE(SUM((SELECT SUM(accepted_qty) FROM goods_receipt_items WHERE goods_receipt_id = gr.id)), 0) as total_qty_accepted,
        COALESCE(SUM((SELECT SUM(rejected_qty) FROM goods_receipt_items WHERE goods_receipt_id = gr.id)), 0) as total_qty_rejected,
        ROUND(
          CASE 
            WHEN SUM((SELECT SUM(received_qty) FROM goods_receipt_items WHERE goods_receipt_id = gr.id)) > 0
            THEN (SUM((SELECT SUM(accepted_qty) FROM goods_receipt_items WHERE goods_receipt_id = gr.id)) / SUM((SELECT SUM(received_qty) FROM goods_receipt_items WHERE goods_receipt_id = gr.id))) * 100
            ELSE 100
          END, 2
        ) as quality_acceptance_rate
      FROM suppliers sup
      LEFT JOIN goods_receipts gr ON gr.supplier_id = sup.id
      GROUP BY sup.id, sup.name, sup.supplier_code
      HAVING COUNT(gr.id) > 0
      ORDER BY total_received_value DESC
      LIMIT 20
    `);

    res.json({ success: true, suppliers: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════
// 5. MATERIAL REQUESTS & ISSUES (Outbound Consumptions)
// ── Moved to ./material_requests.routes.ts ──
// The old handlers lived here and wrote to columns that legacy databases do
// not have (approved_by_dept, approved_wh_at, issued_at ...), so every
// approval/issue call failed. The rewritten router is mounted before this
// one in warehouses_api.routes.ts and owns every /api/material-requests path.
// ═════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 6. STOCK RESERVATIONS ENGINE
// ═══════════════════════════════════════════════════════════════

router.get("/api/stock-reservations", async (req: Request, res: Response) => {
  try {
    const { warehouse_id, ingredient_id, status } = req.query;
    let query = `
      SELECT sr.*, ing.name as item_name, ing.item_code, w.name as warehouse_name, u.username as creator_name
      FROM stock_reservations sr
      JOIN ingredients ing ON sr.ingredient_id = ing.id
      JOIN warehouses w ON sr.warehouse_id = w.id
      LEFT JOIN users u ON sr.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      query += ` AND sr.warehouse_id = $${params.length}`;
    }
    if (ingredient_id) {
      params.push(Number(ingredient_id));
      query += ` AND sr.ingredient_id = $${params.length}`;
    }
    if (status && status !== "all") {
      params.push(status);
      query += ` AND sr.status = $${params.length}`;
    }
    query += ` ORDER BY sr.id DESC LIMIT 100`;
    const result = await pool.query(query, params);
    res.json({ success: true, reservations: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/api/stock-reservations", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      warehouse_id, ingredient_id, quantity, reserved_for_type, reference_id, reference_no,
      expires_at, notes, user
    } = req.body;

    const reqQty = Number(quantity || 0);
    if (!warehouse_id || !ingredient_id || reqQty <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "المخزن والصنف والكمية حقول مطلوبة" });
    }

    // Verify Available Stock = On Hand - Reserved
    const stockRes = await client.query(
      "SELECT id, quantity, reserved FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
      [warehouse_id, ingredient_id]
    );

    const onHand = Number(stockRes.rows[0]?.quantity || 0);
    const currentlyReserved = Number(stockRes.rows[0]?.reserved || 0);
    const available = onHand - currentlyReserved;

    if (available < reqQty) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: `الكمية المتاحة للحجز (${available}) أقل من الكمية المطلوبة (${reqQty})`
      });
    }

    // Update reserved field in inventory_items
    const newReserved = currentlyReserved + reqQty;
    if (stockRes.rows.length > 0) {
      await client.query(
        "UPDATE inventory_items SET reserved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [newReserved, stockRes.rows[0].id]
      );
    } else {
      await client.query(
        "INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, reserved) VALUES ($1, $2, 0, $3)",
        [warehouse_id, ingredient_id, reqQty]
      );
    }

    const resNo = `RES-${Date.now().toString().slice(-6)}`;
    const result = await client.query(`
      INSERT INTO stock_reservations (
        reservation_no, warehouse_id, ingredient_id, quantity, reserved_for_type,
        reference_id, reference_no, expires_at, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
      RETURNING *
    `, [
      resNo, warehouse_id, ingredient_id, reqQty, reserved_for_type || 'sales_order',
      reference_id || null, reference_no || null, expires_at || null, notes || null
    ]);

    await logAudit(client, {
      entity_type: "stock_reservation",
      entity_id: result.rows[0].id,
      action: "create",
      user_name: user || "admin",
      details: `حجز كمية ${reqQty} من الصنف ${ingredient_id} لصالح ${reserved_for_type}`
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      reservation: result.rows[0],
      message: `تم حجز المخزون بنجاح (رقم الحجز: ${resNo})`
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// Release Reservation
router.put("/api/stock-reservations/:id/release", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = Number(req.params.id);
    const { user } = req.body;

    const resRecord = await client.query(
      "SELECT * FROM stock_reservations WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (resRecord.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "الحجز غير موجود" });
    }

    const r = resRecord.rows[0];
    if (r.status !== 'active') {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: `الحجز بحالة ${r.status} وغير قابل للتحرير` });
    }

    // Decrement reserved in inventory_items
    const stockRes = await client.query(
      "SELECT id, reserved FROM inventory_items WHERE warehouse_id = $1 AND ingredient_id = $2 FOR UPDATE",
      [r.warehouse_id, r.ingredient_id]
    );

    if (stockRes.rows.length > 0) {
      const curRes = Number(stockRes.rows[0].reserved || 0);
      const newRes = Math.max(0, curRes - Number(r.quantity));
      await client.query(
        "UPDATE inventory_items SET reserved = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [newRes, stockRes.rows[0].id]
      );
    }

    await client.query(
      "UPDATE stock_reservations SET status = 'released', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [id]
    );

    await logAudit(client, {
      entity_type: "stock_reservation",
      entity_id: id,
      action: "update",
      user_name: user || "admin",
      details: `تحرير حجز المخزون رقم ${r.reservation_no}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم تحرير الحجز بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. INVENTORY PLANNING & REORDER SUGGESTIONS
// ═══════════════════════════════════════════════════════════════

router.get("/api/inventory/planning", async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.query;
    let query = `
      SELECT 
        ing.id as ingredient_id,
        ing.name as item_name,
        ing.item_code,
        ing.category,
        ing.unit,
        COALESCE(ing.min_stock, 0) as min_stock,
        COALESCE(ing.max_stock, 0) as max_stock,
        COALESCE(ing.reorder_point, 0) as reorder_point,
        COALESCE(ing.safety_stock, 0) as safety_stock,
        COALESCE(ing.lead_time_days, 7) as lead_time_days,
        COALESCE(ing.cost, 0) as unit_cost,
        COALESCE(sup.name, ing.supplier) as supplier_name,
        COALESCE(SUM(ii.quantity), 0) as current_stock,
        COALESCE(SUM(ii.reserved), 0) as reserved_stock,
        COALESCE(SUM(ii.in_transit), 0) as in_transit_stock,
        (COALESCE(SUM(ii.quantity), 0) - COALESCE(SUM(ii.reserved), 0)) as available_stock,
        COALESCE((
          SELECT ABS(SUM(it.quantity)) / 30.0
          FROM inventory_transactions it
          WHERE it.ingredient_id = ing.id AND it.type = 'issue' AND it.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0) as avg_daily_usage
      FROM ingredients ing
      LEFT JOIN inventory_items ii ON ii.ingredient_id = ing.id
      LEFT JOIN suppliers sup ON ing.preferred_supplier_id = sup.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      query += ` AND (ii.warehouse_id = $${params.length} OR ii.warehouse_id IS NULL)`;
    }

    query += ` GROUP BY ing.id, ing.name, ing.item_code, ing.category, ing.unit, ing.min_stock, ing.max_stock, ing.reorder_point, ing.safety_stock, ing.lead_time_days, ing.cost, sup.name, ing.supplier`;

    const result = await pool.query(query, params);

    const planningItems = result.rows.map((row: any) => {
      const current = Number(row.current_stock);
      const available = Number(row.available_stock);
      const minStock = Number(row.min_stock || 0);
      const maxStock = Number(row.max_stock || 0);
      const avgDaily = Number(row.avg_daily_usage || 0);
      const leadTime = Number(row.lead_time_days || 7);

      // Calculated Reorder Point = (Lead Time * Avg Daily Usage) + Safety Stock
      const calcRop = avgDaily > 0 ? (leadTime * avgDaily) + Number(row.safety_stock || 0) : minStock;
      const rop = Math.max(Number(row.reorder_point || 0), calcRop);

      // Days of supply
      const daysOfSupply = avgDaily > 0 ? Math.round(available / avgDaily) : 999;

      // Status
      let status = "optimal";
      let suggestedOrderQty = 0;

      if (available <= 0) {
        status = "out_of_stock";
        suggestedOrderQty = Math.max(maxStock - available, rop * 1.5, 10);
      } else if (available < rop) {
        status = "reorder_required";
        suggestedOrderQty = maxStock > 0 ? Math.max(maxStock - available, 0) : Math.max(rop * 2 - available, 10);
      } else if (maxStock > 0 && available > maxStock * 1.3) {
        status = "overstock";
      }

      return {
        ...row,
        calculated_rop: Math.round(rop * 100) / 100,
        days_of_supply: daysOfSupply,
        status,
        suggested_order_qty: Math.round(suggestedOrderQty),
        estimated_order_cost: Math.round(suggestedOrderQty * Number(row.unit_cost))
      };
    });

    const lowStockCount = planningItems.filter((i: any) => i.status === "reorder_required" || i.status === "out_of_stock").length;
    const overstockCount = planningItems.filter((i: any) => i.status === "overstock").length;

    res.json({
      success: true,
      items: planningItems,
      summary: {
        total_items: planningItems.length,
        reorder_needed: lowStockCount,
        overstock: overstockCount,
        optimal: planningItems.length - lowStockCount - overstockCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. AI INVENTORY ADVISOR & PREDICTIONS
// ═══════════════════════════════════════════════════════════════

router.get("/api/inventory-ai/analysis", async (req: Request, res: Response) => {
  try {
    // 1. Analyze high-risk out-of-stock items
    const stockOutRisk = await pool.query(`
      SELECT ing.name as item_name, ing.item_code, w.name as warehouse_name, ii.quantity,
        COALESCE((SELECT ABS(SUM(it.quantity)) / 30.0 FROM inventory_transactions it WHERE it.ingredient_id = ing.id AND it.type = 'issue' AND it.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0) as daily_rate
      FROM inventory_items ii
      JOIN ingredients ing ON ii.ingredient_id = ing.id
      JOIN warehouses w ON ii.warehouse_id = w.id
      WHERE ii.quantity > 0
      ORDER BY (ii.quantity / NULLIF((SELECT ABS(SUM(it.quantity)) / 30.0 FROM inventory_transactions it WHERE it.ingredient_id = ing.id AND it.type = 'issue' AND it.created_at >= CURRENT_DATE - INTERVAL '30 days'), 0)) ASC NULLS LAST
      LIMIT 5
    `);

    // 2. Dead Stock (no issues in last 60 days with positive quantity)
    const deadStock = await pool.query(`
      SELECT ing.name as item_name, ing.item_code, w.name as warehouse_name, ii.quantity, (ii.quantity * ing.cost) as tied_capital
      FROM inventory_items ii
      JOIN ingredients ing ON ii.ingredient_id = ing.id
      JOIN warehouses w ON ii.warehouse_id = w.id
      WHERE ii.quantity > 0 AND NOT EXISTS (
        SELECT 1 FROM inventory_transactions it 
        WHERE it.ingredient_id = ing.id AND it.type = 'issue' AND it.created_at >= CURRENT_DATE - INTERVAL '60 days'
      )
      ORDER BY (ii.quantity * ing.cost) DESC
      LIMIT 5
    `);

    // 3. Expiry Risks
    const expiryRisk = await pool.query(`
      SELECT b.batch_number, ing.name as item_name, b.remaining_quantity, b.expiry_date,
        (b.expiry_date - CURRENT_DATE) as days_to_expiry, (b.remaining_quantity * b.unit_cost) as value_at_risk
      FROM batch_tracking b
      JOIN ingredients ing ON b.ingredient_id = ing.id
      WHERE b.remaining_quantity > 0 AND b.expiry_date IS NOT NULL AND b.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY b.expiry_date ASC
      LIMIT 5
    `);

    const insights = [];

    for (const r of stockOutRisk.rows) {
      const daily = Number(r.daily_rate);
      if (daily > 0) {
        const days = Math.round(Number(r.quantity) / daily);
        if (days <= 10) {
          insights.push({
            type: "stockout_warning",
            severity: days <= 3 ? "critical" : "warning",
            title: `توقع نفاد المخزون: ${r.item_name}`,
            description: `الصنف ${r.item_name} في ${r.warehouse_name} متوقع نفاده خلال ${days} أيام بمعدل استهلاك ${Math.round(daily * 10) / 10} يومياً.`,
            recommended_action: `إصدار طلب شراء عاجل لتغطية 30 يوماً القادمة.`
          });
        }
      }
    }

    for (const d of deadStock.rows) {
      insights.push({
        type: "dead_stock",
        severity: "info",
        title: `مخزون راكد غير متحرك: ${d.item_name}`,
        description: `يوجد ${Number(d.quantity)} وحدة برأسمال معطل ${Number(d.tied_capital).toLocaleString()} ج.م دون أي حركة صرف خلال 60 يوماً.`,
        recommended_action: `إعادة تخصيص المخزون أو عمل عروض ترويجية / تسوية.`
      });
    }

    for (const ex of expiryRisk.rows) {
      const days = Number(ex.days_to_expiry);
      insights.push({
        type: "expiry_risk",
        severity: days < 0 ? "critical" : "warning",
        title: days < 0 ? `تشغيلة منتهية الصلاحية: ${ex.item_name}` : `خطر انتهاء صلاحية وشيك: ${ex.item_name}`,
        description: `التشغيلة #${ex.batch_number} تنتهي خلال ${days} يوم (القيمة المعرضة للخطر: ${Number(ex.value_at_risk).toLocaleString()} ج.م).`,
        recommended_action: days < 0 ? `حظر التشغيلة ونقلها لمخزن الهالك/الحجر.` : `تطبيق قاعدة FEFO وصرف هذه التشغيلة أولاً.`
      });
    }

    res.json({
      success: true,
      insights,
      stockout_risk: stockOutRisk.rows,
      dead_stock: deadStock.rows,
      expiry_risk: expiryRisk.rows
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 9. AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════

router.get("/api/inventory/audit-trail", async (req: Request, res: Response) => {
  try {
    const { entity_type, action, search } = req.query;
    let query = `
      SELECT * FROM inventory_audit_trail WHERE 1=1
    `;
    const params: any[] = [];
    if (entity_type && entity_type !== "all") {
      params.push(entity_type);
      query += ` AND entity_type = $${params.length}`;
    }
    if (action && action !== "all") {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (details ILIKE $${params.length} OR user_name ILIKE $${params.length})`;
    }
    query += ` ORDER BY id DESC LIMIT 100`;
    const result = await pool.query(query, params);
    res.json({ success: true, audit_logs: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 10. ENTERPRISE STOCK INTELLIGENCE & BALANCES (Comprehensive Dashboard Endpoint)
// ═══════════════════════════════════════════════════════════════

router.get("/api/inventory/stock-intelligence", async (req: Request, res: Response) => {
  try {
    const {
      warehouse_id,
      search,
      category,
      brand,
      stock_status,
      item_type,
      supplier_id,
      has_batch,
      has_serial,
      min_qty,
      max_qty,
      min_val,
      max_val,
      sort_by = "ingredient_name",
      sort_order = "ASC"
    } = req.query;

    let query = `
      SELECT 
        ii.id as item_id,
        ii.ingredient_id,
        ii.warehouse_id,
        COALESCE(ii.quantity, 0) as quantity,
        COALESCE(ii.reserved, 0) as reserved,
        COALESCE(ii.in_transit, 0) as in_transit,
        (COALESCE(ii.quantity, 0) - COALESCE(ii.reserved, 0)) as available,
        ii.location_id,
        ii.last_count_date,
        ii.avg_cost as item_specific_cost,

        -- Item master info
        ing.name as ingredient_name,
        COALESCE(ing.code, ing.sku, '') as ingredient_code,
        ing.barcode,
        ing.category,
        ing.subcategory,
        ing.brand,
        ing.manufacturer,
        ing.model,
        COALESCE(ing.item_type, 'raw_material') as item_type,
        COALESCE(ing.tracking_type, 'none') as tracking_type,
        COALESCE(ing.unit, 'قطعة') as ingredient_unit,
        ing.purchase_unit,
        ing.sales_unit,
        COALESCE(ing.conversion_factor, 1) as conversion_factor,
        COALESCE(ing.min_stock, 0) as min_stock,
        COALESCE(ing.max_stock, 0) as max_stock,
        COALESCE(ing.reorder_point, ing.min_stock, 0) as reorder_point,
        COALESCE(ing.safety_stock, 0) as safety_stock,
        COALESCE(ing.lead_time_days, 7) as lead_time_days,
        COALESCE(ing.cost, ing.avg_cost, 0) as cost,
        COALESCE(
          NULLIF(ii.avg_cost, 0),
          NULLIF(ing.avg_cost, 0),
          NULLIF(ing.cost, 0),
          (SELECT sv.unit_cost FROM stock_valuation sv WHERE sv.ingredient_id = ii.ingredient_id AND sv.warehouse_id = ii.warehouse_id AND sv.unit_cost > 0 ORDER BY sv.id DESC LIMIT 1),
          (SELECT it.unit_cost FROM inventory_transactions it WHERE it.ingredient_id = ii.ingredient_id AND it.unit_cost > 0 ORDER BY it.id DESC LIMIT 1),
          (SELECT pr.unit_cost FROM production_runs pr JOIN production_orders po ON po.order_number = pr.order_number WHERE po.product_name = ing.name AND pr.unit_cost > 0 ORDER BY pr.id DESC LIMIT 1),
          0
        ) as avg_cost,
        COALESCE(ing.last_purchase_price, ing.cost, 0) as last_purchase_price,
        COALESCE(ing.standard_cost, ing.cost, 0) as standard_cost,
        COALESCE(ing.valuation_method, 'weighted_average') as valuation_method,

        -- Latest stock valuation / production receipt metadata
        (
          SELECT json_build_object(
            'id', sv.id,
            'valuation_date', sv.valuation_date,
            'unit_cost', sv.unit_cost,
            'total_value', sv.total_value,
            'reference_type', sv.reference_type,
            'production_order', sv.production_order,
            'production_receipt', sv.production_receipt,
            'cost_components', sv.cost_components
          )
          FROM stock_valuation sv
          WHERE sv.ingredient_id = ii.ingredient_id AND sv.warehouse_id = ii.warehouse_id
          ORDER BY sv.id DESC LIMIT 1
        ) as latest_valuation,

        -- Warehouse info
        w.name as warehouse_name,
        w.code as warehouse_code,
        w.type as warehouse_type,
        sup.name as supplier_name,

        -- Location hierarchy
        wl.code as location_code,
        wl.name as location_name,
        wl.type as location_type,
        wl.zone as location_zone,
        wl.rack as location_rack,
        wl.shelf as location_shelf,
        wl.bin as location_bin,

        -- Active batch count & earliest expiry
        COALESCE((
          SELECT COUNT(*)::int 
          FROM batch_tracking bt 
          WHERE bt.ingredient_id = ii.ingredient_id AND bt.warehouse_id = ii.warehouse_id AND bt.remaining_quantity > 0
        ), 0) as batch_count,
        (
          SELECT MIN(bt.expiry_date) 
          FROM batch_tracking bt 
          WHERE bt.ingredient_id = ii.ingredient_id AND bt.warehouse_id = ii.warehouse_id AND bt.remaining_quantity > 0
        ) as earliest_expiry_date,

        -- Active serial count
        COALESCE((
          SELECT COUNT(*)::int 
          FROM item_serials ser 
          WHERE ser.ingredient_id = ii.ingredient_id AND ser.warehouse_id = ii.warehouse_id AND ser.status = 'in_stock'
        ), 0) as serial_count,

        -- Active reservations count
        COALESCE((
          SELECT COUNT(*)::int 
          FROM stock_reservations res 
          WHERE res.ingredient_id = ii.ingredient_id AND res.warehouse_id = ii.warehouse_id AND res.status = 'active'
        ), 0) as reservation_count,

        -- Last movement from inventory_movements
        (
          SELECT json_build_object(
            'date', im.created_at,
            'field', im.field,
            'delta', im.delta,
            'after_qty', im.after_qty,
            'ref_type', im.ref_type,
            'ref_id', im.ref_id,
            'user', im.user,
            'notes', im.notes
          )
          FROM inventory_movements im
          WHERE im.ingredient_id = ii.ingredient_id AND im.warehouse_id = ii.warehouse_id
          ORDER BY im.id DESC LIMIT 1
        ) as last_movement,

        -- Average daily consumption over last 30 days
        COALESCE((
          SELECT ABS(SUM(im.delta)) / 30.0
          FROM inventory_movements im
          WHERE im.ingredient_id = ii.ingredient_id AND im.warehouse_id = ii.warehouse_id AND im.delta < 0 AND im.created_at >= CURRENT_DATE - INTERVAL '30 days'
        ), 0) as avg_daily_consumption

      FROM inventory_items ii
      JOIN ingredients ing ON ing.id = ii.ingredient_id
      JOIN warehouses w ON w.id = ii.warehouse_id
      LEFT JOIN suppliers sup ON sup.id = ing.preferred_supplier_id
      LEFT JOIN warehouse_locations wl ON wl.id = ii.location_id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      query += ` AND ii.warehouse_id = $${params.length}`;
    }

    if (category && category !== "all") {
      params.push(category);
      query += ` AND ing.category = $${params.length}`;
    }

    if (brand && brand !== "all") {
      params.push(brand);
      query += ` AND ing.brand = $${params.length}`;
    }

    if (item_type && item_type !== "all") {
      params.push(item_type);
      query += ` AND ing.item_type = $${params.length}`;
    }

    if (supplier_id && supplier_id !== "all") {
      params.push(Number(supplier_id));
      query += ` AND ing.preferred_supplier_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (ing.name ILIKE $${params.length} OR ing.code ILIKE $${params.length} OR ing.barcode ILIKE $${params.length} OR ing.sku ILIKE $${params.length} OR w.name ILIKE $${params.length})`;
    }

    if (min_qty !== undefined && min_qty !== "") {
      params.push(Number(min_qty));
      query += ` AND ii.quantity >= $${params.length}`;
    }

    if (max_qty !== undefined && max_qty !== "") {
      params.push(Number(max_qty));
      query += ` AND ii.quantity <= $${params.length}`;
    }

    query += ` ORDER BY ing.name ASC, w.name ASC`;

    const result = await pool.query(query, params);

    // Process intelligence calculations
    const items = result.rows.map((row: any) => {
      const qty = Number(row.quantity || 0);
      const reserved = Number(row.reserved || 0);
      const inTransit = Number(row.in_transit || 0);
      const available = Number(row.available || (qty - reserved));
      const minStock = Number(row.min_stock || 0);
      const maxStock = Number(row.max_stock || 0);
      const rop = Number(row.reorder_point || minStock || 0);
      const safetyStock = Number(row.safety_stock || 0);
      const avgDaily = Number(row.avg_daily_consumption || 0);
      const leadTime = Number(row.lead_time_days || 7);
      const avgCost = Number(row.avg_cost || row.cost || 0);
      const conversionFactor = Number(row.conversion_factor || 1);

      // Inventory Status
      let status: "optimal" | "low_stock" | "out_of_stock" | "overstock" | "fully_reserved" | "in_transit" = "optimal";
      let statusLabel = "طبيعي";
      let statusColor = "emerald";

      if (qty <= 0) {
        status = "out_of_stock";
        statusLabel = "نافد";
        statusColor = "red";
      } else if (available <= 0 && reserved > 0) {
        status = "fully_reserved";
        statusLabel = "محجوز بالكامل";
        statusColor = "purple";
      } else if (inTransit > 0 && available <= 0) {
        status = "in_transit";
        statusLabel = "قيد النقل";
        statusColor = "blue";
      } else if ((rop > 0 && available <= rop) || (minStock > 0 && available <= minStock)) {
        status = "low_stock";
        statusLabel = "منخفض";
        statusColor = "amber";
      } else if (maxStock > 0 && available > maxStock) {
        status = "overstock";
        statusLabel = "زائد";
        statusColor = "orange";
      }

      // Reorder Calculation
      let suggestedOrderQty = 0;
      if (status === "out_of_stock" || status === "low_stock") {
        if (maxStock > 0) {
          suggestedOrderQty = Math.max(maxStock - available, 0);
        } else if (rop > 0) {
          suggestedOrderQty = Math.max(rop * 2 - available, 10);
        } else {
          suggestedOrderQty = 20;
        }
      }

      // Days of Supply
      const daysOfSupply = avgDaily > 0 ? Math.round(available / avgDaily) : 999;

      // Location formatted string
      let locationFormatted = "";
      if (row.location_code) {
        const parts = [
          row.warehouse_code || row.warehouse_name,
          row.location_zone ? `Zone: ${row.location_zone}` : null,
          row.location_rack ? `Rack: ${row.location_rack}` : null,
          row.location_shelf ? `Shelf: ${row.location_shelf}` : null,
          row.location_bin ? `Bin: ${row.location_bin}` : null
        ].filter(Boolean);
        locationFormatted = parts.join(" / ");
      } else {
        locationFormatted = `${row.warehouse_name} (عام)`;
      }

      // Secondary unit breakdown text (e.g. 500 Piece = 41 Carton + 8 Piece)
      let secondaryUnitText = "";
      if (conversionFactor > 1 && row.purchase_unit) {
        const majorCount = Math.floor(qty / conversionFactor);
        const minorCount = Math.round((qty % conversionFactor) * 100) / 100;
        secondaryUnitText = `${majorCount} ${row.purchase_unit}${minorCount > 0 ? ` + ${minorCount} ${row.ingredient_unit}` : ""}`;
      }

      // Expiry status check
      let expiryStatus: "valid" | "warning_30" | "critical_7" | "expired" = "valid";
      if (row.earliest_expiry_date) {
        const now = new Date().getTime();
        const exp = new Date(row.earliest_expiry_date).getTime();
        const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) expiryStatus = "expired";
        else if (diffDays <= 7) expiryStatus = "critical_7";
        else if (diffDays <= 30) expiryStatus = "warning_30";
      }

      // Inventory value
      const inventoryValue = qty * avgCost;

      return {
        ...row,
        status,
        statusLabel,
        statusColor,
        location_formatted: locationFormatted,
        secondary_unit_text: secondaryUnitText,
        inventory_value: Math.round(inventoryValue * 100) / 100,
        days_of_supply: daysOfSupply,
        suggested_order_qty: Math.round(suggestedOrderQty),
        estimated_reorder_cost: Math.round(suggestedOrderQty * avgCost),
        expiry_status: expiryStatus,
        daily_avg_consumption: Math.round(avgDaily * 100) / 100,
        weekly_consumption: Math.round(avgDaily * 7 * 100) / 100,
        monthly_consumption: Math.round(avgDaily * 30 * 100) / 100,
      };
    });

    // Filter by stock_status in-memory if requested
    let filteredItems = items;
    if (stock_status && stock_status !== "all") {
      filteredItems = filteredItems.filter((i: any) => i.status === stock_status);
    }
    if (has_batch === "true") {
      filteredItems = filteredItems.filter((i: any) => i.batch_count > 0);
    }
    if (has_serial === "true") {
      filteredItems = filteredItems.filter((i: any) => i.serial_count > 0);
    }

    // Compute Enterprise KPIs Summary
    const totalQty = items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
    const totalAvailable = items.reduce((s: number, i: any) => s + Number(i.available || 0), 0);
    const totalReserved = items.reduce((s: number, i: any) => s + Number(i.reserved || 0), 0);
    const totalInTransit = items.reduce((s: number, i: any) => s + Number(i.in_transit || 0), 0);
    const totalValue = items.reduce((s: number, i: any) => s + Number(i.inventory_value || 0), 0);

    const lowStockCount = items.filter((i: any) => i.status === "low_stock").length;
    const outOfStockCount = items.filter((i: any) => i.status === "out_of_stock").length;
    const overstockCount = items.filter((i: any) => i.status === "overstock").length;
    const fullyReservedCount = items.filter((i: any) => i.status === "fully_reserved").length;
    const expiringCount = items.filter((i: any) => i.expiry_status === "warning_30" || i.expiry_status === "critical_7").length;
    const expiredCount = items.filter((i: any) => i.expiry_status === "expired").length;
    const slowMovingCount = items.filter((i: any) => Number(i.avg_daily_consumption) === 0 && Number(i.quantity) > 0).length;

    res.json({
      success: true,
      items: filteredItems,
      total_count: filteredItems.length,
      kpis: {
        total_items: items.length,
        total_quantity: Math.round(totalQty * 100) / 100,
        total_available: Math.round(totalAvailable * 100) / 100,
        total_reserved: Math.round(totalReserved * 100) / 100,
        total_in_transit: Math.round(totalInTransit * 100) / 100,
        total_value: Math.round(totalValue * 100) / 100,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        overstock_count: overstockCount,
        fully_reserved_count: fullyReservedCount,
        expiring_count: expiringCount,
        expired_count: expiredCount,
        slow_moving_count: slowMovingCount
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11. ITEM DEEP-DIVE DETAILS (For Enterprise Stock Details Drawer)
// ═══════════════════════════════════════════════════════════════

router.get("/api/inventory/item-details/:ingredientId", async (req: Request, res: Response) => {
  try {
    const ingredientId = Number(req.params.ingredientId);

    // 1. Master Item Info
    const itemRes = await pool.query(`
      SELECT ing.*, sup.name as supplier_name, sup.phone as supplier_phone
      FROM ingredients ing
      LEFT JOIN suppliers sup ON sup.id = ing.preferred_supplier_id
      WHERE ing.id = $1
    `, [ingredientId]);

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "الصنف غير موجود" });
    }
    const item = itemRes.rows[0];

    // 2. Warehouse Stock Distribution
    const stockRes = await pool.query(`
      SELECT ii.*, w.name as warehouse_name, w.code as warehouse_code,
             wl.code as location_code, wl.name as location_name, wl.zone, wl.rack, wl.shelf, wl.bin
      FROM inventory_items ii
      JOIN warehouses w ON w.id = ii.warehouse_id
      LEFT JOIN warehouse_locations wl ON wl.id = ii.location_id
      WHERE ii.ingredient_id = $1
      ORDER BY w.name ASC
    `, [ingredientId]);

    // 3. Batches & Lots
    const batchesRes = await pool.query(`
      SELECT b.*, w.name as warehouse_name, wl.code as location_code
      FROM batch_tracking b
      JOIN warehouses w ON w.id = b.warehouse_id
      LEFT JOIN warehouse_locations wl ON wl.id = b.location_id
      WHERE b.ingredient_id = $1
      ORDER BY b.expiry_date ASC NULLS LAST, b.id DESC
    `, [ingredientId]);

    // 4. Serial Numbers
    const serialsRes = await pool.query(`
      SELECT s.*, w.name as warehouse_name, wl.code as location_code
      FROM item_serials s
      LEFT JOIN warehouses w ON w.id = s.warehouse_id
      LEFT JOIN warehouse_locations wl ON wl.id = s.location_id
      WHERE s.ingredient_id = $1
      ORDER BY s.id DESC
    `, [ingredientId]);

    // 5. Active Reservations
    const reservationsRes = await pool.query(`
      SELECT res.*, w.name as warehouse_name
      FROM stock_reservations res
      JOIN warehouses w ON w.id = res.warehouse_id
      WHERE res.ingredient_id = $1 AND res.status = 'active'
      ORDER BY res.id DESC
    `, [ingredientId]);

    // 6. Recent Movements Ledger (Stock Card)
    const movementsRes = await pool.query(`
      SELECT im.*, w.name as warehouse_name
      FROM inventory_movements im
      JOIN warehouses w ON w.id = im.warehouse_id
      WHERE im.ingredient_id = $1
      ORDER BY im.id DESC
      LIMIT 100
    `, [ingredientId]);

    // 7. Recent Goods Receipts (GRN & Production Receipts)
    const receiptsRes = await pool.query(`
      SELECT 
        gri.id,
        gri.goods_receipt_id,
        gri.ingredient_id,
        COALESCE(gri.accepted_qty, gri.received_qty, 0) as received_quantity,
        COALESCE(gri.landed_unit_cost, gri.unit_cost, 0) as unit_price,
        gr.receipt_no as grn_number,
        gr.date as receipt_date,
        COALESCE((SELECT name FROM suppliers WHERE id = gr.supplier_id), '') as supplier_name,
        gr.status as grn_status,
        COALESCE(gr.receiver_name, (SELECT username FROM users WHERE id = gr.posted_by), 'System') as received_by,
        'purchase_grn' as receipt_source,
        NULL::text as production_order,
        NULL::text as cost_components
      FROM goods_receipt_items gri
      JOIN goods_receipts gr ON gr.id = gri.goods_receipt_id
      WHERE gri.ingredient_id = $1
      ORDER BY gr.date DESC, gr.id DESC
      LIMIT 20
    `, [ingredientId]);

    let prodReceiptsRows: any[] = [];
    try {
      const prodRecRes = await pool.query(`
        SELECT 
          it.id,
          it.id as goods_receipt_id,
          it.ingredient_id,
          COALESCE(it.quantity, 0) as received_quantity,
          COALESCE(it.unit_cost, 0) as unit_price,
          it.transaction_number as grn_number,
          it.date as receipt_date,
          'إنتاج وتصنيع داخلي (' || COALESCE(it.reference, '') || ')' as supplier_name,
          COALESCE(it.status, 'approved') as grn_status,
          COALESCE(it."user", 'مسؤول الإنتاج') as received_by,
          'production_receipt' as receipt_source,
          it.reference as production_order,
          it.items as cost_components
        FROM inventory_transactions it
        WHERE it.ingredient_id = $1 AND (it.transaction_number LIKE 'TXN-PRD-REC-%' OR it.reference_type = 'production_receipt')
        ORDER BY it.id DESC
        LIMIT 20
      `, [ingredientId]);
      prodReceiptsRows = prodRecRes.rows;
    } catch (_) {}

    let valuationsRows: any[] = [];
    try {
      const valRes = await pool.query(`
        SELECT sv.*, w.name as warehouse_name
        FROM stock_valuation sv
        LEFT JOIN warehouses w ON w.id = sv.warehouse_id
        WHERE sv.ingredient_id = $1
        ORDER BY sv.id DESC
        LIMIT 20
      `, [ingredientId]);
      valuationsRows = valRes.rows;
    } catch (_) {}

    // 8. Recent Material Requests / Issues
    const issuesRes = await pool.query(`
      SELECT 
        mri.id,
        mri.request_id,
        mri.ingredient_id,
        mri.requested_qty,
        mri.issued_qty as issued_quantity,
        mri.uom,
        mr.request_no as request_number,
        mr.request_type,
        mr.department,
        mr.status as mr_status,
        COALESCE((SELECT username FROM users WHERE id = mr.requested_by), 'System') as requester_name,
        mr.created_at as issue_date
      FROM material_request_items mri
      JOIN material_requests mr ON mr.id = mri.request_id
      WHERE mri.ingredient_id = $1
      ORDER BY mr.id DESC
      LIMIT 20
    `, [ingredientId]);

    // 9. UOM Conversions
    const uomRes = await pool.query(`
      SELECT * FROM item_uom_conversions WHERE ingredient_id = $1 ORDER BY id ASC
    `, [ingredientId]);

    // 10. Audit Trail
    const auditRes = await pool.query(`
      SELECT * FROM inventory_audit_trail 
      WHERE (entity_type = 'item' AND entity_id = $1) OR details ILIKE $2
      ORDER BY id DESC LIMIT 50
    `, [ingredientId, `%${item.name}%`]);

    res.json({
      success: true,
      item,
      stocks: stockRes.rows,
      batches: batchesRes.rows,
      serials: serialsRes.rows,
      reservations: reservationsRes.rows,
      movements: movementsRes.rows,
      receipts: [...receiptsRes.rows, ...prodReceiptsRows],
      valuations: valuationsRows,
      issues: issuesRes.rows,
      uom_conversions: uomRes.rows,
      audit_logs: auditRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 12. UPDATE ITEM LOCATION IN WAREHOUSE
// ═══════════════════════════════════════════════════════════════

router.put("/api/inventory/update-location", async (req: Request, res: Response) => {
  try {
    const { inventory_item_id, location_id, user_name } = req.body;
    if (!inventory_item_id) {
      return res.status(400).json({ success: false, error: "معرف السجل مطلوب" });
    }

    const itemBefore = await pool.query(`SELECT * FROM inventory_items WHERE id = $1`, [inventory_item_id]);
    if (itemBefore.rows.length === 0) {
      return res.status(404).json({ success: false, error: "السجل غير موجود" });
    }

    await pool.query(`
      UPDATE inventory_items 
      SET location_id = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2
    `, [location_id || null, inventory_item_id]);

    // Record in audit log
    await pool.query(`
      INSERT INTO inventory_audit_trail (entity_type, entity_id, action, user_name, old_values, new_values, details)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      "warehouse_location",
      inventory_item_id,
      "update_location",
      user_name || "مدير النظام",
      JSON.stringify({ location_id: itemBefore.rows[0].location_id }),
      JSON.stringify({ location_id }),
      `تحديث موقع تخزين الصنف #${itemBefore.rows[0].ingredient_id} في المخزن #${itemBefore.rows[0].warehouse_id}`
    ]);

    res.json({ success: true, message: "تم تحديث موقع التخزين بنجاح" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// 13. ENTERPRISE WAREHOUSE TRANSFER MANAGEMENT SYSTEM
// ═══════════════════════════════════════════════════════════════

// Centralized inventory engine adapter. All transfer stock changes use the same
// locking, negative-stock validation and movement ledger rules.
async function applyTransferStockMovement(client: any, opts: any) {
  return moveStock(client, opts);
}

// 1. List transfers with filtering, tabs, stats and pagination
router.get("/api/enterprise/warehouse-transfers", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "25",
      tab = "all",
      search = "",
      from_warehouse_id = "all",
      to_warehouse_id = "all",
      type = "all",
      priority = "all",
      date_from = "",
      date_to = ""
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 25));
    const offset = (pageNum - 1) * limitNum;

    // 1. Compute Stats (for header counters)
    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status IN ('draft', 'requested', 'pending') THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN status IN ('approved', 'picking') THEN 1 END)::int AS approved_count,
        COUNT(CASE WHEN status IN ('in_transit', 'dispatched') THEN 1 END)::int AS in_transit_count,
        COUNT(CASE WHEN status IN ('receiving', 'qc_inspection', 'received_partially') THEN 1 END)::int AS receiving_count,
        COUNT(CASE WHEN status IN ('received', 'completed') THEN 1 END)::int AS completed_count,
        COUNT(CASE WHEN status IN ('cancelled', 'rejected') THEN 1 END)::int AS cancelled_count
      FROM warehouse_transfers
    `);

    const stats = statsRes.rows[0] || {
      total: 0,
      pending_count: 0,
      approved_count: 0,
      in_transit_count: 0,
      receiving_count: 0,
      completed_count: 0,
      cancelled_count: 0
    };

    // 2. Build filtered query
    let whereClauses: string[] = ["1=1"];
    let params: any[] = [];

    // Tab filter
    if (tab === "pending") {
      whereClauses.push("t.status IN ('draft', 'requested', 'pending')");
    } else if (tab === "approved") {
      whereClauses.push("t.status IN ('approved', 'picking')");
    } else if (tab === "in_transit") {
      whereClauses.push("t.status IN ('in_transit', 'dispatched')");
    } else if (tab === "receiving") {
      whereClauses.push("t.status IN ('receiving', 'qc_inspection', 'received_partially')");
    } else if (tab === "completed") {
      whereClauses.push("t.status IN ('received', 'completed')");
    } else if (tab === "cancelled") {
      whereClauses.push("t.status IN ('cancelled', 'rejected')");
    }

    if (from_warehouse_id && from_warehouse_id !== "all") {
      params.push(Number(from_warehouse_id));
      whereClauses.push(`t.from_warehouse_id = $${params.length}`);
    }

    if (to_warehouse_id && to_warehouse_id !== "all") {
      params.push(Number(to_warehouse_id));
      whereClauses.push(`t.to_warehouse_id = $${params.length}`);
    }

    if (type && type !== "all") {
      params.push(String(type));
      whereClauses.push(`t.type = $${params.length}`);
    }

    if (priority && priority !== "all") {
      params.push(String(priority));
      whereClauses.push(`t.priority = $${params.length}`);
    }

    if (date_from) {
      params.push(String(date_from));
      whereClauses.push(`t.date >= $${params.length}`);
    }

    if (date_to) {
      params.push(String(date_to));
      whereClauses.push(`t.date <= $${params.length}`);
    }

    if (search && String(search).trim()) {
      params.push(`%${String(search).trim()}%`);
      const pIdx = params.length;
      whereClauses.push(`(t.transfer_number ILIKE $${pIdx} OR t.notes ILIKE $${pIdx} OR t.driver_name ILIKE $${pIdx} OR fw.name ILIKE $${pIdx} OR tw.name ILIKE $${pIdx})`);
    }

    const whereSql = whereClauses.join(" AND ");

    // Count total matching
    const countSql = `
      SELECT COUNT(*)::int as total FROM (
        SELECT t.*
        FROM warehouse_transfers t
        LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
        WHERE ${whereSql}
      ) sub
    `;
    const countRes = await pool.query(countSql, params);
    const totalCount = Number(countRes.rows[0]?.total || 0);

    // Fetch paginated rows
    const dataSql = `
      SELECT t.*,
        fw.name AS from_warehouse_name, fw.code AS from_warehouse_code,
        tw.name AS to_warehouse_name, tw.code AS to_warehouse_code
      FROM warehouse_transfers t
      LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
      WHERE ${whereSql}
      ORDER BY t.date DESC, t.id DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    const dataParams = [...params, limitNum, offset];
    const dataRes = await pool.query(dataSql, dataParams);

    const transfers = dataRes.rows.map((r: any) => {
      let parsedItems: any[] = [];
      if (r.items) {
        if (Array.isArray(r.items)) {
          parsedItems = r.items;
        } else if (typeof r.items === "string") {
          try {
            const p = JSON.parse(r.items);
            parsedItems = Array.isArray(p) ? p : [p];
          } catch {
            parsedItems = [];
          }
        } else if (typeof r.items === "object") {
          parsedItems = [r.items];
        }
      }

      let parsedHistory: any[] = [];
      if (r.status_history) {
        if (Array.isArray(r.status_history)) {
          parsedHistory = r.status_history;
        } else if (typeof r.status_history === "string") {
          try {
            const p = JSON.parse(r.status_history);
            parsedHistory = Array.isArray(p) ? p : [p];
          } catch {
            parsedHistory = [];
          }
        }
      }

      const itemsCount = parsedItems.length;
      const totalQty = parsedItems.reduce((s: number, it: any) => s + Number(it.requested_qty || it.quantity || 0), 0);
      const totalValue = parsedItems.reduce((s: number, it: any) => s + (Number(it.dispatched_qty || it.requested_qty || it.quantity || 0) * Number(it.unit_cost || it.price || 0)), 0);

      return {
        ...r,
        items: parsedItems,
        status_history: parsedHistory,
        items_count: itemsCount,
        total_qty: totalQty,
        total_value: totalValue
      };
    });

    res.json({
      success: true,
      transfers,
      stats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum) || 1
      }
    });
  } catch (err: any) {
    console.error("Error fetching warehouse transfers:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Get single transfer details by ID
router.get("/api/enterprise/warehouse-transfers/:id", async (req: Request, res: Response) => {
  try {
    const trfId = Number(req.params.id);
    const result = await pool.query(`
      SELECT t.*,
        fw.name AS from_warehouse_name, fw.code AS from_warehouse_code,
        tw.name AS to_warehouse_name, tw.code AS to_warehouse_code
      FROM warehouse_transfers t
      LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
      WHERE t.id = $1
    `, [trfId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "التحويل غير موجود" });
    }

    const r = result.rows[0];
    let parsedItems: any[] = [];
    if (r.items) {
      if (Array.isArray(r.items)) parsedItems = r.items;
      else if (typeof r.items === "string") {
        try { parsedItems = JSON.parse(r.items); } catch { parsedItems = []; }
      }
    }

    let parsedHistory: any[] = [];
    if (r.status_history) {
      if (Array.isArray(r.status_history)) parsedHistory = r.status_history;
      else if (typeof r.status_history === "string") {
        try { parsedHistory = JSON.parse(r.status_history); } catch { parsedHistory = []; }
      }
    }

    // Related inventory transactions
    let relatedTransactions: any[] = [];
    try {
      const txRes = await pool.query(`
        SELECT * FROM inventory_transactions
        WHERE reference = $1 OR reference = $2
        ORDER BY id DESC
      `, [r.transfer_number || "", String(r.id)]);
      relatedTransactions = txRes.rows;
    } catch {}

    const itemsCount = parsedItems.length;
    const totalQty = parsedItems.reduce((s: number, it: any) => s + Number(it.requested_qty || it.quantity || 0), 0);
    const totalValue = parsedItems.reduce((s: number, it: any) => s + (Number(it.dispatched_qty || it.requested_qty || it.quantity || 0) * Number(it.unit_cost || it.price || 0)), 0);

    res.json({
      success: true,
      transfer: {
        ...r,
        items: parsedItems,
        status_history: parsedHistory,
        items_count: itemsCount,
        total_qty: totalQty,
        total_value: totalValue,
        related_transactions: relatedTransactions
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Create new transfer (Draft or Requested)
router.post("/api/enterprise/warehouse-transfers", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const {
      transfer_number,
      date,
      from_warehouse_id,
      to_warehouse_id,
      type = "standard",
      priority = "normal",
      department,
      purpose,
      notes,
      items = [],
      user_name = "admin",
      status = "requested",
      auto_post = false
    } = req.body;

    if (!from_warehouse_id || !to_warehouse_id) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "يجب اختيار المخزن المصدر والمخزن الهدف" });
    }

    if (Number(from_warehouse_id) === Number(to_warehouse_id)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن التحويل لنفس المخزن" });
    }

    if (!items || items.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "يجب إضافة صنف واحد على الأقل للتحويل" });
    }

    // Generate automatic transfer number if not supplied
    let trfNo = transfer_number;
    if (!trfNo || !trfNo.trim()) {
      const year = new Date().getFullYear();
      const countRes = await client.query("SELECT COUNT(*)::int as c FROM warehouse_transfers");
      const nextNum = (countRes.rows[0]?.c || 0) + 1;
      trfNo = `TRF-${year}-${String(nextNum).padStart(4, "0")}`;
    }

    // Format & validate item lines
    const formattedItems = items.map((it: any) => ({
      ingredient_id: Number(it.ingredient_id || it.id),
      name: it.name || it.ingredient_name || "",
      code: it.code || it.ingredient_code || "",
      unit: it.unit || it.ingredient_unit || "قطعة",
      barcode: it.barcode || "",
      requested_qty: Number(it.requested_qty || it.quantity || 0),
      approved_qty: Number(it.approved_qty || it.requested_qty || it.quantity || 0),
      dispatched_qty: 0,
      received_qty: 0,
      damaged_qty: 0,
      variance_qty: 0,
      unit_cost: Number(it.unit_cost || it.avg_cost || it.price || 0),
      batch_number: it.batch_number || "",
      expiry_date: it.expiry_date || null,
      serial_number: it.serial_number || "",
      source_location_code: it.source_location_code || "",
      target_location_code: it.target_location_code || "",
      notes: it.notes || ""
    }));

    // Initial status history event
    const statusHistory = [
      {
        status: status,
        action: status === "draft" ? "إنشاء مسودة تحويل" : "تقديم طلب تحويل مخزني",
        user: user_name,
        timestamp: new Date().toISOString(),
        notes: notes || "تم إنشاء الطلب بنجاح"
      }
    ];

    const result = await client.query(`
      INSERT INTO warehouse_transfers (
        transfer_number, transfer_no, date, from_warehouse_id, to_warehouse_id,
        type, priority, department, purpose, status, "user", notes,
        items, status_history, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
      RETURNING id
    `, [
      trfNo,
      trfNo,
      date || new Date().toISOString().split("T")[0],
      Number(from_warehouse_id),
      Number(to_warehouse_id),
      type,
      priority,
      department || null,
      purpose || null,
      status,
      user_name,
      notes || "",
      JSON.stringify(formattedItems),
      JSON.stringify(statusHistory)
    ]);

    const trfId = result.rows[0].id;

    // One-click approved transfer: validate source stock and post the goods
    // directly into the destination warehouse atomically. The normal
    // request -> approve -> dispatch -> receive workflow remains unchanged
    // when auto_post is false.
    if (Boolean(auto_post) && status === "approved") {
      // Aggregate requested quantities by item to prevent a duplicated line
      // from bypassing the source-stock validation.
      const requiredByIngredient = new Map<number, number>();
      for (const item of formattedItems) {
        const ingredientId = Number(item.ingredient_id);
        const qty = Number(item.requested_qty || 0);
        if (!ingredientId || qty <= 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, error: "بيانات الصنف أو الكمية غير صحيحة" });
        }
        requiredByIngredient.set(ingredientId, (requiredByIngredient.get(ingredientId) || 0) + qty);
      }

      for (const [ingredientId, requiredQty] of requiredByIngredient.entries()) {
        const stockRes = await client.query(
          `SELECT quantity, reserved FROM inventory_items
           WHERE warehouse_id=$1 AND ingredient_id=$2
           FOR UPDATE`,
          [Number(from_warehouse_id), ingredientId]
        );
        const row = stockRes.rows[0];
        const rawQty = Number(row?.quantity ?? 0);
        const rawRes = Number(row?.reserved ?? 0);
        // Always derive available from quantity - reserved (never trust stale available column)
        const available = Math.max(0, rawQty - rawRes);
        if (!stockRes.rows.length || available < requiredQty) {
          await client.query("ROLLBACK");
          const ingredientRes = await client.query(`SELECT name FROM ingredients WHERE id=$1`, [ingredientId]);
          const ingredientName = ingredientRes.rows[0]?.name || `#${ingredientId}`;
          return res.status(400).json({
            success: false,
            error: `الرصيد غير كافٍ للصنف "${ingredientName}". المتاح: ${available}، المطلوب: ${requiredQty}`
          });
        }
      }

      // Move each item's aggregate quantity once. The stock ledger is idempotent
      // per transfer/warehouse/ingredient, so moving duplicate lines separately
      // would cause later lines for the same ingredient to be treated as replays.
      for (const [ingredientId, qty] of requiredByIngredient.entries()) {
        await applyTransferStockMovement(client, {
          warehouse_id: Number(from_warehouse_id),
          ingredient_id: ingredientId,
          delta: -qty,
          field: "quantity",
          ref_type: "transfer",
          ref_id: trfId,
          user: user_name,
          notes: `ترحيل تحويل مخزني معتمد رقم ${trfNo} إلى مخزن #${to_warehouse_id}`
        });

        await applyTransferStockMovement(client, {
          warehouse_id: Number(to_warehouse_id),
          ingredient_id: ingredientId,
          delta: qty,
          field: "quantity",
          ref_type: "transfer",
          ref_id: trfId,
          user: user_name,
          notes: `إيداع تحويل مخزني معتمد رقم ${trfNo} من مخزن #${from_warehouse_id}`
        });
      }

      const postedItems = formattedItems.map((item: any) => ({
        ...item,
        approved_qty: Number(item.requested_qty || 0),
        dispatched_qty: Number(item.requested_qty || 0),
        received_qty: Number(item.requested_qty || 0),
        variance_qty: 0
      }));

      statusHistory.push({
        status: "completed",
        action: "اعتماد وترحيل التحويل وإيداع الأصناف بالمخزن المستهدف",
        user: user_name,
        timestamp: new Date().toISOString(),
        notes: notes || "تم ترحيل الأصناف بنجاح من المصدر إلى المخزن المستهدف"
      });

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
        user_name,
        req.body.driver_name || null,
        req.body.vehicle_no || null,
        Number(req.body.shipping_cost || 0),
        JSON.stringify(postedItems),
        JSON.stringify(statusHistory),
        trfId
      ]);

      try {
        const txNumber = `TX-TRF-POST-${trfNo}`;
        const ledgerItems = JSON.stringify(postedItems.map((i: any) => ({
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
          Number(from_warehouse_id),
          `ترحيل تحويل إلى مخزن #${to_warehouse_id}`,
          trfNo,
          user_name,
          `تحويل مخزني معتمد ومُرحّل إلى المخزن #${to_warehouse_id}`,
          ledgerItems
        ]);
        await client.query(`
          INSERT INTO inventory_transactions
            (transaction_number, date, warehouse_id, type, reason, reference, "user", status, notes, items)
          VALUES ($1, CURRENT_DATE, $2, 'transfer', $3, $4, $5, 'approved', $6, $7)
        `, [
          `TX-TRF-POST-IN-${trfNo}`,
          Number(to_warehouse_id),
          `استلام تحويل من مخزن #${from_warehouse_id}`,
          trfNo,
          user_name,
          `إيداع تحويل مخزني معتمد من المخزن #${from_warehouse_id}`,
          ledgerItems
        ]);
      } catch (ledgerErr) {
        console.error("Transfer direct-post ledger error:", ledgerErr);
      }

      await logAudit(client, {
        entity_type: "warehouse_transfer",
        entity_id: trfId,
        action: "approve_and_post",
        user_name,
        details: `اعتماد وترحيل التحويل رقم ${trfNo} من مخزن #${from_warehouse_id} إلى #${to_warehouse_id}`,
        after_data: { status: "completed", items_count: postedItems.length }
      });

      await client.query("COMMIT");
      return res.json({ success: true, id: trfId, transfer_number: trfNo, status: "completed", posted: true, message: "تم اعتماد التحويل وترحيل الأصناف إلى المخزن المستهدف بنجاح" });
    }

    // Log audit trail
    await logAudit(client, {
      entity_type: "warehouse_transfer",
      entity_id: trfId,
      action: "create",
      user_name,
      details: `إنشاء تحويل مخزني رقم ${trfNo} من مخزن #${from_warehouse_id} إلى #${to_warehouse_id}`,
      after_data: { id: trfId, transfer_number: trfNo, items_count: formattedItems.length }
    });

    await client.query("COMMIT");
    res.json({ success: true, id: trfId, transfer_number: trfNo });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 4. Approve / Reject Transfer
router.put("/api/enterprise/warehouse-transfers/:id/approve", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trfId = Number(req.params.id);
    const { user_name = "admin", notes = "", items = [] } = req.body;

    const trfRes = await client.query("SELECT * FROM warehouse_transfers WHERE id = $1 FOR UPDATE", [trfId]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "التحويل غير موجود" });
    }

    const trf = trfRes.rows[0];
    if (!["requested", "pending", "draft"].includes(String(trf.status))) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: `لا يمكن اعتماد تحويل بحالة (${trf.status})` });
    }
    let currentItems = typeof trf.items === "string" ? JSON.parse(trf.items) : (trf.items || []);

    // If approver adjusted quantities
    if (items && items.length > 0) {
      currentItems = currentItems.map((orig: any) => {
        const matching = items.find((it: any) => Number(it.ingredient_id) === Number(orig.ingredient_id));
        if (matching) {
          return {
            ...orig,
            approved_qty: Number(matching.approved_qty !== undefined ? matching.approved_qty : orig.requested_qty),
            notes: matching.notes || orig.notes || ""
          };
        }
        return orig;
      });
    } else {
      currentItems = currentItems.map((orig: any) => ({
        ...orig,
        approved_qty: Number(orig.approved_qty || orig.requested_qty || orig.quantity || 0)
      }));
    }

    let statusHistory: any[] = [];
    try {
      statusHistory = typeof trf.status_history === "string" ? JSON.parse(trf.status_history) : (trf.status_history || []);
    } catch {
      statusHistory = [];
    }

    statusHistory.push({
      status: "approved",
      action: "اعتماد طلب التحويل وتجهيزه للصرف",
      user: user_name,
      timestamp: new Date().toISOString(),
      notes: notes || "تم اعتماد التحويل بنجاح"
    });

    await client.query(`
      UPDATE warehouse_transfers
      SET status = 'approved',
          approved_at = NOW(),
          approved_by = $1,
          items = $2,
          status_history = $3,
          updated_at = NOW()
      WHERE id = $4
    `, [user_name, JSON.stringify(currentItems), JSON.stringify(statusHistory), trfId]);

    await logAudit(client, {
      entity_type: "warehouse_transfer",
      entity_id: trfId,
      action: "approve",
      user_name,
      details: `اعتماد التحويل المخزني رقم ${trf.transfer_number || trfId}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم اعتماد التحويل بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

router.put("/api/enterprise/warehouse-transfers/:id/reject", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trfId = Number(req.params.id);
    const { user_name = "admin", reason = "" } = req.body;

    const trfRes = await client.query("SELECT * FROM warehouse_transfers WHERE id = $1", [trfId]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "التحويل غير موجود" });
    }

    const trf = trfRes.rows[0];
    let statusHistory: any[] = [];
    try {
      statusHistory = typeof trf.status_history === "string" ? JSON.parse(trf.status_history) : (trf.status_history || []);
    } catch {
      statusHistory = [];
    }

    statusHistory.push({
      status: "rejected",
      action: "رفض طلب التحويل",
      user: user_name,
      timestamp: new Date().toISOString(),
      notes: reason || "تم رفض التحويل من قبل الإدارة"
    });

    await client.query(`
      UPDATE warehouse_transfers
      SET status = 'rejected',
          rejected_at = NOW(),
          rejected_by = $1,
          rejected_reason = $2,
          status_history = $3,
          updated_at = NOW()
      WHERE id = $4
    `, [user_name, reason, JSON.stringify(statusHistory), trfId]);

    await logAudit(client, {
      entity_type: "warehouse_transfer",
      entity_id: trfId,
      action: "reject",
      user_name,
      details: `رفض التحويل المخزني رقم ${trf.transfer_number || trfId} للسبب: ${reason}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم رفض التحويل" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 5. Picking & Dispatch (Deduct from Source, Add to Destination In-Transit, write Stock Ledger)
router.put("/api/enterprise/warehouse-transfers/:id/dispatch", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trfId = Number(req.params.id);
    const {
      user_name = "admin",
      driver_name,
      driver_phone,
      vehicle_no,
      waybill_no,
      shipping_cost = 0,
      notes = "",
      items = []
    } = req.body;

    const trfRes = await client.query("SELECT * FROM warehouse_transfers WHERE id = $1 FOR UPDATE", [trfId]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "التحويل غير موجود" });
    }

    const trf = trfRes.rows[0];
    if (["in_transit", "dispatched", "completed", "received", "cancelled"].includes(trf.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: `لا يمكن صرف تحويل بحالة (${trf.status})` });
    }

    let currentItems = typeof trf.items === "string" ? JSON.parse(trf.items) : (trf.items || []);

    // Merge dispatched quantities
    if (items && items.length > 0) {
      currentItems = currentItems.map((orig: any) => {
        const matching = items.find((it: any) => Number(it.ingredient_id) === Number(orig.ingredient_id));
        const dispatchedQty = matching ? Number(matching.dispatched_qty || matching.quantity || orig.approved_qty || orig.requested_qty) : Number(orig.approved_qty || orig.requested_qty || orig.quantity);
        return {
          ...orig,
          dispatched_qty: dispatchedQty,
          batch_number: matching?.batch_number || orig.batch_number || "",
          expiry_date: matching?.expiry_date || orig.expiry_date || null,
          serial_number: matching?.serial_number || orig.serial_number || "",
          source_location_code: matching?.source_location_code || orig.source_location_code || ""
        };
      });
    } else {
      currentItems = currentItems.map((orig: any) => ({
        ...orig,
        dispatched_qty: Number(orig.dispatched_qty || orig.approved_qty || orig.requested_qty || orig.quantity || 0)
      }));
    }

    // Apply Stock Movements:
    // 1. Deduct actual quantity from Source Warehouse
    // 2. Increase 'in_transit' quantity in Destination Warehouse
    for (const item of currentItems) {
      const qty = Number(item.dispatched_qty || 0);
      if (qty > 0) {
        // Out of Source Warehouse
        await applyTransferStockMovement(client, {
          warehouse_id: Number(trf.from_warehouse_id),
          ingredient_id: Number(item.ingredient_id),
          delta: -qty,
          field: "quantity",
          ref_type: "transfer",
          ref_id: trfId,
          user: user_name,
          notes: `صرف تحويل صادر رقم ${trf.transfer_number || trfId} إلى مخزن #${trf.to_warehouse_id}`
        });

        // Into Destination Warehouse as In-Transit
        await applyTransferStockMovement(client, {
          warehouse_id: Number(trf.to_warehouse_id),
          ingredient_id: Number(item.ingredient_id),
          delta: qty,
          field: "in_transit",
          ref_type: "transfer",
          ref_id: trfId,
          user: user_name,
          notes: `تحويل وارد قيد النقل رقم ${trf.transfer_number || trfId} من مخزن #${trf.from_warehouse_id}`
        });
      }
    }

    // Record Stock Ledger Transaction for Outgoing Transfer
    try {
      const txNumber = `TX-TRF-OUT-${trf.transfer_number || trfId}`;
      await client.query(`
        INSERT INTO inventory_transactions (
          transaction_number, date, warehouse_id, type, reason, reference, "user", status, notes, items
        ) VALUES ($1, CURRENT_DATE, $2, 'transfer', $3, $4, $5, 'approved', $6, $7)
      `, [
        txNumber,
        trf.from_warehouse_id,
        `صرف تحويل إلى مخزن #${trf.to_warehouse_id}`,
        trf.transfer_number || String(trfId),
        user_name,
        notes || `سائق: ${driver_name || "—"} | شاحنة: ${vehicle_no || "—"}`,
        JSON.stringify(currentItems.map((i: any) => ({
          ingredient_id: i.ingredient_id,
          name: i.name,
          quantity: i.dispatched_qty,
          unit: i.unit,
          price: i.unit_cost || 0
        })))
      ]);
    } catch (txErr) {
      console.error("Tx ledger write error:", txErr);
    }

    let statusHistory: any[] = [];
    try {
      statusHistory = typeof trf.status_history === "string" ? JSON.parse(trf.status_history) : (trf.status_history || []);
    } catch {
      statusHistory = [];
    }

    statusHistory.push({
      status: "in_transit",
      action: "صرف وشحن البضاعة وبدء النقل",
      user: user_name,
      timestamp: new Date().toISOString(),
      notes: notes || `تم الشحن مع السائق: ${driver_name || "—"} | رقم البوليسة: ${waybill_no || "—"}`
    });

    await client.query(`
      UPDATE warehouse_transfers
      SET status = 'in_transit',
          dispatched_at = NOW(),
          dispatched_by = $1,
          dispatch_date = NOW(),
          driver_name = $2,
          driver_phone = $3,
          vehicle_no = $4,
          waybill_no = $5,
          shipping_cost = $6,
          items = $7,
          status_history = $8,
          updated_at = NOW()
      WHERE id = $9
    `, [
      user_name,
      driver_name || null,
      driver_phone || null,
      vehicle_no || null,
      waybill_no || null,
      Number(shipping_cost || 0),
      JSON.stringify(currentItems),
      JSON.stringify(statusHistory),
      trfId
    ]);

    await logAudit(client, {
      entity_type: "warehouse_transfer",
      entity_id: trfId,
      action: "dispatch",
      user_name,
      details: `صرف وشحن التحويل رقم ${trf.transfer_number || trfId} (قيد النقل)`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم صرف التحويل وأصبح قيد النقل بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 6. Receive, QC Inspection & Put-Away (Clear in_transit, Add accepted to destination quantity, record damage/variance)
router.put("/api/enterprise/warehouse-transfers/:id/receive", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trfId = Number(req.params.id);
    const {
      user_name = "admin",
      received_items = [],
      qc_status = "passed",
      qc_notes = "",
      notes = ""
    } = req.body;

    const trfRes = await client.query("SELECT * FROM warehouse_transfers WHERE id = $1 FOR UPDATE", [trfId]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "التحويل غير موجود" });
    }

    const trf = trfRes.rows[0];
    if (trf.status === "completed" || trf.status === "received" || trf.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: `التحويل بالفعل بحالة (${trf.status})` });
    }

    let currentItems = typeof trf.items === "string" ? JSON.parse(trf.items) : (trf.items || []);

    // Merge receiving details
    const updatedItems = currentItems.map((orig: any) => {
      const match = (received_items || []).find((it: any) => Number(it.ingredient_id) === Number(orig.ingredient_id));
      const dispatchedQty = Number(orig.dispatched_qty || orig.approved_qty || orig.requested_qty || orig.quantity || 0);
      const receivedQty = match ? Number(match.received_qty !== undefined ? match.received_qty : dispatchedQty) : dispatchedQty;
      const damagedQty = match ? Number(match.damaged_qty || 0) : 0;
      const varianceQty = Number((dispatchedQty - receivedQty - damagedQty).toFixed(3));

      return {
        ...orig,
        dispatched_qty: dispatchedQty,
        received_qty: receivedQty,
        damaged_qty: damagedQty,
        variance_qty: varianceQty,
        target_location_code: match?.target_location_code || orig.target_location_code || "",
        qc_item_status: match?.qc_item_status || (damagedQty > 0 ? "damaged" : varianceQty !== 0 ? "variance" : "passed"),
        notes: match?.notes || orig.notes || ""
      };
    });

    // Apply Stock movements:
    // 1. Deduct in_transit from Destination Warehouse (equal to dispatched_qty)
    // 2. Add accepted received_qty into actual quantity of Destination Warehouse
    // 3. If direct receipt (without prior in_transit status, e.g. from draft/approved directly), also deduct from source
    const wasInTransit = trf.status === "in_transit" || trf.status === "dispatched";

    for (const item of updatedItems) {
      const dispatchedQty = Number(item.dispatched_qty || 0);
      const receivedQty = Number(item.received_qty || 0);

      if (wasInTransit) {
        // Clear in_transit
        if (dispatchedQty > 0) {
          await applyTransferStockMovement(client, {
            warehouse_id: Number(trf.to_warehouse_id),
            ingredient_id: Number(item.ingredient_id),
            delta: -dispatchedQty,
            field: "in_transit",
            ref_type: "transfer",
            ref_id: trfId,
            user: user_name,
            notes: `استلام تحويل وارد - إخلاء قيد النقل رقم ${trf.transfer_number || trfId}`
          });
        }
        // Add accepted quantity
        if (receivedQty > 0) {
          await applyTransferStockMovement(client, {
            warehouse_id: Number(trf.to_warehouse_id),
            ingredient_id: Number(item.ingredient_id),
            delta: receivedQty,
            field: "quantity",
            ref_type: "transfer",
            ref_id: trfId,
            user: user_name,
            notes: `استلام تحويل وارد رقم ${trf.transfer_number || trfId} من مخزن #${trf.from_warehouse_id}`
          });
        }
      } else {
        // Direct receipt: deduct from source and add accepted to destination
        if (dispatchedQty > 0) {
          await applyTransferStockMovement(client, {
            warehouse_id: Number(trf.from_warehouse_id),
            ingredient_id: Number(item.ingredient_id),
            delta: -dispatchedQty,
            field: "quantity",
            ref_type: "transfer",
            ref_id: trfId,
            user: user_name,
            notes: `تحويل صادر مباشر رقم ${trf.transfer_number || trfId}`
          });
        }
        if (receivedQty > 0) {
          await applyTransferStockMovement(client, {
            warehouse_id: Number(trf.to_warehouse_id),
            ingredient_id: Number(item.ingredient_id),
            delta: receivedQty,
            field: "quantity",
            ref_type: "transfer",
            ref_id: trfId,
            user: user_name,
            notes: `تحويل وارد مباشر رقم ${trf.transfer_number || trfId}`
          });
        }
      }

      // Handle batches if batch tracking is active
      if (item.batch_number && receivedQty > 0) {
        try {
          await client.query(`
            INSERT INTO stock_batches (
              ingredient_id, warehouse_id, batch_number, received_date, expiry_date,
              quantity, original_quantity, cost, status
            ) VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $5, $6, 'active')
          `, [
            item.ingredient_id,
            trf.to_warehouse_id,
            item.batch_number,
            item.expiry_date || null,
            receivedQty,
            Number(item.unit_cost || 0)
          ]);
        } catch (bErr) {
          // Batch table write fallback
        }
      }
    }

    // Record Stock Ledger Transaction for Incoming Receipt
    try {
      const txNumber = `TX-TRF-IN-${trf.transfer_number || trfId}`;
      await client.query(`
        INSERT INTO inventory_transactions (
          transaction_number, date, warehouse_id, type, reason, reference, "user", status, notes, items
        ) VALUES ($1, CURRENT_DATE, $2, 'transfer', $3, $4, $5, 'approved', $6, $7)
      `, [
        txNumber,
        trf.to_warehouse_id,
        `استلام تحويل من مخزن #${trf.from_warehouse_id}`,
        trf.transfer_number || String(trfId),
        user_name,
        notes || `فحص الجودة: ${qc_status} | ${qc_notes || ""}`,
        JSON.stringify(updatedItems.map((i: any) => ({
          ingredient_id: i.ingredient_id,
          name: i.name,
          quantity: i.received_qty,
          unit: i.unit,
          price: i.unit_cost || 0
        })))
      ]);
    } catch (txErr) {
      console.error("Tx ledger write error:", txErr);
    }

    let statusHistory: any[] = [];
    try {
      statusHistory = typeof trf.status_history === "string" ? JSON.parse(trf.status_history) : (trf.status_history || []);
    } catch {
      statusHistory = [];
    }

    statusHistory.push({
      status: "completed",
      action: "استلام وفحص الجودة وإيداع الأصناف في الرفوف",
      user: user_name,
      timestamp: new Date().toISOString(),
      notes: notes || `تم فحص الجودة (${qc_status}) واستلام الأصناف بنجاح`
    });

    await client.query(`
      UPDATE warehouse_transfers
      SET status = 'completed',
          received_at = NOW(),
          received_date = NOW(),
          received_by = $1,
          qc_status = $2,
          qc_notes = $3,
          items = $4,
          status_history = $5,
          updated_at = NOW()
      WHERE id = $6
    `, [
      user_name,
      qc_status,
      qc_notes || null,
      JSON.stringify(updatedItems),
      JSON.stringify(statusHistory),
      trfId
    ]);

    await logAudit(client, {
      entity_type: "warehouse_transfer",
      entity_id: trfId,
      action: "receive_and_complete",
      user_name,
      details: `استلام وفحص التحويل رقم ${trf.transfer_number || trfId} واكتماله بنجاح`
    });

    await client.query("COMMIT");

    // Accounting and Cost Integration
    try {
      await postWarehouseTransferEntry({
        id: trfId,
        transfer_number: trf.transfer_number,
        shipping_cost: Number(trf.shipping_cost || 0),
        from_warehouse_id: trf.from_warehouse_id,
        to_warehouse_id: trf.to_warehouse_id,
      });
    } catch (glErr: any) {
      console.warn("[GL Integration] Transfer posting note:", glErr.message);
    }

    try {
      await recordWarehouseTransferCost(trfId);
    } catch (cstErr: any) {
      console.warn("[Cost Integration] Transfer cost note:", cstErr.message);
    }

    try {
      ERPEventBus.getInstance().emitEvent("WarehouseTransferCompleted", {
        id: trfId,
        transfer_number: trf.transfer_number,
        from_warehouse_id: trf.from_warehouse_id,
        to_warehouse_id: trf.to_warehouse_id,
        shipping_cost: Number(trf.shipping_cost || 0),
        status: "completed"
      });
    } catch (_) {}

    res.json({ success: true, message: "تم استلام التحويل وإيداع المخزون بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 7. Cancel Transfer (Safe Stock Reversal)
router.put("/api/enterprise/warehouse-transfers/:id/cancel", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trfId = Number(req.params.id);
    const { user_name = "admin", reason = "" } = req.body;

    const trfRes = await client.query("SELECT * FROM warehouse_transfers WHERE id = $1 FOR UPDATE", [trfId]);
    if (trfRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "التحويل غير موجود" });
    }

    const trf = trfRes.rows[0];
    if (trf.status === "completed" || trf.status === "received") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن إلغاء تحويل تم استلامه واكتماله؛ يرجى عمل تحويل عكسي" });
    }

    const items = typeof trf.items === "string" ? JSON.parse(trf.items) : (trf.items || []);

    // If it was in_transit: restore stock to Source Warehouse and clear in_transit from Destination
    if (trf.status === "in_transit" || trf.status === "dispatched") {
      for (const item of items) {
        const qty = Number(item.dispatched_qty || item.approved_qty || item.requested_qty || item.quantity || 0);
        if (qty > 0) {
          // Restore to source
          await applyTransferStockMovement(client, {
            warehouse_id: Number(trf.from_warehouse_id),
            ingredient_id: Number(item.ingredient_id),
            delta: qty,
            field: "quantity",
            ref_type: "transfer_cancel",
            ref_id: trfId,
            user: user_name,
            notes: `عكس تحويل ملغي رقم ${trf.transfer_number || trfId}`
          });
          // Remove from in_transit
          await applyTransferStockMovement(client, {
            warehouse_id: Number(trf.to_warehouse_id),
            ingredient_id: Number(item.ingredient_id),
            delta: -qty,
            field: "in_transit",
            ref_type: "transfer_cancel",
            ref_id: trfId,
            user: user_name,
            notes: `إلغاء قيد النقل للتحويل رقم ${trf.transfer_number || trfId}`
          });
        }
      }
    }

    let statusHistory: any[] = [];
    try {
      statusHistory = typeof trf.status_history === "string" ? JSON.parse(trf.status_history) : (trf.status_history || []);
    } catch {
      statusHistory = [];
    }

    statusHistory.push({
      status: "cancelled",
      action: "إلغاء التحويل المخزني وعكس الحركات",
      user: user_name,
      timestamp: new Date().toISOString(),
      notes: reason || "تم إلغاء التحويل"
    });

    await client.query(`
      UPDATE warehouse_transfers
      SET status = 'cancelled',
          notes = CONCAT(COALESCE(notes, ''), ' | سبب الإلغاء: ', $1::text),
          status_history = $2,
          updated_at = NOW()
      WHERE id = $3
    `, [reason || "إلغاء من قبل المستخدم", JSON.stringify(statusHistory), trfId]);

    await logAudit(client, {
      entity_type: "warehouse_transfer",
      entity_id: trfId,
      action: "cancel",
      user_name,
      details: `إلغاء التحويل رقم ${trf.transfer_number || trfId} للسبب: ${reason}`
    });

    await client.query("COMMIT");
    res.json({ success: true, message: "تم إلغاء التحويل وعكس الأرصدة بنجاح" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

// 8. Live Stock & Batches for a specific source warehouse
router.get("/api/enterprise/warehouse-transfers/source-stock/:warehouse_id", async (req: Request, res: Response) => {
  try {
    const whId = Number(req.params.warehouse_id);
    const result = await pool.query(`
      SELECT
        inv.id as inventory_item_id,
        inv.ingredient_id,
        ing.name as ingredient_name,
        ing.code as ingredient_code,
        ing.unit as ingredient_unit,
        ing.barcode as ingredient_barcode,
        ing.category as ingredient_category,
        ing.avg_cost,
        ing.last_purchase_price,
        inv.quantity,
        inv.reserved,
        GREATEST(COALESCE(inv.quantity,0) - COALESCE(inv.reserved,0), 0) AS available,
        inv.in_transit
      FROM inventory_items inv
      JOIN ingredients ing ON ing.id = inv.ingredient_id
      WHERE inv.warehouse_id = $1 AND inv.quantity > 0
      ORDER BY ing.name ASC
    `, [whId]);

    res.json({ success: true, items: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
