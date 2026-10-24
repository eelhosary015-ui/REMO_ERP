import { pool } from '../../../server-db.js';
import { Request } from 'express';

// ═══════════════════════════════════════════════════════════════
// Enterprise Audit Log Service
// Comprehensive audit trail for all critical operations
// ═══════════════════════════════════════════════════════════════

export type AuditOperation = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'REJECT' | 'EXPORT' | 'LOGIN' | 'LOGOUT' | 'IMPORT' | 'RESTORE' | 'CANCEL' | 'STATUS_CHANGE';

export interface AuditLogEntry {
  user_id?: number | null;
  username?: string | null;
  company_id?: number | null;
  branch_id?: number | null;
  module: string;
  table_name: string;
  record_id?: number | string | null;
  operation: AuditOperation;
  old_data?: Record<string, any> | null;
  new_data?: Record<string, any> | null;
  changed_fields?: string[] | null;
  ip_address?: string | null;
  user_agent?: string | null;
  description?: string | null;
  risk_level?: 'normal' | 'sensitive' | 'critical';
}

// Operations that should ALWAYS be logged regardless of settings
const CRITICAL_OPERATIONS: Array<{ table: string; operation: AuditOperation }> = [
  { table: 'products', operation: 'UPDATE' },     // price changes
  { table: 'ingredients', operation: 'UPDATE' },   // cost changes
  { table: 'orders', operation: 'DELETE' },        // order deletion
  { table: 'orders', operation: 'CREATE' },        // new order
  { table: 'journal_entries', operation: 'CREATE' }, // journal entry
  { table: 'journal_entries', operation: 'DELETE' },
  { table: 'inventory_items', operation: 'UPDATE' }, // stock changes
  { table: 'inventory_transactions', operation: 'CREATE' },
  { table: 'employees', operation: 'DELETE' },
  { table: 'employees', operation: 'UPDATE' },
  { table: 'users', operation: 'UPDATE' },
  { table: 'users', operation: 'DELETE' },
  { table: 'purchase_orders', operation: 'DELETE' },
  { table: 'sales_orders', operation: 'DELETE' },
  { table: 'manufacturing_orders', operation: 'STATUS_CHANGE' },
  { table: 'accounts', operation: 'UPDATE' },
  { table: 'safes', operation: 'UPDATE' },
  { table: 'treasury_transactions', operation: 'CREATE' },
  { table: 'payroll', operation: 'CREATE' },
  { table: 'payroll', operation: 'UPDATE' },
  { table: 'backup_logs', operation: 'CREATE' },  // restore operations
];

// Tables to exclude specific sensitive fields from logging
const SENSITIVE_FIELD_PATTERNS = ['password', 'token', 'secret', 'credit_card', 'ssn'];

function shouldLogOperation(table: string, operation: AuditOperation): boolean {
  return CRITICAL_OPERATIONS.some(
    co => co.table === table && co.operation === operation
  );
}

function extractChangedFields(oldData: Record<string, any> | null, newData: Record<string, any> | null): string[] {
  if (!oldData || !newData) return [];
  const changed: string[] = [];
  for (const key of Object.keys(newData)) {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changed.push(key);
    }
  }
  return changed;
}

function sanitizeData(data: Record<string, any> | null): Record<string, any> | null {
  if (!data) return null;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_FIELD_PATTERNS.some(pattern => key.toLowerCase().includes(pattern))) {
      sanitized[key] = '***REDACTED***';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function determineRiskLevel(table: string, operation: AuditOperation): 'normal' | 'sensitive' | 'critical' {
  if (operation === 'DELETE') return 'critical';
  if (['journal_entries', 'accounts', 'payroll', 'users', 'employees', 'treasury_transactions'].includes(table)) return 'critical';
  if (['products', 'ingredients', 'orders', 'purchase_orders', 'sales_orders', 'manufacturing_orders', 'inventory_items'].includes(table)) return 'sensitive';
  return 'normal';
}

/**
 * Log an audit entry to the enterprise_audit_log table
 * This is async/fire-and-forget - errors are logged to console but don't block
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const oldData = sanitizeData(entry.old_data || null);
    const newData = sanitizeData(entry.new_data || null);
    const changedFields = entry.changed_fields || extractChangedFields(oldData, newData);
    const riskLevel = entry.risk_level || determineRiskLevel(entry.table_name, entry.operation);

    await pool.query(
      `INSERT INTO enterprise_audit_log (
        user_id, username, company_id, branch_id, module, table_name, record_id,
        operation, old_data, new_data, changed_fields, ip_address, user_agent,
        description, risk_level
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        entry.user_id || null,
        entry.username || null,
        entry.company_id || null,
        entry.branch_id || null,
        entry.module,
        entry.table_name,
        entry.record_id || null,
        entry.operation,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        changedFields.length > 0 ? JSON.stringify(changedFields) : null,
        entry.ip_address || null,
        entry.user_agent || null,
        entry.description || null,
        riskLevel,
      ]
    );
  } catch (error: any) {
    // Never let audit logging break the main flow
    console.error('[AUDIT LOG ERROR]', error.message);
  }
}

/**
 * Convenience: extract audit context from Express request
 */
export function getAuditContext(req: Request): Pick<AuditLogEntry, 'user_id' | 'username' | 'company_id' | 'branch_id' | 'ip_address' | 'user_agent'> {
  return {
    user_id: req.user?.id,
    username: req.user?.username,
    company_id: (req as any).companyContext?.company_id || req.user?.company_id || null,
    branch_id: (req as any).companyContext?.branch_id || req.user?.branch_id || null,
    ip_address: req.ip || req.headers['x-forwarded-for'] as string || null,
    user_agent: req.headers['user-agent'] || null,
  };
}

/**
 * Convenience: log a create operation
 */
export async function logCreate(
  req: Request,
  module: string,
  tableName: string,
  recordId: number | string,
  newData: Record<string, any>,
  description?: string
): Promise<void> {
  if (!shouldLogOperation(tableName, 'CREATE')) return;
  await logAudit({
    ...getAuditContext(req),
    module,
    table_name: tableName,
    record_id: recordId,
    operation: 'CREATE',
    new_data: newData,
    description,
  });
}

/**
 * Convenience: log an update operation
 */
export async function logUpdate(
  req: Request,
  module: string,
  tableName: string,
  recordId: number | string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  description?: string
): Promise<void> {
  if (!shouldLogOperation(tableName, 'UPDATE')) return;
  await logAudit({
    ...getAuditContext(req),
    module,
    table_name: tableName,
    record_id: recordId,
    operation: 'UPDATE',
    old_data: oldData,
    new_data: newData,
    description,
  });
}

/**
 * Convenience: log a delete operation
 */
export async function logDelete(
  req: Request,
  module: string,
  tableName: string,
  recordId: number | string,
  deletedData: Record<string, any>,
  description?: string
): Promise<void> {
  if (!shouldLogOperation(tableName, 'DELETE')) return;
  await logAudit({
    ...getAuditContext(req),
    module,
    table_name: tableName,
    record_id: recordId,
    operation: 'DELETE',
    old_data: deletedData,
    description,
  });
}

/**
 * Convenience: log a status change
 */
export async function logStatusChange(
  req: Request,
  module: string,
  tableName: string,
  recordId: number | string,
  oldStatus: string,
  newStatus: string,
  description?: string
): Promise<void> {
  if (!shouldLogOperation(tableName, 'STATUS_CHANGE')) return;
  await logAudit({
    ...getAuditContext(req),
    module,
    table_name: tableName,
    record_id: recordId,
    operation: 'STATUS_CHANGE',
    old_data: { status: oldStatus },
    new_data: { status: newStatus },
    description: description || `Status changed from "${oldStatus}" to "${newStatus}"`,
  });
}