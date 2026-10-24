import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { pool } from "../../../server-db.js";
import { moveStock } from "../services/inventory.service.js";

/**
 * ═══════════════════════════════════════════════════════════════════════
 * MATERIAL REQUESTS (طلبات وصرف المواد)
 * ───────────────────────────────────────────────────────────────────────
 * A material request is raised by a department against one specific
 * warehouse, approved by the department manager, then approved (and
 * reserved) by the warehouse manager, then finally issued (posted) by the
 * storekeeper. Issuing is the only step that physically moves stock and it
 * goes through the canonical stock engine (`moveStock`) so the item card,
 * KPIs, COGS and aging reports all see the movement.
 *
 * Endpoints are registered on the root router because the front-end calls
 * them as `/api/material-requests...` (see src/components/inventory).
 * ═══════════════════════════════════════════════════════════════════════
 */
const router = Router();

export const MR_STATUS = {
  draft: "draft",
  pendingDept: "pending_dept",
  pendingWh: "pending_wh",
  approved: "approved",
  partiallyIssued: "partially_issued",
  issued: "issued",
  rejected: "rejected",
  cancelled: "cancelled",
} as const;

const OPEN_APPROVAL_STATUSES = ["draft", "pending", "pending_dept", "pending_wh"];

const num = (value: any, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round = (value: number, digits = 4): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

function errorMessage(error: any): string {
  if (!error) return "خطأ غير معروف";
  if (error.code === "23505") return "رقم الطلب مستخدم بالفعل، أعد المحاولة";
  if (error.code === "23503") return "أحد الأصناف أو البيانات المرتبطة غير موجود";
  return error.message || String(error);
}

async function logAudit(client: any, data: {
  entity_type: string;
  entity_id?: number;
  action: string;
  user_name?: string;
  details?: string;
}) {
  try {
    await client.query(
      `INSERT INTO inventory_audit_trail (entity_type, entity_id, action, user_name, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, '127.0.0.1')`,
      [data.entity_type, data.entity_id ?? null, data.action, data.user_name || "System", data.details || null]
    );
  } catch {
    /* audit trail must never break the business transaction */
  }
}

/**
 * Self-healing guard: legacy databases are missing the workflow columns and
 * used to fail every approval / issue call with "column does not exist".
 * The DDL is idempotent and runs once per process.
 */
let schemaPromise: Promise<void> | null = null;
function ensureWorkflowColumns(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const statements = [
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_by_dept VARCHAR(150)",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_dept_at TIMESTAMP",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_by_wh VARCHAR(150)",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS approved_wh_at TIMESTAMP",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS issued_at TIMESTAMP",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS issued_by VARCHAR(150)",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150)",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS requested_by_name VARCHAR(150)",
        "ALTER TABLE material_requests ADD COLUMN IF NOT EXISTS total_value DECIMAL(16,4) DEFAULT 0",
        "ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(14,4) DEFAULT 0",
        "ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS purpose TEXT",
        "ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS line_no INTEGER",
        "ALTER TABLE material_request_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      ];
      for (const sql of statements) {
        try { await pool.query(sql); } catch { /* column already exists / no permission */ }
      }
    })();
  }
  return schemaPromise;
}

router.use(async (_req, _res, next) => {
  try { await ensureWorkflowColumns(); } catch { /* ignore */ }
  next();
});

// ───────────────────────────────────────────────────────────────────────
// Item catalogue for the request sheet: search by name / code / barcode
// with the live balance of the warehouse the request is raised against.
// ───────────────────────────────────────────────────────────────────────
router.get("/api/material-requests/items/search", async (req: Request, res: Response) => {
  try {
    const warehouseId = num(req.query.warehouse_id);
    if (!warehouseId) {
      return res.status(400).json({ success: false, error: "يجب تحديد المخزن أولاً", items: [] });
    }
    const term = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(num(req.query.limit, 30), 1), 200);
    const onlyInStock = ["1", "true", "yes"].includes(String(req.query.only_in_stock || "").toLowerCase());
    const ingredientId = num(req.query.ingredient_id);

    const params: any[] = [warehouseId];
    let where = ` WHERE COALESCE(i.is_active, true) = true `;
    if (term) {
      params.push(`%${term}%`);
      where += ` AND (
        i.name ILIKE $${params.length}
        OR COALESCE(i.name_en,'') ILIKE $${params.length}
        OR COALESCE(i.code,'') ILIKE $${params.length}
        OR COALESCE(i.item_code,'') ILIKE $${params.length}
        OR COALESCE(i.sku,'') ILIKE $${params.length}
        OR COALESCE(i.barcode,'') ILIKE $${params.length}
        OR COALESCE(i.short_name,'') ILIKE $${params.length}
      )`;
    }
    if (ingredientId) {
      params.push(ingredientId);
      where += ` AND i.id = $${params.length}`;
    }
    if (onlyInStock) where += " AND COALESCE(ii.quantity, 0) > 0 ";
    params.push(limit);

    const result = await pool.query(
      `SELECT i.id,
              i.name,
              COALESCE(NULLIF(i.code, ''), NULLIF(i.item_code, ''), NULLIF(i.sku, ''), '') AS code,
              COALESCE(NULLIF(i.barcode, ''), '') AS barcode,
              COALESCE(NULLIF(i.unit, ''), NULLIF(i.stock_unit, ''), 'وحدة') AS unit,
              COALESCE(ii.quantity, 0)::numeric AS on_hand_qty,
              COALESCE(ii.reserved, 0)::numeric AS reserved_qty,
              GREATEST(COALESCE(ii.quantity, 0) - COALESCE(ii.reserved, 0), 0)::numeric AS available_qty,
              COALESCE(NULLIF(ii.avg_cost, 0), NULLIF(ii.cost, 0), NULLIF(i.avg_cost, 0), NULLIF(i.cost, 0), 0)::numeric AS unit_cost,
              COALESCE(i.min_stock, 0)::numeric AS min_stock,
              i.category
         FROM ingredients i
         LEFT JOIN inventory_items ii
                ON ii.ingredient_id = i.id AND ii.warehouse_id = $1
        ${where}
        ORDER BY (COALESCE(ii.quantity, 0) > 0) DESC, i.name ASC
        LIMIT $${params.length}`,
      params
    );

    res.json({
      success: true,
      items: result.rows.map((row: any) => ({
        id: Number(row.id),
        name: row.name,
        code: row.code || "",
        barcode: row.barcode || "",
        unit: row.unit || "وحدة",
        category: row.category || "",
        on_hand_qty: num(row.on_hand_qty),
        reserved_qty: num(row.reserved_qty),
        available_qty: num(row.available_qty),
        unit_cost: num(row.unit_cost),
        min_stock: num(row.min_stock),
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: errorMessage(err), items: [] });
  }
});

// ───────────────────────────────────────────────────────────────────────
// KPIs
// ───────────────────────────────────────────────────────────────────────
router.get("/api/material-requests/kpis", async (req: Request, res: Response) => {
  try {
    const warehouseId = req.query.warehouse_id && req.query.warehouse_id !== "all" ? num(req.query.warehouse_id) : 0;
    const params: any[] = [];
    let whFilter = "";
    if (warehouseId) {
      params.push(warehouseId);
      whFilter = ` AND mr.warehouse_id = $${params.length}`;
    }

    const counts = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE date_trunc('month', COALESCE(mr.request_date, mr.created_at)) = date_trunc('month', CURRENT_DATE))::int AS total_month,
         COUNT(*) FILTER (WHERE mr.status IN ('draft','pending','pending_dept','pending_wh'))::int AS pending_approvals,
         COUNT(*) FILTER (WHERE mr.status IN ('approved','partially_issued'))::int AS pending_issue,
         COUNT(*) FILTER (WHERE mr.status = 'issued')::int AS issued_month,
         COUNT(*) FILTER (
           WHERE mr.priority IN ('urgent','high')
             AND mr.status IN ('draft','pending','pending_dept','pending_wh')
             AND COALESCE(mr.request_date, mr.created_at) < NOW() - INTERVAL '2 hours'
         )::int AS urgent_delayed
       FROM material_requests mr
       WHERE 1=1 ${whFilter}`,
      params
    );

    const valueParams: any[] = [];
    let valueWh = "";
    if (warehouseId) {
      valueParams.push(warehouseId);
      valueWh = ` AND mr.warehouse_id = $${valueParams.length}`;
    }
    const valueRes = await pool.query(
      `SELECT COALESCE(SUM(
                mri.requested_qty * COALESCE(NULLIF(mri.unit_cost, 0), NULLIF(ii.avg_cost, 0), NULLIF(i.avg_cost, 0), 0)
              ), 0)::numeric AS total_month_value
         FROM material_request_items mri
         JOIN material_requests mr ON mr.id = mri.request_id
         LEFT JOIN ingredients i ON i.id = mri.ingredient_id
         LEFT JOIN inventory_items ii
                ON ii.ingredient_id = mri.ingredient_id AND ii.warehouse_id = mr.warehouse_id
        WHERE date_trunc('month', COALESCE(mr.request_date, mr.created_at)) = date_trunc('month', CURRENT_DATE)
        ${valueWh}`,
      valueParams
    );

    const row = counts.rows[0] || {};
    res.json({
      success: true,
      kpis: {
        total_month: num(row.total_month),
        pending_approval: num(row.pending_approvals),
        pending_approvals: num(row.pending_approvals),
        pending_issue: num(row.pending_issue),
        issued_month: num(row.issued_month),
        urgent_overdue: num(row.urgent_delayed),
        urgent_delayed: num(row.urgent_delayed),
        total_month_value: num(valueRes.rows[0]?.total_month_value),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: errorMessage(err), kpis: {} });
  }
});

// ───────────────────────────────────────────────────────────────────────
// List
// ───────────────────────────────────────────────────────────────────────
router.get("/api/material-requests", async (req: Request, res: Response) => {
  try {
    const {
      warehouse_id, status, department, request_type, priority, search, limit,
    } = req.query as Record<string, any>;
    const fromDate = req.query.from_date || req.query.start_date;
    const toDate = req.query.to_date || req.query.end_date;

    const params: any[] = [];
    let query = `
      SELECT mr.*,
             w.name AS warehouse_name,
             w.code AS warehouse_code,
             COALESCE(NULLIF(mr.requested_by_name, ''), u.name, u.username) AS requester_name
        FROM material_requests mr
        LEFT JOIN warehouses w ON mr.warehouse_id = w.id
        LEFT JOIN users u ON mr.requested_by = u.id
       WHERE 1=1`;

    if (warehouse_id && warehouse_id !== "all") {
      params.push(num(warehouse_id));
      query += ` AND mr.warehouse_id = $${params.length}`;
    }
    if (status && status !== "all") {
      params.push(String(status));
      query += ` AND mr.status = $${params.length}`;
    }
    if (department && department !== "all") {
      params.push(String(department));
      query += ` AND mr.department = $${params.length}`;
    }
    if (request_type && request_type !== "all") {
      params.push(String(request_type));
      query += ` AND mr.request_type = $${params.length}`;
    }
    if (priority && priority !== "all") {
      params.push(String(priority));
      query += ` AND mr.priority = $${params.length}`;
    }
    if (fromDate) {
      params.push(String(fromDate));
      query += ` AND COALESCE(mr.request_date, mr.created_at) >= $${params.length}::date`;
    }
    if (toDate) {
      params.push(String(toDate));
      query += ` AND COALESCE(mr.request_date, mr.created_at) < ($${params.length}::date + INTERVAL '1 day')`;
    }
    if (search) {
      params.push(`%${String(search).trim()}%`);
      query += ` AND (
        mr.request_no ILIKE $${params.length}
        OR COALESCE(mr.department,'') ILIKE $${params.length}
        OR COALESCE(mr.cost_center,'') ILIKE $${params.length}
        OR COALESCE(mr.work_order_no,'') ILIKE $${params.length}
        OR COALESCE(mr.notes,'') ILIKE $${params.length}
        OR COALESCE(mr.requested_by_name,'') ILIKE $${params.length}
        OR EXISTS (
             SELECT 1 FROM material_request_items mri
               JOIN ingredients i ON i.id = mri.ingredient_id
              WHERE mri.request_id = mr.id
                AND (i.name ILIKE $${params.length} OR COALESCE(i.code,'') ILIKE $${params.length}
                     OR COALESCE(i.item_code,'') ILIKE $${params.length} OR COALESCE(i.barcode,'') ILIKE $${params.length})
           )
      )`;
    }

    const rowLimit = Math.min(Math.max(num(limit, 200), 1), 500);
    params.push(rowLimit);
    query += ` ORDER BY mr.id DESC LIMIT $${params.length}`;

    const result = await pool.query(query, params);
    const requests = result.rows || [];

    if (requests.length) {
      const ids = requests.map((r: any) => Number(r.id));
      const itemsRes = await pool.query(
        `SELECT mri.*,
                i.name AS ingredient_name,
                COALESCE(NULLIF(i.code,''), NULLIF(i.item_code,''), '') AS ingredient_code,
                COALESCE(NULLIF(i.unit,''), NULLIF(i.stock_unit,''), 'وحدة') AS ingredient_unit,
                i.barcode,
                COALESCE(NULLIF(ii.avg_cost,0), NULLIF(ii.cost,0), NULLIF(i.avg_cost,0), 0) AS live_unit_cost
           FROM material_request_items mri
           LEFT JOIN ingredients i ON i.id = mri.ingredient_id
           LEFT JOIN material_requests mr ON mr.id = mri.request_id
           LEFT JOIN inventory_items ii ON ii.ingredient_id = mri.ingredient_id AND ii.warehouse_id = mr.warehouse_id
          WHERE mri.request_id = ANY($1::int[])
          ORDER BY mri.line_no NULLS LAST, mri.id`,
        [ids]
      );

      const itemsByRequest = new Map<number, any[]>();
      for (const item of itemsRes.rows) {
        const list = itemsByRequest.get(Number(item.request_id)) || [];
        list.push(item);
        itemsByRequest.set(Number(item.request_id), list);
      }

      const enriched = requests.map((request: any) => {
        const items = (itemsByRequest.get(Number(request.id)) || []).map((item: any) => {
          const requestedQty = num(item.requested_qty);
          const approvedQty = num(item.approved_qty);
          const issuedQty = num(item.issued_qty);
          const unitCost = num(item.unit_cost) || num(item.live_unit_cost);
          return {
            ...item,
            requested_qty: requestedQty,
            approved_qty: approvedQty || requestedQty,
            issued_qty: issuedQty,
            remaining_qty: round(Math.max(0, (approvedQty || requestedQty) - issuedQty), 4),
            name: item.ingredient_name || "صنف",
            code: item.ingredient_code || "",
            unit: item.uom || item.ingredient_unit || "وحدة",
            unit_cost: unitCost,
            line_total: round(requestedQty * unitCost, 4),
          };
        });

        const totalValue = items.length
          ? items.reduce((sum: number, item: any) => sum + num(item.line_total), 0)
          : num(request.total_value);

        return {
          ...request,
          request_no: request.request_no || `MR-${request.id}`,
          items,
          items_count: items.length,
          total_qty: round(items.reduce((sum: number, item: any) => sum + num(item.requested_qty), 0), 4),
          total_issued_qty: round(items.reduce((sum: number, item: any) => sum + num(item.issued_qty), 0), 4),
          total_value: totalValue,
        };
      });

      return res.json({ success: true, material_requests: enriched });
    }

    res.json({ success: true, material_requests: [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: errorMessage(err), material_requests: [] });
  }
});

// ───────────────────────────────────────────────────────────────────────
// Details (with live warehouse balance per line)
// ───────────────────────────────────────────────────────────────────────
router.get("/api/material-requests/:id", async (req: Request, res: Response) => {
  try {
    const id = num(req.params.id);
    const headerRes = await pool.query(
      `SELECT mr.*,
              w.name AS warehouse_name,
              w.code AS warehouse_code,
              COALESCE(NULLIF(mr.requested_by_name,''), u.name, u.username) AS requester_name
         FROM material_requests mr
         LEFT JOIN warehouses w ON mr.warehouse_id = w.id
         LEFT JOIN users u ON mr.requested_by = u.id
        WHERE mr.id = $1`,
      [id]
    );

    if (!headerRes.rows.length) {
      return res.status(404).json({ success: false, error: "طلب الصرف غير موجود" });
    }
    const request = headerRes.rows[0];

    const itemsRes = await pool.query(
      `SELECT mri.*,
              i.name AS ingredient_name,
              COALESCE(NULLIF(i.code,''), NULLIF(i.item_code,''), '') AS ingredient_code,
              COALESCE(NULLIF(i.unit,''), NULLIF(i.stock_unit,''), 'وحدة') AS ingredient_unit,
              i.barcode,
              COALESCE(NULLIF(ii.avg_cost,0), NULLIF(ii.cost,0), NULLIF(i.avg_cost,0), 0) AS live_unit_cost,
              COALESCE(ii.quantity, 0)::numeric AS on_hand_qty,
              COALESCE(ii.reserved, 0)::numeric AS reserved_qty
         FROM material_request_items mri
         LEFT JOIN ingredients i ON i.id = mri.ingredient_id
         LEFT JOIN inventory_items ii ON ii.ingredient_id = mri.ingredient_id AND ii.warehouse_id = $1
        WHERE mri.request_id = $2
        ORDER BY mri.line_no NULLS LAST, mri.id`,
      [request.warehouse_id, id]
    );

    const items = itemsRes.rows.map((item: any) => {
      const requestedQty = num(item.requested_qty);
      const approvedQty = num(item.approved_qty) || requestedQty;
      const issuedQty = num(item.issued_qty);
      const unitCost = num(item.unit_cost) || num(item.live_unit_cost);
      const onHand = num(item.on_hand_qty);
      const reserved = num(item.reserved_qty);
      return {
        ...item,
        requested_qty: requestedQty,
        approved_qty: approvedQty,
        issued_qty: issuedQty,
        remaining_qty: round(Math.max(0, approvedQty - issuedQty), 4),
        name: item.ingredient_name || "صنف",
        code: item.ingredient_code || "",
        unit: item.uom || item.ingredient_unit || "وحدة",
        unit_cost: unitCost,
        line_total: round(approvedQty * unitCost, 4),
        on_hand_qty: onHand,
        reserved_qty: reserved,
        available_qty: round(Math.max(0, onHand - reserved), 4),
      };
    });

    const payload = {
      ...request,
      request_no: request.request_no || `MR-${request.id}`,
      items,
      items_count: items.length,
      total_qty: round(items.reduce((sum: number, item: any) => sum + item.requested_qty, 0), 4),
      total_value: items.reduce((sum: number, item: any) => sum + item.line_total, 0),
    };

    // `request` is kept as an alias so older callers keep working.
    res.json({ success: true, material_request: payload, request: payload, items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: errorMessage(err) });
  }
});

// ───────────────────────────────────────────────────────────────────────
// Create
// ───────────────────────────────────────────────────────────────────────
router.post("/api/material-requests", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const body = req.body || {};
    const warehouseId = num(body.warehouse_id);
    const rawItems: any[] = Array.isArray(body.items) ? body.items : [];
    const asDraft = String(body.status || "").toLowerCase() === "draft";

    if (!warehouseId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "اختر المخزن المطلوب الصرف منه" });
    }

    // Normalise + validate lines: no empty rows, no duplicated item, positive qty.
    const merged = new Map<number, { ingredient_id: number; requested_qty: number; purpose: string; notes: string; unit_cost: number }>();
    for (const raw of rawItems) {
      const ingredientId = num(raw.ingredient_id);
      const qty = round(num(raw.requested_qty), 4);
      if (!ingredientId || qty <= 0) continue;
      const existing = merged.get(ingredientId);
      if (existing) {
        existing.requested_qty = round(existing.requested_qty + qty, 4);
        existing.notes = existing.notes || raw.notes || "";
      } else {
        merged.set(ingredientId, {
          ingredient_id: ingredientId,
          requested_qty: qty,
          purpose: raw.purpose || raw.notes || "",
          notes: raw.notes || "",
          unit_cost: num(raw.unit_cost),
        });
      }
    }

    if (merged.size === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "أضف صنفاً واحداً على الأقل بكمية أكبر من صفر" });
    }

    const warehouseRes = await client.query(
      "SELECT id, name, COALESCE(allow_negative_stock, false) AS allow_negative_stock FROM warehouses WHERE id = $1",
      [warehouseId]
    );
    if (!warehouseRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "المخزن غير موجود" });
    }

    // Resolve names, units and costs from the item master (never trust the client for these).
    const ingredientIds = [...merged.keys()];
    const masterRes = await client.query(
      `SELECT i.id,
              i.name,
              COALESCE(NULLIF(i.unit,''), NULLIF(i.stock_unit,''), 'وحدة') AS unit,
              COALESCE(NULLIF(ii.avg_cost,0), NULLIF(ii.cost,0), NULLIF(i.avg_cost,0), NULLIF(i.cost,0), 0)::numeric AS unit_cost,
              COALESCE(ii.quantity, 0)::numeric AS on_hand_qty
         FROM ingredients i
         LEFT JOIN inventory_items ii ON ii.ingredient_id = i.id AND ii.warehouse_id = $2
        WHERE i.id = ANY($1::int[])`,
      [ingredientIds, warehouseId]
    );
    if (masterRes.rows.length !== ingredientIds.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "أحد الأصناف المختارة غير موجود في دليل الأصناف" });
    }
    const master = new Map<number, any>(masterRes.rows.map((row: any) => [Number(row.id), row]));

    const shortageWarnings: string[] = [];
    let totalValue = 0;
    for (const line of merged.values()) {
      const info = master.get(line.ingredient_id);
      if (!line.unit_cost) line.unit_cost = num(info?.unit_cost);
      totalValue += line.requested_qty * line.unit_cost;
      if (!warehouseRes.rows[0].allow_negative_stock && line.requested_qty > num(info?.on_hand_qty)) {
        shortageWarnings.push(`${info?.name}: المطلوب ${line.requested_qty} والمتاح ${num(info?.on_hand_qty)}`);
      }
    }

    const status = asDraft ? MR_STATUS.draft : MR_STATUS.pendingDept;

    let requestNo = "";
    let inserted: any = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      // Count the year's requests instead of parsing the number: legacy rows
      // were written as "MR-2026-20260002", so a digit-based MAX produced
      // ever-growing numbers. A collision with a deleted row is retried below.
      const seqRes = await client.query(
        `SELECT COUNT(*)::int AS seq
           FROM material_requests
          WHERE request_no LIKE $1`,
        [`MR-${new Date().getFullYear()}-%`]
      );
      const seq = Number(seqRes.rows[0]?.seq || 0) + 1 + attempt;
      requestNo = `MR-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
      try {
        const insertRes = await client.query(
          `INSERT INTO material_requests
             (request_no, date, request_date, warehouse_id, request_type, department, cost_center,
              employee_id, work_order_no, priority, needed_date, status, notes, total_value,
              requested_by, requested_by_name, attachments)
           VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           RETURNING *`,
          [
            requestNo,
            warehouseId,
            body.request_type || "operational",
            body.department || "غير محدد",
            body.cost_center || null,
            num(body.employee_id) || null,
            body.work_order_no || null,
            body.priority || "medium",
            body.needed_date || null,
            status,
            body.notes || null,
            round(totalValue, 4),
            num(body.requested_by) || null,
            body.requester_name || body.requested_by_name || null,
            JSON.stringify(Array.isArray(body.attachments) ? body.attachments : []),
          ]
        );
        inserted = insertRes.rows[0];
      } catch (insertError: any) {
        if (insertError?.code === "23505" && attempt < 4) continue;
        throw insertError;
      }
    }

    let lineNo = 0;
    for (const line of merged.values()) {
      lineNo += 1;
      const info = master.get(line.ingredient_id);
      await client.query(
        `INSERT INTO material_request_items
           (request_id, ingredient_id, requested_qty, approved_qty, issued_qty, unit_cost, uom, purpose, notes, line_no)
         VALUES ($1, $2, $3, 0, 0, $4, $5, $6, $7, $8)`,
        [
          inserted.id,
          line.ingredient_id,
          line.requested_qty,
          line.unit_cost,
          info?.unit || null,
          line.purpose || null,
          line.notes || null,
          lineNo,
        ]
      );
    }

    await logAudit(client, {
      entity_type: "material_request",
      entity_id: inserted.id,
      action: "create",
      user_name: body.user || "admin",
      details: `إنشاء طلب صرف ${requestNo} — القسم: ${body.department || "غير محدد"} — ${merged.size} صنف — القيمة: ${round(totalValue, 2)}`,
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      material_request: { ...inserted, request_no: requestNo, items_count: merged.size },
      warnings: shortageWarnings,
      message: `تم إنشاء طلب الصرف ${requestNo} بنجاح`,
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    res.status(500).json({ success: false, error: errorMessage(err) });
  } finally {
    client.release();
  }
});

// ───────────────────────────────────────────────────────────────────────
// Approval chain: department → warehouse
// Both verbs are accepted because older builds posted with POST while the
// original API only registered PUT (which is why approvals silently failed).
// ───────────────────────────────────────────────────────────────────────
const approveDeptHandler = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = num(req.params.id);
    const { user, notes, user_id } = req.body || {};

    const requestRes = await client.query("SELECT * FROM material_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!requestRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "الطلب غير موجود" });
    }
    const request = requestRes.rows[0];
    if (!OPEN_APPROVAL_STATUSES.includes(request.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: `لا يمكن اعتماد طلب بحالة «${request.status}». الطلبات القابلة للاعتماد: مسودة أو بانتظار الاعتماد.`,
      });
    }

    await client.query(
      `UPDATE material_requests
          SET status = $1,
              approved_by_dept = $2,
              approved_dept_at = CURRENT_TIMESTAMP,
              approved_by = COALESCE($3, approved_by),
              approved_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $4`,
      [MR_STATUS.pendingWh, user || "مدير القسم", num(user_id) || null, id]
    );

    await logAudit(client, {
      entity_type: "material_request",
      entity_id: id,
      action: "approve_dept",
      user_name: user || "مدير القسم",
      details: `اعتماد طلب الصرف ${request.request_no} من مدير القسم${notes ? ` — ${notes}` : ""}`,
    });

    await client.query("COMMIT");
    res.json({ success: true, status: MR_STATUS.pendingWh, message: "تم اعتماد الطلب من مدير القسم وإحالته إلى المخزن" });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    res.status(500).json({ success: false, error: errorMessage(err) });
  } finally {
    client.release();
  }
};

const approveWarehouseHandler = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = num(req.params.id);
    const { user, notes, user_id } = req.body || {};

    const requestRes = await client.query("SELECT * FROM material_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!requestRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "الطلب غير موجود" });
    }
    const request = requestRes.rows[0];
    if (![MR_STATUS.pendingWh, "pending"].includes(request.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: "لا يمكن الاعتماد المخزني إلا لطلب معتمد من القسم وبانتظار المخزن",
      });
    }

    const itemsRes = await client.query(
      "SELECT * FROM material_request_items WHERE request_id = $1 ORDER BY line_no NULLS LAST, id",
      [id]
    );
    if (!itemsRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "الطلب لا يحتوي على أصناف" });
    }

    const existingReservations = await client.query(
      "SELECT ingredient_id FROM stock_reservations WHERE reference_id = $1 AND reserved_for_type = 'material_request' AND status = 'active'",
      [id]
    );
    const alreadyReserved = new Set(existingReservations.rows.map((row: any) => Number(row.ingredient_id)));

    const shortages: string[] = [];
    for (const item of itemsRes.rows) {
      const qtyToReserve = num(item.approved_qty) || num(item.requested_qty);
      if (qtyToReserve <= 0 || alreadyReserved.has(Number(item.ingredient_id))) continue;

      // `allow_negative_stock` lives on `warehouses`, not on `inventory_items`;
      // selecting it from the stock row made every warehouse approval fail with
      // "column does not exist" and blocked the whole workflow.
      const stockRes = await client.query(
        `SELECT ii.quantity, ii.reserved,
                COALESCE(w.allow_negative_stock, false) AS wh_allows_negative
           FROM inventory_items ii
           JOIN warehouses w ON w.id = ii.warehouse_id
          WHERE ii.warehouse_id = $1 AND ii.ingredient_id = $2
          FOR UPDATE OF ii`,
        [request.warehouse_id, item.ingredient_id]
      );
      const onHand = num(stockRes.rows[0]?.quantity);
      const allowsNegative = Boolean(stockRes.rows[0]?.wh_allows_negative);
      if (stockRes.rows.length && !allowsNegative && onHand < qtyToReserve) {
        shortages.push(`الصنف #${item.ingredient_id}: المتاح ${onHand} والمطلوب ${qtyToReserve}`);
      }

      if (stockRes.rows.length) {
        await client.query(
          `UPDATE inventory_items
              SET reserved = COALESCE(reserved, 0) + $1,
                  available = GREATEST(COALESCE(quantity, 0) - (COALESCE(reserved, 0) + $1), 0),
                  updated_at = CURRENT_TIMESTAMP
            WHERE warehouse_id = $2 AND ingredient_id = $3`,
          [qtyToReserve, request.warehouse_id, item.ingredient_id]
        );
      }

      await client.query(
        `INSERT INTO stock_reservations
           (reservation_no, warehouse_id, ingredient_id, quantity, uom, reserved_for_type,
            reference_id, reference_no, notes, status)
         VALUES ($1, $2, $3, $4, $5, 'material_request', $6, $7, $8, 'active')`,
        [
          `RES-${id}-${item.ingredient_id}-${Date.now().toString().slice(-5)}`,
          request.warehouse_id,
          item.ingredient_id,
          qtyToReserve,
          item.uom || null,
          id,
          request.request_no,
          `حجز مواد لطلب الصرف ${request.request_no}`,
        ]
      );
    }

    // Freeze the approved quantity so issuing never exceeds what was approved.
    await client.query(
      `UPDATE material_request_items
          SET approved_qty = CASE WHEN COALESCE(approved_qty, 0) > 0 THEN approved_qty ELSE requested_qty END,
              updated_at = CURRENT_TIMESTAMP
        WHERE request_id = $1`,
      [id]
    );

    await client.query(
      `UPDATE material_requests
          SET status = $1,
              approved_by_wh = $2,
              approved_wh_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [MR_STATUS.approved, user || "مدير المخازن", id]
    );

    await logAudit(client, {
      entity_type: "material_request",
      entity_id: id,
      action: "approve_wh",
      user_name: user || "مدير المخازن",
      details: `اعتماد مخزني وحجز كميات لطلب الصرف ${request.request_no}${notes ? ` — ${notes}` : ""}`,
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      status: MR_STATUS.approved,
      warnings: shortages,
      message: shortages.length
        ? `تم اعتماد الطلب وحجز الكميات، مع ملاحظة نقص في ${shortages.length} صنف`
        : "تم اعتماد الطلب مخزنياً وحجز الكميات بنجاح، جاهز للصرف",
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    res.status(500).json({ success: false, error: errorMessage(err) });
  } finally {
    client.release();
  }
};

router.put("/api/material-requests/:id/approve-dept", approveDeptHandler);
router.post("/api/material-requests/:id/approve-dept", approveDeptHandler);
router.put("/api/material-requests/:id/approve-wh", approveWarehouseHandler);
router.post("/api/material-requests/:id/approve-wh", approveWarehouseHandler);

// ───────────────────────────────────────────────────────────────────────
// Reject / cancel — both release any active reservation
// ───────────────────────────────────────────────────────────────────────
async function releaseReservations(client: any, requestId: number, request: any, items: any[]) {
  for (const item of items) {
    const outstanding = Math.max(0, (num(item.approved_qty) || num(item.requested_qty)) - num(item.issued_qty));
    if (outstanding <= 0) continue;
    await client.query(
      `UPDATE inventory_items
          SET reserved = GREATEST(COALESCE(reserved, 0) - $1, 0),
              available = GREATEST(COALESCE(quantity, 0) - GREATEST(COALESCE(reserved, 0) - $1, 0), 0),
              updated_at = CURRENT_TIMESTAMP
        WHERE warehouse_id = $2 AND ingredient_id = $3`,
      [outstanding, request.warehouse_id, item.ingredient_id]
    );
  }
  await client.query(
    "UPDATE stock_reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE reference_id = $1 AND reserved_for_type = 'material_request' AND status = 'active'",
    [requestId]
  );
}

const rejectHandler = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = num(req.params.id);
    const { reason, user } = req.body || {};

    const requestRes = await client.query("SELECT * FROM material_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!requestRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "الطلب غير موجود" });
    }
    const request = requestRes.rows[0];
    if ([MR_STATUS.issued, MR_STATUS.cancelled, MR_STATUS.rejected].includes(request.status as any)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن رفض طلب مغلق أو مصروف" });
    }

    const itemsRes = await client.query("SELECT * FROM material_request_items WHERE request_id = $1", [id]);
    await releaseReservations(client, id, request, itemsRes.rows);

    await client.query(
      `UPDATE material_requests
          SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [MR_STATUS.rejected, reason || "تم الرفض بواسطة الإدارة", id]
    );

    await logAudit(client, {
      entity_type: "material_request",
      entity_id: id,
      action: "reject",
      user_name: user || "admin",
      details: `رفض طلب الصرف ${request.request_no} — السبب: ${reason || "بدون سبب"}`,
    });

    await client.query("COMMIT");
    res.json({ success: true, status: MR_STATUS.rejected, message: `تم رفض طلب الصرف ${request.request_no}` });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    res.status(500).json({ success: false, error: errorMessage(err) });
  } finally {
    client.release();
  }
};

const cancelHandler = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = num(req.params.id);
    const { user, reason } = req.body || {};

    const requestRes = await client.query("SELECT * FROM material_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!requestRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "الطلب غير موجود" });
    }
    const request = requestRes.rows[0];
    if ([MR_STATUS.issued, MR_STATUS.cancelled].includes(request.status as any)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن إلغاء طلب مصروف أو ملغي بالفعل" });
    }

    const itemsRes = await client.query("SELECT * FROM material_request_items WHERE request_id = $1", [id]);
    if (num(request.issued_qty_total ?? 0) > 0 || itemsRes.rows.some((item: any) => num(item.issued_qty) > 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لا يمكن إلغاء طلب تم صرف جزء منه — استخدم إرجاع المواد" });
    }

    await releaseReservations(client, id, request, itemsRes.rows);

    await client.query(
      `UPDATE material_requests
          SET status = $1,
              rejection_reason = COALESCE($2, rejection_reason),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [MR_STATUS.cancelled, reason || null, id]
    );

    await logAudit(client, {
      entity_type: "material_request",
      entity_id: id,
      action: "cancel",
      user_name: user || "admin",
      details: `إلغاء طلب الصرف ${request.request_no}`,
    });

    await client.query("COMMIT");
    res.json({ success: true, status: MR_STATUS.cancelled, message: `تم إلغاء طلب الصرف ${request.request_no}` });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    res.status(500).json({ success: false, error: errorMessage(err) });
  } finally {
    client.release();
  }
};

router.post("/api/material-requests/:id/reject", rejectHandler);
router.put("/api/material-requests/:id/reject", rejectHandler);
router.post("/api/material-requests/:id/cancel", cancelHandler);
router.put("/api/material-requests/:id/cancel", cancelHandler);

// ───────────────────────────────────────────────────────────────────────
// Issue (post): the only step that moves stock out of the warehouse
// ───────────────────────────────────────────────────────────────────────
router.post("/api/material-requests/:id/issue", async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const id = num(req.params.id);
    const { items, user, recipient_name, notes } = req.body || {};

    const requestRes = await client.query("SELECT * FROM material_requests WHERE id = $1 FOR UPDATE", [id]);
    if (!requestRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, error: "طلب الصرف غير موجود" });
    }
    const request = requestRes.rows[0];
    if ([MR_STATUS.issued, MR_STATUS.cancelled, MR_STATUS.rejected, MR_STATUS.draft, MR_STATUS.pendingDept, MR_STATUS.pendingWh].includes(request.status as any)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        error: `الطلب بحالة «${request.status}» ولا يمكن صرفه. الصرف متاح للطلبات المعتمدة فقط.`,
      });
    }

    const itemsRes = await client.query(
      "SELECT * FROM material_request_items WHERE request_id = $1 ORDER BY line_no NULLS LAST, id",
      [id]
    );
    if (!itemsRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "الطلب لا يحتوي على أصناف" });
    }

    const issueToken = randomUUID().slice(0, 8);
    const payload: any[] = Array.isArray(items) ? items : [];
    let anyIssued = false;
    let allIssued = true;
    let totalIssuedValue = 0;

    for (const item of itemsRes.rows) {
      const approvedQty = num(item.approved_qty) || num(item.requested_qty);
      const remaining = Math.max(0, approvedQty - num(item.issued_qty));
      if (remaining <= 0) continue;

      // Accept every shape the UI sends: line id (`id`), the older `item_id`
      // key, or the ingredient id. Without `item_id` a partial issue matched no
      // line and silently issued the full remaining quantity.
      const requested = payload.find(
        (line: any) =>
          num(line.id) === num(item.id) ||
          num(line.item_id) === num(item.id) ||
          num(line.ingredient_id) === num(item.ingredient_id)
      );
      let issueQty = requested ? round(num(requested.issue_qty ?? requested.issued_qty ?? requested.qty), 4) : remaining;
      if (issueQty < 0) issueQty = 0;
      if (issueQty > remaining) issueQty = remaining;

      if (issueQty <= 0) {
        allIssued = false;
        continue;
      }

      const ingredientRes = await client.query(
        `SELECT i.name,
                COALESCE(NULLIF(i.unit,''), NULLIF(i.stock_unit,''), 'وحدة') AS unit,
                COALESCE(NULLIF(ii.avg_cost,0), NULLIF(ii.cost,0), NULLIF(i.avg_cost,0), 0)::numeric AS unit_cost
           FROM ingredients i
           LEFT JOIN inventory_items ii ON ii.ingredient_id = i.id AND ii.warehouse_id = $2
          WHERE i.id = $1`,
        [item.ingredient_id, request.warehouse_id]
      );
      const itemName = ingredientRes.rows[0]?.name || `#${item.ingredient_id}`;
      const unitCost = num(ingredientRes.rows[0]?.unit_cost) || num(item.unit_cost);

      // Canonical stock engine: deducts quantity, recalculates available,
      // writes the stock ledger + item card + report transactions.
      await moveStock(client, {
        warehouse_id: request.warehouse_id,
        ingredient_id: item.ingredient_id,
        delta: -issueQty,
        field: "quantity",
        ref_type: "material_issue",
        ref_id: id,
        reference_no: request.request_no,
        event_key: `material_issue:${id}:${item.id}:${issueToken}`,
        unit_cost: unitCost,
        user: user || "أمين المخزن",
        notes: `صرف ${request.request_no} — ${request.department || "قسم"} — المستلم: ${recipient_name || "غير محدد"}`,
      });

      // Release the reserved hold for the issued quantity.
      const reservationRes = await client.query(
        `SELECT id, quantity FROM stock_reservations
          WHERE reference_id = $1 AND reserved_for_type = 'material_request'
            AND ingredient_id = $2 AND status = 'active'
          FOR UPDATE`,
        [id, item.ingredient_id]
      );
      const reservedLeft = reservationRes.rows.reduce((sum: number, row: any) => sum + num(row.quantity), 0);
      const releaseQty = Math.min(issueQty, reservedLeft);
      if (releaseQty > 0) {
        let toRelease = releaseQty;
        for (const reservation of reservationRes.rows) {
          if (toRelease <= 0) break;
          const qty = num(reservation.quantity);
          const deduct = Math.min(qty, toRelease);
          if (deduct >= qty) {
            await client.query(
              "UPDATE stock_reservations SET status = 'fulfilled', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
              [reservation.id]
            );
          } else {
            await client.query(
              "UPDATE stock_reservations SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
              [deduct, reservation.id]
            );
          }
          toRelease = round(toRelease - deduct, 4);
        }
        await client.query(
          `UPDATE inventory_items
              SET reserved = GREATEST(COALESCE(reserved, 0) - $1, 0),
                  available = GREATEST(COALESCE(quantity, 0) - GREATEST(COALESCE(reserved, 0) - $1, 0), 0),
                  updated_at = CURRENT_TIMESTAMP
            WHERE warehouse_id = $2 AND ingredient_id = $3`,
          [releaseQty, request.warehouse_id, item.ingredient_id]
        );
      }

      const totalIssuedForLine = round(num(item.issued_qty) + issueQty, 4);
      await client.query(
        "UPDATE material_request_items SET issued_qty = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [totalIssuedForLine, item.id]
      );

      anyIssued = true;
      totalIssuedValue += issueQty * unitCost;
      if (totalIssuedForLine < approvedQty) allIssued = false;

      if (issueQty < remaining) allIssued = false;

      await logAudit(client, {
        entity_type: "material_request",
        entity_id: id,
        action: "issue_line",
        user_name: user || "أمين المخزن",
        details: `صرف ${itemName}: ${issueQty} × ${unitCost} = ${round(issueQty * unitCost, 2)}`,
      });
    }

    if (!anyIssued) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, error: "لم يتم تحديد أي كمية صالحة للصرف" });
    }

    const finalStatus = allIssued ? MR_STATUS.issued : MR_STATUS.partiallyIssued;
    await client.query(
      `UPDATE material_requests
          SET status = $1,
              issued_at = CURRENT_TIMESTAMP,
              issued_by = $2,
              recipient_name = COALESCE($3, recipient_name),
              notes = COALESCE($4, notes),
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $5`,
      [finalStatus, user || "أمين المخزن", recipient_name || null, notes || null, id]
    );

    await logAudit(client, {
      entity_type: "material_request",
      entity_id: id,
      action: "issue",
      user_name: user || "أمين المخزن",
      details: `صرف ${allIssued ? "كلي" : "جزئي"} لطلب ${request.request_no} بقيمة ${round(totalIssuedValue, 2)} — المستلم: ${recipient_name || "غير محدد"}`,
    });

    await client.query("COMMIT");
    res.json({
      success: true,
      status: finalStatus,
      total_value: round(totalIssuedValue, 4),
      message: allIssued
        ? `تم صرف كل كميات الطلب ${request.request_no} وخصمها من المخزن وترحيل الحركة`
        : `تم الصرف الجزئي للطلب ${request.request_no} وتحديث الأرصدة`,
    });
  } catch (err: any) {
    try { await client.query("ROLLBACK"); } catch { /* ignore */ }
    const status = err?.code === "INSUFFICIENT_STOCK" ? 409 : 500;
    res.status(status).json({ success: false, error: errorMessage(err) });
  } finally {
    client.release();
  }
});

export default router;
