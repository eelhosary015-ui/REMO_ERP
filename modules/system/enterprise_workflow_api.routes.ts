import { Router } from "express";
import { pool } from "../../server-db.js";
import { authenticateToken } from "./system_api.routes.js";

const router = Router();

export async function ensureEnterpriseWorkflowTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workflow_definitions (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      module_type TEXT NOT NULL,
      description TEXT,
      steps JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_definitions_module ON workflow_definitions(module_type, is_active);
  `);
  const count = await pool.query(`SELECT COUNT(*)::int AS count FROM workflow_definitions`);
  if ((count.rows[0]?.count || 0) === 0) {
    await pool.query(`
      INSERT INTO workflow_definitions (name, module_type, description, steps, created_by)
      VALUES
      ('الموافقات المالية','finance','مسار اعتماد المعاملات المالية', $1::jsonb, 'system'),
      ('دورة المشتريات','purchases','مسار طلب الشراء حتى الفاتورة', $2::jsonb, 'system'),
      ('تحويلات المخزون','inventory','مسار تحويل واستلام المخزون', $3::jsonb, 'system')
    `, [
      JSON.stringify([{name:'طلب',role:'department_manager'},{name:'مراجعة مالية',role:'finance'},{name:'اعتماد',role:'approver'}]),
      JSON.stringify([{name:'طلب شراء',role:'requester'},{name:'مراجعة',role:'purchasing'},{name:'أمر شراء',role:'purchasing_manager'},{name:'استلام',role:'warehouse'},{name:'فاتورة',role:'accounting'}]),
      JSON.stringify([{name:'طلب تحويل',role:'requester'},{name:'إرسال',role:'source_warehouse'},{name:'استلام',role:'destination_warehouse'},{name:'تحديث الرصيد',role:'system'}])
    ]);
  }
}

router.get('/api/enterprise/workflows', authenticateToken, async (_req, res) => {
  try {
    await ensureEnterpriseWorkflowTables();
    const result = await pool.query(`SELECT * FROM workflow_definitions ORDER BY id DESC`);
    res.json({ data: result.rows });
  } catch (error: any) {
    res.status(500).json({ error: 'WORKFLOWS_FAILED', message: error.message });
  }
});

router.post('/api/enterprise/workflows', authenticateToken, async (req: any, res) => {
  try {
    await ensureEnterpriseWorkflowTables();
    const name = String(req.body?.name || '').trim();
    const moduleType = String(req.body?.module_type || '').trim();
    const description = req.body?.description ? String(req.body.description) : null;
    const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
    if (!name || !moduleType || !steps.length) return res.status(400).json({ error: 'INVALID_WORKFLOW' });
    const result = await pool.query(`
      INSERT INTO workflow_definitions (name,module_type,description,steps,created_by)
      VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING *
    `, [name, moduleType, description, JSON.stringify(steps), String(req.user?.id || req.user?.username || 'system')]);
    res.status(201).json({ data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: 'WORKFLOW_CREATE_FAILED', message: error.message });
  }
});

router.put('/api/enterprise/workflows/:id', authenticateToken, async (req, res) => {
  try {
    await ensureEnterpriseWorkflowTables();
    const fields: string[] = []; const values: any[] = [];
    const add = (sql: string, value: any) => { values.push(value); fields.push(sql.replace('?', `$${values.length}`)); };
    if (req.body?.name !== undefined) add('name=?', String(req.body.name).trim());
    if (req.body?.module_type !== undefined) add('module_type=?', String(req.body.module_type).trim());
    if (req.body?.description !== undefined) add('description=?', req.body.description == null ? null : String(req.body.description));
    if (req.body?.steps !== undefined) add('steps=?::jsonb', JSON.stringify(Array.isArray(req.body.steps) ? req.body.steps : []));
    if (req.body?.is_active !== undefined) add('is_active=?', Boolean(req.body.is_active));
    if (!fields.length) return res.status(400).json({ error: 'NO_CHANGES' });
    values.push(req.params.id);
    const result = await pool.query(`UPDATE workflow_definitions SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${values.length} RETURNING *`, values);
    if (!result.rowCount) return res.status(404).json({ error: 'WORKFLOW_NOT_FOUND' });
    res.json({ data: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: 'WORKFLOW_UPDATE_FAILED', message: error.message });
  }
});

router.delete('/api/enterprise/workflows/:id', authenticateToken, async (req, res) => {
  try {
    await ensureEnterpriseWorkflowTables();
    const result = await pool.query(`DELETE FROM workflow_definitions WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'WORKFLOW_NOT_FOUND' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: 'WORKFLOW_DELETE_FAILED', message: error.message });
  }
});

export default router;
