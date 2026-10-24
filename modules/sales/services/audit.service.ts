import { erpPool } from "../../../server-erp-core.js";

export interface SalesAuditLogEntry {
  entityType: 'quotation' | 'sales_order' | 'delivery_note' | 'invoice' | 'return' | 'reservation' | 'sales_product' | 'price_list';
  entityId: number;
  entityNumber?: string;
  action: string;
  oldStatus?: string;
  newStatus?: string;
  userName?: string;
  details?: Record<string, any> | string;
}

export class SalesAuditService {
  private static ensured = false;

  static async ensureTable(): Promise<void> {
    if (this.ensured) return;
    try {
      await erpPool.query(`
        CREATE TABLE IF NOT EXISTS sales_audit_logs (
          id SERIAL PRIMARY KEY,
          entity_type VARCHAR(50) NOT NULL,
          entity_id INTEGER NOT NULL,
          entity_number VARCHAR(100),
          action VARCHAR(100) NOT NULL,
          old_status VARCHAR(50),
          new_status VARCHAR(50),
          user_name VARCHAR(100) DEFAULT 'النظام',
          details JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sales_audit_entity ON sales_audit_logs(entity_type, entity_id);
      `);
      this.ensured = true;
    } catch (err: any) {
      console.warn("[SalesAuditService] Table init warning:", err.message);
    }
  }

  static async log(entry: SalesAuditLogEntry): Promise<void> {
    try {
      await this.ensureTable();
      const detailsJson = typeof entry.details === 'object' ? JSON.stringify(entry.details) : JSON.stringify({ message: entry.details || '' });
      await erpPool.query(`
        INSERT INTO sales_audit_logs (
          entity_type, entity_id, entity_number, action, old_status, new_status, user_name, details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        entry.entityType,
        entry.entityId,
        entry.entityNumber || null,
        entry.action,
        entry.oldStatus || null,
        entry.newStatus || null,
        entry.userName || 'النظام',
        detailsJson
      ]);
    } catch (e: any) {
      console.warn("[SalesAuditService] Log error:", e.message);
    }
  }

  static async getLogs(filter?: { entityType?: string; entityId?: number; limit?: number }): Promise<any[]> {
    await this.ensureTable();
    try {
      let query = "SELECT * FROM sales_audit_logs WHERE 1=1";
      const params: any[] = [];
      let idx = 1;

      if (filter?.entityType) {
        query += ` AND entity_type = $${idx++}`;
        params.push(filter.entityType);
      }
      if (filter?.entityId) {
        query += ` AND entity_id = $${idx++}`;
        params.push(filter.entityId);
      }

      query += ` ORDER BY created_at DESC LIMIT $${idx}`;
      params.push(filter?.limit || 100);

      const res = await erpPool.query(query, params);
      return res.rows.map((r: any) => ({
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        entityNumber: r.entity_number,
        action: r.action,
        oldStatus: r.old_status,
        newStatus: r.new_status,
        userName: r.user_name,
        details: r.details,
        createdAt: r.created_at
      }));
    } catch (e: any) {
      console.warn("[SalesAuditService] Fetch error:", e.message);
      return [];
    }
  }
}
