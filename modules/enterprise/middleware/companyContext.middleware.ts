import { Request, Response, NextFunction } from 'express';
import { pool } from '../../../server-db.js';

// ═══════════════════════════════════════════════════════════════
// Company Context Middleware
// Ensures all data operations are scoped to the user's company & branch
// ═══════════════════════════════════════════════════════════════

export interface CompanyContext {
  company_id: number | null;
  branch_id: number | null;
  is_admin: boolean;
}

declare global {
  namespace Express {
    interface Request {
      companyContext?: CompanyContext;
      user?: {
        id: number;
        username: string;
        role: string;
        branch_id?: number | null;
        company_id?: number | null;
        permissions?: Record<string, any>;
      };
    }
  }
}

// Tables that must be filtered by company_id and branch_id
const COMPANY_SCOPED_TABLES = [
  'orders', 'products', 'ingredients', 'categories',
  'customers', 'suppliers', 'inventory_items', 'inventory_transactions',
  'journal_entries', 'journal_items', 'accounts',
  'employees', 'attendance', 'payroll',
  'purchase_orders', 'purchase_order_items', 'purchases', 'purchase_items',
  'sales_orders', 'sales_order_items',
  'warehouses', 'warehouses_sections',
  'manufacturing_orders', 'manufacturing_order_items',
  'production_boms', 'bom_items',
  'work_centers', 'quality_checks', 'scrap_records',
  'maintenance_assets', 'maintenance_requests', 'maintenance_work_orders', 'preventive_maintenance',
  'crm_leads', 'crm_opportunities', 'crm_quotations', 'crm_quotation_items', 'crm_activities',
  'recipes', 'recipe_ingredients',
  'waste_records', 'batch_tracking', 'reordering_rules',
  'safes', 'safe_transactions', 'treasury_accounts', 'treasury_transactions',
  'cost_items', 'operating_costs',
  'delivery_areas', 'reservations', 'web_orders',
  'hr_departments', 'hr_shifts',
  'stock_entries', 'stock_entry_items',
];

// Tables that only need branch_id filtering
const BRANCH_SCOPED_TABLES = [
  'orders', 'products', 'categories',
  'inventory_items', 'inventory_transactions',
  'employees', 'attendance', 'payroll',
  'manufacturing_orders', 'work_centers',
  'maintenance_assets', 'maintenance_requests', 'maintenance_work_orders',
  'recipes', 'waste_records',
  'safes', 'safe_transactions',
  'delivery_areas', 'reservations',
];

/**
 * Main middleware: extracts company/branch from token and attaches to request
 */
export function companyContextMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = req.user;
    const company_id = user?.company_id || null;
    const branch_id = user?.branch_id || null;
    const is_admin = user?.role === 'admin' || user?.permissions?.all === true;

    req.companyContext = {
      company_id,
      branch_id,
      is_admin,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Builds WHERE clause fragments for company/branch filtering
 * Usage in repositories:
 *   const { clause, params } = buildScopeFilter(req.companyContext, 'orders');
 *   sql += ` ${clause}`;
 */
export function buildScopeFilter(
  ctx: CompanyContext | undefined,
  tableName: string,
  alias?: string
): { clause: string; params: any[] } {
  if (!ctx || ctx.is_admin) return { clause: '', params: [] };

  const params: any[] = [];
  const parts: string[] = [];
  const tbl = alias || tableName;
  const paramIdx = () => `$${params.length + 1}`;

  // Check if table has company_id
  if (COMPANY_SCOPED_TABLES.includes(tableName) && ctx.company_id) {
    parts.push(`${tbl}.company_id = ${paramIdx()}`);
    params.push(ctx.company_id);
  }

  // Check if table has branch_id
  if (BRANCH_SCOPED_TABLES.includes(tableName) && ctx.branch_id) {
    parts.push(`${tbl}.branch_id = ${paramIdx()}`);
    params.push(ctx.branch_id);
  }

  if (parts.length === 0) return { clause: '', params: [] };

  return { clause: `AND ${parts.join(' AND ')}`, params };
}

/**
 * Apply company/branch scope to INSERT data
 * Adds company_id and branch_id to the data object if the table supports it
 */
export function applyInsertScope(
  ctx: CompanyContext | undefined,
  data: Record<string, any>,
  tableName: string
): Record<string, any> {
  if (!ctx || ctx.is_admin) return data;

  const result = { ...data };

  if (COMPANY_SCOPED_TABLES.includes(tableName) && ctx.company_id && !result.company_id) {
    result.company_id = ctx.company_id;
  }

  if (BRANCH_SCOPED_TABLES.includes(tableName) && ctx.branch_id && !result.branch_id) {
    result.branch_id = ctx.branch_id;
  }

  return result;
}

/**
 * Cross-company access guard - blocks access to data from another company
 * Call this after fetching data to verify it belongs to the user's company
 */
export function guardCompanyAccess(
  ctx: CompanyContext | undefined,
  record: Record<string, any> | null | undefined,
  tableName: string
): boolean {
  if (!ctx || ctx.is_admin || !record) return true;

  if (COMPANY_SCOPED_TABLES.includes(tableName) && ctx.company_id) {
    if (record.company_id && record.company_id !== ctx.company_id) {
      return false;
    }
  }

  if (BRANCH_SCOPED_TABLES.includes(tableName) && ctx.branch_id) {
    if (record.branch_id && record.branch_id !== ctx.branch_id) {
      return false;
    }
  }

  return true;
}