import { Router } from "express";
import { pool } from "../../server-db.js";
import { ERPEventBus } from "../../server-erp-core.js";
import { initWarehouseEventHandlers } from "./warehouse_event_handlers.js";
import enterpriseInventoryRoutes from "./routes/enterprise_inventory.routes.js";
import materialRequestsRoutes from "./routes/material_requests.routes.js";
import { moveStock } from "./services/inventory.service.js";

// Initialize event handlers (Sales/Purchases/Production/Accouting integration)
initWarehouseEventHandlers();

const router = Router();
// Material requests own their paths and must be mounted before the broad
// enterprise inventory router (which also registers a catch-all /api prefix).
router.use(materialRequestsRoutes);
router.use(enterpriseInventoryRoutes);

// Multi-level approval thresholds
const APPROVAL_THRESHOLDS = {
  LEVEL_1: 5000,    // Single approval below 5,000
  LEVEL_2: 50000,   // Two approvals for amounts 5,000–50,000
  // Above 50,000 requires three approvals (auto-flagged)
};

// ─────────────────────────────────────────────────────────────
// HELPER: Stock Movement Engine
// Updates inventory_items + logs to inventory_movements (audit trail)
// Emits 'InventoryAdjusted' event for accounting auto-posting
// ─────────────────────────────────────────────────────────────
export async function applyStockMovement(client: any, opts: any) {
  return moveStock(client, opts);
}

// ─────────────────────────────────────────────────────────────
// HELPER: Auto-create notification when stock is low
// ─────────────────────────────────────────────────────────────
async function checkLowStockNotification(warehouse_id: number, ingredient_id: number) {
  try {
    const inv = (await pool.query("SELECT quantity FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2", [warehouse_id, ingredient_id])).rows[0];
    if (!inv) return;
    const ing = (await pool.query("SELECT name, min_stock FROM ingredients WHERE id=$1", [ingredient_id])).rows[0];
    if (!ing || !ing.min_stock || Number(ing.min_stock) <= 0) return;
    if (Number(inv.quantity) <= Number(ing.min_stock)) {
      // Check existing unread notification
      const existing = (await pool.query(
        "SELECT id FROM inventory_notifications WHERE ingredient_id=$1 AND warehouse_id=$2 AND type='low_stock' AND read=false",
        [ingredient_id, warehouse_id]
      )).rows;
      if (existing.length === 0) {
        await pool.query(
          `INSERT INTO inventory_notifications (type, ingredient_id, warehouse_id, message, severity, read, created_at)
           VALUES ('low_stock', $1, $2, $3, 'warning', false, NOW())`,
          [ingredient_id, warehouse_id, `${ing.name} وصل للحد الأدنى (${inv.quantity}/${ing.min_stock})`]
        );
      }
    }
  } catch (e) { /* non-critical */ }
}

// ─────────────────────────────────────────────────────────────
// HELPER: Auto-create notification when batch is near expiry
// ─────────────────────────────────────────────────────────────
async function checkExpiryNotifications() {
  try {
    const today = new Date();
    const batches = (await pool.query("SELECT * FROM stock_batches WHERE status IN ('active','expiring_soon') AND quantity > 0")).rows;
    for (const b of batches) {
      if (!b.expiry_date) continue;
      const daysToExpiry = Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let severity = "";
      let status = "";
      if (daysToExpiry < 0) { severity = "critical"; status = "expired"; }
      else if (daysToExpiry <= 3) { severity = "critical"; status = "expiring_soon"; }
      else if (daysToExpiry <= 7) { severity = "warning"; status = "expiring_soon"; }
      else continue;
      // Update batch status
      await pool.query("UPDATE stock_batches SET status=$1 WHERE id=$2", [status, b.id]);
      // Check existing notification
      const existing = (await pool.query(
        "SELECT id FROM inventory_notifications WHERE batch_id=$1 AND type='expiry_warning' AND read=false",
        [b.id]
      )).rows;
      if (existing.length === 0) {
        const ing = (await pool.query("SELECT name FROM ingredients WHERE id=$1", [b.ingredient_id])).rows[0];
        const msg = daysToExpiry < 0
          ? `${ing?.name || "صنف"} (تشغيلة ${b.batch_number}) انتهت صلاحيته منذ ${Math.abs(daysToExpiry)} يوم`
          : `${ing?.name || "صنف"} (تشغيلة ${b.batch_number}) ينتهي خلال ${daysToExpiry} يوم`;
        await pool.query(
          `INSERT INTO inventory_notifications (type, ingredient_id, warehouse_id, batch_id, message, severity, read, created_at)
           VALUES ('expiry_warning', $1, $2, $3, $4, $5, false, NOW())`,
          [b.ingredient_id, b.warehouse_id, b.id, msg, severity]
        );
      }
    }
  } catch (e) { /* non-critical */ }
}

// ─────────────────────────────────────────────────────────────
// WAREHOUSES CRUD & MODULE LINKAGES
// ─────────────────────────────────────────────────────────────
const getWarehousesHandler = async (req: any, res: any) => {
  try {
    const { module: moduleFilter } = req.query;

    // IMPORTANT: Keep the base warehouse query independent from optional
    // enterprise columns. Older databases may have the original warehouses
    // table before the later ALTER migrations were applied. The old query
    // referenced is_default/is_module_default/linked_module directly in SQL,
    // so a single missing column made GET /api/warehouses return 500 and the
    // UI silently displayed an empty list even though INSERT succeeded.
    const result = await pool.query(`SELECT * FROM warehouses ORDER BY id ASC`);
    let rows = Array.isArray(result.rows) ? result.rows : [];

    // Normalize optional fields in application code so both legacy and
    // enterprise warehouse schemas are supported.
    rows = rows.map((w: any) => ({
      ...w,
      status: w.status || "active",
      code: w.code || String(w.id),
      linked_module: w.linked_module || "general",
      linked_modules: w.linked_modules || "[]",
      is_default: w.is_default === true || Number(w.is_default) === 1,
      is_module_default: w.is_module_default === true || Number(w.is_module_default) === 1,
      auto_sync: w.auto_sync !== false,
      allow_negative: w.allow_negative === true || Number(w.allow_negative) === 1,
    }));

    // Apply module filtering after retrieval so missing optional DB columns
    // never break the warehouse list.
    if (moduleFilter && moduleFilter !== "all") {
      rows = rows.filter((w: any) => {
        if (w.linked_module === moduleFilter || w.linked_module === "all" || w.linked_module === "general") return true;
        try {
          const linked = Array.isArray(w.linked_modules)
            ? w.linked_modules
            : JSON.parse(String(w.linked_modules || "[]"));
          return Array.isArray(linked) && linked.includes(moduleFilter);
        } catch {
          return String(w.linked_modules || "").includes(String(moduleFilter));
        }
      });
    }

    // Enrich each warehouse with stock statistics without making the main
    // warehouse query depend on optional columns.
    try {
      const invResult = await pool.query(`
        SELECT i.warehouse_id, COUNT(*)::int AS item_count,
               COALESCE(SUM(i.quantity * COALESCE(ing.avg_cost, 0)), 0) AS stock_value
        FROM inventory_items i
        LEFT JOIN ingredients ing ON ing.id = i.ingredient_id
        GROUP BY i.warehouse_id
      `);
      const stats = new Map<number, any>(invResult.rows.map((r: any) => [Number(r.warehouse_id), r]));
      rows = rows.map((w: any) => ({
        ...w,
        item_count: Number(stats.get(Number(w.id))?.item_count || 0),
        stock_value: Number(stats.get(Number(w.id))?.stock_value || 0),
      }));
    } catch (statsError: any) {
      // Warehouse records must remain visible even if an optional inventory
      // summary table/column is unavailable during a migration.
      console.warn("Warehouse stock summary skipped:", statsError?.message || statsError);
      rows = rows.map((w: any) => ({ ...w, item_count: 0, stock_value: 0 }));
    }

    rows.sort((a: any, b: any) => {
      const ad = a.is_default ? 1 : 0;
      const bd = b.is_default ? 1 : 0;
      if (ad !== bd) return bd - ad;
      const amd = a.is_module_default ? 1 : 0;
      const bmd = b.is_module_default ? 1 : 0;
      if (amd !== bmd) return bmd - amd;
      return Number(a.id) - Number(b.id);
    });

    res.json(rows);
  } catch (e: any) {
    console.error("GET /api/warehouses failed:", e);
    res.status(500).json({ error: e.message || "Failed to fetch warehouses" });
  }
};

router.get("/api/warehouses", getWarehousesHandler);
router.get("/api/inventory/warehouses", getWarehousesHandler);

/**
 * Next serial warehouse code (WH-001, WH-002, ...).
 * Continues whatever numeric sequence the table already uses, so legacy rows
 * with plain codes such as "1" are honoured instead of restarting from 1.
 */
async function generateWarehouseCode(): Promise<string> {
  const result = await pool.query(
    "SELECT code FROM warehouses WHERE code IS NOT NULL AND btrim(code) <> ''"
  );
  let last = 0;
  for (const row of result.rows) {
    const match = String(row.code).match(/(\d+)\s*$/);
    if (match) last = Math.max(last, Number(match[1]));
  }
  return `WH-${String(last + 1).padStart(3, "0")}`;
}

router.get("/api/warehouses/next-code", async (_req, res) => {
  try {
    res.json({ code: await generateWarehouseCode() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Get overview of all system modules and their linked warehouses
router.get("/api/warehouses/module-linkages", async (_req, res) => {
  try {
    const modulesDef = [
      { id: "hotels", name: "إدارة الفنادق والنزلاء", code: "HOTEL_PMS", icon: "Hotel", category: "Hospitality", desc: "ربط مستلزمات الغرف والبياضات وميني بار الفندق" },
      { id: "restaurants", name: "المطاعم والكافيهات", code: "REST_POS", icon: "Utensils", category: "F&B", desc: "ربط المواد الخام ومكونات الوجبات والمشروبات" },
      { id: "pos", name: "نقاط البيع والتجزئة", code: "RETAIL_POS", icon: "ShoppingCart", category: "Retail", desc: "ربط بضاعة البيع المباشر والسوبرماركت" },
      { id: "maintenance", name: "الصيانة والتشغيل", code: "MAINT_OPS", icon: "Wrench", category: "Operations", desc: "ربط قطع الغيار وأدوات الصيانة الدورية" },
      { id: "production", name: "التصنيع والإنتاج", code: "MFG_PROD", icon: "Factory", category: "Manufacturing", desc: "ربط خطوط الإنتاج والمواد الأولية والتعبئة" },
      { id: "laundry", name: "المغسلة والتنظيف", code: "LAUNDRY_OPS", icon: "Sparkles", category: "Services", desc: "ربط المنظفات ومستلزمات الغسيل والكي" },
      { id: "medical", name: "العيادات والخدمات الطبية", code: "CLINIC_MED", icon: "HeartPulse", category: "Healthcare", desc: "ربط المستلزمات الطبية والأدوية والمستهلكات" },
      { id: "hr", name: "الموارد البشرية والعهد", code: "HR_ASSETS", icon: "Users", category: "Administration", desc: "ربط عهد الموظفين والأجهزة والزي الموحد" },
      { id: "general", name: "المخزن العام المركزي", code: "CENTRAL_STORE", icon: "Warehouse", category: "Central", desc: "المخزن الرئيسي لجميع الأغراض المشتركة" }
    ];

    const whResult = await pool.query(`
      SELECT w.*,
        (SELECT COUNT(*) FROM inventory_items i WHERE i.warehouse_id = w.id) AS item_count,
        (SELECT COALESCE(SUM(i.quantity),0) FROM inventory_items i WHERE i.warehouse_id = w.id) AS total_quantity
      FROM warehouses w
      ORDER BY w.id
    `);

    const linkages = modulesDef.map(mod => {
      const linkedWhs = whResult.rows.filter((w: any) => 
        w.linked_module === mod.id || 
        (w.linked_modules && w.linked_modules.includes(mod.id)) ||
        w.linked_module === "all"
      );
      const defaultWh = linkedWhs.find((w: any) => w.is_module_default) || linkedWhs[0] || null;
      return {
        module: mod,
        linked_warehouses: linkedWhs,
        default_warehouse: defaultWh,
        warehouses_count: linkedWhs.length,
        total_items: linkedWhs.reduce((s: number, w: any) => s + Number(w.item_count || 0), 0),
        auto_sync: defaultWh ? defaultWh.auto_sync !== false : true
      };
    });

    res.json({ success: true, data: linkages, all_warehouses: whResult.rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Quick link / unlink warehouse to a module
router.post("/api/warehouses/link-module", async (req, res) => {
  try {
    const { warehouse_id, module_id, is_default, auto_sync } = req.body;
    if (!warehouse_id || !module_id) {
      return res.status(400).json({ error: "warehouse_id and module_id are required" });
    }

    if (is_default) {
      await pool.query(
        `UPDATE warehouses SET is_module_default = false WHERE linked_module = $1`,
        [module_id]
      );
    }

    await pool.query(
      `UPDATE warehouses 
       SET linked_module = $1, 
           is_module_default = COALESCE($2, is_module_default),
           auto_sync = COALESCE($3, auto_sync)
       WHERE id = $4`,
      [module_id, is_default ?? false, auto_sync ?? true, warehouse_id]
    );

    res.json({ success: true, message: "تم تحديث ربط المخزن بالمديول بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/warehouses", async (req, res) => {
  try {
    let { 
      name, code, type, branch_id, manager, address, status, 
      allow_negative, is_default, description,
      linked_module, linked_modules, is_module_default, auto_sync 
    } = req.body;

    code = typeof code === "string" ? code.trim() : "";

    // If is_default, unset other defaults
    if (is_default) {
      await pool.query("UPDATE warehouses SET is_default = false");
    }
    if (is_module_default && linked_module) {
      await pool.query("UPDATE warehouses SET is_module_default = false WHERE linked_module = $1", [linked_module]);
    }

    const insertWarehouse = async (warehouseCode: string) => {
      const result = await pool.query(
        `INSERT INTO warehouses (
          name, code, type, branch_id, manager, address, status, 
          allow_negative, is_default, description,
          linked_module, linked_modules, is_module_default, auto_sync
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [
          name, 
          warehouseCode, 
          type || "main", 
          branch_id || null, 
          manager || "", 
          address || "", 
          status || "active", 
          allow_negative || false, 
          is_default || false, 
          description || "",
          linked_module || "general",
          typeof linked_modules === "string" ? linked_modules : JSON.stringify(linked_modules || []),
          is_module_default || false,
          auto_sync !== false
        ]
      );
      return result.rows[0].id as number;
    };

    // An explicit code is respected; otherwise the next serial code is taken at
    // save time. warehouses.code has a unique index, so if a concurrent save
    // grabbed the same number we recompute and retry.
    let newWhId: number | null = null;
    let savedCode = code;
    for (let attempt = 0; attempt < 5 && newWhId === null; attempt++) {
      savedCode = code || await generateWarehouseCode();
      try {
        newWhId = await insertWarehouse(savedCode);
      } catch (err: any) {
        if (err?.code === "23505" && !code) continue;
        if (err?.code === "23505") {
          return res.status(409).json({ error: "كود المخزن مستخدم بالفعل" });
        }
        throw err;
      }
    }
    if (newWhId === null) {
      return res.status(409).json({ error: "تعذر توليد كود مخزن فريد، حاول مرة أخرى" });
    }
    try {
      const ings = await pool.query("SELECT id, avg_cost, cost, min_stock, max_stock FROM ingredients");
      for (const ing of ings.rows) {
        const cVal = Number(ing.avg_cost || ing.cost || 20);
        await pool.query(
          `INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, reserved, in_transit, available, avg_cost, last_cost, cost, min_quantity, max_quantity)
           VALUES ($1, $2, 0, 0, 0, 0, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [newWhId, ing.id, cVal, cVal, cVal, Number(ing.min_stock || 10), Number(ing.max_stock || 100)]
        );
      }
    } catch (errIng) {
      console.warn("Auto link inventory_items error:", errIng);
    }
    res.json({ id: newWhId, code: savedCode, success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/warehouses/:id", async (req, res) => {
  try {
    const { 
      name, code, type, branch_id, manager, address, status, 
      allow_negative, is_default, description,
      linked_module, linked_modules, is_module_default, auto_sync
    } = req.body;

    if (is_default) {
      await pool.query("UPDATE warehouses SET is_default = false");
    }
    if (is_module_default && linked_module) {
      await pool.query("UPDATE warehouses SET is_module_default = false WHERE linked_module = $1 AND id != $2", [linked_module, req.params.id]);
    }

    await pool.query(
      `UPDATE warehouses SET 
        name=$1, code=$2, type=$3, branch_id=$4, manager=$5, address=$6, status=$7, 
        allow_negative=$8, is_default=$9, description=$10,
        linked_module=$11, linked_modules=$12, is_module_default=$13, auto_sync=$14
       WHERE id=$15`,
      [
        name, code, type, branch_id, manager, address, status, 
        allow_negative, is_default, description,
        linked_module || "general",
        typeof linked_modules === "string" ? linked_modules : JSON.stringify(linked_modules || []),
        is_module_default || false,
        auto_sync !== false,
        req.params.id
      ]
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/warehouses/:id", async (req, res) => {
  try {
    // Check if warehouse has items
    const items = await pool.query("SELECT COUNT(*)::int AS c FROM inventory_items WHERE warehouse_id=$1 AND quantity > 0", [req.params.id]);
    if (items.rows[0].c > 0) {
      return res.status(400).json({ error: "لا يمكن حذف مخزن به أصناف لها أرصدة. قم بترحيل الأصناف أولاً." });
    }
    await pool.query("DELETE FROM warehouses WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// INGREDIENTS CRUD (with stock summary)
// ─────────────────────────────────────────────────────────────
router.get("/api/ingredients", async (req, res) => {
  try {
    const { with_stock } = req.query;
    let query = `
      SELECT ing.*,
        COALESCE(NULLIF(ing.code, ''), ing.item_code) AS code,
        (SELECT COALESCE(SUM(i.quantity),0) FROM inventory_items i WHERE i.ingredient_id = ing.id) AS total_stock,
        (SELECT COALESCE(SUM(i.reserved),0) FROM inventory_items i WHERE i.ingredient_id = ing.id) AS total_reserved,
        (SELECT COUNT(*)::int FROM inventory_items i WHERE i.ingredient_id = ing.id AND i.quantity > 0) AS warehouses_count
      FROM ingredients ing
      ORDER BY ing.id
    `;
    if (with_stock === "true") {
      // Filter only items that have stock somewhere
      query = `
        SELECT ing.*,
          COALESCE(NULLIF(ing.code, ''), ing.item_code) AS code,
          (SELECT COALESCE(SUM(i.quantity),0) FROM inventory_items i WHERE i.ingredient_id = ing.id) AS total_stock,
          (SELECT COALESCE(SUM(i.reserved),0) FROM inventory_items i WHERE i.ingredient_id = ing.id) AS total_reserved,
          (SELECT COUNT(*)::int FROM inventory_items i WHERE i.ingredient_id = ing.id AND i.quantity > 0) AS warehouses_count
        FROM ingredients ing
        WHERE EXISTS (SELECT 1 FROM inventory_items i WHERE i.ingredient_id = ing.id AND i.quantity > 0)
        ORDER BY ing.id
      `;
    }
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/ingredients", async (req, res) => {
  try {
    let { name, code, unit, barcode, category, min_stock, max_stock, reorder_point, last_purchase_price, avg_cost } = req.body;
    
    if (!code) {
      const countRes = await pool.query("SELECT MAX(id) as max_id FROM ingredients");
      const nextId = (Number(countRes.rows?.[0]?.max_id) || 0) + 1;
      code = `ING-${String(nextId).padStart(3, "0")}`;
    }

    const result = await pool.query(
      `INSERT INTO ingredients (name, code, unit, barcode, category, min_stock, max_stock, reorder_point, last_purchase_price, avg_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [name, code, unit||"قطعة", barcode||"", category||"عام", min_stock||0, max_stock||0, reorder_point||0, last_purchase_price||0, avg_cost||0]
    );
    const newIngId = result.rows?.[0]?.id;
    try {
      const whs = await pool.query("SELECT id FROM warehouses");
      for (const wh of (whs.rows || [])) {
        const cVal = Number(avg_cost || last_purchase_price || 0);
        await pool.query(
          `INSERT INTO inventory_items (warehouse_id, ingredient_id, quantity, reserved, in_transit, available, avg_cost, last_cost, cost, min_quantity, max_quantity)
           VALUES ($1, $2, 0, 0, 0, 0, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [wh.id, newIngId, cVal, cVal, cVal, Number(min_stock || 10), Number(max_stock || 100)]
        );
      }
    } catch (errWh) {
      console.warn("Auto link new ingredient to warehouses error:", errWh);
    }
    res.json({ id: newIngId, success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/ingredients/:id", async (req, res) => {
  try {
    const { name, code, unit, barcode, category, min_stock, max_stock, reorder_point, last_purchase_price, avg_cost } = req.body;
    await pool.query(
      `UPDATE ingredients SET name=$1, code=$2, unit=$3, barcode=$4, category=$5, min_stock=$6, max_stock=$7, reorder_point=$8, last_purchase_price=$9, avg_cost=$10 WHERE id=$11`,
      [name, code, unit, barcode, category, min_stock, max_stock, reorder_point, last_purchase_price, avg_cost, req.params.id]
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/ingredients/:id", async (req, res) => {
  try {
    const items = await pool.query("SELECT COUNT(*)::int AS c FROM inventory_items WHERE ingredient_id=$1 AND quantity > 0", [req.params.id]);
    if (items.rows[0]?.c > 0) {
      return res.status(400).json({ error: "لا يمكن حذف صنف له أرصدة في المخازن." });
    }
    await pool.query("DELETE FROM inventory_items WHERE ingredient_id = $1", [req.params.id]);
    await pool.query("DELETE FROM stock_batches WHERE ingredient_id = $1", [req.params.id]);
    await pool.query("DELETE FROM inventory_notifications WHERE ingredient_id = $1", [req.params.id]);
    await pool.query("DELETE FROM inventory_movements WHERE ingredient_id = $1", [req.params.id]);
    await pool.query("DELETE FROM sales_order_items WHERE ingredient_id = $1", [req.params.id]);
    await pool.query("DELETE FROM material_request_items WHERE ingredient_id = $1", [req.params.id]);
    await pool.query("DELETE FROM ingredients WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// INVENTORY ITEMS (with optional JOIN to ingredients & warehouse)
// ─────────────────────────────────────────────────────────────
const getInventoryItemsHandler = async (req: any, res: any) => {
  try {
    const { warehouse_id, low_stock, with_ingredient } = req.query;
    let query = `
      SELECT i.*, ing.name AS ingredient_name, ing.code AS ingredient_code, ing.unit AS ingredient_unit,
             ing.barcode, ing.category, ing.min_stock, ing.max_stock, ing.reorder_point,
             ing.last_purchase_price, ing.avg_cost,
             w.name AS warehouse_name, w.code AS warehouse_code
      FROM inventory_items i
      LEFT JOIN ingredients ing ON ing.id = i.ingredient_id
      LEFT JOIN warehouses w ON w.id = i.warehouse_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      query += ` AND i.warehouse_id = $${params.length}`;
    }
    if (low_stock === "true") {
      query += ` AND ing.min_stock > 0 AND i.quantity <= ing.min_stock`;
    }
    query += " ORDER BY ing.name";
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};

router.get("/api/inventory-items", getInventoryItemsHandler);
router.get("/api/inventory/items", getInventoryItemsHandler);

router.post("/api/inventory/adjust", async (req, res) => {
  try {
    const { warehouse_id, ingredient_id, quantity, notes, user } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await applyStockMovement(client, {
        warehouse_id: Number(warehouse_id),
        ingredient_id: Number(ingredient_id),
        delta: Number(quantity),
        ref_type: "adjustment",
        ref_id: Date.now(),
        user: user || "system",
        notes: notes || "تعديل مخزني مباشر",
      });
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Putaway rules
const getPutawayRulesHandler = async (_req: any, res: any) => {
  try {
    const result = await pool.query("SELECT * FROM putaway_rules ORDER BY id DESC");
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
router.get("/api/putaway-rules", getPutawayRulesHandler);
router.get("/api/inventory/putaway-rules", getPutawayRulesHandler);

router.post(["/api/putaway-rules", "/api/inventory/putaway-rules"], async (req, res) => {
  try {
    const { rule_name, warehouse_id, section_id, priority, is_active } = req.body;
    const result = await pool.query(
      `INSERT INTO putaway_rules (rule_name, warehouse_id, section_id, priority, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [rule_name, warehouse_id || null, section_id || null, priority || 1, is_active !== false]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete(["/api/putaway-rules/:id", "/api/inventory/putaway-rules/:id"], async (req, res) => {
  try {
    await pool.query("DELETE FROM putaway_rules WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Product Bundles
const getProductBundlesHandler = async (_req: any, res: any) => {
  try {
    const result = await pool.query("SELECT * FROM product_bundles ORDER BY id DESC");
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
router.get("/api/product-bundles", getProductBundlesHandler);
router.get("/api/inventory/product-bundles", getProductBundlesHandler);

router.post(["/api/product-bundles", "/api/inventory/product-bundles"], async (req, res) => {
  try {
    const { name, code, price, items, description } = req.body;
    const result = await pool.query(
      `INSERT INTO product_bundles (name, code, price, items, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, code, price || 0, JSON.stringify(items || []), description || ""]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete(["/api/product-bundles/:id", "/api/inventory/product-bundles/:id"], async (req, res) => {
  try {
    await pool.query("DELETE FROM product_bundles WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Stock Entries
const getStockEntriesHandler = async (_req: any, res: any) => {
  try {
    const result = await pool.query("SELECT * FROM stock_entries ORDER BY id DESC");
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
router.get("/api/stock-entries", getStockEntriesHandler);
router.get("/api/inventory/stock-entries", getStockEntriesHandler);

router.get(["/api/stock-entries/:id", "/api/inventory/stock-entries/:id"], async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stock_entries WHERE id = $1", [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post(["/api/stock-entries", "/api/inventory/stock-entries"], async (req, res) => {
  try {
    const { entry_type, warehouse_id, items, notes, status } = req.body;
    const result = await pool.query(
      `INSERT INTO stock_entries (entry_type, warehouse_id, items, notes, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [entry_type || "in", warehouse_id || null, JSON.stringify(items || []), notes || "", status || "completed"]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Delivery Notes
const getDeliveryNotesHandler = async (_req: any, res: any) => {
  try {
    const result = await pool.query("SELECT * FROM delivery_notes ORDER BY id DESC");
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
router.get("/api/delivery-notes", getDeliveryNotesHandler);
router.get("/api/inventory/delivery-notes", getDeliveryNotesHandler);

router.get(["/api/delivery-notes/:id", "/api/inventory/delivery-notes/:id"], async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM delivery_notes WHERE id = $1", [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post(["/api/delivery-notes", "/api/inventory/delivery-notes"], async (req, res) => {
  try {
    const { note_number, customer_id, warehouse_id, items, notes, status } = req.body;
    const result = await pool.query(
      `INSERT INTO delivery_notes (note_number, customer_id, warehouse_id, items, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [note_number || `DN-${Date.now()}`, customer_id || null, warehouse_id || null, JSON.stringify(items || []), notes || "", status || "draft"]
    );
    res.json(result.rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Sales Orders
const getSalesOrdersHandler = async (_req: any, res: any) => {
  try {
    const result = await pool.query("SELECT * FROM sales_orders ORDER BY id DESC");
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
router.get("/api/sales-orders", getSalesOrdersHandler);
router.get("/api/inventory/sales-orders", getSalesOrdersHandler);

router.get(["/api/sales-orders/:id", "/api/inventory/sales-orders/:id"], async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM sales_orders WHERE id = $1", [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Inventory Requests
const getInventoryRequestsHandler = async (_req: any, res: any) => {
  try {
    const result = await pool.query("SELECT * FROM inventory_requests ORDER BY id DESC");
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
};
router.get("/api/inventory-requests", getInventoryRequestsHandler);
router.get("/api/inventory/requests", getInventoryRequestsHandler);

router.get(["/api/inventory-requests/:id", "/api/inventory/requests/:id"], async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM inventory_requests WHERE id = $1", [req.params.id]);
    res.json(result.rows[0] || null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// INVENTORY TRANSACTIONS  (with stock movement on save)
// ─────────────────────────────────────────────────────────────
router.get("/api/inventory-transactions", async (req, res) => {
  try {
    const { warehouse_id, type, status, from_date, to_date } = req.query;
    let query = `
      SELECT t.*, w.name AS warehouse_name, w.code AS warehouse_code,
        CASE
          WHEN t.items IS NOT NULL AND json_typeof(t.items::json) = 'array'
            THEN json_array_length(t.items::json)
          ELSE 1
        END::int AS items_count,
        CASE
          WHEN t.items IS NOT NULL AND json_typeof(t.items::json) = 'array' AND json_array_length(t.items::json) > 0
            THEN (SELECT COALESCE(SUM((item->>'quantity')::numeric * COALESCE((item->>'price')::numeric,0)),0)
                  FROM json_array_elements(t.items::json) AS item)
          ELSE COALESCE(NULLIF(t.total_cost, 0), (t.quantity * COALESCE(t.unit_cost,0)), 0)
        END AS total_value,
        COALESCE(t.date, t.created_at) AS transaction_date
      FROM inventory_transactions t
      LEFT JOIN warehouses w ON w.id = t.warehouse_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      query += ` AND t.warehouse_id = $${params.length}`;
    }
    if (type) {
      params.push(type);
      query += ` AND t.type = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    if (from_date) {
      params.push(from_date);
      query += ` AND t.date >= $${params.length}`;
    }
    if (to_date) {
      params.push(to_date);
      query += ` AND t.date <= $${params.length}`;
    }
    query += " ORDER BY t.date DESC, t.id DESC";
    const result = await pool.query(query, params);
    const rows = result.rows.map((r: any) => {
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
      return {
        ...r,
        transaction_number: r.transaction_number || `TXN-MAN-${r.id}`,
        items: parsedItems
      };
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/inventory-transactions", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { transaction_number, date, warehouse_id, type, reason, reference, user, status, notes, items, supplier_id } = req.body;
    const result = await client.query(
      `INSERT INTO inventory_transactions (transaction_number, date, warehouse_id, type, reason, reference, "user", status, notes, items, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [transaction_number, date, warehouse_id, type, reason||"", reference||"", user||"admin", status||"approved", notes||"", JSON.stringify(items||[]), supplier_id||null]
    );
    const txId = result.rows[0].id;

    // Apply stock movements IF status is approved (or any non-pending)
    if (status !== "pending") {
      const effectMap: any = {
        receive: "in", issue: "out", opening: "in", return: "in",
        damaged: "out", adjustment: "adjust", count: "adjust",
      };
      const effect = effectMap[type];
      // Get warehouse's branch_id for accounting
      const wh = (await client.query("SELECT branch_id FROM warehouses WHERE id=$1", [warehouse_id])).rows[0];
      const branchId = wh?.branch_id;
      for (const item of (items || [])) {
        const delta = effect === "in" ? Number(item.quantity) :
                      effect === "out" ? -Number(item.quantity) :
                      effect === "adjust" ? Number(item.diff || item.quantity) : 0;
        if (delta !== 0) {
          // Get ingredient name & unit_cost
          const ing = (await client.query("SELECT name, avg_cost FROM ingredients WHERE id=$1", [item.ingredient_id])).rows[0];
          const unitCost = Number(item.price) || Number(ing?.avg_cost) || 0;
          await applyStockMovement(client, {
            warehouse_id: Number(warehouse_id),
            ingredient_id: Number(item.ingredient_id),
            delta,
            ref_type: "transaction",
            ref_id: txId,
            user: user || "admin",
            notes: `${type} - ${reason || ""}`,
            unit_cost: unitCost,
            ingredient_name: ing?.name || "",
            branch_id: branchId,
          });
          // For receive transactions, also create a stock batch (expiry tracking)
          if (type === "receive" && item.batch_number) {
            await client.query(
              `INSERT INTO stock_batches (ingredient_id, warehouse_id, batch_number, received_date, expiry_date, quantity, original_quantity, cost, supplier_id, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')`,
              [item.ingredient_id, warehouse_id, item.batch_number, date, item.expiry_date || null, Number(item.quantity), Number(item.quantity), unitCost, supplier_id || null]
            );
          }
          // For receive transactions without explicit batch, auto-create one
          if (type === "receive" && !item.batch_number && item.expiry_date) {
            const batchNum = `B-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
            await client.query(
              `INSERT INTO stock_batches (ingredient_id, warehouse_id, batch_number, received_date, expiry_date, quantity, original_quantity, cost, supplier_id, status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')`,
              [item.ingredient_id, warehouse_id, batchNum, date, item.expiry_date, Number(item.quantity), Number(item.quantity), unitCost, supplier_id || null]
            );
          }
        }
        // Update ingredient's last_purchase_price and avg_cost if it's a receive transaction using Moving Weighted Average
        if (type === "receive" && item.price && Number(item.price) > 0) {
          const ing = await client.query("SELECT avg_cost, last_purchase_price FROM ingredients WHERE id=$1", [item.ingredient_id]);
          if (ing.rows.length > 0) {
            const lastAvg = Number(ing.rows[0].avg_cost || 0);
            const newPrice = Number(item.price);
            const incomingQty = Math.max(0, Number(item.quantity) || 0);

            // Existing quantity across inventory before this incoming movement
            // (delta was already added to inventory_items by applyStockMovement above)
            const stockRes = await client.query(
              "SELECT COALESCE(SUM(quantity), 0) as total_qty FROM inventory_items WHERE ingredient_id=$1",
              [item.ingredient_id]
            );
            const totalStockAfter = Number(stockRes.rows[0]?.total_qty || 0);
            const existingQty = Math.max(0, totalStockAfter - incomingQty);

            let newAvgCost: number;
            if (existingQty <= 0 || lastAvg <= 0) {
              // If no prior stock exists or prior average was 0, new cost is incoming price
              newAvgCost = newPrice;
            } else {
              const totalQty = existingQty + incomingQty;
              if (totalQty > 0) {
                // Moving Weighted Average: (Existing Qty * Existing Unit Cost + Incoming Qty * Incoming Unit Cost) / Total Qty
                newAvgCost = ((existingQty * lastAvg) + (incomingQty * newPrice)) / totalQty;
              } else {
                newAvgCost = newPrice;
              }
            }

            // Zero-quantity / NaN / Infinity safety guard
            if (!Number.isFinite(newAvgCost) || newAvgCost <= 0) {
              newAvgCost = newPrice > 0 ? newPrice : lastAvg;
            }

            await client.query(
              "UPDATE ingredients SET last_purchase_price=$1, avg_cost=$2 WHERE id=$3",
              [newPrice, Number(newAvgCost.toFixed(4)), item.ingredient_id]
            );
          }
        }
        // Check for low stock after movement (only on issue/damaged/adjustment)
        if (type === "issue" || type === "damaged" || type === "adjustment" || type === "count") {
          // Fire and forget
          checkLowStockNotification(Number(warehouse_id), Number(item.ingredient_id)).catch(() => {});
        }
      }
    }
    // Run expiry notification check (fire and forget)
    checkExpiryNotifications().catch(() => {});
    await client.query("COMMIT");
    res.json({ id: txId, success: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

router.put("/api/inventory-transactions/:id/approve", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txId = Number(req.params.id);
    const { user } = req.body;
    const tx = (await client.query("SELECT * FROM inventory_transactions WHERE id=$1", [txId])).rows[0];
    if (!tx) { await client.query("ROLLBACK"); return res.status(404).json({ error: "الحركة غير موجودة" }); }
    if (tx.status !== "pending") { await client.query("ROLLBACK"); return res.status(400).json({ error: "الحركة غير معلقة" }); }
    await client.query("UPDATE inventory_transactions SET status='approved', approved_by=$1, approved_at=NOW() WHERE id=$2", [user || "admin", txId]);
    // Apply movements
    const effectMap: any = { receive: "in", issue: "out", opening: "in", return: "in", damaged: "out", adjustment: "adjust", count: "adjust" };
    const effect = effectMap[tx.type];
    const items = typeof tx.items === "string" ? JSON.parse(tx.items) : (tx.items || []);
    for (const item of items) {
      const delta = effect === "in" ? Number(item.quantity) :
                    effect === "out" ? -Number(item.quantity) :
                    effect === "adjust" ? Number(item.diff || item.quantity) : 0;
      if (delta !== 0) {
        await applyStockMovement(client, {
          warehouse_id: Number(tx.warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta, ref_type: "transaction", ref_id: txId, user: user || "admin", notes: `approve ${tx.type}`,
        });
      }
    }
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e: any) {
    await client.query("ROLLBACK"); res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

router.delete("/api/inventory-transactions/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txId = Number(req.params.id);
    const tx = (await client.query("SELECT * FROM inventory_transactions WHERE id=$1", [txId])).rows[0];
    if (!tx) { await client.query("ROLLBACK"); return res.status(404).json({ error: "غير موجودة" }); }
    if (tx.status === "approved") {
      // Reverse stock
      const effectMap: any = { receive: "in", issue: "out", opening: "in", return: "in", damaged: "out" };
      const effect = effectMap[tx.type];
      const items = typeof tx.items === "string" ? JSON.parse(tx.items) : (tx.items || []);
      for (const item of items) {
        const reverseDelta = effect === "in" ? -Number(item.quantity) : effect === "out" ? Number(item.quantity) : 0;
        if (reverseDelta !== 0) {
          await applyStockMovement(client, {
            warehouse_id: Number(tx.warehouse_id), ingredient_id: Number(item.ingredient_id),
            delta: reverseDelta, ref_type: "transaction", ref_id: txId, user: "admin", notes: `reverse delete`,
          });
        }
      }
    }
    await client.query("DELETE FROM inventory_transactions WHERE id=$1", [txId]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e: any) {
    await client.query("ROLLBACK"); res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ─────────────────────────────────────────────────────────────
// WAREHOUSE TRANSFERS (with full workflow: pending → in_transit → received → cancelled)
// ─────────────────────────────────────────────────────────────
router.get("/api/warehouse-transfers", async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT t.*,
        fw.name AS from_warehouse_name, fw.code AS from_warehouse_code,
        tw.name AS to_warehouse_name, tw.code AS to_warehouse_code,
        (SELECT COUNT(*)::int FROM json_array_elements(t.items::json)) AS items_count,
        (SELECT COALESCE(SUM((item->>'quantity')::numeric),0) FROM json_array_elements(t.items::json) AS item) AS total_qty
      FROM warehouse_transfers t
      LEFT JOIN warehouses fw ON fw.id = t.from_warehouse_id
      LEFT JOIN warehouses tw ON tw.id = t.to_warehouse_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (status) {
      params.push(status);
      query += ` AND t.status = $${params.length}`;
    }
    query += " ORDER BY t.date DESC, t.id DESC";
    const result = await pool.query(query, params);
    const rows = result.rows.map((r: any) => {
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
      return {
        ...r,
        items: parsedItems
      };
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/warehouse-transfers", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { transfer_number, date, from_warehouse_id, to_warehouse_id, status, user, notes, items } = req.body;
    const result = await client.query(
      `INSERT INTO warehouse_transfers (transfer_number, date, from_warehouse_id, to_warehouse_id, status, "user", notes, items)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [transfer_number, date, from_warehouse_id, to_warehouse_id, status||"pending", user||"admin", notes||"", JSON.stringify(items||[])]
    );
    const trfId = result.rows[0].id;

    // If status is approved/received directly: deduct from source, add to destination
    if (status === "received") {
      for (const item of (items || [])) {
        // Out of source
        await applyStockMovement(client, {
          warehouse_id: Number(from_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: -Number(item.quantity), ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `تحويل صادر إلى مخزن ${to_warehouse_id}`,
        });
        // Into destination
        await applyStockMovement(client, {
          warehouse_id: Number(to_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: Number(item.quantity), ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `تحويل وارد من مخزن ${from_warehouse_id}`,
        });
      }
    } else if (status === "in_transit") {
      // Mark items as in_transit at destination
      for (const item of (items || [])) {
        await applyStockMovement(client, {
          warehouse_id: Number(to_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: Number(item.quantity), field: "in_transit",
          ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `تحويل قيد النقل من ${from_warehouse_id}`,
        });
      }
    }
    await client.query("COMMIT");
    res.json({ id: trfId, success: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// Update transfer status (workflow)
router.put("/api/warehouse-transfers/:id/status", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trfId = Number(req.params.id);
    const { status, user } = req.body;
    const trf = (await client.query("SELECT * FROM warehouse_transfers WHERE id=$1", [trfId])).rows[0];
    if (!trf) { await client.query("ROLLBACK"); return res.status(404).json({ error: "التحويل غير موجود" }); }
    const items = typeof trf.items === "string" ? JSON.parse(trf.items) : (trf.items || []);

    if (status === "in_transit" && trf.status === "pending") {
      // Mark items as in_transit at destination
      for (const item of items) {
        await applyStockMovement(client, {
          warehouse_id: Number(trf.to_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: Number(item.quantity), field: "in_transit",
          ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `تحويل قيد النقل من ${trf.from_warehouse_id}`,
        });
      }
    } else if (status === "received" && trf.status === "pending") {
      // Direct receive from pending: deduct source, add to destination
      for (const item of items) {
        await applyStockMovement(client, {
          warehouse_id: Number(trf.from_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: -Number(item.quantity), ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `تحويل صادر إلى مخزن ${trf.to_warehouse_id}`,
        });
        await applyStockMovement(client, {
          warehouse_id: Number(trf.to_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: Number(item.quantity), ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `تحويل وارد من مخزن ${trf.from_warehouse_id}`,
        });
      }
    } else if (status === "received" && trf.status === "in_transit") {
      // Already marked in_transit; now receive: deduct source, convert in_transit to actual stock at destination
      for (const item of items) {
        await applyStockMovement(client, {
          warehouse_id: Number(trf.from_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: -Number(item.quantity), ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `تحويل صادر إلى مخزن ${trf.to_warehouse_id}`,
        });
        // Reduce in_transit
        await applyStockMovement(client, {
          warehouse_id: Number(trf.to_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: -Number(item.quantity), field: "in_transit",
          ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `استلام تحويل من ${trf.from_warehouse_id}`,
        });
        // Increase actual quantity
        await applyStockMovement(client, {
          warehouse_id: Number(trf.to_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: Number(item.quantity), ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `استلام تحويل من ${trf.from_warehouse_id}`,
        });
      }
    } else if (status === "cancelled") {
      if (trf.status === "in_transit") {
        // Reverse in_transit
        for (const item of items) {
          await applyStockMovement(client, {
            warehouse_id: Number(trf.to_warehouse_id), ingredient_id: Number(item.ingredient_id),
            delta: -Number(item.quantity), field: "in_transit",
            ref_type: "transfer", ref_id: trfId, user: user || "admin",
            notes: `إلغاء تحويل قيد النقل`,
          });
        }
      }
    }
    await client.query("UPDATE warehouse_transfers SET status=$1, updated_at=NOW() WHERE id=$2", [status, trfId]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ─────────────────────────────────────────────────────────────
// SUPPLIERS (for receive transactions & purchase orders)
// ─────────────────────────────────────────────────────────────
router.get("/api/warehouse-suppliers", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*,
        (SELECT COUNT(*)::int FROM inventory_transactions t WHERE t.supplier_id = s.id) AS tx_count,
        (SELECT COALESCE(SUM((item->>'quantity')::numeric * COALESCE((item->>'price')::numeric,0)),0)
         FROM inventory_transactions t, json_array_elements(t.items::json) AS item
         WHERE t.supplier_id = s.id AND t.type='receive') AS total_purchases
      FROM suppliers s
      WHERE s.name IS NOT NULL AND s.name != ''
      ORDER BY s.id
    `);
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/warehouse-suppliers", async (req, res) => {
  try {
    const { name, code, phone, email, address, tax_number, contact_person, balance, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO suppliers (name, code, phone, email, address, tax_number, contact_person, balance, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [name, code||`SUP-${Date.now()}`, phone||"", email||"", address||"", tax_number||"", contact_person||"", balance||0, notes||""]
    );
    res.json({ id: result.rows[0].id, success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/warehouse-suppliers/:id", async (req, res) => {
  try {
    const { name, code, phone, email, address, tax_number, contact_person, balance, notes } = req.body;
    await pool.query(
      `UPDATE suppliers SET name=$1, code=$2, phone=$3, email=$4, address=$5, tax_number=$6, contact_person=$7, balance=$8, notes=$9 WHERE id=$10`,
      [name, code, phone, email, address, tax_number, contact_person, balance, notes, req.params.id]
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/warehouse-suppliers/:id", async (req, res) => {
  try { await pool.query("DELETE FROM suppliers WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// STOCK MOVEMENTS (Audit log)
// ─────────────────────────────────────────────────────────────
router.get(["/api/inventory-movements", "/api/inventory/movements"], async (req, res) => {
  try {
    const { warehouse_id, ingredient_id, ref_type, from_date, to_date, limit } = req.query;
    let query = `
      SELECT m.*, ing.name AS ingredient_name, ing.code AS ingredient_code, ing.unit,
             w.name AS warehouse_name, w.code AS warehouse_code
      FROM inventory_movements m
      LEFT JOIN ingredients ing ON ing.id = m.ingredient_id
      LEFT JOIN warehouses w ON w.id = m.warehouse_id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id && warehouse_id !== "all") { params.push(Number(warehouse_id)); query += ` AND m.warehouse_id = $${params.length}`; }
    if (ingredient_id) { params.push(Number(ingredient_id)); query += ` AND m.ingredient_id = $${params.length}`; }
    if (ref_type) { params.push(ref_type); query += ` AND m.ref_type = $${params.length}`; }
    if (from_date) { params.push(from_date); query += ` AND m.created_at >= $${params.length}`; }
    if (to_date) { params.push(to_date); query += ` AND m.created_at <= $${params.length}`; }
    query += " ORDER BY m.created_at DESC, m.id DESC";
    if (limit) { params.push(Number(limit)); query += ` LIMIT $${params.length}`; }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// LOW STOCK ALERTS & REORDER
// ─────────────────────────────────────────────────────────────
router.get("/api/warehouse-low-stock", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.*, ing.name AS ingredient_name, ing.code AS ingredient_code, ing.unit,
             ing.min_stock, ing.reorder_point, ing.avg_cost, ing.last_purchase_price,
             w.name AS warehouse_name
      FROM inventory_items i
      JOIN ingredients ing ON ing.id = i.ingredient_id
      JOIN warehouses w ON w.id = i.warehouse_id
      WHERE ing.min_stock > 0 AND i.quantity <= ing.min_stock
      ORDER BY (i.quantity * 1.0 / NULLIF(ing.min_stock,0)) ASC
    `);
    res.json(result.rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// DASHBOARD KPI
// ─────────────────────────────────────────────────────────────
router.get("/api/warehouse-dashboard", async (_req, res) => {
  try {
    const totalWarehouses = (await pool.query("SELECT COUNT(*)::int AS c FROM warehouses")).rows[0].c;
    const totalIngredients = (await pool.query("SELECT COUNT(*)::int AS c FROM ingredients")).rows[0].c;
    const totalItems = (await pool.query("SELECT COUNT(*)::int AS c FROM inventory_items WHERE quantity > 0")).rows[0].c;

    // Stock value: compute in JS using simpler queries
    const invItems = (await pool.query("SELECT * FROM inventory_items")).rows;
    const ings = (await pool.query("SELECT * FROM ingredients")).rows;
    let stockValue = 0;
    let totalReserved = 0;
    let totalInTransit = 0;
    let lowStockCount = 0;
    for (const i of invItems) {
      const ing = ings.find((g: any) => Number(g.id) === Number(i.ingredient_id));
      stockValue += Number(i.quantity || 0) * Number(ing?.avg_cost || 0);
      totalReserved += Number(i.reserved || 0);
      totalInTransit += Number(i.in_transit || 0);
      if (ing && Number(ing.min_stock) > 0 && Number(i.quantity) <= Number(ing.min_stock)) lowStockCount++;
    }

    // Today's movements count
    const todayStr = new Date().toISOString().split("T")[0];
    const allMovements = (await pool.query("SELECT * FROM inventory_movements")).rows;
    const todayMovements = allMovements.filter((m: any) => String(m.created_at instanceof Date ? m.created_at.toISOString() : (m.created_at || "")).startsWith(todayStr)).length;

    // Pending transfers / transactions
    const pendingTransfers = (await pool.query("SELECT COUNT(*)::int AS c FROM warehouse_transfers WHERE status='pending'")).rows[0].c;
    const pendingTx = (await pool.query("SELECT COUNT(*)::int AS c FROM inventory_transactions WHERE status='pending'")).rows[0].c;

    // Damaged this month
    const yearMonth = todayStr.substring(0, 7); // 2026-07
    const allTx = (await pool.query("SELECT * FROM inventory_transactions")).rows;
    const damagedThisMonth = allTx.filter((t: any) => t.type === "damaged" && String(t.date instanceof Date ? t.date.toISOString() : (t.date || "")).startsWith(yearMonth)).length;

    // Top 5 items by value (computed in JS)
    const itemAgg = new Map<string, any>();
    for (const i of invItems) {
      const ing = ings.find((g: any) => Number(g.id) === Number(i.ingredient_id));
      if (!ing) continue;
      const key = `${ing.name}|||${ing.code}|||${ing.unit}`;
      if (!itemAgg.has(key)) {
        itemAgg.set(key, { name: ing.name, code: ing.code, unit: ing.unit, qty: 0, value: 0 });
      }
      const e = itemAgg.get(key);
      e.qty += Number(i.quantity || 0);
      e.value += Number(i.quantity || 0) * Number(ing.avg_cost || 0);
    }
    const topItems = Array.from(itemAgg.values()).sort((a: any, b: any) => Number(b.value) - Number(a.value)).slice(0, 5);

    // Movements trend (last 7 days) - computed in JS
    const trend = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dStr = d.toISOString().split("T")[0];
      const movCount = allMovements.filter((m: any) => String(m.created_at instanceof Date ? m.created_at.toISOString() : (m.created_at || "")).startsWith(dStr)).length;
      const txCount = allTx.filter((t: any) => String(t.date instanceof Date ? t.date.toISOString() : (t.date || "")).startsWith(dStr)).length;
      trend.push({ date: dStr, movements: movCount, transactions: txCount });
    }

    // Stock value by warehouse
    const whs = (await pool.query("SELECT * FROM warehouses")).rows;
    const byWarehouse = whs.map((w: any) => {
      const items = invItems.filter((i: any) => Number(i.warehouse_id) === Number(w.id));
      const value = items.reduce((s: number, i: any) => {
        const ing = ings.find((g: any) => Number(g.id) === Number(i.ingredient_id));
        return s + (Number(i.quantity || 0) * Number(ing?.avg_cost || 0));
      }, 0);
      return { name: w.name, value, items_count: items.length };
    }).sort((a: any, b: any) => Number(b.value) - Number(a.value));

    res.json({
      totalWarehouses, totalIngredients, totalItems, stockValue,
      lowStockCount, todayMovements, pendingTransfers, pendingTx,
      totalReserved, totalInTransit, damagedThisMonth,
      topItems, trend, byWarehouse,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// SETTINGS & TYPES (ENTERPRISE)
// ─────────────────────────────────────────────────────────────
router.get(["/api/inventory-settings", "/api/inventory/settings"], async (_req, res) => {
  try {
    let settings = (await pool.query("SELECT * FROM inventory_settings ORDER BY id DESC LIMIT 1")).rows[0];
    if (!settings) {
      const initRes = await pool.query(`
        INSERT INTO inventory_settings (
          costing_method, allow_negative_stock, require_approval_for_transactions,
          require_qc_for_receipts, auto_post_receipts, expiry_warning_days,
          enable_fefo, enable_multi_uom, enable_barcode_scanner, enable_ai_reorder,
          inventory_policy, default_reorder_point, allowed_wastage_percentage,
          lock_stock_during_count, auto_link_accounts
        ) VALUES (
          'weighted_average', false, true, false, false, 30,
          true, true, true, true,
          'periodic', 10, 2.5,
          true, true
        ) RETURNING *
      `);
      settings = initRes.rows[0];
    }
    res.json(settings);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put(["/api/inventory-settings", "/api/inventory/settings"], async (req, res) => {
  try {
    const {
      costing_method, allow_negative_stock, require_approval_for_transactions,
      require_qc_for_receipts, auto_post_receipts, expiry_warning_days,
      inventory_policy, default_reorder_point, allowed_wastage_percentage,
      lock_stock_during_count, auto_link_accounts
    } = req.body;

    const existing = (await pool.query("SELECT id FROM inventory_settings LIMIT 1")).rows[0];
    if (existing) {
      await pool.query(`
        UPDATE inventory_settings SET
          costing_method = COALESCE($1, costing_method),
          allow_negative_stock = COALESCE($2, allow_negative_stock),
          require_approval_for_transactions = COALESCE($3, require_approval_for_transactions),
          require_qc_for_receipts = COALESCE($4, require_qc_for_receipts),
          auto_post_receipts = COALESCE($5, auto_post_receipts),
          expiry_warning_days = COALESCE($6, expiry_warning_days),
          inventory_policy = COALESCE($7, inventory_policy),
          default_reorder_point = COALESCE($8, default_reorder_point),
          allowed_wastage_percentage = COALESCE($9, allowed_wastage_percentage),
          lock_stock_during_count = COALESCE($10, lock_stock_during_count),
          auto_link_accounts = COALESCE($11, auto_link_accounts),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $12
      `, [
        costing_method, allow_negative_stock, require_approval_for_transactions,
        require_qc_for_receipts, auto_post_receipts, expiry_warning_days,
        inventory_policy, default_reorder_point, allowed_wastage_percentage,
        lock_stock_during_count, auto_link_accounts, existing.id
      ]);
    } else {
      await pool.query(`
        INSERT INTO inventory_settings (
          costing_method, allow_negative_stock, require_approval_for_transactions,
          require_qc_for_receipts, auto_post_receipts, expiry_warning_days,
          inventory_policy, default_reorder_point, allowed_wastage_percentage,
          lock_stock_during_count, auto_link_accounts
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [
        costing_method || 'weighted_average', allow_negative_stock ?? false, require_approval_for_transactions ?? true,
        require_qc_for_receipts ?? false, auto_post_receipts ?? false, expiry_warning_days || 30,
        inventory_policy || 'periodic', default_reorder_point || 10, allowed_wastage_percentage || 2.5,
        lock_stock_during_count ?? true, auto_link_accounts ?? true
      ]);
    }
    res.json({ success: true, message: "تم حفظ إعدادات المخزون بنجاح" });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/api/warehouse-types", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM warehouse_types ORDER BY is_system DESC, id ASC")).rows); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/warehouse-types", async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;
    const r = await pool.query(
      "INSERT INTO warehouse_types (name, code, description, is_active, is_system) VALUES ($1,$2,$3,$4,false) RETURNING *",
      [name, code, description || "", is_active ?? true]
    );
    res.json({ item: r.rows[0], success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/warehouse-types/:id", async (req, res) => {
  try {
    const { name, code, description, is_active } = req.body;
    const r = await pool.query(
      "UPDATE warehouse_types SET name = COALESCE($1, name), code = COALESCE($2, code), description = COALESCE($3, description), is_active = COALESCE($4, is_active) WHERE id = $5 RETURNING *",
      [name, code, description, is_active, req.params.id]
    );
    res.json({ item: r.rows[0], success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/warehouse-types/:id", async (req, res) => {
  try {
    const existing = (await pool.query("SELECT is_system FROM warehouse_types WHERE id=$1", [req.params.id])).rows[0];
    if (existing?.is_system) {
      return res.status(400).json({ error: "لا يمكن حذف نوع مخزن نظامي أساسي" });
    }
    await pool.query("DELETE FROM warehouse_types WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/api/transaction-types", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM transaction_types ORDER BY is_system DESC, id ASC")).rows); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/transaction-types", async (req, res) => {
  try {
    const { name, code, effect, requires_approval, is_active, description } = req.body;
    const r = await pool.query(
      "INSERT INTO transaction_types (name, code, effect, requires_approval, is_active, description, is_system) VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING *",
      [name, code, effect || "in", requires_approval ?? true, is_active ?? true, description || ""]
    );
    res.json({ item: r.rows[0], success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/transaction-types/:id", async (req, res) => {
  try {
    const { name, code, effect, requires_approval, is_active, description } = req.body;
    const r = await pool.query(
      "UPDATE transaction_types SET name = COALESCE($1, name), code = COALESCE($2, code), effect = COALESCE($3, effect), requires_approval = COALESCE($4, requires_approval), is_active = COALESCE($5, is_active), description = COALESCE($6, description) WHERE id = $7 RETURNING *",
      [name, code, effect, requires_approval, is_active, description, req.params.id]
    );
    res.json({ item: r.rows[0], success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/transaction-types/:id", async (req, res) => {
  try {
    const existing = (await pool.query("SELECT is_system FROM transaction_types WHERE id=$1", [req.params.id])).rows[0];
    if (existing?.is_system) {
      return res.status(400).json({ error: "لا يمكن حذف نوع حركة نظامي أساسي" });
    }
    await pool.query("DELETE FROM transaction_types WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get("/api/transaction-reasons", async (_req, res) => {
  try { res.json((await pool.query("SELECT * FROM transaction_reasons ORDER BY is_system DESC, id ASC")).rows); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/transaction-reasons", async (req, res) => {
  try {
    const { name, code, transaction_type, description, is_active } = req.body;
    const r = await pool.query(
      "INSERT INTO transaction_reasons (name, code, transaction_type, description, is_active, is_system) VALUES ($1,$2,$3,$4,$5,false) RETURNING *",
      [name, code, transaction_type || "all", description || "", is_active ?? true]
    );
    res.json({ item: r.rows[0], success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/transaction-reasons/:id", async (req, res) => {
  try {
    const { name, code, transaction_type, description, is_active } = req.body;
    const r = await pool.query(
      "UPDATE transaction_reasons SET name = COALESCE($1, name), code = COALESCE($2, code), transaction_type = COALESCE($3, transaction_type), description = COALESCE($4, description), is_active = COALESCE($5, is_active) WHERE id = $6 RETURNING *",
      [name, code, transaction_type, description, is_active, req.params.id]
    );
    res.json({ item: r.rows[0], success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/transaction-reasons/:id", async (req, res) => {
  try {
    const existing = (await pool.query("SELECT is_system FROM transaction_reasons WHERE id=$1", [req.params.id])).rows[0];
    if (existing?.is_system) {
      return res.status(400).json({ error: "لا يمكن حذف سبب حركة نظامي أساسي" });
    }
    await pool.query("DELETE FROM transaction_reasons WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// ENTERPRISE REPORTS APIS
// ─────────────────────────────────────────────────────────────

// Movement direction for the report ledger. Relying on `type.includes("in")`
// misreads "issue", "return" and "wastage" as inflows, so the direction is
// resolved from an explicit allow-list instead.
const OUTFLOW_TYPES = new Set([
  "out", "issue", "issue_out", "transfer_out", "transfer", "material_issue",
  "count", "adjustment_out", "wastage", "sale", "consumption", "production",
]);
function isInflowType(type: string): boolean {
  const t = String(type || "").toLowerCase();
  if (OUTFLOW_TYPES.has(t)) return false;
  return [
    "in", "receive", "receipt", "return", "transfer_in", "adjustment_in",
    "opening_balance", "count_surplus", "production_receipt",
  ].includes(t);
}

// 1. ITEM CARD / LEDGER (كارت الصنف والحركة التفصيلية)
router.get(["/api/warehouse-item-card", "/api/inventory/reports/item-card"], async (req, res) => {
  try {
    const { ingredient_id, warehouse_id, from_date, to_date } = req.query;
    if (!ingredient_id) {
      return res.status(400).json({ error: "ingredient_id is required" });
    }

    const ing = (await pool.query("SELECT * FROM ingredients WHERE id = $1", [ingredient_id])).rows[0];
    if (!ing) return res.status(404).json({ error: "Item not found" });

    // Fetch transactions
    let txQuery = `
      SELECT t.*, w.name as warehouse_name
      FROM inventory_transactions t
      LEFT JOIN warehouses w ON t.warehouse_id = w.id
      WHERE t.ingredient_id = $1
    `;
    const params: any[] = [ingredient_id];
    let pIdx = 2;

    if (warehouse_id && warehouse_id !== "all") {
      txQuery += ` AND t.warehouse_id = $${pIdx++}`;
      params.push(warehouse_id);
    }
    if (from_date) {
      txQuery += ` AND t.created_at >= $${pIdx++}`;
      params.push(from_date);
    }
    if (to_date) {
      txQuery += ` AND t.created_at <= $${pIdx++}`;
      params.push(to_date + " 23:59:59");
    }

    txQuery += " ORDER BY t.created_at ASC, t.id ASC";
    const txRows = (await pool.query(txQuery, params)).rows;

    const currentStockRes = await pool.query(
      warehouse_id && warehouse_id !== "all"
        ? "SELECT SUM(quantity) as stock FROM inventory_items WHERE ingredient_id = $1 AND warehouse_id = $2"
        : "SELECT SUM(quantity) as stock FROM inventory_items WHERE ingredient_id = $1",
      warehouse_id && warehouse_id !== "all" ? [ingredient_id, warehouse_id] : [ingredient_id]
    );

    // Movements recorded by the canonical engine carry authoritative balances.
    // Legacy rows may hold a signed quantity or only a direction, so normalise
    // both into (qtyIn, qtyOut) and derive the running balance from the last
    // authoritative closing balance instead of assuming a zero opening stock.
    const normalised: Array<{ tx: any; q: number; qtyIn: number; qtyOut: number }> = txRows.map((tx: any) => {
      const rawQty = Number(tx.quantity || 0);
      // A negative stored quantity is the legacy encoding of an outflow.
      const signed = rawQty < 0;
      const q = Math.abs(rawQty);
      const inflow = signed ? false : isInflowType(tx.type);
      return { tx, q, qtyIn: inflow ? q : 0, qtyOut: inflow ? 0 : q };
    });

    const lastAuthoritative = [...normalised].reverse().find((n) => Number(n.tx.balance_after) !== 0);
    const finalStock = Number(currentStockRes.rows[0]?.stock || 0);
    // Reconstruct the opening balance that makes the running total end at the
    // real current stock (a period that starts mid-history has no opening row).
    let openingBalance = lastAuthoritative
      ? finalStock - normalised.reduce((s: number, n: { qtyIn: number; qtyOut: number }) => s + (n.qtyIn - n.qtyOut), 0)
      : 0;

    let runningBalance = openingBalance;
    let totalIn = 0;
    let totalOut = 0;

    const movements = normalised.map(({ tx, qtyIn, qtyOut }: { tx: any; qtyIn: number; qtyOut: number }) => {
      totalIn += qtyIn;
      totalOut += qtyOut;
      runningBalance += (qtyIn - qtyOut);

      return {
        id: tx.id,
        date: tx.created_at,
        type: tx.type,
        ref_no: tx.reference_number || tx.reference_no || tx.transaction_number || tx.batch_number || `TX-${tx.id}`,
        warehouse_name: tx.warehouse_name || "المخزن",
        qty_in: qtyIn,
        qty_out: qtyOut,
        unit_cost: Number(tx.unit_cost || ing.avg_cost || 0),
        total_cost: qtyIn * Number(tx.unit_cost || ing.avg_cost || 0),
        balance_after: runningBalance,
        notes: tx.notes || ""
      };
    });

    res.json({
      item: {
        id: ing.id,
        name: ing.name,
        code: ing.code,
        unit: ing.unit,
        avg_cost: Number(ing.avg_cost || 0),
        current_stock: finalStock
      },
      movements,
      opening_balance: openingBalance,
      total_in: totalIn,
      total_out: totalOut,
      final_balance: finalStock
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 2. INVENTORY AGING (تقرير أعمار المخزون)
router.get(["/api/warehouse-aging", "/api/inventory/reports/aging"], async (_req, res) => {
  try {
    const ings = (await pool.query("SELECT * FROM ingredients")).rows;
    const invItems = (await pool.query("SELECT * FROM inventory_items")).rows;
    const txs = (await pool.query("SELECT ingredient_id, MAX(created_at) as last_date FROM inventory_transactions GROUP BY ingredient_id")).rows;

    const today = new Date();
    const itemsWithAging = ings.map((ing: any) => {
      const qty = invItems.filter((i: any) => Number(i.ingredient_id) === Number(ing.id))
                          .reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
      if (qty <= 0) return null;

      const txRecord = txs.find((t: any) => Number(t.ingredient_id) === Number(ing.id));
      const lastDate = txRecord?.last_date ? new Date(txRecord.last_date) : new Date(ing.created_at || Date.now() - 45 * 86400000);
      const daysInStock = Math.max(1, Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
      const value = qty * Number(ing.avg_cost || 0);

      let bucket = "0_30";
      if (daysInStock > 90) bucket = "90_plus";
      else if (daysInStock > 60) bucket = "61_90";
      else if (daysInStock > 30) bucket = "31_60";

      return {
        id: ing.id,
        name: ing.name,
        code: ing.code,
        unit: ing.unit,
        quantity: qty,
        avg_cost: Number(ing.avg_cost || 0),
        value,
        days_in_stock: daysInStock,
        last_date: new Date(lastDate.getTime() - lastDate.getTimezoneOffset() * 60000).toISOString().split("T")[0],
        bucket
      };
    }).filter(Boolean);

    const b0_30 = itemsWithAging.filter((i: any) => i.bucket === "0_30");
    const b31_60 = itemsWithAging.filter((i: any) => i.bucket === "31_60");
    const b61_90 = itemsWithAging.filter((i: any) => i.bucket === "61_90");
    const b90_plus = itemsWithAging.filter((i: any) => i.bucket === "90_plus");

    res.json({
      summary: {
        bucket_0_30: { count: b0_30.length, value: b0_30.reduce((s: number, i: any) => s + i.value, 0) },
        bucket_31_60: { count: b31_60.length, value: b31_60.reduce((s: number, i: any) => s + i.value, 0) },
        bucket_61_90: { count: b61_90.length, value: b61_90.reduce((s: number, i: any) => s + i.value, 0) },
        bucket_90_plus: { count: b90_plus.length, value: b90_plus.reduce((s: number, i: any) => s + i.value, 0) },
        total_value: itemsWithAging.reduce((s: number, i: any) => s + i.value, 0)
      },
      items: itemsWithAging.sort((a: any, b: any) => b.days_in_stock - a.days_in_stock)
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// 3. TOP KPIS & COUNTERS (إحصائيات وتقارير عامة وشاملة)
router.get(["/api/warehouse-kpis", "/api/inventory/reports/kpis"], async (_req, res) => {
  try {
    const [
      whRes,
      ingCountRes,
      ingsRes,
      invItemsRes,
      damagedRes,
      pendingGrnRes,
      transfersRes,
      wastageRes,
      cogsRes
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM warehouses").catch(() => ({ rows: [{ count: 1 }] })),
      pool.query("SELECT COUNT(*) as count FROM ingredients").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT id, avg_cost, min_stock, reorder_point, safety_stock FROM ingredients").catch(() => ({ rows: [] })),
      pool.query("SELECT ingredient_id, SUM(quantity) as qty FROM inventory_items GROUP BY ingredient_id").catch(() => ({ rows: [] })),
      pool.query("SELECT COALESCE(SUM(total_value), 0) as total FROM inventory_wastage WHERE status = 'approved' AND wastage_date >= date_trunc('month', CURRENT_DATE)").catch(() => ({ rows: [{ total: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM goods_receipts WHERE status IN ('draft', 'qc_pending', 'pending')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM warehouse_transfers WHERE status IN ('draft', 'pending', 'in_transit')").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query("SELECT COUNT(*) as count FROM inventory_wastage WHERE status = 'draft'").catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`
        SELECT COALESCE(SUM(ABS(COALESCE(quantity,0)) * COALESCE(unit_cost,0)), 0) as cogs
          FROM inventory_transactions
         WHERE COALESCE(type,'') NOT IN ('in','receive','receipt','return','transfer_in','adjustment_in','opening_balance','count_surplus','production_receipt')
           AND created_at >= date_trunc('year', CURRENT_DATE)
      `).catch(() => ({ rows: [{ cogs: 0 }] }))
    ]);

    const totalWarehouses = Number(whRes.rows[0]?.count || 1);
    const totalIngredients = Number(ingCountRes.rows[0]?.count || 0);
    const ings = ingsRes.rows || [];
    const invItems = invItemsRes.rows || [];

    const invMap = new Map<number, number>();
    for (const item of invItems) {
      invMap.set(Number(item.ingredient_id), Number(item.qty || 0));
    }

    let stockValue = 0;
    let lowStockCount = 0;

    for (const ing of ings) {
      const qty = invMap.get(Number(ing.id)) || 0;
      stockValue += (qty * Number(ing.avg_cost || 0));
      const minL = Number(ing.min_stock ?? ing.reorder_point ?? ing.safety_stock ?? 0);
      // A zero/absent threshold means "not tracked" and must not flag the item.
      if (minL > 0 && qty <= minL) lowStockCount++;
    }

    const damagedThisMonth = Number(damagedRes.rows[0]?.total || 0);
    const pendingGrn = Number(pendingGrnRes.rows[0]?.count || 0);
    const pendingTransfers = Number(transfersRes.rows[0]?.count || 0);
    const draftWastage = Number(wastageRes.rows[0]?.count || 0);
    const cogs = Number(cogsRes.rows[0]?.cogs || 0);
    // Without any issued-stock history the ratio is undefined, so report 0
    // rather than a fabricated 3.8 that hides the fact.
    const turnoverRate = stockValue > 0 ? Number((cogs / stockValue).toFixed(2)) : 0;

    res.json({
      total_warehouses: Number(totalWarehouses),
      total_ingredients: Number(totalIngredients),
      low_stock_count: Number(lowStockCount),
      total_stock_value: Number(stockValue.toFixed(2)),
      damaged_this_month: Number(damagedThisMonth.toFixed(2)),
      turnover_rate: Number(turnoverRate) || 0,
      pending_grn_count: Number(pendingGrn),
      pending_transfers_count: Number(pendingTransfers),
      draft_wastage_count: Number(draftWastage)
    });
  } catch (e: any) {
    res.json({
      total_warehouses: 1,
      total_ingredients: 0,
      low_stock_count: 0,
      total_stock_value: 0,
      damaged_this_month: 0,
      turnover_rate: 0,
      pending_grn_count: 0,
      pending_transfers_count: 0,
      draft_wastage_count: 0
    });
  }
});

// 4. SUPPLIERS REPORT (تقرير أداء الموردين ومشتريات المخزن)
router.get(["/api/warehouse-suppliers-report", "/api/inventory/reports/suppliers"], async (_req, res) => {
  try {
    let suppliers: any[] = [];
    try {
      suppliers = (await pool.query("SELECT id, name, phone, email, tax_number FROM suppliers ORDER BY name")).rows;
    } catch {
      suppliers = [];
    }

    let grns: any[] = [];
    try {
      grns = (await pool.query("SELECT supplier_id, COUNT(*) as grn_count, COALESCE(SUM(total_amount), 0) as total_received, AVG(CASE WHEN qc_status = 'passed' THEN 100 ELSE 0 END) as quality_rate FROM goods_receipts GROUP BY supplier_id")).rows;
    } catch {
      try {
        grns = (await pool.query("SELECT supplier_id, COUNT(*) as grn_count, COALESCE(SUM(total_amount), 0) as total_received, 100 as quality_rate FROM purchases GROUP BY supplier_id")).rows;
      } catch {
        grns = [];
      }
    }

    const report = suppliers.map((sup: any) => {
      const g = grns.find((x: any) => Number(x.supplier_id) === Number(sup.id));
      return {
        id: sup.id,
        name: sup.name,
        phone: sup.phone || "—",
        email: sup.email || "—",
        grn_count: Number(g?.grn_count || 0),
        total_received: Number(g?.total_received || 0),
        quality_rate: g ? Math.round(Number(g.quality_rate || 95)) : 100,
        status: "معتمد"
      };
    }).sort((a: any, b: any) => b.total_received - a.total_received);

    res.json(report);
  } catch (e: any) {
    res.json([]);
  }
});

// ─────────────────────────────────────────────────────────────
// ABC ANALYSIS (Pareto)
// ─────────────────────────────────────────────────────────────
router.get("/api/warehouse-abc", async (_req, res) => {
  try {
    const ings = (await pool.query("SELECT * FROM ingredients")).rows;
    const invItems = (await pool.query("SELECT * FROM inventory_items")).rows;
    const classified = ings.map((ing: any) => {
      const qty = invItems.filter((i: any) => Number(i.ingredient_id) === Number(ing.id))
                          .reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
      const value = qty * Number(ing.avg_cost || 0);
      return { id: ing.id, name: ing.name, code: ing.code, unit: ing.unit, avg_cost: ing.avg_cost, qty, value };
    }).sort((a: any, b: any) => Number(b.value) - Number(a.value));
    const totalValue = classified.reduce((s: number, r: any) => s + Number(r.value), 0);
    let cumValue = 0;
    const withClass = classified.map((r: any) => {
      cumValue += Number(r.value);
      const cumPct = totalValue > 0 ? (cumValue / totalValue) * 100 : 0;
      let cls = "C";
      if (cumPct <= 80) cls = "A";
      else if (cumPct <= 95) cls = "B";
      return { ...r, cum_pct: cumPct.toFixed(2), class: cls };
    });
    res.json({ items: withClass, totalValue });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ─────────────────────────────────────────────────────────────
// STOCK VALUATION
// ─────────────────────────────────────────────────────────────
router.get("/api/warehouse-valuation", async (_req, res) => {
  try {
    const ings = (await pool.query("SELECT * FROM ingredients")).rows;
    const invItems = (await pool.query("SELECT * FROM inventory_items")).rows;
    const whs = (await pool.query("SELECT * FROM warehouses")).rows;
    const rows: any[] = [];
    for (const i of invItems) {
      if (Number(i.quantity || 0) <= 0) continue;
      const ing = ings.find((g: any) => Number(g.id) === Number(i.ingredient_id));
      const w = whs.find((wh: any) => Number(wh.id) === Number(i.warehouse_id));
      if (!ing || !w) continue;
      rows.push({
        warehouse_id: w.id, warehouse_name: w.name, warehouse_code: w.code,
        ingredient_id: ing.id, name: ing.name, code: ing.code, unit: ing.unit,
        quantity: Number(i.quantity), avg_cost: Number(ing.avg_cost || 0),
        last_purchase_price: Number(ing.last_purchase_price || 0),
        total_value: Number(i.quantity) * Number(ing.avg_cost || 0),
      });
    }
    rows.sort((a, b) => {
      const wc = (a.warehouse_name || "").localeCompare(b.warehouse_name || "", "ar");
      if (wc !== 0) return wc;
      return (a.name || "").localeCompare(b.name || "", "ar");
    });
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// STOCK BATCHES (Expiry Tracking — FEFO First Expiry First Out)
// ═══════════════════════════════════════════════════════════════
router.get("/api/stock-batches", async (req, res) => {
  try {
    const { warehouse_id, ingredient_id, status, expiring_only } = req.query;
    const batches = (await pool.query("SELECT * FROM stock_batches ORDER BY expiry_date ASC")).rows;
    const ings = (await pool.query("SELECT id, name, unit, barcode FROM ingredients")).rows;
    const whs = (await pool.query("SELECT id, name, code FROM warehouses")).rows;
    let result = batches.map((b: any) => {
      const ing = ings.find((g: any) => Number(g.id) === Number(b.ingredient_id));
      const wh = whs.find((w: any) => Number(w.id) === Number(b.warehouse_id));
      const today = new Date();
      const daysToExpiry = b.expiry_date ? Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
      return {
        ...b,
        ingredient_name: ing?.name || null,
        ingredient_unit: ing?.unit || null,
        barcode: ing?.barcode || null,
        warehouse_name: wh?.name || null,
        warehouse_code: wh?.code || null,
        days_to_expiry: daysToExpiry,
      };
    });
    if (warehouse_id && warehouse_id !== "all") result = result.filter((b: any) => Number(b.warehouse_id) === Number(warehouse_id));
    if (ingredient_id) result = result.filter((b: any) => Number(b.ingredient_id) === Number(ingredient_id));
    if (status) result = result.filter((b: any) => b.status === status);
    if (expiring_only === "true") result = result.filter((b: any) => b.days_to_expiry !== null && b.days_to_expiry <= 7);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/stock-batches", async (req, res) => {
  try {
    const { ingredient_id, warehouse_id, batch_number, received_date, expiry_date, quantity, cost, supplier_id } = req.body;
    const r = await pool.query(
      `INSERT INTO stock_batches (ingredient_id, warehouse_id, batch_number, received_date, expiry_date, quantity, original_quantity, cost, supplier_id, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active') RETURNING id`,
      [ingredient_id, warehouse_id, batch_number || `B-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`, received_date || new Date().toISOString().split("T")[0], expiry_date || null, quantity, quantity, cost || 0, supplier_id || null]
    );
    res.json({ id: r.rows[0].id, success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/stock-batches/:id", async (req, res) => {
  try {
    const { batch_number, expiry_date, quantity, cost, status } = req.body;
    await pool.query(
      `UPDATE stock_batches SET batch_number=$1, expiry_date=$2, quantity=$3, cost=$4, status=$5 WHERE id=$6`,
      [batch_number, expiry_date, quantity, cost, status || "active", req.params.id]
    );
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/stock-batches/:id", async (req, res) => {
  try { await pool.query("DELETE FROM stock_batches WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS (Low Stock + Expiry Alerts)
// ═══════════════════════════════════════════════════════════════
router.get("/api/inventory-notifications", async (req, res) => {
  try {
    const { unread_only } = req.query;
    // Refresh expiry notifications before returning
    await checkExpiryNotifications();
    let notifs = (await pool.query("SELECT * FROM inventory_notifications ORDER BY created_at DESC, id DESC")).rows;
    const ings = (await pool.query("SELECT id, name FROM ingredients")).rows;
    const whs = (await pool.query("SELECT id, name FROM warehouses")).rows;
    notifs = notifs.map((n: any) => ({
      ...n,
      ingredient_name: ings.find((i: any) => Number(i.id) === Number(n.ingredient_id))?.name || null,
      warehouse_name: whs.find((w: any) => Number(w.id) === Number(n.warehouse_id))?.name || null,
    }));
    if (unread_only === "true") notifs = notifs.filter((n: any) => !n.read);
    res.json(notifs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/inventory-notifications/:id/read", async (req, res) => {
  try { await pool.query("UPDATE inventory_notifications SET read=true WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put("/api/inventory-notifications/read-all", async (_req, res) => {
  try { await pool.query("UPDATE inventory_notifications SET read=true WHERE read=false"); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/inventory-notifications/:id", async (req, res) => {
  try { await pool.query("DELETE FROM inventory_notifications WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// SUPPLIER RATINGS
// ═══════════════════════════════════════════════════════════════
router.get("/api/supplier-ratings/:supplierId", async (req, res) => {
  try {
    const ratings = (await pool.query("SELECT * FROM supplier_ratings WHERE supplier_id=$1 ORDER BY created_at DESC", [req.params.supplierId])).rows;
    const avgRating = ratings.length > 0 ? (ratings.reduce((s: number, r: any) => s + Number(r.rating), 0) / ratings.length) : 0;
    // Group by criteria
    const byCriteria: any = {};
    for (const r of ratings) {
      if (!byCriteria[r.criteria]) byCriteria[r.criteria] = [];
      byCriteria[r.criteria].push(Number(r.rating));
    }
    const criteriaAverages = Object.entries(byCriteria).map(([criteria, vals]: [string, any]) => ({
      criteria,
      average: vals.reduce((s: number, v: number) => s + v, 0) / vals.length,
      count: vals.length,
    }));
    res.json({ ratings, average: avgRating.toFixed(2), count: ratings.length, criteria_averages: criteriaAverages });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/api/supplier-ratings", async (req, res) => {
  try {
    const { supplier_id, rating, criteria, comment } = req.body;
    if (!supplier_id || !rating || !criteria) return res.status(400).json({ error: "Missing required fields" });
    const r = await pool.query(
      `INSERT INTO supplier_ratings (supplier_id, rating, criteria, comment, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [supplier_id, Number(rating), criteria, comment || "", new Date().toISOString().split("T")[0]]
    );
    res.json({ id: r.rows[0].id, success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.delete("/api/supplier-ratings/:id", async (req, res) => {
  try { await pool.query("DELETE FROM supplier_ratings WHERE id=$1", [req.params.id]); res.json({ success: true }); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// INVENTORY TURNOVER REPORT
// Turnover = Cost of Goods Sold (out transactions) / Average Inventory Value
// ═══════════════════════════════════════════════════════════════
router.get("/api/warehouse-turnover", async (req, res) => {
  try {
    const { days } = req.query;
    const periodDays = Number(days) || 30;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - periodDays);
    const startStr = startDate.toISOString().split("T")[0];

    const ings = (await pool.query("SELECT * FROM ingredients")).rows;
    const invItems = (await pool.query("SELECT * FROM inventory_items")).rows;
    const txs = (await pool.query("SELECT * FROM inventory_transactions WHERE date >= $1", [startStr])).rows;

    // Calculate COGS per ingredient (out-type transactions)
    const cogsByIng = new Map<number, number>();
    const outTypes = ["issue", "damaged"];
    for (const tx of txs) {
      if (!outTypes.includes(tx.type)) continue;
      let items: any[] = [];
      try { items = typeof tx.items === "string" ? JSON.parse(tx.items) : (tx.items || []); } catch { items = []; }
      for (const it of items) {
        const ing = ings.find((g: any) => Number(g.id) === Number(it.ingredient_id));
        const cost = Number(it.price) || Number(ing?.avg_cost) || 0;
        cogsByIng.set(Number(it.ingredient_id), (cogsByIng.get(Number(it.ingredient_id)) || 0) + Number(it.quantity) * cost);
      }
    }

    // Build result per ingredient
    const result = ings.map((ing: any) => {
      const items = invItems.filter((i: any) => Number(i.ingredient_id) === Number(ing.id));
      const currentQty = items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
      const avgInvValue = currentQty * Number(ing.avg_cost || 0) / 2; // crude average
      const cogs = cogsByIng.get(Number(ing.id)) || 0;
      const turnover = avgInvValue > 0 ? cogs / avgInvValue : 0;
      const daysOfSupply = cogs > 0 ? Math.round((currentQty / (cogs / periodDays)) || 0) : null;
      return {
        id: ing.id, name: ing.name, code: ing.code, unit: ing.unit, category: ing.category,
        current_qty: currentQty,
        avg_cost: Number(ing.avg_cost || 0),
        inventory_value: currentQty * Number(ing.avg_cost || 0),
        cogs_period: cogs,
        turnover_ratio: Number(turnover.toFixed(2)),
        days_of_supply: daysOfSupply,
        status: turnover === 0 ? "no_movement" : turnover < 0.5 ? "slow_moving" : turnover < 1 ? "normal" : "fast_moving",
      };
    }).sort((a: any, b: any) => a.turnover_ratio - b.turnover_ratio); // slowest first

    const totalInvValue = result.reduce((s: number, r: any) => s + r.inventory_value, 0);
    const totalCogs = result.reduce((s: number, r: any) => s + r.cogs_period, 0);
    const overallTurnover = totalInvValue > 0 ? totalCogs / (totalInvValue / 2) : 0;

    res.json({
      period_days: periodDays,
      start_date: startStr,
      items: result,
      summary: {
        total_inventory_value: totalInvValue,
        total_cogs: totalCogs,
        overall_turnover_ratio: Number(overallTurnover.toFixed(2)),
        slow_moving_count: result.filter((r: any) => r.status === "slow_moving").length,
        no_movement_count: result.filter((r: any) => r.status === "no_movement").length,
        fast_moving_count: result.filter((r: any) => r.status === "fast_moving").length,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// SLOW-MOVING ITEMS REPORT (no out-movements in last N days)
// ═══════════════════════════════════════════════════════════════
router.get("/api/warehouse-slow-moving", async (req, res) => {
  try {
    const { days } = req.query;
    const periodDays = Number(days) || 30;
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - periodDays);
    const startStr = startDate.toISOString().split("T")[0];

    const ings = (await pool.query("SELECT * FROM ingredients")).rows;
    const invItems = (await pool.query("SELECT * FROM inventory_items")).rows;
    const txs = (await pool.query("SELECT * FROM inventory_transactions WHERE date >= $1 AND type IN ('issue','damaged')", [startStr])).rows;

    // Set of ingredient IDs that had out-movements
    const movedIngIds = new Set<number>();
    for (const tx of txs) {
      let items: any[] = [];
      try { items = typeof tx.items === "string" ? JSON.parse(tx.items) : (tx.items || []); } catch { items = []; }
      for (const it of items) movedIngIds.add(Number(it.ingredient_id));
    }

    // Slow-moving = has stock but no out-movements in the period
    const slowMoving = ings.filter((ing: any) => {
      const hasStock = invItems.some((i: any) => Number(i.ingredient_id) === Number(ing.id) && Number(i.quantity) > 0);
      return hasStock && !movedIngIds.has(Number(ing.id));
    }).map((ing: any) => {
      const items = invItems.filter((i: any) => Number(i.ingredient_id) === Number(ing.id));
      const qty = items.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);
      return {
        id: ing.id, name: ing.name, code: ing.code, unit: ing.unit, category: ing.category,
        quantity: qty,
        avg_cost: Number(ing.avg_cost || 0),
        inventory_value: qty * Number(ing.avg_cost || 0),
        last_purchase_price: Number(ing.last_purchase_price || 0),
        days_without_movement: periodDays,
      };
    }).sort((a: any, b: any) => b.inventory_value - a.inventory_value);

    const totalStuckValue = slowMoving.reduce((s: number, r: any) => s + r.inventory_value, 0);

    res.json({
      period_days: periodDays,
      items: slowMoving,
      summary: {
        count: slowMoving.length,
        total_stuck_value: totalStuckValue,
      },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// MULTI-LEVEL APPROVALS
// Returns the required approval level for a given transaction total value
// ═══════════════════════════════════════════════════════════════
router.get("/api/warehouse-approval-level/:total", async (req, res) => {
  try {
    const total = Number(req.params.total) || 0;
    let level = 1;
    let description = "موافقة واحدة (مدير المخازن)";
    if (total > APPROVAL_THRESHOLDS.LEVEL_2) {
      level = 3;
      description = "ثلاث موافقات (مدير المخازن + المالي + المدير العام)";
    } else if (total > APPROVAL_THRESHOLDS.LEVEL_1) {
      level = 2;
      description = "موافقتان (مدير المخازن + المالي)";
    }
    res.json({ total, level, description, threshold_1: APPROVAL_THRESHOLDS.LEVEL_1, threshold_2: APPROVAL_THRESHOLDS.LEVEL_2 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Cancel transfer with mandatory reason
router.put("/api/warehouse-transfers/:id/cancel", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const trfId = Number(req.params.id);
    const { user, reason } = req.body;
    if (!reason || String(reason).trim().length < 3) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "سبب الإلغاء مطلوب (٣ أحرف على الأقل)" });
    }
    const trf = (await client.query("SELECT * FROM warehouse_transfers WHERE id=$1", [trfId])).rows[0];
    if (!trf) { await client.query("ROLLBACK"); return res.status(404).json({ error: "التحويل غير موجود" }); }
    if (trf.status === "cancelled" || trf.status === "received") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "لا يمكن إلغاء تحويل منتهي" });
    }
    // If in_transit, reverse in_transit
    if (trf.status === "in_transit") {
      const items = typeof trf.items === "string" ? JSON.parse(trf.items) : (trf.items || []);
      for (const item of items) {
        await applyStockMovement(client, {
          warehouse_id: Number(trf.to_warehouse_id), ingredient_id: Number(item.ingredient_id),
          delta: -Number(item.quantity), field: "in_transit",
          ref_type: "transfer", ref_id: trfId, user: user || "admin",
          notes: `إلغاء تحويل - السبب: ${reason}`,
        });
      }
    }
    await client.query("UPDATE warehouse_transfers SET status='cancelled', notes=CONCAT(COALESCE(notes,''),' | سبب الإلغاء: ', $1), updated_at=NOW() WHERE id=$2", [reason, trfId]);
    await client.query("COMMIT");
    res.json({ success: true });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: e.message });
  } finally { client.release(); }
});

// ═══════════════════════════════════════════════════════════════
// INVENTORY COUNTS & STOCKTAKING (إدارة وجرد المخازن والتسوية)
// ═══════════════════════════════════════════════════════════════

// 1. Get list of inventory counts
router.get("/api/inventory/counts", async (req, res) => {
  try {
    const { warehouse_id, status, search } = req.query;
    let query = `
      SELECT c.*, w.name as warehouse_name, w.code as warehouse_code,
             u.name as user_name, u2.name as approved_by_name,
             (SELECT COUNT(*) FROM inventory_count_items WHERE inventory_count_id = c.id) as items_count,
             (SELECT COUNT(*) FROM inventory_count_items WHERE inventory_count_id = c.id AND status = 'matched') as matched_count,
             (SELECT COUNT(*) FROM inventory_count_items WHERE inventory_count_id = c.id AND status = 'shortage') as shortage_count,
             (SELECT COUNT(*) FROM inventory_count_items WHERE inventory_count_id = c.id AND status = 'surplus') as surplus_count
      FROM inventory_counts c
      LEFT JOIN warehouses w ON c.warehouse_id = w.id
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN users u2 ON c.approved_by = u2.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (warehouse_id && warehouse_id !== "all") {
      params.push(Number(warehouse_id));
      query += ` AND c.warehouse_id = $${params.length}`;
    }
    if (status && status !== "all") {
      params.push(status);
      query += ` AND c.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (c.inventory_no ILIKE $${params.length} OR c.notes ILIKE $${params.length})`;
    }
    query += ` ORDER BY c.id DESC`;

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 2. Prepare new inventory count session with active items and book quantities
router.get("/api/inventory/counts/prepare-new", async (req, res) => {
  try {
    const rawWh = req.query.warehouse_id;
    const warehouseId = rawWh && rawWh !== "all" && !isNaN(Number(rawWh)) ? Number(rawWh) : null;
    const year = new Date().getFullYear();
    const prefix = `GR-${year}-`;
    
    // Generate next inventory number
    const lastCount = await pool.query(
      `SELECT inventory_no FROM inventory_counts WHERE inventory_no LIKE $1 ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );
    let nextNumber = "001";
    if (lastCount.rows.length > 0) {
      const parts = lastCount.rows[0].inventory_no.split("-");
      const lastSeq = parseInt(parts[parts.length - 1] || "0", 10);
      nextNumber = String(lastSeq + 1).padStart(3, "0");
    }
    const inventory_no = `${prefix}${nextNumber}`;
    const inventory_date = new Date().toISOString().split("T")[0];

    // Fetch items with quantities
    let itemsQuery = `
      SELECT 
        ing.id as product_id,
        ing.id as ingredient_id,
        ing.code,
        ing.name,
        COALESCE(ing.unit, 'قطعة') as unit,
        COALESCE(ing.cost, ing.cost_per_unit, 0) as cost_price,
        ing.barcode,
        ing.category,
        COALESCE(ii.warehouse_id, ${warehouseId || 'COALESCE((SELECT id FROM warehouses WHERE status=\'active\' ORDER BY id LIMIT 1), 1)'}) as warehouse_id,
        COALESCE(w.name, 'المخزن الرئيسي') as warehouse_name,
        COALESCE(ii.quantity, 0) as book_quantity
      FROM ingredients ing
      LEFT JOIN inventory_items ii ON ing.id = ii.ingredient_id ${warehouseId ? `AND ii.warehouse_id = ${warehouseId}` : ''}
      LEFT JOIN warehouses w ON ii.warehouse_id = w.id
      WHERE ing.status != 'archived' OR ing.status IS NULL
      ORDER BY ing.name ASC
    `;

    const itemsRes = await pool.query(itemsQuery);
    const formattedItems = itemsRes.rows.map((row: any) => {
      const bookQty = Number(
        row.book_quantity ??
        row.quantity ??
        row.current_stock ??
        row.available_stock ??
        0
      );
      const cost = Number(
        row.cost_price ??
        row.unit_cost ??
        row.cost ??
        row.avg_cost ??
        row.standard_cost ??
        row.last_cost ??
        row.last_purchase_price ??
        0
      );
      return {
        product_id: row.product_id || row.ingredient_id || row.id,
        ingredient_id: row.ingredient_id || row.id,
        code: row.code || row.item_code || `ITM-${row.id || row.product_id || row.ingredient_id}`,
        name: row.name || row.ingredient_name,
        unit: row.unit || "قطعة",
        warehouse_id: row.warehouse_id || warehouseId || 1,
        warehouse_name: row.warehouse_name || "المخزن الرئيسي",
        book_quantity: bookQty,
        physical_quantity: bookQty, // Defaults to book qty for seamless counting
        difference_quantity: 0,
        cost_price: cost,
        difference_cost: 0,
        difference_percent: 0,
        status: "matched",
        notes: ""
      };
    });

    const warehousesRes = await pool.query(`SELECT id, name, code FROM warehouses WHERE status='active' ORDER BY name ASC`);

    res.json({
      success: true,
      inventory_no,
      inventory_date,
      user: { id: 1, name: "المشرف العام" },
      items: formattedItems,
      warehouses: warehousesRes.rows
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 3. Get single inventory count details
router.get("/api/inventory/counts/:id", async (req, res) => {
  try {
    const countId = Number(req.params.id);
    const countRes = await pool.query(
      `SELECT c.*, w.name as warehouse_name, w.code as warehouse_code,
              u.name as user_name, u2.name as approved_by_name
       FROM inventory_counts c
       LEFT JOIN warehouses w ON c.warehouse_id = w.id
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN users u2 ON c.approved_by = u2.id
       WHERE c.id = $1`,
      [countId]
    );

    if (countRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: "عملية الجرد غير موجودة" });
    }

    const itemsRes = await pool.query(
      `SELECT ci.*, ing.name, ing.code, ing.unit, ing.barcode, w.name as warehouse_name
       FROM inventory_count_items ci
       LEFT JOIN ingredients ing ON ci.ingredient_id = ing.id
       LEFT JOIN warehouses w ON ci.warehouse_id = w.id
       WHERE ci.inventory_count_id = $1
       ORDER BY ci.id ASC`,
      [countId]
    );

    res.json({
      success: true,
      count: countRes.rows[0],
      items: itemsRes.rows
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// 4. Save or create inventory count
router.post("/api/inventory/counts", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { inventory_no, inventory_date, warehouse_id, notes, items, user_name } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "يجب إدراج صنف واحد على الأقل في الجرد" });
    }

    const year = new Date().getFullYear();
    const countNo = inventory_no || `GR-${year}-${Date.now().toString().slice(-4)}`;
    const whId = warehouse_id && warehouse_id !== "all" ? Number(warehouse_id) : null;

    let totalDiffCost = 0;
    const processedItems = items.map((i: any) => {
      const bookQty = Number(i.book_quantity || 0);
      const physQty = Math.max(0, Number(i.physical_quantity || 0));
      const diffQty = Number((physQty - bookQty).toFixed(3));
      const costPrice = Number(i.cost_price || 0);
      const diffCost = Number((diffQty * costPrice).toFixed(2));
      const diffPercent = bookQty > 0 ? Number(((diffQty / bookQty) * 100).toFixed(2)) : (diffQty > 0 ? 100 : 0);
      
      let status = "matched";
      if (diffQty > 0) status = "surplus";
      if (diffQty < 0) status = "shortage";

      totalDiffCost += diffCost;

      return {
        ...i,
        book_quantity: bookQty,
        physical_quantity: physQty,
        difference_quantity: diffQty,
        cost_price: costPrice,
        difference_cost: diffCost,
        difference_percent: diffPercent,
        status
      };
    });

    const countInsert = await client.query(
      `INSERT INTO inventory_counts 
        (inventory_no, inventory_date, warehouse_id, user_id, status, notes, total_difference_cost, created_at, updated_at)
       VALUES ($1, $2, $3, 1, 'in_progress', $4, $5, NOW(), NOW())
       RETURNING id`,
      [countNo, inventory_date || new Date(), whId, notes || "", totalDiffCost]
    );
    const countId = countInsert.rows[0].id;

    for (const itm of processedItems) {
      const ingId = itm.ingredient_id || itm.product_id;
      const itmWhId = itm.warehouse_id ? Number(itm.warehouse_id) : (whId || 1);

      await client.query(
        `INSERT INTO inventory_count_items
          (inventory_count_id, ingredient_id, product_id, warehouse_id, book_quantity, physical_quantity, difference_quantity, cost_price, difference_cost, difference_percent, status, notes, is_settled, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0, NOW(), NOW())`,
        [
          countId,
          ingId,
          ingId,
          itmWhId,
          itm.book_quantity,
          itm.physical_quantity,
          itm.difference_quantity,
          itm.cost_price,
          itm.difference_cost,
          itm.difference_percent,
          itm.status,
          itm.notes || null
        ]
      );
    }

    await client.query("COMMIT");
    res.json({
      success: true,
      message: "تم حفظ مسودة الجرد بنجاح",
      count_id: countId,
      inventory_no: countNo
    });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// 5. Approve Inventory Count & Auto-Post Adjustments to Warehouses
router.post("/api/inventory/counts/:id/approve", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const countId = Number(req.params.id);
    const countRes = await client.query(`SELECT * FROM inventory_counts WHERE id = $1`, [countId]);
    if (countRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "عملية الجرد غير موجودة" });
    }
    const count = countRes.rows[0];
    if (count.status === "approved") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "تم اعتماد هذا الجرد مسبقاً" });
    }

    const itemsRes = await client.query(
      `SELECT ci.*, ing.name as ingredient_name 
       FROM inventory_count_items ci 
       LEFT JOIN ingredients ing ON ci.ingredient_id = ing.id 
       WHERE ci.inventory_count_id = $1`,
      [countId]
    );
    const countItems = itemsRes.rows;

    // Transaction Number for audit
    const txNumber = `TX-ADJ-${Date.now().toString().slice(-6)}`;

    for (const item of countItems) {
      const diffQty = Number(item.difference_quantity);
      if (diffQty !== 0) {
        const ingId = Number(item.ingredient_id || item.product_id);
        const whId = Number(item.warehouse_id);

        // Apply movement delta to inventory items
        await applyStockMovement(client, {
          warehouse_id: whId,
          ingredient_id: ingId,
          delta: diffQty,
          field: "quantity",
          ref_type: "count",
          ref_id: countId,
          user: req.body.user || "المشرف العام",
          notes: `تسوية جرد آلي رقم ${count.inventory_no} - ${diffQty > 0 ? "فائض جرد (+)" : "عجز جرد (-)"}`,
          unit_cost: Number(item.cost_price),
          ingredient_name: item.ingredient_name
        });

        // inventory_transactions is written by moveStock for every movement.

        // Mark item settled
        await client.query(
          `UPDATE inventory_count_items SET is_settled = 1, updated_at = NOW() WHERE id = $1`,
          [item.id]
        );
      }
    }

    // Mark count approved
    await client.query(
      `UPDATE inventory_counts 
       SET status = 'approved', approved_at = NOW(), approved_by = 1, updated_at = NOW() 
       WHERE id = $1`,
      [countId]
    );

    // Emit event for accounting/ERP integration
    ERPEventBus.getInstance().emitEvent("InventoryCountApproved", {
      count_id: countId,
      inventory_no: count.inventory_no,
      total_diff_cost: count.total_difference_cost,
      items: countItems
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      message: `تم اعتماد الجرد رقم ${count.inventory_no} وترحيل قيود وفروقات التسوية بنجاح إلى أرصدة المخازن`
    });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// 6. Settle Single Item
router.post("/api/inventory/counts/:id/settle-item", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const countId = Number(req.params.id);
    const { item_id, user } = req.body;
    
    const itemRes = await client.query(
      `SELECT ci.*, ing.name as ingredient_name, c.inventory_no
       FROM inventory_count_items ci
       JOIN inventory_counts c ON ci.inventory_count_id = c.id
       LEFT JOIN ingredients ing ON ci.ingredient_id = ing.id
       WHERE ci.id = $1 AND ci.inventory_count_id = $2`,
      [item_id, countId]
    );

    if (itemRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "بند الجرد غير موجود" });
    }

    const item = itemRes.rows[0];
    const diffQty = Number(item.difference_quantity);

    if (diffQty !== 0 && !item.is_settled) {
      await applyStockMovement(client, {
        warehouse_id: Number(item.warehouse_id),
        ingredient_id: Number(item.ingredient_id || item.product_id),
        delta: diffQty,
        field: "quantity",
        ref_type: "count_item",
        ref_id: item.id,
        user: user || "admin",
        notes: `تسوية بند فردي جرد ${item.inventory_no}`,
        unit_cost: Number(item.cost_price),
        ingredient_name: item.ingredient_name
      });

      await client.query(
        `UPDATE inventory_count_items SET is_settled = 1, updated_at = NOW() WHERE id = $1`,
        [item.id]
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "تمت تسوية البند بنجاح" });
  } catch (e: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

export default router;
