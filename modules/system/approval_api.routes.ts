import { Router, Request, Response } from "express";
import { pool } from "../../server-db.js";
import { ERPEventBus } from "../../server-erp-core.js";
import { authenticateToken } from "./system_api.routes.js";

const router = Router();

// ═══════════════════════════════════════════════════════════════
// APPROVAL SYSTEM API — V1 Routes
// ═══════════════════════════════════════════════════════════════

// --- Module Type Labels (Arabic) ---
const MODULE_LABELS: Record<string, string> = {
  purchase_order: "أمر شراء",
  purchase_return: "مرتجع مشتريات",
  operating_cost: "تكلفة تشغيلية",
  sales_return: "مرتجع مبيعات",
  journal_entry: "قيد يومية",
  treasury_transaction: "حركة خزينة",
  hr_leave: "طلب إجازة",
};

// ─── 1. Dashboard Stats ───
router.get(["/dashboard", "/api/approvals/dashboard", "/api/v2/approvals/dashboard"], async (req: any, res: Response) => {
  try {
    let deptIdFilter: number | null = null;
    let isDeptHeadOrSupervisor = false;

    if (req.user) {
      const empRes = await pool.query(
        `SELECT id, department_id, is_department_head, is_supervisor, role_level 
         FROM employees 
         WHERE name = $1 OR phone = $1 OR fingerprint_code = $1 OR id = $2`,
        [req.user.username, req.user.employee_id || 0]
      );
      const emp = empRes.rows[0];
      if (emp) {
        const isHead = emp.is_department_head === 1 || emp.is_department_head === true || emp.role_level === "head" || emp.is_supervisor === 1 || emp.is_supervisor === true || emp.role_level === "supervisor";
        if (isHead && req.user.role !== "admin") {
          isDeptHeadOrSupervisor = true;
          deptIdFilter = emp.department_id;
        }
      }
    }

    let filterCond = "";
    const filterParams: any[] = [];
    if (isDeptHeadOrSupervisor && deptIdFilter !== null) {
      filterCond = ` AND (module_type != 'hr_leave' OR (metadata->>'department_id')::int = $1)`;
      filterParams.push(deptIdFilter);
    }

    const [pending, approvedToday, rejected, total] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'${filterCond}`, filterParams),
      pool.query(`SELECT COUNT(*) as count FROM approval_requests WHERE status = 'approved' AND approved_at >= CURRENT_DATE${filterCond}`, filterParams),
      pool.query(`SELECT COUNT(*) as count FROM approval_requests WHERE status = 'rejected'${filterCond}`, filterParams),
      pool.query(`SELECT COUNT(*) as count FROM approval_requests WHERE 1=1${filterCond}`, filterParams),
    ]);

    // Per-module breakdown
    const byModule = await pool.query(`
      SELECT module_type, status, COUNT(*) as count
      FROM approval_requests
      WHERE 1=1${filterCond}
      GROUP BY module_type, status
      ORDER BY module_type, status
    `, filterParams);

    res.json({
      pending_count: parseInt(pending.rows[0]?.count || '0'),
      approved_today: parseInt(approvedToday.rows[0]?.count || '0'),
      rejected_count: parseInt(rejected.rows[0]?.count || '0'),
      total_count: parseInt(total.rows[0]?.count || '0'),
      by_module: byModule.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. List Approval Requests ───
router.get(["/", "/api/approvals", "/api/v2/approvals"], async (req: any, res: Response) => {
  try {
    const { status, module_type, priority, search, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    let deptIdFilter: number | null = null;
    let isDeptHeadOrSupervisor = false;

    if (req.user) {
      const empRes = await pool.query(
        `SELECT id, department_id, is_department_head, is_supervisor, role_level 
         FROM employees 
         WHERE name = $1 OR phone = $1 OR fingerprint_code = $1 OR id = $2`,
        [req.user.username, req.user.employee_id || 0]
      );
      const emp = empRes.rows[0];
      if (emp) {
        const isHead = emp.is_department_head === 1 || emp.is_department_head === true || emp.role_level === "head" || emp.is_supervisor === 1 || emp.is_supervisor === true || emp.role_level === "supervisor";
        if (isHead && req.user.role !== "admin") {
          isDeptHeadOrSupervisor = true;
          deptIdFilter = emp.department_id;
        }
      }
    }

    let query = `SELECT ar.* FROM approval_requests ar WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (status) { query += ` AND ar.status = $${idx}`; params.push(status); idx++; }
    if (module_type) { query += ` AND ar.module_type = $${idx}`; params.push(module_type); idx++; }
    if (priority) { query += ` AND ar.priority = $${idx}`; params.push(priority); idx++; }
    if (search) {
      query += ` AND (ar.title ILIKE $${idx} OR ar.description ILIKE $${idx} OR ar.requested_by ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }

    if (isDeptHeadOrSupervisor && deptIdFilter !== null) {
      query += ` AND (ar.module_type != 'hr_leave' OR (ar.metadata->>'department_id')::int = $${idx})`;
      params.push(deptIdFilter);
      idx++;
    }

    // Count
    const countResult = await pool.query(query.replace('SELECT ar.*', 'SELECT COUNT(*) as count'), params);
    const total = parseInt(countResult.rows[0]?.count || '0');

    query += ` ORDER BY ar.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit as string), offset); idx += 2;

    const result = await pool.query(query, params);

    // Enrich with module-specific data
    const enriched = await Promise.all(result.rows.map(async (row: any) => {
      let details: any = null;
      try {
        if (row.module_type === 'purchase_order') {
          const po = await pool.query(
            `SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = $1`,
            [row.reference_id]
          );
          details = po.rows[0] || null;
        } else if (row.module_type === 'operating_cost') {
          const cost = await pool.query("SELECT * FROM operating_costs WHERE id = $1", [row.reference_id]);
          details = cost.rows[0] || null;
        }
      } catch (_e) { /* ignore enrichment errors */ }

      return {
        ...row,
        module_label: MODULE_LABELS[row.module_type] || row.module_type,
        details,
      };
    }));

    res.json({
      data: enriched,
      pagination: { total, page: parseInt(page as string), limit: parseInt(limit as string), pages: Math.ceil(total / parseInt(limit as string)) },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. Get Single Approval Request ───
// NOTE: Specific routes (settings, pending-count, history, check) must come BEFORE this /:id route
//       to avoid Express matching "settings" as an id parameter.
router.get(["/:id(\\d+)", "/api/approvals/:id(\\d+)", "/api/v2/approvals/:id(\\d+)"], async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM approval_requests WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Approval request not found" });

    const row = result.rows[0];
    let details: any = null;
    try {
      if (row.module_type === 'purchase_order') {
        const po = await pool.query(
          `SELECT po.*, s.name as supplier_name FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id = s.id WHERE po.id = $1`,
          [row.reference_id]
        );
        const items = await pool.query(
          `SELECT poi.*, i.name as ingredient_name, i.unit FROM purchase_order_items poi LEFT JOIN ingredients i ON poi.ingredient_id = i.id WHERE poi.purchase_order_id = $1`,
          [row.reference_id]
        );
        details = { ...po.rows[0], items: items.rows };
      } else if (row.module_type === 'operating_cost') {
        const cost = await pool.query("SELECT * FROM operating_costs WHERE id = $1", [row.reference_id]);
        details = cost.rows[0] || null;
      }
    } catch (_e) { /* ignore */ }

    res.json({ ...row, module_label: MODULE_LABELS[row.module_type] || row.module_type, details });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. Create Approval Request ───
router.post(["/", "/api/approvals", "/api/v2/approvals"], async (req: Request, res: Response) => {
  try {
    const { module_type, reference_id, title, description, priority, requested_by, metadata } = req.body;
    if (!module_type || !reference_id || !title) {
      return res.status(400).json({ error: "module_type, reference_id, and title are required" });
    }

    // Check if approval already exists for this reference
    const existing = await pool.query(
      "SELECT id, status FROM approval_requests WHERE module_type = $1 AND reference_id = $2 AND status IN ('pending', 'approved')",
      [module_type, reference_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "يوجد طلب موافقة نشط لهذا العنصر بالفعل", existing: existing.rows[0] });
    }

    const result = await pool.query(
      `INSERT INTO approval_requests (module_type, reference_id, title, description, priority, requested_by, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [module_type, reference_id, title, description || null, priority || 'normal', requested_by || 'system', metadata ? JSON.stringify(metadata) : '{}']
    );

    // Update the source document status to 'pending_approval'
    try {
      if (module_type === 'purchase_order') {
        await pool.query("UPDATE purchase_orders SET status = 'pending_approval', requested_by = $1 WHERE id = $2", [requested_by || 'system', reference_id]);
      } else if (module_type === 'operating_cost') {
        await pool.query("UPDATE operating_costs SET approval_status = 'Pending' WHERE id = $1", [reference_id]);
      }
    } catch (_e) { /* non-critical */ }

    // Emit event
    try {
      ERPEventBus.getInstance().emitEvent("ApprovalRequested", {
        approval_id: result.rows[0].id,
        module_type,
        reference_id,
        title,
      });
    } catch (_e) { /* non-critical */ }

    res.status(201).json({ ...result.rows[0], module_label: MODULE_LABELS[module_type] || module_type });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. Approve ───
router.put(["/:id(\\d+)/approve", "/api/approvals/:id(\\d+)/approve", "/api/v2/approvals/:id(\\d+)/approve"], async (req: Request, res: Response) => {
  try {
    const { approved_by, notes } = req.body;
    if (!approved_by) return res.status(400).json({ error: "approved_by is required" });

    const current = await pool.query("SELECT * FROM approval_requests WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: "Approval request not found" });
    if (current.rows[0].status !== 'pending') {
      return res.status(400).json({ error: `لا يمكن الموافقة - الحالة الحالية: ${current.rows[0].status}` });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update approval request
      const result = await client.query(
        `UPDATE approval_requests
         SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
             approval_notes = COALESCE($2, approval_notes), updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [approved_by, notes || null, req.params.id]
      );

      const approval = result.rows[0];

      // Update source document based on module type
      if (approval.module_type === 'purchase_order') {
        await client.query(
          `UPDATE purchase_orders SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [approved_by, approval.reference_id]
        );
      } else if (approval.module_type === 'operating_cost') {
        await client.query(
          `UPDATE operating_costs SET approval_status = 'Approved' WHERE id = $1`,
          [approval.reference_id]
        );
      } else if (approval.module_type === 'hr_leave') {
        // 1. Update system_settings remo_pro_leave_requests
        const settingsRes = await client.query("SELECT value FROM system_settings WHERE key = 'remo_pro_leave_requests'");
        if (settingsRes.rows.length > 0) {
          let leaveRequests = [];
          try {
            leaveRequests = JSON.parse(settingsRes.rows[0].value);
          } catch (e) {}
          if (Array.isArray(leaveRequests)) {
            const index = leaveRequests.findIndex((r: any) => r.id === approval.reference_id);
            if (index !== -1) {
              leaveRequests[index].status = 'approved';
              leaveRequests[index].approved_by = approved_by;
              leaveRequests[index].approved_at = new Date().toISOString();
              await client.query("UPDATE system_settings SET value = $1 WHERE key = 'remo_pro_leave_requests'", [JSON.stringify(leaveRequests)]);
            }
          }
        }

        // 2. Also update employee_portal_requests status if applicable
        let meta: any = {};
        try {
          meta = typeof approval.metadata === 'string' ? JSON.parse(approval.metadata) : (approval.metadata || {});
        } catch (e) {}
        const portalId = meta.portal_request_id || approval.reference_id;
        await client.query(
          `UPDATE employee_portal_requests 
           SET status = 'approved', admin_response = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2 OR id = $3`,
          [notes || 'تمت الموافقة من رئيس القسم', portalId, approval.reference_id]
        );

        // 3. Deduct leave days from employee balance
        const employeeId = meta.employee_id;
        if (employeeId) {
          let leaveType = 'annual';
          const pName = String(meta.policy_name || '').toLowerCase();
          const pTitle = String(approval.title || '').toLowerCase();
          if (pName.includes('مرضية') || pName.includes('sick') || pTitle.includes('مرضية') || pTitle.includes('sick')) {
            leaveType = 'sick';
          } else if (pName.includes('عارضة') || pName.includes('casual') || pTitle.includes('عارضة') || pTitle.includes('casual')) {
            leaveType = 'casual';
          }
          const balanceColumn = leaveType === 'sick' ? 'sick_leave_balance' : leaveType === 'casual' ? 'casual_leave_balance' : 'annual_leave_balance';
          const daysCount = meta.days_count || 1;
          await client.query(
            `UPDATE employees SET ${balanceColumn} = GREATEST(COALESCE(${balanceColumn}, 21) - $1, 0) WHERE id = $2`,
            [Number(daysCount), employeeId]
          );
        }
      }

      await client.query("COMMIT");

      // Emit event for downstream processing
      try {
        ERPEventBus.getInstance().emitEvent("ApprovalGranted", {
          approval_id: approval.id,
          module_type: approval.module_type,
          reference_id: approval.reference_id,
          approved_by,
        });
      } catch (_e) { /* non-critical */ }

      res.json({ ...approval, module_label: MODULE_LABELS[approval.module_type] || approval.module_type });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 6. Reject ───
router.put(["/:id(\\d+)/reject", "/api/approvals/:id(\\d+)/reject", "/api/v2/approvals/:id(\\d+)/reject"], async (req: Request, res: Response) => {
  try {
    const { approved_by, reason } = req.body;
    if (!approved_by) return res.status(400).json({ error: "approved_by is required" });

    const current = await pool.query("SELECT * FROM approval_requests WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: "Approval request not found" });
    if (current.rows[0].status !== 'pending') {
      return res.status(400).json({ error: `لا يمكن الرفض - الحالة الحالية: ${current.rows[0].status}` });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE approval_requests
         SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP,
             rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [approved_by, reason || null, req.params.id]
      );

      const approval = result.rows[0];

      // Revert source document status
      if (approval.module_type === 'purchase_order') {
        await client.query(
          `UPDATE purchase_orders SET status = 'rejected', approved_by = $1 WHERE id = $2`,
          [approved_by, approval.reference_id]
        );
      } else if (approval.module_type === 'operating_cost') {
        await client.query(
          `UPDATE operating_costs SET approval_status = 'Rejected' WHERE id = $1`,
          [approval.reference_id]
        );
      } else if (approval.module_type === 'hr_leave') {
        // 1. Update system_settings remo_pro_leave_requests
        const settingsRes = await client.query("SELECT value FROM system_settings WHERE key = 'remo_pro_leave_requests'");
        if (settingsRes.rows.length > 0) {
          let leaveRequests = [];
          try {
            leaveRequests = JSON.parse(settingsRes.rows[0].value);
          } catch (e) {}
          if (Array.isArray(leaveRequests)) {
            const index = leaveRequests.findIndex((r: any) => r.id === approval.reference_id);
            if (index !== -1) {
              leaveRequests[index].status = 'rejected';
              leaveRequests[index].rejection_reason = reason;
              leaveRequests[index].approved_by = approved_by;
              leaveRequests[index].approved_at = new Date().toISOString();
              await client.query("UPDATE system_settings SET value = $1 WHERE key = 'remo_pro_leave_requests'", [JSON.stringify(leaveRequests)]);
            }
          }
        }

        // 2. Also update employee_portal_requests status
        let meta: any = {};
        try {
          meta = typeof approval.metadata === 'string' ? JSON.parse(approval.metadata) : (approval.metadata || {});
        } catch (e) {}
        const portalId = meta.portal_request_id || approval.reference_id;
        await client.query(
          `UPDATE employee_portal_requests 
           SET status = 'rejected', admin_response = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2 OR id = $3`,
          [reason || 'تم رفض طلب الإجازة من رئيس القسم', portalId, approval.reference_id]
        );
      }

      await client.query("COMMIT");

      try {
        ERPEventBus.getInstance().emitEvent("ApprovalRejected", {
          approval_id: approval.id,
          module_type: approval.module_type,
          reference_id: approval.reference_id,
          approved_by,
          reason,
        });
      } catch (_e) { /* non-critical */ }

      res.json({ ...approval, module_label: MODULE_LABELS[approval.module_type] || approval.module_type });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 7. Cancel ───
router.put(["/:id(\\d+)/cancel", "/api/approvals/:id(\\d+)/cancel", "/api/v2/approvals/:id(\\d+)/cancel"], async (req: Request, res: Response) => {
  try {
    const { canceled_by } = req.body;

    const current = await pool.query("SELECT * FROM approval_requests WHERE id = $1", [req.params.id]);
    if (current.rows.length === 0) return res.status(404).json({ error: "Approval request not found" });
    if (current.rows[0].status !== 'pending') {
      return res.status(400).json({ error: `لا يمكن الإلغاء - الحالة الحالية: ${current.rows[0].status}` });
    }

    const result = await pool.query(
      `UPDATE approval_requests SET status = 'canceled', approval_notes = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *`,
      [`تم الإلغاء بواسطة: ${canceled_by || 'system'}`, req.params.id]
    );

    // Revert source document
    const approval = result.rows[0];
    if (approval.module_type === 'purchase_order') {
      await pool.query("UPDATE purchase_orders SET status = 'draft' WHERE id = $1", [approval.reference_id]);
    } else if (approval.module_type === 'hr_leave') {
      const settingsRes = await pool.query("SELECT value FROM system_settings WHERE key = 'remo_pro_leave_requests'");
      if (settingsRes.rows.length > 0) {
        let leaveRequests = [];
        try {
          leaveRequests = JSON.parse(settingsRes.rows[0].value);
        } catch (e) {}
        if (Array.isArray(leaveRequests)) {
          const index = leaveRequests.findIndex((r: any) => r.id === approval.reference_id);
          if (index !== -1) {
            leaveRequests[index].status = 'canceled';
            await pool.query("UPDATE system_settings SET value = $1 WHERE key = 'remo_pro_leave_requests'", [JSON.stringify(leaveRequests)]);
          }
        }
      }

      let meta: any = {};
      try {
        meta = typeof approval.metadata === 'string' ? JSON.parse(approval.metadata) : (approval.metadata || {});
      } catch (e) {}
      const portalId = meta.portal_request_id || approval.reference_id;
      await pool.query(
        `UPDATE employee_portal_requests SET status = 'canceled', updated_at = CURRENT_TIMESTAMP WHERE id = $1 OR id = $2`,
        [portalId, approval.reference_id]
      );
    }

    res.json({ ...approval, module_label: MODULE_LABELS[approval.module_type] || approval.module_type });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 8. Approval Settings ───
router.get(["/settings", "/api/approvals/settings", "/api/v2/approvals/settings"], async (_req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM approval_settings ORDER BY module_type");
    res.json(result.rows.map((r: any) => ({
      ...r,
      module_label: MODULE_LABELS[r.module_type] || r.module_type,
    })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put(["/settings/:id", "/api/approvals/settings/:id", "/api/v2/approvals/settings/:id"], async (req: Request, res: Response) => {
  try {
    const { requires_approval, min_approver_role, auto_approve_below, notify_on_request, notify_on_approve } = req.body;
    const result = await pool.query(
      `UPDATE approval_settings
       SET requires_approval = COALESCE($1, requires_approval),
           min_approver_role = COALESCE($2, min_approver_role),
           auto_approve_below = COALESCE($3, auto_approve_below),
           notify_on_request = COALESCE($4, notify_on_request),
           notify_on_approve = COALESCE($5, notify_on_approve),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 RETURNING *`,
      [requires_approval, min_approver_role, auto_approve_below, notify_on_request, notify_on_approve, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Setting not found" });
    res.json({ ...result.rows[0], module_label: MODULE_LABELS[result.rows[0].module_type] || result.rows[0].module_type });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 9. Check if module requires approval (helper) ───
router.get(["/check/:module_type", "/api/approvals/check/:module_type", "/api/v2/approvals/check/:module_type"], async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM approval_settings WHERE module_type = $1",
      [req.params.module_type]
    );
    if (result.rows.length === 0) {
      return res.json({ requires_approval: false, module_type: req.params.module_type });
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 10. Get pending count (for badge/notification) ───
router.get(["/pending-count", "/api/approvals/pending-count", "/api/v2/approvals/pending-count"], async (req: any, res: Response) => {
  try {
    let deptIdFilter: number | null = null;
    let isDeptHeadOrSupervisor = false;

    if (req.user) {
      const empRes = await pool.query(
        `SELECT id, department_id, is_department_head, is_supervisor, role_level 
         FROM employees 
         WHERE name = $1 OR phone = $1 OR fingerprint_code = $1 OR id = $2`,
        [req.user.username, req.user.employee_id || 0]
      );
      const emp = empRes.rows[0];
      if (emp) {
        const isHead = emp.is_department_head === 1 || emp.is_department_head === true || emp.role_level === "head" || emp.is_supervisor === 1 || emp.is_supervisor === true || emp.role_level === "supervisor";
        if (isHead && req.user.role !== "admin") {
          isDeptHeadOrSupervisor = true;
          deptIdFilter = emp.department_id;
        }
      }
    }

    let query = "SELECT COUNT(*) as count FROM approval_requests WHERE status = 'pending'";
    const params: any[] = [];
    if (isDeptHeadOrSupervisor && deptIdFilter !== null) {
      query += ` AND (module_type != 'hr_leave' OR (metadata->>'department_id')::int = $1)`;
      params.push(deptIdFilter);
    }

    const result = await pool.query(query, params);
    res.json({ count: parseInt(result.rows[0]?.count || '0') });
  } catch (err: any) {
    res.status(200).json({ count: 0, error: err?.message });
  }
});

// ─── 11. Get approval history ───
router.get(["/history", "/api/approvals/history", "/api/v2/approvals/history"], async (req: any, res: Response) => {
  try {
    const { module_type, reference_id } = req.query;
    
    let deptIdFilter: number | null = null;
    let isDeptHeadOrSupervisor = false;

    if (req.user) {
      const empRes = await pool.query(
        `SELECT id, department_id, is_department_head, is_supervisor, role_level 
         FROM employees 
         WHERE name = $1 OR phone = $1 OR fingerprint_code = $1 OR id = $2`,
        [req.user.username, req.user.employee_id || 0]
      );
      const emp = empRes.rows[0];
      if (emp) {
        const isHead = emp.is_department_head === 1 || emp.is_department_head === true || emp.role_level === "head" || emp.is_supervisor === 1 || emp.is_supervisor === true || emp.role_level === "supervisor";
        if (isHead && req.user.role !== "admin") {
          isDeptHeadOrSupervisor = true;
          deptIdFilter = emp.department_id;
        }
      }
    }

    let query = "SELECT * FROM approval_requests WHERE status IN ('approved', 'rejected', 'canceled')";
    const params: any[] = [];
    let idx = 1;
    if (module_type) { query += ` AND module_type = $${idx}`; params.push(module_type); idx++; }
    if (reference_id) { query += ` AND reference_id = $${idx}`; params.push(reference_id); idx++; }
    
    if (isDeptHeadOrSupervisor && deptIdFilter !== null) {
      query += ` AND (module_type != 'hr_leave' OR (metadata->>'department_id')::int = $${idx})`;
      params.push(deptIdFilter);
      idx++;
    }

    query += " ORDER BY updated_at DESC LIMIT 50";
    const result = await pool.query(query, params);
    res.json(result.rows.map((r: any) => ({ ...r, module_label: MODULE_LABELS[r.module_type] || r.module_type })));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;