/**
 * مسارات توافقية للواجهة (Compatibility routes)
 * ------------------------------------------------------------------
 * بعض شاشات الواجهة تستدعي مسارات لم تكن موجودة في الخلفية (404):
 *   GET  /api/hr/branches
 *   GET  /api/inventory/stock
 *   GET  /api/v2/sales/settings
 *   GET  /api/v2/sales/core-products-available
 *   GET  /api/warehouse-settings  + PUT /api/warehouse-settings/:id
 *
 * تُنفَّذ بأقل تدخّل: قراءة/تحديث فقط، مع نفس أشكال الاستجابة التي تتوقعها الواجهة.
 */
import { Router } from "express";
import { pool } from "../../server-db.js";

const router = Router();

// ── GET /api/hr/branches ─────────────────────────────────────
router.get("/api/hr/branches", async (_req, res) => {
  try {
    const r = await pool.query("SELECT * FROM branches ORDER BY id");
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/inventory/stock?warehouse_id=&product_id= ───────
router.get("/api/inventory/stock", async (req, res) => {
  try {
    const warehouseId = Number(req.query.warehouse_id);
    const productId = Number(req.query.product_id);
    if (!warehouseId || !productId) {
      return res.status(400).json({ error: "warehouse_id and product_id are required" });
    }

    // المصدر الرسمي للرصيد هو inventory_items (نفس الجدول الذي يخصم منه محرك المخزون).
    // stock_balances جدول قديم لا يُحدَّث في الدورات الحديثة، فلا يصلح كمصدر أول.
    const ingredientRes = await pool.query(
      `SELECT COALESCE(p.ingredient_id, (
          SELECT i.id FROM ingredients i WHERE i.name = p.name ORDER BY i.id LIMIT 1
       )) AS ingredient_id
         FROM products p WHERE p.id = $1`,
      [productId]
    );
    const ingredientId = Number(ingredientRes.rows[0]?.ingredient_id) || productId;

    const balance = await pool.query(
      "SELECT COALESCE(SUM(quantity),0)::numeric AS quantity, COALESCE(SUM(reserved),0)::numeric AS reserved FROM inventory_items WHERE warehouse_id=$1 AND ingredient_id=$2",
      [warehouseId, ingredientId]
    );
    let quantity = Number(balance.rows[0]?.quantity || 0);
    let reserved = Number(balance.rows[0]?.reserved || 0);

    // fallback: أرصدة قديمة محفوظة على جدول stock_balances
    if (!quantity && !reserved) {
      const legacy = await pool.query(
        "SELECT COALESCE(SUM(quantity),0)::numeric AS quantity FROM stock_balances WHERE warehouse_id=$1 AND product_id=$2",
        [warehouseId, productId]
      );
      quantity = Number(legacy.rows[0]?.quantity || 0);
    }

    res.json({
      warehouse_id: warehouseId,
      product_id: productId,
      ingredient_id: ingredientId,
      quantity,
      reserved,
      available: Math.max(quantity - reserved, 0),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET/PUT /api/v2/sales/settings ───────────────────────────
router.get("/api/v2/sales/settings", async (_req, res) => {
  try {
    const r = await pool.query("SELECT setting_key, setting_value, description FROM sales_general_settings ORDER BY setting_key");
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/api/v2/sales/settings", async (req, res) => {
  try {
    const key = String(req.body?.key || req.body?.setting_key || "").trim();
    if (!key) return res.status(400).json({ error: "key is required" });
    const value = req.body?.value ?? req.body?.setting_value ?? null;
    const r = await pool.query(
      `INSERT INTO sales_general_settings (setting_key, setting_value, updated_at)
       VALUES ($1,$2,NOW())
       ON CONFLICT (setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value, updated_at=NOW()
       RETURNING setting_key, setting_value`,
      [key, value]
    );
    res.json(r.rows[0]);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── GET /api/v2/sales/core-products-available?q= ─────────────
router.get("/api/v2/sales/core-products-available", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const like = `%${q}%`;
    const r = await pool.query(
      `SELECT id, name, price, code, barcode, unit, stock, is_active
         FROM products
        WHERE is_active IS NOT FALSE
          AND ($1 = '' OR name ILIKE $2 OR COALESCE(code,'') ILIKE $2 OR COALESCE(barcode,'') ILIKE $2)
        ORDER BY name
        LIMIT 50`,
      [q, like]
    );
    res.json(r.rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/warehouse-settings + PUT /api/warehouse-settings/:id ──
const INVENTORY_SETTING_COLUMNS = [
  "costing_method",
  "allow_negative_stock",
  "require_approval_for_transactions",
  "require_qc_for_receipts",
  "auto_post_receipts",
  "default_warehouse_id",
  "quarantine_warehouse_id",
  "scrap_warehouse_id",
  "expiry_warning_days",
  "enable_fefo",
  "enable_multi_uom",
  "enable_barcode_scanner",
  "enable_ai_reorder",
  "inventory_policy",
  "default_reorder_point",
  "allowed_wastage_percentage",
  "lock_stock_during_count",
  "auto_link_accounts",
];

router.get("/api/warehouse-settings", async (_req, res) => {
  try {
    const r = await pool.query("SELECT * FROM inventory_settings ORDER BY id LIMIT 1");
    const row = r.rows[0] || {};
    const list = INVENTORY_SETTING_COLUMNS.map((col, index) => ({
      id: index + 1,
      key: col,
      label: col,
      value: row[col] ?? null,
      updated_at: row.updated_at || null,
    }));
    res.json(list);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/api/warehouse-settings/:id", async (req, res) => {
  try {
    const index = Number(req.params.id) - 1;
    const column = INVENTORY_SETTING_COLUMNS[index];
    if (!column) return res.status(400).json({ error: "setting not found" });
    const value = req.body?.value ?? null;

    const existing = await pool.query("SELECT id FROM inventory_settings ORDER BY id LIMIT 1");
    if (!existing.rows[0]) {
      await pool.query("INSERT INTO inventory_settings DEFAULT VALUES");
    }
    await pool.query(`UPDATE inventory_settings SET ${column} = $1, updated_at = NOW() WHERE id = (SELECT id FROM inventory_settings ORDER BY id LIMIT 1)`, [value]);
    res.json({ success: true, key: column, value });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
