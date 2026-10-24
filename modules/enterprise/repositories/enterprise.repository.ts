import { pool } from '../../../server-db.js';
import { buildScopeFilter, applyInsertScope, CompanyContext } from '../middleware/companyContext.middleware.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Repository - Data Access Layer
// All database queries for enterprise module
// ═══════════════════════════════════════════════════════════════

// ─── 1. COMPANIES ───
export const companyRepo = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM companies ORDER BY id');
    return rows;
  },
  async findById(id: string) {
    const { rows } = await pool.query('SELECT * FROM companies WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO companies (code, name_ar, name_en, tax_number, commercial_register, phone, email, address, city, country, currency, settings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.code, data.name_ar, data.name_en, data.tax_number, data.commercial_register, data.phone, data.email, data.address, data.city, data.country || 'مصر', data.currency || 'EGP', JSON.stringify(data.settings || {})]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const COL_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const [key, val] of Object.entries(data)) {
      if (key === 'id') continue;
      if (!COL_REGEX.test(key)) continue;
      fields.push(`${key} = $${i}`); values.push(typeof val === 'object' ? JSON.stringify(val) : val); i++;
    }
    values.push(id);
    const { rows } = await pool.query(`UPDATE companies SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${i} RETURNING *`, values);
    return rows[0] || null;
  },
  async delete(id: string) {
    await pool.query('DELETE FROM companies WHERE id = $1', [id]);
    return true;
  },
};

// ─── 2. ROLES & PERMISSIONS ───
export const roleRepo = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT r.*, (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) as permission_count
      FROM roles r ORDER BY r.id
    `);
    return rows;
  },
  async findById(id: string) {
    const { rows } = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    return rows[0] || null;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO roles (name, name_ar, description, is_system) VALUES ($1,$2,$3,$4) RETURNING *`,
      [data.name, data.name_ar, data.description, data.is_system || false]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const { rows } = await pool.query(
      `UPDATE roles SET name=COALESCE($1,name), name_ar=COALESCE($2,name_ar), description=COALESCE($3,description), updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *`,
      [data.name, data.name_ar, data.description, id]
    );
    return rows[0] || null;
  },
  async delete(id: string) {
    await pool.query('DELETE FROM roles WHERE id = $1 AND is_system = false', [id]);
    return true;
  },
  async getPermissions(roleId: string) {
    const { rows } = await pool.query('SELECT * FROM role_permissions WHERE role_id = $1', [roleId]);
    return rows;
  },
  async setPermissions(roleId: string, permissions: Array<{ key: string; is_granted: boolean; limits: Record<string, any> }>) {
    for (const p of permissions) {
      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_key, is_granted, limits) VALUES ($1,$2,$3,$4)
         ON CONFLICT (role_id, permission_key) DO UPDATE SET is_granted=$3, limits=$4`,
        [roleId, p.key, p.is_granted !== false, JSON.stringify(p.limits || {})]
      );
    }
    return true;
  },
  async createWithPermissions(data: Record<string, any>) {
    const role = await this.create(data);
    if (data.permissions && Array.isArray(data.permissions)) {
      await this.setPermissions(String(role.id), data.permissions);
    }
    return role;
  },
};

// ─── 3. BATCH TRACKING ───
export const batchRepo = {
  async findAll(filters: Record<string, any> = {}, ctx?: CompanyContext) {
    let sql = 'SELECT b.*, i.name as ingredient_name, w.name as warehouse_name, s.name as supplier_name FROM batch_tracking b LEFT JOIN ingredients i ON b.ingredient_id=i.id LEFT JOIN warehouses w ON b.warehouse_id=w.id LEFT JOIN suppliers s ON b.supplier_id=s.id WHERE 1=1';
    const params: any[] = [];
    if (filters.ingredient_id) { sql += ` AND b.ingredient_id = $${params.length + 1}`; params.push(filters.ingredient_id); }
    if (filters.warehouse_id) { sql += ` AND b.warehouse_id = $${params.length + 1}`; params.push(filters.warehouse_id); }
    if (filters.status) { sql += ` AND b.status = $${params.length + 1}`; params.push(filters.status); }
    if (filters.expiring_within_days) { sql += ` AND b.expiry_date <= CURRENT_DATE + ($${params.length + 1} || ' days')::INTERVAL AND b.expiry_date >= CURRENT_DATE`; params.push(filters.expiring_within_days); }
    const scope = buildScopeFilter(ctx, 'batch_tracking');
    sql += ` ${scope.clause}`; params.push(...scope.params);
    sql += ' ORDER BY b.expiry_date ASC NULLS LAST';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async create(data: Record<string, any>, ctx?: CompanyContext) {
    const d = applyInsertScope(ctx, data, 'batch_tracking');
    const { rows } = await pool.query(
      `INSERT INTO batch_tracking (ingredient_id, warehouse_id, batch_number, supplier_id, quantity, remaining_quantity, unit_cost, manufacturing_date, expiry_date, notes, company_id, branch_id)
       VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [d.ingredient_id, d.warehouse_id, d.batch_number, d.supplier_id, d.quantity, d.unit_cost, d.manufacturing_date, d.expiry_date, d.notes, d.company_id, d.branch_id]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const { rows } = await pool.query(
      `UPDATE batch_tracking SET status=COALESCE($1,status), remaining_quantity=COALESCE($2,remaining_quantity), notes=COALESCE($3,notes) WHERE id=$4 RETURNING *`,
      [data.status, data.remaining_quantity, data.notes, id]
    );
    return rows[0] || null;
  },
};

// ─── 4. REORDERING RULES ───
export const reorderingRepo = {
  async findAll() {
    const { rows } = await pool.query(`
      SELECT r.*, i.name as ingredient_name, i.item_code, w.name as warehouse_name, s.name as supplier_name
      FROM reordering_rules r
      LEFT JOIN ingredients i ON r.ingredient_id=i.id LEFT JOIN warehouses w ON r.warehouse_id=w.id LEFT JOIN suppliers s ON r.supplier_id=s.id
      ORDER BY i.name
    `);
    return rows;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO reordering_rules (ingredient_id, warehouse_id, min_quantity, max_quantity, reorder_point, economic_order_qty, lead_time_days, safety_stock, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.ingredient_id, data.warehouse_id, data.min_quantity, data.max_quantity, data.reorder_point, data.economic_order_qty, data.lead_time_days, data.safety_stock, data.supplier_id]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const COL_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const [key, val] of Object.entries(data)) { if (key === 'id') continue; if (!COL_REGEX.test(key)) continue; fields.push(`${key} = $${i}`); values.push(val); i++; }
    values.push(id);
    const { rows } = await pool.query(`UPDATE reordering_rules SET ${fields.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=$${i} RETURNING *`, values);
    return rows[0] || null;
  },
  async delete(id: string) {
    await pool.query('DELETE FROM reordering_rules WHERE id=$1', [id]);
    return true;
  },
  async getSuggestions() {
    const { rows } = await pool.query(`
      SELECT r.*, i.name as ingredient_name, i.item_code, w.name as warehouse_name, iv.quantity as current_stock,
        s.name as supplier_name, s.phone as supplier_phone
      FROM reordering_rules r
      JOIN ingredients i ON r.ingredient_id=i.id JOIN warehouses w ON r.warehouse_id=w.id
      LEFT JOIN inventory_items iv ON iv.ingredient_id=i.id AND iv.warehouse_id=w.id
      LEFT JOIN suppliers s ON r.supplier_id=s.id
      WHERE r.is_active = true AND COALESCE(iv.quantity, 0) <= r.reorder_point
      ORDER BY (COALESCE(iv.quantity, 0) / NULLIF(r.reorder_point, 0)) ASC
    `);
    return rows;
  },
};

// ─── 5. STOCK VALUATION ───
export const stockValuationRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = `SELECT sv.*, i.name as ingredient_name, i.item_code, w.name as warehouse_name
               FROM stock_valuation sv JOIN ingredients i ON sv.ingredient_id=i.id JOIN warehouses w ON sv.warehouse_id=w.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.warehouse_id) { sql += ` AND sv.warehouse_id=$${params.length+1}`; params.push(filters.warehouse_id); }
    if (filters.ingredient_id) { sql += ` AND sv.ingredient_id=$${params.length+1}`; params.push(filters.ingredient_id); }
    if (filters.date) { sql += ` AND sv.valuation_date=$${params.length+1}`; params.push(filters.date); }
    sql += ' ORDER BY sv.valuation_date DESC, i.name';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async calculate() {
    const { rows } = await pool.query(`
      INSERT INTO stock_valuation (ingredient_id, warehouse_id, valuation_date, quantity_on_hand, unit_cost, total_value, valuation_method)
      SELECT iv.ingredient_id, iv.warehouse_id, CURRENT_DATE, iv.quantity, COALESCE(i.cost, 0), iv.quantity * COALESCE(i.cost, 0), 'avg'
      FROM inventory_items iv JOIN ingredients i ON iv.ingredient_id=i.id WHERE iv.quantity > 0
      ON CONFLICT DO NOTHING RETURNING *
    `);
    return rows;
  },
};

// ─── 6. BOM ───
export const bomRepo = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM production_boms ORDER BY id DESC');
    for (const bom of rows) {
      const items = await pool.query('SELECT bi.*, i.name as ingredient_name, i.unit FROM bom_items bi LEFT JOIN ingredients i ON bi.ingredient_id=i.id WHERE bi.bom_id=$1 ORDER BY bi.sort_order', [bom.id]);
      bom.items = items.rows;
    }
    return rows;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO production_boms (product_id, product_name, bom_code) VALUES ($1,$2,$3) RETURNING *`,
      [data.product_id, data.product_name, data.bom_code]
    );
    const bomId = rows[0].id;
    let totalCost = 0;
    for (const item of (data.items || [])) {
      const itemCost = (item.quantity || 0) * (item.unit_cost || 0);
      totalCost += itemCost;
      await pool.query(
        `INSERT INTO bom_items (bom_id, ingredient_id, quantity, unit, unit_cost, total_cost, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [bomId, item.ingredient_id, item.quantity, item.unit, item.unit_cost, itemCost, item.sort_order || 0]
      );
    }
    await pool.query('UPDATE production_boms SET total_cost=$1 WHERE id=$2', [totalCost, bomId]);
    return { ...rows[0], total_cost: totalCost };
  },
  async delete(id: string) {
    await pool.query('DELETE FROM production_boms WHERE id=$1', [id]);
    return true;
  },
};

// ─── 7. WORK CENTERS ───
export const workCenterRepo = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM work_centers ORDER BY code');
    return rows;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO work_centers (code, name, name_ar, branch_id, warehouse_id, cost_per_hour, capacity) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.code, data.name, data.name_ar, data.branch_id, data.warehouse_id, data.cost_per_hour, data.capacity]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const COL_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const [key, val] of Object.entries(data)) { if (key === 'id') continue; if (!COL_REGEX.test(key)) continue; fields.push(`${key}=$${i}`); values.push(val); i++; }
    values.push(id);
    const { rows } = await pool.query(`UPDATE work_centers SET ${fields.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=$${i} RETURNING *`, values);
    return rows[0] || null;
  },
  async delete(id: string) {
    await pool.query('DELETE FROM work_centers WHERE id=$1', [id]);
    return true;
  },
};

// ─── 8. MANUFACTURING ORDERS ───
export const manufacturingRepo = {
  async findAll(filters: Record<string, any> = {}, ctx?: CompanyContext) {
    let sql = `SELECT mo.*, w.name as work_center_name, b.name as branch_name
               FROM manufacturing_orders mo LEFT JOIN work_centers w ON mo.work_center_id=w.id LEFT JOIN branches b ON mo.branch_id=b.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.status) { sql += ` AND mo.status=$${params.length+1}`; params.push(filters.status); }
    if (filters.work_center_id) { sql += ` AND mo.work_center_id=$${params.length+1}`; params.push(filters.work_center_id); }
    const scope = buildScopeFilter(ctx, 'manufacturing_orders');
    sql += ` ${scope.clause}`; params.push(...scope.params);
    sql += ' ORDER BY mo.created_at DESC';
    const { rows } = await pool.query(sql, params);
    for (const mo of rows) {
      const items = await pool.query('SELECT * FROM manufacturing_order_items WHERE mo_id=$1', [mo.id]);
      mo.items = items.rows;
    }
    return rows;
  },
  async create(data: Record<string, any>, ctx?: CompanyContext) {
    const d = applyInsertScope(ctx, data, 'manufacturing_orders');
    const moNum = `MO-${Date.now()}`;
    const { rows } = await pool.query(
      `INSERT INTO manufacturing_orders (mo_number, bom_id, product_id, product_name, work_center_id, quantity_planned, priority, planned_start, planned_end, branch_id, status, company_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'planned',$11) RETURNING *`,
      [moNum, d.bom_id, d.product_id, d.product_name, d.work_center_id, d.quantity_planned, d.priority || 'normal', d.planned_start, d.planned_end, d.branch_id, d.company_id]
    );
    const moId = rows[0].id;
    let totalMaterialCost = 0;
    for (const item of (data.items || [])) {
      const tc = (item.consumed_qty || item.planned_qty || 0) * (item.unit_cost || 0);
      totalMaterialCost += tc;
      await pool.query(
        `INSERT INTO manufacturing_order_items (mo_id, ingredient_id, ingredient_name, planned_qty, unit_cost, total_cost, warehouse_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [moId, item.ingredient_id, item.ingredient_name, item.planned_qty, item.unit_cost, tc, item.warehouse_id]
      );
    }
    await pool.query('UPDATE manufacturing_orders SET total_material_cost=$1 WHERE id=$2', [totalMaterialCost, moId]);
    return { ...rows[0], total_material_cost: totalMaterialCost };
  },
  async updateStatus(id: string, data: Record<string, any>) {
    const { rows } = await pool.query(
      `UPDATE manufacturing_orders SET status=$1, quantity_produced=COALESCE($2,quantity_produced), quantity_scrapped=COALESCE($3,quantity_scrapped),
       actual_start=COALESCE($4,actual_start), actual_end=COALESCE($5,actual_end), updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *`,
      [data.status, data.quantity_produced, data.quantity_scrapped, data.actual_start, data.actual_end, id]
    );
    return rows[0] || null;
  },
};

// ─── 9. QUALITY CHECKS ───
export const qualityRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = 'SELECT * FROM quality_checks WHERE 1=1';
    const params: any[] = [];
    if (filters.mo_id) { sql += ` AND mo_id=$${params.length+1}`; params.push(filters.mo_id); }
    sql += ' ORDER BY check_date DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async create(data: Record<string, any>) {
    const passRate = data.total_checked > 0 ? ((data.passed / data.total_checked) * 100).toFixed(2) : '0';
    const { rows } = await pool.query(
      `INSERT INTO quality_checks (mo_id, product_id, product_name, work_center_id, total_checked, passed, failed, pass_rate, status, defects, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.mo_id, data.product_id, data.product_name, data.work_center_id, data.total_checked, data.passed, data.failed, passRate, data.status || 'passed', data.defects, data.notes]
    );
    return rows[0];
  },
};

// ─── 10. SCRAP RECORDS ───
export const scrapRepo = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM scrap_records ORDER BY scrapped_at DESC');
    return rows;
  },
  async create(data: Record<string, any>) {
    const totalCost = (data.quantity || 0) * (data.unit_cost || 0);
    const { rows } = await pool.query(
      `INSERT INTO scrap_records (mo_id, ingredient_id, ingredient_name, warehouse_id, quantity, unit_cost, total_cost, reason, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.mo_id, data.ingredient_id, data.ingredient_name, data.warehouse_id, data.quantity, data.unit_cost, totalCost, data.reason, data.notes]
    );
    return rows[0];
  },
};

// ─── 11. MAINTENANCE ASSETS ───
export const assetRepo = {
  async findAll(filters: Record<string, any> = {}, ctx?: CompanyContext) {
    let sql = `SELECT a.*, b.name as branch_name FROM maintenance_assets a LEFT JOIN branches b ON a.branch_id=b.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.branch_id) { sql += ` AND a.branch_id=$${params.length+1}`; params.push(filters.branch_id); }
    if (filters.category) { sql += ` AND a.category=$${params.length+1}`; params.push(filters.category); }
    if (filters.status) { sql += ` AND a.status=$${params.length+1}`; params.push(filters.status); }
    const scope = buildScopeFilter(ctx, 'maintenance_assets');
    sql += ` ${scope.clause}`; params.push(...scope.params);
    sql += ' ORDER BY a.asset_code';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async create(data: Record<string, any>) {
    const cols = ['asset_code','name','name_ar','category','brand','model','serial_number','location','branch_id','work_center_id','purchase_date','purchase_cost','current_value','depreciation_rate','warranty_end','status','supplier_id','specification','image_url','notes'];
    const fields = cols.filter(c => data[c] !== undefined);
    const values = fields.map(c => data[c]);
    const { rows } = await pool.query(
      `INSERT INTO maintenance_assets (${fields.join(',')}) VALUES (${fields.map((_,i) => `$${i+1}`).join(',')}) RETURNING *`, values
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const COL_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const [key, val] of Object.entries(data)) { if (key === 'id') continue; if (!COL_REGEX.test(key)) continue; fields.push(`${key}=$${i}`); values.push(val); i++; }
    values.push(id);
    const { rows } = await pool.query(`UPDATE maintenance_assets SET ${fields.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=$${i} RETURNING *`, values);
    return rows[0] || null;
  },
  async delete(id: string) {
    await pool.query('DELETE FROM maintenance_assets WHERE id=$1', [id]);
    return true;
  },
};

// ─── 12. MAINTENANCE REQUESTS ───
export const maintenanceRequestRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = `SELECT mr.*, a.name as asset_name, a.asset_code FROM maintenance_requests mr JOIN maintenance_assets a ON mr.asset_id=a.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.status) { sql += ` AND mr.status=$${params.length+1}`; params.push(filters.status); }
    if (filters.asset_id) { sql += ` AND mr.asset_id=$${params.length+1}`; params.push(filters.asset_id); }
    if (filters.branch_id) { sql += ` AND mr.branch_id=$${params.length+1}`; params.push(filters.branch_id); }
    sql += ' ORDER BY mr.requested_at DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO maintenance_requests (asset_id, request_type, priority, description, branch_id, assigned_to, estimated_cost)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.asset_id, data.request_type || 'corrective', data.priority || 'normal', data.description, data.branch_id, data.assigned_to, data.estimated_cost]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const { rows } = await pool.query(
      `UPDATE maintenance_requests SET status=COALESCE($1,status), assigned_to=COALESCE($2,assigned_to), scheduled_date=COALESCE($3,scheduled_date),
       actual_cost=COALESCE($4,actual_cost), completed_at=COALESCE($5,completed_at), updated_at=CURRENT_TIMESTAMP WHERE id=$6 RETURNING *`,
      [data.status, data.assigned_to, data.scheduled_date, data.actual_cost, data.completed_at, id]
    );
    return rows[0] || null;
  },
};

// ─── 13. WORK ORDERS ───
export const workOrderRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = `SELECT wo.*, a.name as asset_name, a.asset_code FROM maintenance_work_orders wo JOIN maintenance_assets a ON wo.asset_id=a.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.status) { sql += ` AND wo.status=$${params.length+1}`; params.push(filters.status); }
    if (filters.asset_id) { sql += ` AND wo.asset_id=$${params.length+1}`; params.push(filters.asset_id); }
    sql += ' ORDER BY wo.created_at DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async create(data: Record<string, any>) {
    const woNum = `WO-${Date.now()}`;
    const { rows } = await pool.query(
      `INSERT INTO maintenance_work_orders (wo_number, request_id, asset_id, work_center_id, description, priority, assigned_to, planned_start, planned_end, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [woNum, data.request_id, data.asset_id, data.work_center_id, data.description, data.priority || 'normal', data.assigned_to, data.planned_start, data.planned_end, data.branch_id]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const totalCost = (data.labor_cost || 0) + (data.parts_cost || 0) + (data.other_cost || 0);
    const { rows } = await pool.query(
      `UPDATE maintenance_work_orders SET status=COALESCE($1,status), labor_hours=COALESCE($2,labor_hours), labor_cost=COALESCE($3,labor_cost),
       parts_cost=COALESCE($4,parts_cost), other_cost=COALESCE($5,other_cost), total_cost=$6,
       actual_start=COALESCE($7,actual_start), actual_end=COALESCE($8,actual_end), updated_at=CURRENT_TIMESTAMP WHERE id=$9 RETURNING *`,
      [data.status, data.labor_hours, data.labor_cost, data.parts_cost, data.other_cost, totalCost, data.actual_start, data.actual_end, id]
    );
    return rows[0] || null;
  },
};

// ─── 14. PREVENTIVE MAINTENANCE ───
export const preventiveMaintRepo = {
  async findAll() {
    const { rows } = await pool.query(`SELECT pm.*, a.name as asset_name, a.asset_code FROM preventive_maintenance pm JOIN maintenance_assets a ON pm.asset_id=a.id ORDER BY pm.next_due ASC`);
    return rows;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO preventive_maintenance (asset_id, title, description, frequency_type, frequency_value, assigned_to, estimated_duration_min, next_due)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CURRENT_DATE + ($5::text || ' ' || $4::text || ' days')::INTERVAL) RETURNING *`,
      [data.asset_id, data.title, data.description, data.frequency_type || 'monthly', data.frequency_value || 1, data.assigned_to, data.estimated_duration_min]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const { rows } = await pool.query(
      `UPDATE preventive_maintenance SET last_performed=COALESCE($1,last_performed), is_active=COALESCE($2,is_active), assigned_to=COALESCE($3,assigned_to),
       updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *`,
      [data.last_performed, data.is_active, data.assigned_to, id]
    );
    return rows[0] || null;
  },
};

// ─── 15. CRM LEADS ───
export const leadRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = 'SELECT * FROM crm_leads WHERE 1=1';
    const params: any[] = [];
    if (filters.status) { sql += ` AND status=$${params.length+1}`; params.push(filters.status); }
    if (filters.assigned_to) { sql += ` AND assigned_to=$${params.length+1}`; params.push(filters.assigned_to); }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async findById(id: string) {
    const { rows } = await pool.query('SELECT * FROM crm_leads WHERE id=$1', [id]);
    return rows[0] || null;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO crm_leads (name, phone, email, company_name, source, industry, notes, assigned_to, branch_id, estimated_value)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [data.name, data.phone, data.email, data.company_name, data.source, data.industry, data.notes, data.assigned_to, data.branch_id, data.estimated_value]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const COL_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const [key, val] of Object.entries(data)) { if (key === 'id') continue; if (!COL_REGEX.test(key)) continue; fields.push(`${key}=$${i}`); values.push(val); i++; }
    values.push(id);
    const { rows } = await pool.query(`UPDATE crm_leads SET ${fields.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=$${i} RETURNING *`, values);
    return rows[0] || null;
  },
  async delete(id: string) {
    await pool.query('DELETE FROM crm_leads WHERE id=$1', [id]);
    return true;
  },
  async convert(leadId: string, data: Record<string, any>) {
    const { rows: leadRows } = await pool.query('SELECT * FROM crm_leads WHERE id=$1', [leadId]);
    if (!leadRows[0]) return null;
    const l = leadRows[0];
    let customerId = l.customer_id;
    if (!customerId) {
      const { rows: custRows } = await pool.query('INSERT INTO customers (name, phone) VALUES ($1,$2) RETURNING id', [l.name, l.phone]);
      customerId = custRows[0].id;
    }
    const { rows: oppRows } = await pool.query(
      `INSERT INTO crm_opportunities (lead_id, customer_id, title, pipeline_stage, estimated_value, expected_close_date, assigned_to, branch_id, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [leadId, customerId, data.title || l.name, data.pipeline_stage || 'qualified', data.estimated_value || l.estimated_value, data.expected_close_date, l.assigned_to, l.branch_id, l.source]
    );
    await pool.query("UPDATE crm_leads SET status='converted' WHERE id=$1", [leadId]);
    return oppRows[0];
  },
};

// ─── 16. CRM OPPORTUNITIES ───
export const opportunityRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = `SELECT o.*, l.name as lead_name, c.name as customer_name FROM crm_opportunities o LEFT JOIN crm_leads l ON o.lead_id=l.id LEFT JOIN customers c ON o.customer_id=c.id WHERE 1=1`;
    const params: any[] = [];
    if (filters.pipeline_stage) { sql += ` AND o.pipeline_stage=$${params.length+1}`; params.push(filters.pipeline_stage); }
    if (filters.assigned_to) { sql += ` AND o.assigned_to=$${params.length+1}`; params.push(filters.assigned_to); }
    sql += ' ORDER BY o.created_at DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async update(id: string, data: Record<string, any>) {
    const COL_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    const fields: string[] = []; const values: any[] = []; let i = 1;
    for (const [key, val] of Object.entries(data)) { if (key === 'id') continue; if (!COL_REGEX.test(key)) continue; fields.push(`${key}=$${i}`); values.push(val); i++; }
    values.push(id);
    const { rows } = await pool.query(`UPDATE crm_opportunities SET ${fields.join(',')}, updated_at=CURRENT_TIMESTAMP WHERE id=$${i} RETURNING *`, values);
    return rows[0] || null;
  },
};

// ─── 17. CRM QUOTATIONS ───
export const quotationRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = 'SELECT * FROM crm_quotations WHERE 1=1';
    const params: any[] = [];
    if (filters.status) { sql += ` AND status=$${params.length+1}`; params.push(filters.status); }
    sql += ' ORDER BY created_at DESC';
    const { rows } = await pool.query(sql, params);
    for (const q of rows) {
      const items = await pool.query('SELECT * FROM crm_quotation_items WHERE quotation_id=$1 ORDER BY sort_order', [q.id]);
      q.items = items.rows;
    }
    return rows;
  },
  async create(data: Record<string, any>) {
    const qNum = `QT-${Date.now()}`;
    let subtotal = 0;
    for (const item of (data.items || [])) subtotal += item.total_price || 0;
    const grandTotal = subtotal - (data.discount_amount || 0) + (data.tax_amount || 0);
    const { rows } = await pool.query(
      `INSERT INTO crm_quotations (quotation_number, opportunity_id, customer_id, customer_name, customer_phone, branch_id, subtotal, discount_amount, tax_amount, grand_total, notes, terms_conditions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [qNum, data.opportunity_id, data.customer_id, data.customer_name, data.customer_phone, data.branch_id, subtotal, data.discount_amount, data.tax_amount, grandTotal, data.notes, data.terms_conditions]
    );
    const qId = rows[0].id;
    for (const item of (data.items || [])) {
      await pool.query(
        `INSERT INTO crm_quotation_items (quotation_id, ingredient_id, item_name, quantity, unit, unit_price, discount_percent, tax_rate, total_price, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [qId, item.ingredient_id, item.item_name, item.quantity, item.unit, item.unit_price, item.discount_percent, item.tax_rate, item.total_price, item.sort_order || 0]
      );
    }
    return { ...rows[0], items: data.items };
  },
};

// ─── 18. CRM ACTIVITIES ───
export const activityRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = 'SELECT * FROM crm_activities WHERE 1=1';
    const params: any[] = [];
    if (filters.opportunity_id) { sql += ` AND opportunity_id=$${params.length+1}`; params.push(filters.opportunity_id); }
    if (filters.lead_id) { sql += ` AND lead_id=$${params.length+1}`; params.push(filters.lead_id); }
    if (filters.status) { sql += ` AND status=$${params.length+1}`; params.push(filters.status); }
    sql += ' ORDER BY scheduled_date DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async create(data: Record<string, any>) {
    const { rows } = await pool.query(
      `INSERT INTO crm_activities (opportunity_id, lead_id, activity_type, subject, description, scheduled_date, assigned_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [data.opportunity_id, data.lead_id, data.activity_type, data.subject, data.description, data.scheduled_date, data.assigned_to]
    );
    return rows[0];
  },
  async update(id: string, data: Record<string, any>) {
    const { rows } = await pool.query(
      `UPDATE crm_activities SET status=COALESCE($1,status), completed_date=COALESCE($2,completed_date) WHERE id=$3 RETURNING *`,
      [data.status, data.completed_date, id]
    );
    return rows[0] || null;
  },
};

// ─── 19. RECIPES ───
export const recipeRepo = {
  async findAll() {
    const { rows } = await pool.query('SELECT * FROM recipes ORDER BY name');
    for (const r of rows) {
      const items = await pool.query('SELECT ri.*, i.name as ingredient_name FROM recipe_ingredients ri LEFT JOIN ingredients i ON ri.ingredient_id=i.id WHERE ri.recipe_id=$1 ORDER BY ri.sort_order', [r.id]);
      r.items = items.rows;
    }
    return rows;
  },
  async create(data: Record<string, any>) {
    let totalCost = 0;
    for (const item of (data.items || [])) totalCost += item.total_cost || 0;
    const foodCostPercent = data.selling_price > 0 ? ((totalCost / data.selling_price) * 100).toFixed(2) : '0';
    const { rows } = await pool.query(
      `INSERT INTO recipes (product_id, name, name_ar, description, instructions, prep_time_min, cook_time_min, total_yield, total_cost, selling_price, food_cost_percent, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [data.product_id, data.name, data.name_ar, data.description, data.instructions, data.prep_time_min, data.cook_time_min, data.total_yield, totalCost, data.selling_price, foodCostPercent, data.branch_id]
    );
    const recipeId = rows[0].id;
    for (const item of (data.items || [])) {
      await pool.query(
        `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, unit_cost, total_cost, waste_percent, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [recipeId, item.ingredient_id, item.quantity, item.unit, item.unit_cost, item.total_cost, item.waste_percent, item.sort_order || 0]
      );
    }
    return { ...rows[0], items: data.items };
  },
};

// ─── 20. WASTE RECORDS ───
export const wasteRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = 'SELECT w.*, i.name as ingredient_name FROM waste_records w LEFT JOIN ingredients i ON w.ingredient_id=i.id WHERE 1=1';
    const params: any[] = [];
    if (filters.branch_id) { sql += ` AND w.branch_id=$${params.length+1}`; params.push(filters.branch_id); }
    if (filters.waste_type) { sql += ` AND w.waste_type=$${params.length+1}`; params.push(filters.waste_type); }
    if (filters.date_from) { sql += ` AND w.recorded_at >= $${params.length+1}`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND w.recorded_at <= $${params.length+1}`; params.push(filters.date_to); }
    sql += ' ORDER BY w.recorded_at DESC';
    const { rows } = await pool.query(sql, params);
    return rows;
  },
  async create(data: Record<string, any>) {
    const totalCost = (data.quantity || 0) * (data.unit_cost || 0);
    const { rows } = await pool.query(
      `INSERT INTO waste_records (branch_id, ingredient_id, ingredient_name, quantity, unit_cost, total_cost, waste_type, reason, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [data.branch_id, data.ingredient_id, data.ingredient_name, data.quantity, data.unit_cost, totalCost, data.waste_type || 'spoilage', data.reason, data.notes]
    );
    return rows[0];
  },
};

// ─── 21. AUDIT LOG ───
export const auditLogRepo = {
  async findAll(filters: Record<string, any> = {}) {
    let sql = 'SELECT * FROM enterprise_audit_log WHERE 1=1';
    const params: any[] = [];
    if (filters.module) { sql += ` AND module=$${params.length+1}`; params.push(filters.module); }
    if (filters.user_id) { sql += ` AND user_id=$${params.length+1}`; params.push(filters.user_id); }
    if (filters.table_name) { sql += ` AND table_name=$${params.length+1}`; params.push(filters.table_name); }
    if (filters.date_from) { sql += ` AND created_at >= $${params.length+1}`; params.push(filters.date_from); }
    if (filters.date_to) { sql += ` AND created_at <= $${params.length+1}`; params.push(filters.date_to); }
    if (filters.company_id) { sql += ` AND company_id=$${params.length+1}`; params.push(filters.company_id); }
    sql += ` ORDER BY created_at DESC LIMIT ${filters.limit || 500}`;
    const { rows } = await pool.query(sql, params);
    return rows;
  },
};

// ─── 22. DASHBOARD KPIs ───
export const dashboardRepo = {
  async getKPIs(filters: Record<string, any> = {}) {
    const df = filters.date_from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const dt = filters.date_to || new Date().toISOString().split('T')[0];
    const branchFilter = filters.branch_id ? `AND o.branch_id = $3` : '';
    const params = filters.branch_id ? [df, dt, parseInt(filters.branch_id)] : [df, dt];

    const [salesRes, ordersRes, costRes, inventoryRes, productionRes] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(total),0) as total_sales FROM orders WHERE timestamp >= $1 AND timestamp <= $2 AND is_paid=true ${branchFilter}`, params),
      pool.query(`SELECT COUNT(*) as total_orders, COALESCE(AVG(total),0) as avg_order FROM orders WHERE timestamp >= $1 AND timestamp <= $2 ${branchFilter}`, params),
      pool.query(`SELECT COALESCE(SUM(total_cost),0) as total_cost FROM orders WHERE timestamp >= $1 AND timestamp <= $2 ${branchFilter}`, params),
      pool.query(`SELECT COALESCE(SUM(ii.quantity * i.cost), 0) as inventory_value FROM inventory_items ii JOIN ingredients i ON ii.ingredient_id = i.id`),
      pool.query(`SELECT COUNT(*) as total_mo, COALESCE(SUM(quantity_produced),0) as total_produced, COALESCE(SUM(quantity_scrapped),0) as total_scrap FROM manufacturing_orders WHERE created_at >= $1 AND created_at <= $2 ${branchFilter}`, params),
    ]);

    const totalSales = parseFloat(salesRes.rows[0]?.total_sales || 0);
    const totalCost = parseFloat(costRes.rows[0]?.total_cost || 0);
    const totalOrders = parseInt(ordersRes.rows[0]?.total_orders || 0);
    const avgOrder = parseFloat(ordersRes.rows[0]?.avg_order || 0);
    const inventoryValue = parseFloat(inventoryRes.rows[0]?.inventory_value || 0);
    const totalMO = parseInt(productionRes.rows[0]?.total_mo || 0);
    const totalProduced = parseFloat(productionRes.rows[0]?.total_produced || 0);
    const totalScrap = parseFloat(productionRes.rows[0]?.total_scrap || 0);

    return {
      period: { from: df, to: dt, branch_id: filters.branch_id || 'all' },
      sales: { total: totalSales, orders: totalOrders, avg_order: avgOrder, profit: totalSales - totalCost, profit_margin: totalSales > 0 ? ((totalSales - totalCost) / totalSales * 100).toFixed(2) : 0 },
      inventory: { value: inventoryValue },
      production: { orders: totalMO, output: totalProduced, scrap: totalScrap, scrap_rate: totalProduced > 0 ? (totalScrap / (totalProduced + totalScrap) * 100).toFixed(2) : 0 },
      cost: { total: totalCost, food_cost_ratio: totalSales > 0 ? (totalCost / totalSales * 100).toFixed(2) : 0 },
    };
  },
};

// ─── 23. FINANCIAL REPORTS ───
export const financialRepo = {
  async trialBalance(date_from?: string, date_to?: string) {
    const { rows } = await pool.query(`
      SELECT a.id, a.code, a.name, a.name_ar, a.type, a.account_type, a.level, a.is_leaf,
        COALESCE(SUM(ji.debit), 0) as total_debit,
        COALESCE(SUM(ji.credit), 0) as total_credit,
        COALESCE(SUM(ji.debit), 0) - COALESCE(SUM(ji.credit), 0) as net_balance
      FROM accounts a
      LEFT JOIN journal_items ji ON ji.account_id = a.id
        AND ji.journal_entry_id IN (
          SELECT id FROM journal_entries WHERE 1=1
          ${date_from ? `AND date >= $1` : ''}
          ${date_to ? `AND date <= $2` : ''}
        )
      WHERE a.is_leaf = true AND a.status = true
      GROUP BY a.id, a.code, a.name, a.name_ar, a.type, a.account_type, a.level, a.is_leaf
      HAVING COALESCE(SUM(ji.debit), 0) > 0 OR COALESCE(SUM(ji.credit), 0) > 0
      ORDER BY a.code
    `, date_from && date_to ? [date_from, date_to] : date_from ? [date_from] : date_to ? [date_to] : []);
    const totalDebit = rows.reduce((s: number, r: any) => s + parseFloat(r.total_debit), 0);
    const totalCredit = rows.reduce((s: number, r: any) => s + parseFloat(r.total_credit), 0);
    return { report_date: date_from || 'all', total_debit: totalDebit, total_credit: totalCredit, difference: totalDebit - totalCredit, accounts: rows };
  },

  async incomeStatement(date_from?: string, date_to?: string) {
    const { rows } = await pool.query(`
      SELECT a.id, a.code, a.name, a.name_ar, a.type, a.account_type,
        COALESCE(SUM(ji.debit), 0) as total_debit,
        COALESCE(SUM(ji.credit), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_items ji ON ji.account_id = a.id
        AND ji.journal_entry_id IN (
          SELECT id FROM journal_entries WHERE 1=1
          ${date_from ? `AND date >= $1` : ''}
          ${date_to ? `AND date <= $2` : ''}
        )
      WHERE a.status = true AND a.is_leaf = true AND a.type IN ('revenue', 'expense')
      GROUP BY a.id, a.code, a.name, a.name_ar, a.type, a.account_type
      HAVING COALESCE(SUM(ji.debit), 0) > 0 OR COALESCE(SUM(ji.credit), 0) > 0
      ORDER BY a.type, a.code
    `, date_from && date_to ? [date_from, date_to] : date_from ? [date_from] : date_to ? [date_to] : []);
    const revenue = rows.filter((r: any) => r.type === 'revenue').reduce((s: number, r: any) => s + parseFloat(r.total_credit) - parseFloat(r.total_debit), 0);
    const expenses = rows.filter((r: any) => r.type === 'expense').reduce((s: number, r: any) => s + parseFloat(r.total_debit) - parseFloat(r.total_credit), 0);
    return { period: { from: date_from, to: date_to }, revenue, expenses, net_income: revenue - expenses, accounts: rows };
  },

  async balanceSheet(date_from?: string, date_to?: string) {
    const { rows } = await pool.query(`
      SELECT a.id, a.code, a.name, a.name_ar, a.type, a.account_type, a.level,
        COALESCE(SUM(ji.debit), 0) as total_debit,
        COALESCE(SUM(ji.credit), 0) as total_credit
      FROM accounts a
      LEFT JOIN journal_items ji ON ji.account_id = a.id
        AND ji.journal_entry_id IN (
          SELECT id FROM journal_entries WHERE 1=1
          ${date_from ? `AND date >= $1` : ''}
          ${date_to ? `AND date <= $2` : ''}
        )
      WHERE a.status = true AND a.is_leaf = true AND a.type IN ('asset', 'liability', 'equity')
      GROUP BY a.id, a.code, a.name, a.name_ar, a.type, a.account_type, a.level
      HAVING COALESCE(SUM(ji.debit), 0) > 0 OR COALESCE(SUM(ji.credit), 0) > 0
      ORDER BY a.type, a.code
    `, date_from && date_to ? [date_from, date_to] : date_from ? [date_from] : date_to ? [date_to] : []);
    const assets = rows.filter((r: any) => r.type === 'asset').reduce((s: number, r: any) => s + parseFloat(r.total_debit) - parseFloat(r.total_credit), 0);
    const liabilities = rows.filter((r: any) => r.type === 'liability').reduce((s: number, r: any) => s + parseFloat(r.total_credit) - parseFloat(r.total_debit), 0);
    const equity = rows.filter((r: any) => r.type === 'equity').reduce((s: number, r: any) => s + parseFloat(r.total_credit) - parseFloat(r.total_debit), 0);
    return { period: { from: date_from, to: date_to }, assets, liabilities, equity, total_liabilities_equity: liabilities + equity, accounts: rows };
  },

  async cashFlow(date_from?: string, date_to?: string) {
    const { rows } = await pool.query(`
      SELECT transaction_type,
        COALESCE(SUM(CASE WHEN transaction_type IN ('receipt','deposit','transfer_in','customer_payment') THEN amount ELSE 0 END), 0) as inflow,
        COALESCE(SUM(CASE WHEN transaction_type IN ('payment','withdrawal','transfer_out','supplier_payment','expense') THEN amount ELSE 0 END), 0) as outflow
      FROM treasury_transactions
      WHERE 1=1
        ${date_from ? `AND created_at >= '${date_from}'` : ''}
        ${date_to ? `AND created_at <= '${date_to}'` : ''}
      GROUP BY transaction_type
      ORDER BY transaction_type
    `);
    const totalInflow = rows.reduce((s: number, r: any) => s + parseFloat(r.inflow), 0);
    const totalOutflow = rows.reduce((s: number, r: any) => s + parseFloat(r.outflow), 0);
    return { period: { from: date_from, to: date_to }, total_inflow: totalInflow, total_outflow: totalOutflow, net_cash_flow: totalInflow - totalOutflow, details: rows };
  },
};