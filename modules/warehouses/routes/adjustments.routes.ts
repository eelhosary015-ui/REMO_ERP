import { Router, Request, Response } from "express";
import { pool } from "../../../server-db.js";
import { ERPEventBus } from "../../../server-erp-core.js";
import { postInventoryAdjustmentEntry } from "../../accounts/services/auto-posting.service.js";
import { recordInventoryAdjustmentCost } from "../../costs/services/cost.integration.service.js";

const router = Router();

// GET all adjustments
router.get("/api/inventory-adjustments", async (req: Request, res: Response) => {
  try {
    const { warehouse_id, type, status, search, date_from, date_to } = req.query;

    let query = `
      SELECT a.*, w.name as warehouse_name, u.username as created_by_name, r.name_ar as reason_name,
        (SELECT COUNT(*) FROM inventory_adjustment_items i WHERE i.adjustment_id = a.id) as items_count
      FROM inventory_adjustments a
      LEFT JOIN warehouses w ON a.warehouse_id = w.id
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN adjustment_reasons r ON a.reason_id = r.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (warehouse_id) {
      params.push(Number(warehouse_id));
      query += ` AND a.warehouse_id = $${params.length}`;
    }
    if (type) {
      params.push(String(type));
      query += ` AND a.type = $${params.length}`;
    }
    if (status) {
      params.push(String(status));
      query += ` AND a.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (a.adjustment_number ILIKE $${params.length} OR a.notes ILIKE $${params.length})`;
    }
    if (date_from) {
      params.push(String(date_from));
      query += ` AND a.adjustment_date >= $${params.length}`;
    }
    if (date_to) {
      params.push(String(date_to));
      query += ` AND a.adjustment_date <= $${params.length}`;
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("GET /api/inventory-adjustments Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET single adjustment
router.get("/api/inventory-adjustments/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const adjRes = await pool.query(`
      SELECT a.*, w.name as warehouse_name, u.username as created_by_name, r.name_ar as reason_name
      FROM inventory_adjustments a
      LEFT JOIN warehouses w ON a.warehouse_id = w.id
      LEFT JOIN users u ON a.created_by = u.id
      LEFT JOIN adjustment_reasons r ON a.reason_id = r.id
      WHERE a.id = $1
    `, [id]);

    if (adjRes.rows.length === 0) {
      return res.status(404).json({ error: "Adjustment not found" });
    }
    const adjustment = adjRes.rows[0];

    const itemsRes = await pool.query(`
      SELECT i.*, p.name as product_name, p.unit
      FROM inventory_adjustment_items i
      LEFT JOIN products p ON i.product_id = p.id
      WHERE i.adjustment_id = $1
    `, [id]);
    
    adjustment.items = itemsRes.rows;
    res.json(adjustment);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET reasons
router.get("/api/adjustment-reasons", async (req: Request, res: Response) => {
  try {
    const type = req.query.type as string;
    let q = `SELECT * FROM adjustment_reasons WHERE is_active = true`;
    const p: any[] = [];
    if (type) {
      p.push(type);
      q += ` AND (type = $1 OR type = 'both')`;
    }
    const result = await pool.query(q, p);
    // If empty (seed logic fallback)
    if (result.rows.length === 0) {
        return res.json([
            { id: 1, name_ar: 'عجز جرد', type: 'shortage' },
            { id: 2, name_ar: 'زيادة جرد', type: 'surplus' },
            { id: 3, name_ar: 'تالف', type: 'shortage' },
            { id: 4, name_ar: 'إهلاك', type: 'shortage' }
        ]);
    }
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST create adjustment
router.post("/api/inventory-adjustments", async (req: Request, res: Response) => {
  try {
    const { warehouse_id, type, reason_id, reference_no, notes, status, items, total_value } = req.body;
    
    // Auth bypass for now (usually req.user.id)
    const created_by = 1; 

    // Generate ADJ-YYYY-XXXX
    const countRes = await pool.query(`SELECT COUNT(*) as count FROM inventory_adjustments`);
    const nextId = Number(countRes.rows[0].count || 0) + 1;
    const adjNo = `ADJ-${new Date().getFullYear()}-${String(nextId).padStart(4, '0')}`;

    const adjResult = await pool.query(`
      INSERT INTO inventory_adjustments 
      (adjustment_number, warehouse_id, type, reason_id, reference_no, notes, total_value, status, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [adjNo, warehouse_id, type, reason_id, reference_no, notes, total_value || 0, status || 'draft', created_by]);

    const adj = adjResult.rows[0];

    for (const item of items) {
      await pool.query(`
        INSERT INTO inventory_adjustment_items
        (adjustment_id, product_id, current_qty, physical_qty, adjustment_qty, unit_cost, total_cost)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [adj.id, item.product_id, item.current_qty, item.physical_qty, item.adjustment_qty, item.unit_cost, item.total_cost]);
    }

    res.status(201).json(adj);
  } catch (error: any) {
    console.error("Create Adj Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST approve adjustment
router.post("/api/inventory-adjustments/:id/approve", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    
    // 1. Get adj
    const adjRes = await pool.query(`SELECT * FROM inventory_adjustments WHERE id = $1`, [id]);
    if (adjRes.rows.length === 0) return res.status(404).json({error: "Not found"});
    const adj = adjRes.rows[0];
    
    if (adj.status === 'approved') return res.status(400).json({error: "Already approved"});

    // 2. Get items
    const itemsRes = await pool.query(`SELECT * FROM inventory_adjustment_items WHERE adjustment_id = $1`, [id]);
    
    // 3. Update stock_balances and insert stock_ledger
    for (const item of itemsRes.rows) {
      // In offline mock db, we might not have all complex stock transaction logic, so we do simple inserts
      const qty = Number(item.adjustment_qty);
      
      // Update stock_balances
      const stockRes = await pool.query(`
        SELECT * FROM stock_balances WHERE warehouse_id = $1 AND product_id = $2
      `, [adj.warehouse_id, item.product_id]);

      if (stockRes.rows.length > 0) {
        await pool.query(`
          UPDATE stock_balances 
          SET quantity = quantity + $1 
          WHERE warehouse_id = $2 AND product_id = $3
        `, [qty, adj.warehouse_id, item.product_id]);
      } else {
        await pool.query(`
          INSERT INTO stock_balances (warehouse_id, product_id, quantity)
          VALUES ($1, $2, $3)
        `, [adj.warehouse_id, item.product_id, qty]);
      }

      // Add to inventory_transactions (to maintain history in the existing system)
      const txNum = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await pool.query(`
        INSERT INTO inventory_transactions 
        (transaction_number, date, type, reason, notes, status, items, warehouse_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        txNum, 
        new Date().toISOString(), 
        'adjustment', 
        `Adjustment ${adj.adjustment_number}`, 
        adj.notes, 
        'approved', 
        JSON.stringify([{
           ingredient_id: item.product_id, 
           quantity: Math.abs(qty),
           type: qty >= 0 ? 'increase' : 'decrease'
        }]),
        adj.warehouse_id
      ]);
    }

    // 4. Update status
    const result = await pool.query(`
      UPDATE inventory_adjustments 
      SET status = 'approved', approved_at = CURRENT_TIMESTAMP
      WHERE id = $1 RETURNING *
    `, [id]);

    const approvedAdj = result.rows[0];

    // 5. Accounting & Cost Integration
    try {
      await postInventoryAdjustmentEntry({
        id: approvedAdj.id,
        warehouse_id: approvedAdj.warehouse_id,
        total_value: approvedAdj.total_value,
        type: approvedAdj.type,
        items: itemsRes.rows
      });
    } catch (glErr: any) {
      console.error("[GL Integration] Adjustment approval error:", glErr.message);
    }

    try {
      await recordInventoryAdjustmentCost(approvedAdj.id);
    } catch (cstErr: any) {
      console.error("[Cost Integration] Adjustment cost error:", cstErr.message);
    }

    // 6. Emit event to ERPEventBus
    try {
      ERPEventBus.getInstance().emitEvent("InventoryAdjustmentApproved", {
        id: approvedAdj.id,
        adjustment_number: approvedAdj.adjustment_number,
        warehouse_id: approvedAdj.warehouse_id,
        total_value: approvedAdj.total_value,
        type: approvedAdj.type,
        items: itemsRes.rows
      });
    } catch (_) {}

    res.json(approvedAdj);
  } catch (error: any) {
    console.error("Approve Adj Error:", error);
    res.status(500).json({ error: error.message });
  }
});

export const adjustmentsRouter = router;
