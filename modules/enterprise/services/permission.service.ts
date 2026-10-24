import { pool } from '../../../server-db.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Permission Service
// Hierarchical: User → Role → Permission → Module → Action
// Actions: view, create, update, delete, approve, export
// ═══════════════════════════════════════════════════════════════

export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export';

export interface ModulePermission {
  module: string;
  actions: Record<PermissionAction, boolean>;
  limits?: Record<string, any>;
}

export interface UserPermissionSet {
  userId: number;
  roleId: number;
  roleName: string;
  isAdmin: boolean;
  modules: Map<string, ModulePermission>;
}

// Cache for user permissions (TTL: 5 minutes)
const permissionCache = new Map<number, { data: UserPermissionSet; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the full permission set for a user from the database
 * Caches results for performance
 */
export async function getUserPermissions(userId: number, roleId: number, userPermissions?: Record<string, any>): Promise<UserPermissionSet> {
  // Check cache first
  const cached = permissionCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }

  // Admin users get full access
  if (userPermissions?.all === true || roleId === 1) {
    return {
      userId,
      roleId,
      roleName: 'admin',
      isAdmin: true,
      modules: new Map(),
    };
  }

  const result: UserPermissionSet = {
    userId,
    roleId,
    roleName: 'user',
    isAdmin: false,
    modules: new Map(),
  };

  try {
    // 1. Get role info
    const { rows: roleRows } = await pool.query(
      'SELECT id, name, name_ar FROM roles WHERE id = $1',
      [roleId]
    );
    if (roleRows.length > 0) {
      result.roleName = roleRows[0].name;
    }

    // 2. Get all permission modules
    const { rows: modules } = await pool.query(
      'SELECT id, module_key, name_ar, name_en FROM permission_modules WHERE is_active = true ORDER BY sort_order'
    );

    // 3. Get all actions for these modules
    const moduleIds = modules.map((m: any) => m.id);
    let actions: any[] = [];
    if (moduleIds.length > 0) {
      const { rows: actionRows } = await pool.query(
        'SELECT module_id, action_key FROM permission_actions WHERE is_active = true',
      );
      actions = actionRows;
    }

    // 4. Get role permissions
    const { rows: rolePerms } = await pool.query(
      'SELECT permission_key, is_granted, limits FROM role_permissions WHERE role_id = $1',
      [roleId]
    );

    // 5. Get user-specific permission overrides (from users.permissions JSON)
    const userPermMap: Record<string, any> = userPermissions || {};

    // 6. Build the permission map
    for (const mod of modules) {
      const modPerms: ModulePermission = {
        module: mod.module_key,
        actions: { view: false, create: false, update: false, delete: false, approve: false, export: false },
      };

      // Get actions for this module
      const modActions = actions.filter((a: any) => a.module_id === mod.id);

      // Explicit user settings are the source of truth for the Security screen.
      // A stored true opens a permission; a stored false closes it.
      for (const action of modActions) {
        const actionKey = action.action_key as PermissionAction;
        const permKey = `${mod.module_key}.${action.action_key}`;
        const readKey = `${mod.module_key}.read`;
        const rolePerm = rolePerms.find((rp: any) => rp.permission_key === permKey);
        const hasUserExact = Object.prototype.hasOwnProperty.call(userPermMap, permKey);
        const hasUserRead = action.action_key === 'view' && Object.prototype.hasOwnProperty.call(userPermMap, readKey);

        if (hasUserExact) {
          modPerms.actions[actionKey] = userPermMap[permKey] === true;
        } else if (hasUserRead) {
          // Frontend uses .read while enterprise RBAC uses .view.
          modPerms.actions[actionKey] = userPermMap[readKey] === true;
        } else if (rolePerm) {
          modPerms.actions[actionKey] = rolePerm.is_granted === true;
          if (rolePerm.limits) modPerms.limits = rolePerm.limits;
        } else if (userPermMap[mod.module_key] === true) {
          modPerms.actions[actionKey] = true;
        }
      }

      // Backward compatibility for legacy module-level permissions.
      if (userPermMap[mod.module_key] === true) {
        for (const action of modActions) {
          const permKey = `${mod.module_key}.${action.action_key}`;
          if (!Object.prototype.hasOwnProperty.call(userPermMap, permKey)) {
            const rolePerm = rolePerms.find((rp: any) => rp.permission_key === permKey);
            if (!rolePerm || rolePerm.is_granted === true) {
              modPerms.actions[action.action_key as PermissionAction] = true;
            }
          }
        }
      }

      // Legacy aliases
      const legacyAliases: Record<string, string[]> = {
        'safes': ['treasury'],
        'general-accounts': ['accounting'],
        'warehouses': ['inventory'],
        'pos': ['restaurant'],
        'branches': ['restaurant'],
      };

      for (const [alias, targets] of Object.entries(legacyAliases)) {
        if (targets.includes(mod.module_key) && userPermMap[alias] === true) {
          for (const action of modActions) {
            const permKey = `${mod.module_key}.${action.action_key}`;
            if (!Object.prototype.hasOwnProperty.call(userPermMap, permKey)) {
              modPerms.actions[action.action_key as PermissionAction] = true;
            }
          }
        }
      }

      // Apply user-level limits
      if (userPermMap.limits && typeof userPermMap.limits === 'object') {
        modPerms.limits = { ...modPerms.limits, ...userPermMap.limits };
      }

      result.modules.set(mod.module_key, modPerms);
    }

    // Cache the result
    permissionCache.set(userId, { data: result, expires: Date.now() + CACHE_TTL });

    return result;
  } catch (error) {
    // Never fail-open: a permission/database failure must not grant admin access.
    console.error('[PERMISSION SERVICE] Error loading permissions:', error);
    permissionCache.delete(userId);
    return result;
  }
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(permSet: UserPermissionSet, moduleKey: string, action: PermissionAction): boolean {
  if (permSet.isAdmin) return true;

  const modPerm = permSet.modules.get(moduleKey);
  if (!modPerm) return false;

  return modPerm.actions[action] === true;
}

/**
 * Check multiple permissions at once (AND logic)
 */
export function hasAllPermissions(permSet: UserPermissionSet, checks: Array<{ module: string; action: PermissionAction }>): boolean {
  if (permSet.isAdmin) return true;
  return checks.every(c => hasPermission(permSet, c.module, c.action));
}

/**
 * Check if user has any of the given permissions (OR logic)
 */
export function hasAnyPermission(permSet: UserPermissionSet, checks: Array<{ module: string; action: PermissionAction }>): boolean {
  if (permSet.isAdmin) return true;
  return checks.some(c => hasPermission(permSet, c.module, c.action));
}

/**
 * Get the operational limits for a user (max_order_amount, max_discount_percent, etc.)
 */
export function getOperationalLimits(permSet: UserPermissionSet): Record<string, any> {
  if (permSet.isAdmin) return {};

  // Collect limits from all modules
  const allLimits: Record<string, any> = {};
  for (const [, modPerm] of permSet.modules) {
    if (modPerm.limits) {
      Object.assign(allLimits, modPerm.limits);
    }
  }
  return allLimits;
}

/**
 * Invalidate permission cache for a user (call after role/permission changes)
 */
export function invalidatePermissionCache(userId?: number): void {
  if (userId) {
    permissionCache.delete(userId);
  } else {
    permissionCache.clear();
  }
}

/**
 * Express middleware: Check enterprise-level permission
 * Usage: router.get('/data', checkPermission('inventory', 'view'), handler)
 */
export function checkPermission(moduleKey: string, action: PermissionAction) {
  return async (req: any, res: any, next: any) => {
    try {
      // Admin always passes
      if (req.user?.role === 'admin' || req.user?.permissions?.all === true) {
        return next();
      }

      // Load permissions if not already on request
      if (!req.permissionSet) {
        req.permissionSet = await getUserPermissions(
          req.user?.id,
          req.user?.role_id || 0,
          req.user?.permissions
        );
      }

      if (hasPermission(req.permissionSet, moduleKey, action)) {
        return next();
      }

      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: `ليس لديك صلاحية ${action} على ${moduleKey}`,
        module: moduleKey,
        action,
      });
    } catch (error: any) {
      // Fail closed on permission check errors.
      console.error('[PERMISSION CHECK ERROR]', error.message);
      res.status(503).json({ error: 'PERMISSION_SERVICE_UNAVAILABLE', message: 'تعذر التحقق من الصلاحيات، حاول مرة أخرى' });
    }
  };
}