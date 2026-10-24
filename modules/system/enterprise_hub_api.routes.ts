import { Router } from "express";
import { pool } from "../../server-db.js";
import { authenticateToken } from "./system_api.routes.js";

const router = Router();

async function ensureEnterpriseHubTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      user_id TEXT,
      reference_id TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
  `);
}

router.get("/api/enterprise/search", authenticateToken, async (req: any, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 50);
  if (q.length < 2) return res.json({ data: [] });
  try {
    const like = `%${q}%`;
    const sources: Array<[string, string, string, string]> = [
      ["customers", "العملاء", "name", "/api/customers"],
      ["suppliers", "الموردون", "name", "/api/suppliers"],
      ["products", "المنتجات", "name", "/api/products"],
      ["employees", "الموظفون", "name", "/api/hr/employees"],
      ["branches", "الفروع", "name", "/api/branches"],
      ["purchase_orders", "أوامر الشراء", "supplier_name", "/api/purchases"],
      ["approval_requests", "الموافقات", "title", "/api/approvals"],
    ];
    const results: any[] = [];
    for (const [table, label, column, path] of sources) {
      const exists = await pool.query("SELECT to_regclass($1) AS table_name", [table]);
      if (!exists.rows[0]?.table_name) continue;
      const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [table]);
      const names = new Set(cols.rows.map((r: any) => r.column_name));
      const searchCols = [column, "code", "phone", "email"].filter(c => names.has(c));
      if (!searchCols.length) continue;
      const where = searchCols.map((c, i) => `CAST(${c} AS TEXT) ILIKE $1`).join(" OR ");
      const idCol = names.has("id") ? "id" : "NULL";
      const titleCol = names.has(column) ? column : searchCols[0];
      const sql = `SELECT ${idCol} AS id, ${titleCol} AS title FROM ${table} WHERE ${where} ORDER BY ${names.has("id") ? "id DESC" : "1"} LIMIT $2`;
      const rows = await pool.query(sql, [like, Math.min(10, limit)]);
      rows.rows.forEach((r: any) => results.push({ type: table, label, id: r.id, title: r.title, path }));
      if (results.length >= limit) break;
    }
    res.json({ data: results.slice(0, limit), query: q });
  } catch (error: any) {
    console.error("Enterprise global search error:", error);
    res.status(500).json({ error: "SEARCH_FAILED", message: "تعذر تنفيذ البحث الموحد" });
  }
});

router.get("/api/enterprise/notifications", authenticateToken, async (req: any, res) => {
  try {
    await ensureEnterpriseHubTables();
    const userId = String(req.user?.id || req.user?.user_id || req.user?.username || "");
    const rows = await pool.query(`SELECT * FROM notifications WHERE user_id IS NULL OR user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId]);
    res.json({ data: rows.rows, unread: rows.rows.filter((n: any) => !n.is_read).length });
  } catch (error: any) {
    res.status(500).json({ error: "NOTIFICATIONS_FAILED", message: error.message });
  }
});

router.put("/api/enterprise/notifications/:id/read", authenticateToken, async (req: any, res) => {
  try {
    await ensureEnterpriseHubTables();
    const userId = String(req.user?.id || req.user?.user_id || req.user?.username || "");
    await pool.query(`UPDATE notifications SET is_read=true WHERE id=$1 AND (user_id IS NULL OR user_id=$2)`, [req.params.id, userId]);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: "NOTIFICATION_UPDATE_FAILED", message: error.message }); }
});

router.put("/api/enterprise/notifications/read-all", authenticateToken, async (req: any, res) => {
  try {
    await ensureEnterpriseHubTables();
    const userId = String(req.user?.id || req.user?.user_id || req.user?.username || "");
    await pool.query(`UPDATE notifications SET is_read=true WHERE user_id IS NULL OR user_id=$1`, [userId]);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: "NOTIFICATIONS_UPDATE_FAILED", message: error.message }); }
});

router.get("/api/enterprise/command-center", authenticateToken, async (_req, res) => {
  try {
    const queries = [
      ["customers", "SELECT COUNT(*)::int AS count FROM customers"],
      ["products", "SELECT COUNT(*)::int AS count FROM products"],
      ["employees", "SELECT COUNT(*)::int AS count FROM employees"],
      ["approvals", "SELECT COUNT(*)::int AS count FROM approval_requests WHERE status='pending'"],
    ] as const;
    const metrics: Record<string, number> = {};
    for (const [key, sql] of queries) {
      try { const r = await pool.query(sql); metrics[key] = r.rows[0]?.count || 0; } catch { metrics[key] = 0; }
    }
    res.json({ metrics, generated_at: new Date().toISOString() });
  } catch (error: any) { res.status(500).json({ error: "COMMAND_CENTER_FAILED", message: error.message }); }
});

// ── مسارات مسارات العمل (كانت تستدعيها الواجهة ولا وجود لها) ──
router.get("/api/enterprise/workflows", authenticateToken, async (_req: any, res: any) => {
  try {
    const r = await pool.query("SELECT * FROM workflow_definitions ORDER BY created_at DESC");
    res.json({ data: r.rows });
  } catch (error: any) { res.status(500).json({ error: "WORKFLOWS_LIST_FAILED", message: error.message }); }
});

router.post("/api/enterprise/workflows", authenticateToken, async (req: any, res: any) => {
  try {
    const { name, module_type, description, steps } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });
    const r = await pool.query(
      `INSERT INTO workflow_definitions (name, module_type, description, steps, is_active, created_by)
       VALUES ($1,$2,$3,$4,true,$5) RETURNING *`,
      [name, module_type || "custom", description || null, JSON.stringify(steps || []), req.user?.username || null]
    );
    res.status(201).json(r.rows[0]);
  } catch (error: any) { res.status(400).json({ error: "WORKFLOW_CREATE_FAILED", message: error.message }); }
});

router.put("/api/enterprise/workflows/:id", authenticateToken, async (req: any, res: any) => {
  try {
    const r = await pool.query(
      `UPDATE workflow_definitions SET is_active = COALESCE($1, is_active), updated_at = NOW() WHERE id = $2 RETURNING *`,
      [req.body?.is_active ?? null, req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "NOT_FOUND" });
    res.json(r.rows[0]);
  } catch (error: any) { res.status(400).json({ error: "WORKFLOW_UPDATE_FAILED", message: error.message }); }
});

router.delete("/api/enterprise/workflows/:id", authenticateToken, async (req: any, res: any) => {
  try {
    await pool.query("DELETE FROM workflow_definitions WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (error: any) { res.status(400).json({ error: "WORKFLOW_DELETE_FAILED", message: error.message }); }
});

// ── أرصدة المخزون لمسار Enterprise ────────────────────────
router.get("/api/enterprise/stock", authenticateToken, async (req: any, res: any) => {
  try {
    const warehouseId = Number(req.query.warehouse_id) || null;
    const r = await pool.query(
      `SELECT ii.id, ii.ingredient_id, ii.warehouse_id, ii.quantity, ii.avg_cost,
              i.name AS item_name, i.unit, w.name AS warehouse_name
         FROM inventory_items ii
         LEFT JOIN ingredients i ON i.id = ii.ingredient_id
         LEFT JOIN warehouses w ON w.id = ii.warehouse_id
        WHERE ($1::int IS NULL OR ii.warehouse_id = $1)
        ORDER BY i.name
        LIMIT 500`,
      [warehouseId]
    );
    res.json({ data: r.rows });
  } catch (error: any) { res.status(500).json({ error: "STOCK_LIST_FAILED", message: error.message }); }
});

export default router;
