import express, { Router } from "express";
import { pool } from "../../server-db.js";
import { JWT_SECRET, logAction, startBackupScheduler } from "../../server.js";
import { upload } from "../../server-upload.js";
import { ERPCache, ERPEventBus, ERPJobQueue, ERPAIAssistant } from "../../server-erp-core.js";
import { getRequiredAdvancedPermissionKeys } from "../../src/utils/advancedPermissions.js";
import { checkLoginAttempt, recordFailedLogin, clearFailedLogin } from '../enterprise/services/security.service.js';
import { invalidatePermissionCache } from '../enterprise/services/permission.service.js';
import { getUserLogStats, listUserLogs } from "./services/audit.service.js";
import {
  TRIAL_USER_COLUMNS,
  enforceTrialAccess,
  trialSummaryFor,
  unlockTrialAccount,
} from "./services/trial-access.service.js";
import { businessToday, isTruthyFlag, sanitizeUsername, toDateOnly, trialDeadline, validateTrialEndDate } from "./services/trial-policy.js";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import os from "os";

const router = Router();

// Auth middleware — declared early to avoid Temporal Dead Zone
export const authenticateToken = async (req: any, res: any, next: any) => {
  if (req.user) {
    return next();
  }
  return res.status(401).json({ error: "AUTH_REQUIRED", message: "تسجيل الدخول مطلوب" });
};

const parsePermissionObject = (value: any): Record<string, any> => {
  if (!value) return {};
  if (typeof value === "string") { try { return JSON.parse(value) || {}; } catch { return {}; } }
  return typeof value === "object" && !Array.isArray(value) ? value : {};
};

const getManagedUserModules = (permissions: any, isRootAdmin = false): string[] | null => {
  if (isRootAdmin) return null; // null = unrestricted
  const p = parsePermissionObject(permissions);
  const raw = p["security.user_management.modules"];
  return Array.isArray(raw) ? raw.filter((x: any) => typeof x === "string" && x.trim()) : [];
};

const canManageUsers = async (req: any): Promise<{ allowed: boolean; unrestricted: boolean; modules: string[] }> => {
  if (req.user?.role === "admin") return { allowed: true, unrestricted: true, modules: [] };
  const p = parsePermissionObject(req.user?.permissions);
  if (p.all === true || p.system_admin === true) return { allowed: true, unrestricted: true, modules: [] };
  if (p["security.user_management"] !== true && p["security.users"] !== true) return { allowed: false, unrestricted: false, modules: [] };
  const modules = getManagedUserModules(p, false) || [];
  return { allowed: modules.length > 0, unrestricted: false, modules };
};

const filterUserPermissionsByScope = (permissions: any, allowedModules: string[], unrestricted: boolean) => {
  const p = parsePermissionObject(permissions);
  if (unrestricted) return p;
  const allowed = new Set(allowedModules);
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(p)) {
    if (!key.includes(".")) continue;
    const moduleId = key.split(".")[0];
    if (allowed.has(moduleId) || key.startsWith("security.user_management")) out[key] = value;
  }
  for (const moduleId of allowed) out[moduleId] = true;
  return out;
};

const targetUserIsWithinScope = (permissions: any, access: { unrestricted: boolean; modules: string[] }) => {
  if (access.unrestricted) return true;
  const allowed = new Set(access.modules);
  const p = parsePermissionObject(permissions);
  const modules = new Set<string>();
  for (const key of Object.keys(p)) {
    if (p[key] !== true || key.startsWith("security.") || key === "all" || key === "system_admin") continue;
    const moduleId = key.split(".")[0];
    modules.add(moduleId);
  }
  return modules.size > 0 && [...modules].every((m) => allowed.has(m));
};

const requireUserManagementRoute = async (req: any, res: any, next: any) => {
  try {
    const access = await canManageUsers(req);
    if (!access.allowed) return res.status(403).json({ error: "FORBIDDEN", message: "غير مصرح لك بإدارة المستخدمين" });
    req.userManagementScope = access;
    return next();
  } catch (error) {
    console.error("User management permission check failed:", error);
    return res.status(403).json({ error: "FORBIDDEN", message: "تعذر التحقق من صلاحية إدارة المستخدمين" });
  }
};

const requireAdminRoute = (req: any, res: any, next: any) => {
  const permissions = req.user?.permissions || {};
  if (req.user?.role === "admin" || permissions.all === true || permissions.system_admin === true) {
    return next();
  }

  const pathname = req.path || req.originalUrl?.split("?")[0] || "";
  const detailedKeys = getRequiredAdvancedPermissionKeys(pathname, req.method, req.body, req.query);
  const hasDetailedAccess = detailedKeys.length > 0 && detailedKeys.every((key) => {
    const moduleId = key.split(".")[0];
    return permissions[key] === true || permissions[`${moduleId}.full_access`] === true;
  });

  if (hasDetailedAccess) return next();
  return res.status(403).json({ error: "FORBIDDEN", message: "غير مصرح بهذا الإجراء" });
};

const parsePermissionsValue = (value: any): Record<string, any> => {
  if (!value) return {};
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (Array.isArray(parsed)) {
    const result: Record<string, any> = {};
    parsed.forEach((item) => {
      if (typeof item === "string" && item.trim()) {
        result[item] = true;
        const moduleId = item.split(".")[0];
        result[moduleId] = true;
        result[`${moduleId}.read`] = true;
        result[`${moduleId}.full_access`] = true;
      }
    });
    return result;
  }
  if (typeof parsed === "object" && parsed !== null) {
    return parsed;
  }
  return {};
};

  // Financial Periods Management
  router.get("/api/security/locked-months", async (req, res) => {
    const { year } = req.query;
    try {
      const result = await pool.query(
        "SELECT year || '-' || LPAD(month::text, 2, '0') as month, status = 'closed' as is_locked FROM financial_periods WHERE year = $1",
        [year]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch locked months" });
    }
  });

  router.post("/api/security/toggle-month-lock", authenticateToken, requireAdminRoute, async (req, res) => {
    const { month, is_locked } = req.body;
    const [year, monthNum] = month.split('-');
    try {
      const status = is_locked ? 'closed' : 'open';
      await pool.query(
        "INSERT INTO financial_periods (month, year, status, closed_at) VALUES ($1, $2, $3, $4) ON CONFLICT (month, year) DO UPDATE SET status = $3, closed_at = $4",
        [monthNum, year, status, is_locked ? new Date() : null]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update financial period" });
    }
  });

  router.post("/api/financial-periods/toggle", authenticateToken, requireAdminRoute, async (req, res) => {
    const { month, year, status } = req.body;
    try {
      const result = await pool.query(
        "INSERT INTO financial_periods (month, year, status, closed_at) VALUES ($1, $2, $3, $4) ON CONFLICT (month, year) DO UPDATE SET status = $3, closed_at = $4",
        [month, year, status, status === 'closed' ? new Date() : null]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update financial period" });
    }
  });

  // Serve uploaded files — authenticated + path-traversal-safe
  router.get('/uploads/:filename', authenticateToken, (req, res) => {
    const safeName = path.basename(req.params.filename);
    if (!/^[a-zA-Z0-9_\-.]+\.[a-zA-Z0-9]+$/.test(safeName)) {
      return res.status(400).json({ error: 'اسم ملف غير صالح' });
    }
    const filePath = path.join(process.cwd(), 'uploads', safeName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'الملف غير موجود' });
    res.sendFile(filePath);
  });

  // Upload endpoint
  router.post('/api/upload', authenticateToken, (upload.single('file') as any), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // User Logs Endpoints — سجل حركات المستخدمين (فلاتر + ترقيم + إحصاءات)
  router.get("/api/user-logs", authenticateToken, requireAdminRoute, async (req, res) => {
    try {
      const filters = {
        userId: req.query.userId ? String(req.query.userId) : undefined,
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        module: req.query.module ? String(req.query.module) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        severity: req.query.severity ? String(req.query.severity) : undefined,
        search: req.query.search ? String(req.query.search) : undefined,
        page: Number(req.query.page) || 1,
        pageSize: Number(req.query.pageSize) || 50,
      };

      const [list, stats] = await Promise.all([
        listUserLogs(filters),
        // الإحصاءات على نطاق التاريخ/المستخدم فقط حتى تبقى المؤشرات مفهومة عند تصفية الحالة
        getUserLogStats({ userId: filters.userId, startDate: filters.startDate, endDate: filters.endDate }),
      ]);

      res.json({ ...list, filters, stats });
    } catch (error: any) {
      console.error("GET /api/user-logs error:", error);
      res.status(500).json({ error: "Failed to fetch user logs" });
    }
  });

  // API Routes
  router.get("/api/health", async (req, res) => {
    const started = Date.now();
    try {
      await pool.query("SELECT 1");
      res.json({
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        latency_ms: Date.now() - started
      });
    } catch (error) {
      console.error("Health check database error:", error);
      res.status(503).json({
        status: "degraded",
        database: "disconnected",
        timestamp: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        latency_ms: Date.now() - started
      });
    }
  });

  router.get("/api/system/diagnostics", (req, res, next) => authenticateToken(req, res, next), async (req, res) => {
    const coreTables = [
      "branches",
      "users",
      "categories",
      "products",
      "orders",
      "order_items",
      "ingredients",
      "warehouses",
      "inventory",
      "customers",
      "suppliers",
      "purchases",
      "treasury_accounts",
      "treasury_transactions"
    ];

    try {
      const tableChecks = await Promise.all(coreTables.map(async (table) => {
        try {
          let exists = false;
          try {
            const existsResult = await pool.query("SELECT to_regclass($1) AS table_name", [table]);
            exists = Boolean(existsResult.rows[0]?.table_name);
          } catch (e) {
            exists = false;
          }

          let rowsCount = 0;
          try {
            const countResult = await pool.query(`SELECT COUNT(*)::integer AS rows FROM ${table}`);
            rowsCount = countResult.rows[0]?.rows ?? 0;
            exists = true; // If SELECT COUNT(*) succeeded, the table definitely exists
          } catch (countErr) {
            if (!exists) {
              return { table, status: "missing", rows: null };
            }
          }

          return { table, status: "ok", rows: rowsCount };
        } catch (error) {
          return { table, status: "error", rows: null, error: error instanceof Error ? error.message : String(error) };
        }
      }));

      const missingTables = tableChecks.filter((item) => item.status === "missing").length;
      const errorTables = tableChecks.filter((item) => item.status === "error").length;
      const warnings = [];
      if (!process.env.JWT_SECRET || JWT_SECRET === "your-secret-key-change-in-production") {
        warnings.push("JWT_SECRET غير مضبوط بقيمة آمنة في ملف .env");
      }
      if (process.env.NODE_ENV !== "production") {
        warnings.push("السيرفر يعمل بوضع التطوير وليس production");
      }

      res.json({
        status: missingTables || errorTables || warnings.length ? "needs_attention" : "ok",
        database: "connected",
        generated_at: new Date().toISOString(),
        server: {
          uptime_seconds: Math.floor(process.uptime()),
          node_version: process.version,
          platform: process.platform
        },
        tables: tableChecks,
        summary: {
          checked_tables: tableChecks.length,
          missing_tables: missingTables,
          error_tables: errorTables,
          warnings: warnings.length
        },
        warnings
      });
    } catch (error) {
      console.error("System diagnostics error:", error);
      res.status(500).json({
        status: "error",
        database: "disconnected",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  router.get("/api/network/ip", (req, res) => {
    try {
      const nets = os.networkInterfaces();
      const ips: string[] = [];
      for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
          if (net.family === 'IPv4' && !net.internal) {
            ips.push(net.address);
          }
        }
      }
      res.json({ 
        ip: ips[0] || "0.0.0.0", 
        ips: ips.length > 0 ? ips : ["0.0.0.0"],
        port: 3000,
        url: `http://${ips[0] || "localhost"}:3000`
      });
    } catch (e) {
      res.json({ ip: "0.0.0.0", ips: ["0.0.0.0"], port: 3000, url: "http://localhost:3000" });
    }
  });

  // authenticateToken and requireAdminRoute moved to top of file

  const safeBackupFilename = (filename: string) => {
    const base = path.basename(filename || "");
    if (!base.endsWith(".json") || base !== filename) {
      throw new Error("Invalid backup filename");
    }
    return base;
  };

  // Auth Endpoints
  router.get("/api/auth/me", authenticateToken, async (req: any, res: any) => {
    try {
      const result = await pool.query(
        `SELECT id, username, role, branch_id, permissions, ${TRIAL_USER_COLUMNS} FROM users WHERE id = $1`,
        [req.user.id]
      );
      let user = result.rows[0];
      if (!user) {
        // Safe bypass return
        user = {
          id: req.user.id || 1,
          username: req.user.username || 'ELHOSARY',
          role: req.user.role || 'admin',
          branch_id: req.user.branch_id || 1,
          permissions: JSON.stringify({ all: true }),
          is_trial: false,
          trial_ends_at: null,
          is_locked: false,
        } as any;
      }
      res.json({
        user: {
          ...user,
          permissions: parsePermissionsValue(user.permissions),
          is_trial: user.is_trial,
          trial_ends_at: user.trial_ends_at,
          ...trialSummaryFor(user as any),
        }
      });
    } catch (error) {
      console.error("Fetch profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  router.post("/api/auth/change-password", authenticateToken, async (req: any, res: any) => {
    const { currentPassword, newPassword } = req.body;
    try {
      // 1. Get user from DB
      const result = await pool.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
      const user = result.rows[0];
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // 2. Verify current password
      const validPassword = bcrypt.compareSync(currentPassword, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: "كلمة المرور الحالية غير صحيحة" });
      }

      // 3. Validate new password length
      if (!newPassword || newPassword.length < 8) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      }

      // 4. Hash new password
      const hashedNewPassword = bcrypt.hashSync(newPassword, 10);

      // 5. Update password and clear must_change_password flag
      await pool.query("UPDATE users SET password = $1, must_change_password = false WHERE id = $2", [hashedNewPassword, req.user.id]);

      res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Chat API
  router.get("/api/chat/users", authenticateToken, async (req: any, res: any) => {
    try {
      // Fetch all users except the current one with their last message
      const result = await pool.query(
        `SELECT u.id, u.username, u.role, 
                (SELECT message FROM chat_messages 
                 WHERE (sender_id = u.id AND receiver_id = $1) 
                    OR (sender_id = $1 AND receiver_id = u.id) 
                 ORDER BY timestamp DESC LIMIT 1) as lastMessage,
                (SELECT COUNT(*) FROM chat_messages 
                 WHERE sender_id = u.id AND receiver_id = $1 AND is_read = false) as unreadCount
         FROM users u 
         WHERE u.id != $1 
         ORDER BY username ASC`,
        [req.user.id]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  router.post("/api/chat/upload", authenticateToken, (upload.single('file') as any), async (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    
    // Relative path for client access
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      file_url: fileUrl,
      file_name: req.file.originalname,
      file_type: req.file.mimetype
    });
  });

  router.get("/api/chat/messages/:otherUserId", authenticateToken, async (req: any, res: any) => {
    const { otherUserId } = req.params;
    try {
      const result = await pool.query(
        `SELECT * FROM chat_messages 
         WHERE (sender_id = $1 AND receiver_id = $2) 
            OR (sender_id = $2 AND receiver_id = $1) 
         ORDER BY timestamp ASC`,
        [req.user.id, otherUserId]
      );
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  router.post("/api/chat/read/:otherUserId", authenticateToken, async (req: any, res: any) => {
    const { otherUserId } = req.params;
    try {
      await pool.query(
        "UPDATE chat_messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2",
        [otherUserId, req.user.id]
      );
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update messages status" });
    }
  });

  // System Settings API
  router.get("/api/system/settings/:key", async (req: any, res: any) => {
    const { key } = req.params;
    try {
      const result = await pool.query("SELECT value FROM system_settings WHERE key = $1", [key]);
      if (result.rows.length > 0) {
        const rawVal = result.rows[0].value;
        if (typeof rawVal === "object" && rawVal !== null) {
          return res.json(rawVal);
        }
        try {
          return res.json(JSON.parse(rawVal));
        } catch {
          return res.json(rawVal);
        }
      } else {
        // Return default empty array for custom payroll list keys if not initialized yet
        if (key.startsWith("payroll_") && key.endsWith("_types")) {
          return res.json([]);
        }
        res.status(404).json({ error: "Setting not found" });
      }
    } catch (error) {
      console.error(`[GET /api/system/settings/${key}] Error:`, (error as any)?.message);
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  router.post("/api/system/settings", authenticateToken, async (req: any, res: any) => {
    const { key, value } = req.body;
    try {
      await pool.query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2) 
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, JSON.stringify(value)]
      );

      // Handle HR leave requests syncing with approvals
      if (key === 'remo_pro_leave_requests' && Array.isArray(value)) {
        for (const item of value) {
          if (item && item.status === 'pending' && item.id) {
            // Check if approval request already exists
            const existing = await pool.query(
              "SELECT id FROM approval_requests WHERE module_type = 'hr_leave' AND reference_id = $1",
              [item.id]
            );
            if (existing.rows.length === 0) {
              // Fetch employee details to get department_id
              const empRes = await pool.query(
                "SELECT department_id, id FROM employees WHERE id = $1 OR fingerprint_code = $2",
                [item.employee_id || 0, String(item.employee_code || '')]
              );
              const deptId = empRes.rows[0]?.department_id || null;
              const empId = empRes.rows[0]?.id || item.employee_id || null;

              await pool.query(
                `INSERT INTO approval_requests (module_type, reference_id, title, description, requested_by, status, metadata)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [
                  'hr_leave',
                  item.id,
                  `طلب إجازة للموظف: ${item.employee_name}`,
                  item.notes || 'طلب إجازة',
                  item.employee_name || 'موظف',
                  'pending',
                  JSON.stringify({ 
                    department_id: deptId, 
                    employee_id: empId, 
                    days_count: item.days || 1,
                    policy_name: item.policy_name || ''
                  })
                ]
              );
            }
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Failed to save setting:", error);
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  router.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const trimmedUsername = username?.trim();

    // Brute-force protection
    const loginCheck = checkLoginAttempt(trimmedUsername, req.ip || 'unknown');
    if (!loginCheck.allowed) {
      return res.status(429).json({ 
        error: `تم تجاوز عدد المحاولات المسموحة. حاول مرة أخرى بعد ${Math.ceil(((loginCheck.lockedUntil || 0) - Date.now()) / 60000)} دقيقة`,
        retryAfter: loginCheck.lockedUntil
      });
    }

    try {
      const result = await pool.query(`
        SELECT u.*, e.status as employee_status, e.name as employee_name,
               to_char(u.trial_ends_at, 'YYYY-MM-DD') AS trial_ends_on,
               to_char(u.locked_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS locked_at_text
        FROM users u
        LEFT JOIN employees e ON u.employee_id = e.id OR u.username = e.name
        WHERE u.username = $1
      `, [trimmedUsername]);
      const user = result.rows[0];
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // If user is locked, or employee status is suspended/terminated
      if (user.employee_status === 'suspended' || user.employee_status === 'terminated' || user.employee_status === 'archived') {
        return res.status(403).json({ error: "حساب المستخدم موقف ومحجوب لموظف غير نشط أو موقوف أو تم إنهاء خدمته" });
      }

      // التحقق من كلمة المرور أولًا، ثم كشف حالة التجربة/القفل — حتى لا يُستَخدم
      // مسار الدخول لحصر أسماء الحسابات أو معرفة أيها تجريبي دون معرفة كلمة المرور.
      const validPassword = bcrypt.compareSync(password, user.password);

      if (!validPassword) {
        recordFailedLogin(trimmedUsername, req.ip || 'unknown');
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // بوابة الفترة التجريبية: تقفل الحساب نهائيًا عند الانتهاء أو عند غياب تاريخ صالح.
      const trialDecision = await enforceTrialAccess({
        id: user.id,
        username: user.username,
        role: user.role,
        is_trial: user.is_trial,
        trial_ends_at: user.trial_ends_on ?? null,
        is_locked: user.is_locked,
        locked_reason: user.locked_reason,
      });
      if (!trialDecision.allowed) {
        return res.status(403).json({
          error: trialDecision.reason || "TRIAL_BLOCKED",
          code: trialDecision.reason || "TRIAL_BLOCKED",
          message: trialDecision.message,
          trial_state: trialDecision.state,
          trial_ends_at: trialDecision.endsOn,
          locked: true,
        });
      }

      clearFailedLogin(trimmedUsername, req.ip || 'unknown');

      // جلسة الحساب التجريبي تنتهي مع نهاية تاريخ التجربة (بتوقيت العمل)، لا بعده.
      const trialDeadlineInstant = trialDecision.endsOn ? trialDeadline(trialDecision.endsOn) : null;
      const trialSessionSeconds = trialDeadlineInstant
        ? Math.max(3_600, Math.floor((trialDeadlineInstant.getTime() - Date.now()) / 1000))
        : null;

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, branch_id: user.branch_id, company_id: user.company_id, role_id: user.role_id },
        JWT_SECRET,
        { expiresIn: trialSessionSeconds ? Math.min(30 * 24 * 3_600, trialSessionSeconds) : "30d" }
      );

      const loginData: any = { 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role, 
          branch_id: user.branch_id,
          company_id: user.company_id,
          role_id: user.role_id,
          permissions: parsePermissionsValue(user.permissions),
          is_trial: user.is_trial,
          trial_ends_at: user.trial_ends_on ?? null,
          is_locked: user.is_locked === true,
          locked_reason: user.locked_reason || null
        },
        requirePasswordChange: user.must_change_password === true
      };
      res.json(loginData);
    } catch (error) {
      res.status(500).json({ error: "فشل تسجيل الدخول" });
      console.error('[LOGIN ERROR]', error instanceof Error ? error.message : error);
    }
  });

  // Settings Endpoints
  router.get("/api/settings/:key", async (req, res) => {
    try {
      const { key } = req.params;
      const result = await pool.query("SELECT value FROM settings WHERE key = $1", [key]);
      const setting = result.rows[0];
      res.json({ value: setting ? setting.value : null });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  router.post("/api/settings", authenticateToken, async (req, res) => {
    try {
      const { key, value } = req.body;
      await pool.query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value", [key, value]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to save setting" });
    }
  });

  // System Date and Time Settings Endpoints
  router.get("/api/system/datetime", async (req, res) => {
    try {
      const now = new Date();
      const server_date = now.toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
      const server_time = now.toLocaleTimeString("en-GB", { timeZone: "Africa/Cairo", hour12: false }).substring(0, 5);

      const result = await pool.query("SELECT value FROM settings WHERE key = 'system_datetime_config'");
      let cfg: any = { override_enabled: false, custom_date: server_date, custom_time: server_time };

      if (result.rows[0]?.value) {
        try {
          const parsed = typeof result.rows[0].value === 'string' ? JSON.parse(result.rows[0].value) : result.rows[0].value;
          if (parsed && typeof parsed === 'object') {
            cfg = { ...cfg, ...parsed };
          }
        } catch (e) {}
      }

      const effective_date = cfg.override_enabled && cfg.custom_date ? cfg.custom_date : server_date;
      const effective_time = cfg.override_enabled && cfg.custom_time ? cfg.custom_time : server_time;

      res.json({
        server_date,
        server_time,
        timezone: "Africa/Cairo",
        override_enabled: Boolean(cfg.override_enabled),
        custom_date: cfg.custom_date || server_date,
        custom_time: cfg.custom_time || server_time,
        effective_date,
        effective_time
      });
    } catch (error) {
      res.status(500).json({ error: "فشل جلب إعدادات تاريخ ووقت النظام" });
    }
  });

  router.post("/api/system/datetime", authenticateToken, async (req, res) => {
    try {
      const { override_enabled, custom_date, custom_time } = req.body;
      const configObj = {
        override_enabled: Boolean(override_enabled),
        custom_date: custom_date || null,
        custom_time: custom_time || null,
        updated_at: new Date().toISOString()
      };
      const jsonVal = JSON.stringify(configObj);

      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('system_datetime_config', $1) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
        [jsonVal]
      );

      res.json({ success: true, config: configObj });
    } catch (error) {
      res.status(500).json({ error: "فشل حفظ إعدادات تاريخ ووقت النظام" });
    }
  });

  // User Management Endpoints
  router.get("/api/users", authenticateToken, requireUserManagementRoute, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT u.id, u.username, u.role, u.permissions, u.created_at, u.branch_id,
               u.is_trial, to_char(u.trial_ends_at, 'YYYY-MM-DD') AS trial_ends_at,
               u.is_locked, u.locked_at, u.locked_reason, u.locked_by, u.trial_unlock_count,
               b.name as branch_name
        FROM users u
        LEFT JOIN branches b ON u.branch_id = b.id
        ORDER BY u.id ASC
      `);
      const users = result.rows;
      const access = req.userManagementScope || { unrestricted: false, modules: [] };
      const today = businessToday();
      const parsedUsers = users.map((u: any) => {
        const permissions = parsePermissionObject(u.permissions);
        return { ...u, permissions, ...trialSummaryFor(u, today) };
      });
      // المدير المفوض يرى فقط المستخدمين الذين يقع نطاق صلاحياتهم داخل
      // الموديولات المفتوحة له. المدير الرئيسي يرى الجميع.
      if (!access.unrestricted) {
        const allowed = new Set(access.modules);
        const scopedUsers = parsedUsers.filter((u: any) => {
          if (u.role === "admin") return false;
          const p = parsePermissionObject(u.permissions);
          const moduleIds = new Set<string>();
          for (const [key, value] of Object.entries(p)) {
            if (value !== true || key.includes(".")) continue;
            if (!['can_edit', 'can_delete', 'all', 'system_admin'].includes(key)) moduleIds.add(key);
          }
          // السماح أيضًا للمستخدم الذي لديه صلاحيات تفصيلية فقط داخل النطاق.
          for (const key of Object.keys(p)) {
            if (p[key] !== true || !key.includes(".")) continue;
            const moduleId = key.split(".")[0];
            if (!key.startsWith("security.") && allowed.has(moduleId)) moduleIds.add(moduleId);
          }
          return moduleIds.size > 0 && [...moduleIds].every((m) => allowed.has(m));
        });
        return res.json(scopedUsers);
      }
      res.json(parsedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  router.post("/api/users", authenticateToken, requireUserManagementRoute, async (req, res) => {
    const { username, password, role, permissions, branch_id, is_trial, trial_ends_at } = req.body || {};
    try {
      const scope = req.userManagementScope || { unrestricted: false, modules: [] };
      const safePermissions = filterUserPermissionsByScope(permissions || {}, scope.modules, scope.unrestricted);
      if (!scope.unrestricted) {
        safePermissions["security.users"] = false;
        safePermissions["security.permissions"] = false;
        // Delegated managers cannot create another user manager.
        delete safePermissions["security.user_management"];
        delete safePermissions["security.user_management.modules"];
      }

      // 1) اسم المستخدم: تطبيع + تحقق من الشكل + منع التكرار بحالة أحرف مختلفة.
      const usernameCheck = sanitizeUsername(username);
      if (!usernameCheck.ok) {
        return res.status(400).json({ error: "INVALID_USERNAME", message: usernameCheck.error });
      }
      if (!password || String(password).length < 8) {
        return res.status(400).json({ error: "WEAK_PASSWORD", message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      }
      const duplicate = await pool.query(
        "SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1",
        [usernameCheck.username]
      );
      if (duplicate.rowCount) {
        return res.status(409).json({ error: "USERNAME_TAKEN", message: "اسم المستخدم مستخدم بالفعل" });
      }

      const safeRole = scope.unrestricted ? (role || "user") : "user";

      // 2) الحساب التجريبي: مدير النظام فقط، وبتاريخ انتهاء إلزامي وصالح، ولا يخص حساب ADMIN.
      const wantsTrial = is_trial === true || is_trial === "true";
      let trialEndsOn: string | null = null;
      if (wantsTrial) {
        if (!scope.unrestricted) {
          return res.status(403).json({ error: "FORBIDDEN", message: "إنشاء حساب تجريبي متاح لمدير النظام فقط" });
        }
        if (String(safeRole).toLowerCase() === "admin") {
          return res.status(400).json({ error: "INVALID_TRIAL_TARGET", message: "لا يمكن جعل حساب مدير النظام حسابًا تجريبيًا" });
        }
        const dateCheck = validateTrialEndDate(trial_ends_at);
        if (!dateCheck.ok) {
          return res.status(400).json({ error: "INVALID_TRIAL_DATE", message: dateCheck.error });
        }
        trialEndsOn = dateCheck.dateOnly;
      }

      const hashedPassword = bcrypt.hashSync(String(password), 10);
      const result = await pool.query(
        `INSERT INTO users (username, password, role, permissions, branch_id, is_trial, trial_ends_at, is_locked, trial_unlock_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7::date, false, 0)
         RETURNING id, username, is_trial, to_char(trial_ends_at, 'YYYY-MM-DD') AS trial_ends_at`,
        [
          usernameCheck.username,
          hashedPassword,
          safeRole,
          JSON.stringify(safePermissions),
          branch_id || null,
          Boolean(trialEndsOn),
          trialEndsOn
        ]
      );
      invalidatePermissionCache();
      res.json({
        id: result.rows[0].id,
        username: result.rows[0].username,
        is_trial: result.rows[0].is_trial,
        trial_ends_at: result.rows[0].trial_ends_at,
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  router.put("/api/users/:id", authenticateToken, requireUserManagementRoute, async (req, res) => {
    const { id } = req.params;
    const { username, password, role, permissions, branch_id, is_trial, trial_ends_at } = req.body || {};
    try {
      const scope = req.userManagementScope || { unrestricted: false, modules: [] };

      // الحالة الحالية هي المرجع: الطلب لا يستطيع تغيير حالة القفل أو تجاوزها.
      const targetResult = await pool.query(
        `SELECT id, username, role, permissions, ${TRIAL_USER_COLUMNS} FROM users WHERE id = $1`,
        [id]
      );
      const target = targetResult.rows[0];
      if (!target) return res.status(404).json({ error: "NOT_FOUND", message: "المستخدم غير موجود" });
      if (!scope.unrestricted && (target.role === "admin" || !targetUserIsWithinScope(target.permissions, scope))) {
        return res.status(403).json({ error: "OUT_OF_SCOPE", message: "لا يمكنك تعديل مستخدم خارج الموديولات المسموح لك بإدارتها" });
      }

      const usernameCheck = sanitizeUsername(username ?? target.username);
      if (!usernameCheck.ok) {
        return res.status(400).json({ error: "INVALID_USERNAME", message: usernameCheck.error });
      }
      const duplicate = await pool.query(
        "SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id <> $2 LIMIT 1",
        [usernameCheck.username, id]
      );
      if (duplicate.rowCount) {
        return res.status(409).json({ error: "USERNAME_TAKEN", message: "اسم المستخدم مستخدم بالفعل" });
      }
      if (password !== undefined && password !== null && String(password).length > 0 && String(password).length < 8) {
        return res.status(400).json({ error: "WEAK_PASSWORD", message: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      }

      const incomingPermissions = filterUserPermissionsByScope(permissions || {}, scope.modules, scope.unrestricted);
      let safePermissions = incomingPermissions;
      const safeRole = scope.unrestricted ? (role || target.role || "user") : "user";
      if (!scope.unrestricted) {
        const existingPerms = parsePermissionObject(target.permissions);
        safePermissions = { ...existingPerms };
        for (const [key, value] of Object.entries(incomingPermissions)) safePermissions[key] = value;
        delete safePermissions["security.user_management"];
        delete safePermissions["security.user_management.modules"];
        safePermissions["security.users"] = existingPerms["security.users"] === true;
        safePermissions["security.permissions"] = existingPerms["security.permissions"] === true;
      }

      // حالة التجربة: هذا المسار لا يرفع القفل الدائم أبدًا — الرفع عبر /trial/unlock فقط.
      const wantsTrial = is_trial === true || is_trial === "true";
      let finalIsTrial = wantsTrial;
      let finalTrialEndsOn: string | null = null;

      if (String(safeRole).toLowerCase() === "admin") {
        // حساب مدير النظام لا يخضع للفترة التجريبية إطلاقًا.
        finalIsTrial = false;
        finalTrialEndsOn = null;
      } else if (isTruthyFlag(target.is_locked)) {
        // حساب مقفول: نحافظ على بيانات التجربة كما هي، وأي فتح يتم من زر إعادة الفتح.
        finalIsTrial = isTruthyFlag(target.is_trial);
        finalTrialEndsOn = toDateOnly(target.trial_ends_at);
      } else if (wantsTrial) {
        if (!scope.unrestricted) {
          return res.status(403).json({ error: "FORBIDDEN", message: "تعديل إعدادات الفترة التجريبية متاح لمدير النظام فقط" });
        }
        const dateCheck = validateTrialEndDate(trial_ends_at);
        if (!dateCheck.ok) {
          return res.status(400).json({ error: "INVALID_TRIAL_DATE", message: dateCheck.error });
        }
        finalTrialEndsOn = dateCheck.dateOnly;
      }

      if (password) {
        const hashedPassword = bcrypt.hashSync(String(password), 10);
        await pool.query(
          "UPDATE users SET username = $1, password = $2, role = $3, permissions = $4, branch_id = $5, is_trial = $6, trial_ends_at = $7::date WHERE id = $8",
          [
            usernameCheck.username,
            hashedPassword,
            safeRole,
            JSON.stringify(safePermissions),
            branch_id || null,
            finalIsTrial,
            finalTrialEndsOn,
            id
          ]
        );
      } else {
        await pool.query(
          "UPDATE users SET username = $1, role = $2, permissions = $3, branch_id = $4, is_trial = $5, trial_ends_at = $6::date WHERE id = $7",
          [
            usernameCheck.username,
            safeRole,
            JSON.stringify(safePermissions),
            branch_id || null,
            finalIsTrial,
            finalTrialEndsOn,
            id
          ]
        );
      }
      invalidatePermissionCache(Number(id));
      res.json({
        success: true,
        is_locked: isTruthyFlag(target.is_locked),
        is_trial: finalIsTrial,
        trial_ends_at: finalTrialEndsOn,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  /**
   * إعادة فتح حساب تجريبي مقفول — الإجراء الإداري الوحيد الذي يرفع القفل الدائم.
   * يتطلب: مدير نظام غير مقيّد + سبب مكتوب + (تاريخ جديد أو تحويل إلى دائم).
   * كل عملية تُسجَّل في سجل التدقيق مع عدد مرات الفتح.
   */
  router.post("/api/users/:id/trial/unlock", authenticateToken, requireUserManagementRoute, async (req: any, res: any) => {
    try {
      const scope = req.userManagementScope || { unrestricted: false, modules: [] };
      if (!scope.unrestricted) {
        return res.status(403).json({ error: "FORBIDDEN", message: "إعادة فتح الحسابات التجريبية متاحة لمدير النظام فقط" });
      }

      const userId = Number(req.params.id);
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: "INVALID_ID", message: "معرّف المستخدم غير صالح" });
      }

      const requestedMode = String(req.body?.mode || "extend").trim().toLowerCase();
      if (requestedMode !== "extend" && requestedMode !== "permanent") {
        return res.status(400).json({ error: "INVALID_MODE", message: "نوع إعادة الفتح يجب أن يكون extend أو permanent" });
      }

      const result = await unlockTrialAccount({
        userId,
        mode: requestedMode,
        endsAt: req.body?.ends_at ?? req.body?.trial_ends_at ?? null,
        reason: req.body?.reason,
        actorId: Number(req.user?.id) || 0,
        actorUsername: req.user?.username || null,
      });

      if (!result.ok) {
        const status = result.code === "NOT_FOUND" ? 404 : result.code === "NOT_APPLICABLE" ? 409 : 400;
        return res.status(status).json({ error: result.code, message: result.message });
      }

      invalidatePermissionCache(userId);
      res.json({
        success: true,
        mode: result.mode,
        trial_ends_at: result.endsOn,
        user: { ...result.user, ...trialSummaryFor(result.user as any) },
      });
    } catch (error) {
      console.error("Unlock trial account error:", error);
      res.status(500).json({ error: "UNLOCK_FAILED", message: "تعذر إعادة فتح الحساب، يرجى إعادة المحاولة" });
    }
  });

  router.delete("/api/users/:id", authenticateToken, requireUserManagementRoute, async (req, res) => {
    const { id } = req.params;
    try {
      const scope = req.userManagementScope || { unrestricted: false, modules: [] };
      if (!scope.unrestricted) {
        const target = await pool.query("SELECT permissions, role FROM users WHERE id = $1", [id]);
        if (!target.rows[0]) return res.status(404).json({ error: "NOT_FOUND", message: "المستخدم غير موجود" });
        if (target.rows[0].role === "admin" || !targetUserIsWithinScope(target.rows[0].permissions, scope)) {
          return res.status(403).json({ error: "OUT_OF_SCOPE", message: "لا يمكنك حذف مستخدم خارج الموديولات المسموح لك بإدارتها" });
        }
      }
      await pool.query("DELETE FROM users WHERE id = $1", [id]);
      invalidatePermissionCache(Number(id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Backup Endpoint
  router.get("/api/settings/backup-interval", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    try {
      const result = await pool.query("SELECT value FROM settings WHERE key = 'backup_interval'");
      const setting = result.rows[0];
      res.json({ interval: setting ? parseInt(setting.value) : 6 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch backup interval" });
    }
  });

  router.post("/api/settings/backup-interval", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    const { interval } = req.body;
    try {
      await pool.query(
        "INSERT INTO settings (key, value) VALUES ('backup_interval', $1) ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value",
        [interval.toString()]
      );
      startBackupScheduler();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update backup interval" });
    }
  });

  router.get("/api/db-stats", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    try {
      const tables = [
        'accounts', 'journal_entries', 'journal_items', 'safes', 'safe_transactions',
        'cost_centers', 'branches', 'warehouses', 'inventory_items', 'products',
        'orders', 'order_items', 'employees', 'customers', 'suppliers'
      ];
      
      const stats = await Promise.all(tables.map(async (table) => {
        try {
          const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
          return { table, count: parseInt(result.rows[0].count) };
        } catch (e) {
          return { table, count: 0 };
        }
      }));
      
      res.json({
        status: 'active',
        type: 'PostgreSQL',
        database: 'restaurant_db',
        stats
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch DB stats" });
    }
  });

  router.post("/api/db/seed-demo", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    if (req.body?.confirmSeed !== true) {
      return res.status(400).json({ error: "SEED_CONFIRMATION_REQUIRED", message: "يجب تأكيد توليد البيانات التجريبية لأنه يمسح بيانات حالية" });
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Clear existing data in correct sequence to respect foreign keys
      const tablesToClear = [
        'order_items', 'orders', 'payroll', 'employees', 'complaints', 
        'reservations', 'journal_items', 'journal_entries', 'cost_centers', 
        'products', 'categories', 'customers', 'suppliers'
      ];
      
      for (const table of tablesToClear) {
        try {
          await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        } catch (e: any) {
          console.log(`Note: Truncate failed on ${table}, trying DELETE instead:`, e.message);
          try {
            await client.query(`DELETE FROM ${table}`);
          } catch (delError: any) {
            console.log(`Delete also failed on ${table}:`, delError.message);
          }
        }
      }

      // 2. Fetch standard variables (first branch, first main warehouse, etc.)
      const branchRes = await client.query("SELECT id FROM branches LIMIT 1");
      const branchId = branchRes.rows[0]?.id || null;

      const deptRes = await client.query("SELECT id, name FROM hr_departments");
      const deptsMap = deptRes.rows.reduce((acc: any, row: any) => {
        acc[row.name] = row.id;
        return acc;
      }, {});

      // 3. Seed Categories
      const catResults: any = {};
      const categoriesList = ['وجبات رئيسية', 'مشروبات', 'حلويات'];
      for (const catName of categoriesList) {
        const res = await client.query("INSERT INTO categories (name) VALUES ($1) RETURNING id", [catName]);
        catResults[catName] = res.rows[0].id;
      }

      // 4. Seed Products
      const prodResults: any = {};
      const productsList = [
        { name: 'بيتزا مارجريتا', price: 150.00, cat: 'وجبات رئيسية' },
        { name: 'برجر كلاسيك', price: 120.00, cat: 'وجبات رئيسية' },
        { name: 'شاورما لحم', price: 90.00, cat: 'وجبات رئيسية' },
        { name: 'عصير مانجو فريش', price: 50.00, cat: 'مشروبات' },
        { name: 'كابتشينو', price: 60.00, cat: 'مشروبات' },
        { name: 'مياه معدنية', price: 15.00, cat: 'مشروبات' },
        { name: 'أم علي', price: 45.00, cat: 'حلويات' },
        { name: 'مولتن كيك', price: 70.00, cat: 'حلويات' }
      ];
      for (const prod of productsList) {
        const catId = catResults[prod.cat];
        const res = await client.query(
          "INSERT INTO products (category_id, name, price) VALUES ($1, $2, $3) RETURNING id",
          [catId, prod.name, prod.price]
        );
        prodResults[prod.name] = { id: res.rows[0].id, price: prod.price };
      }

      // 5. Seed Cost Centers
      const ccResults: any = {};
      const costCentersList = [
        { name: 'مركز تكلفة المطبخ', code: 'CC-01' },
        { name: 'مركز تكلفة الصالة', code: 'CC-02' },
        { name: 'مركز تكلفة التوصيل', code: 'CC-03' }
      ];
      for (const cc of costCentersList) {
        const res = await client.query(
          "INSERT INTO cost_centers (name, code) VALUES ($1, $2) RETURNING id",
          [cc.name, cc.code]
        );
        ccResults[cc.name] = res.rows[0].id;
      }

      // 6. Seed Customers & Suppliers
      const customersList = [
        { name: 'أحمد جمال', phone: '01012345678' },
        { name: 'منى السيد', phone: '01234567890' }
      ];
      for (const cust of customersList) {
        await client.query("INSERT INTO customers (name, phone) VALUES ($1, $2)", [cust.name, cust.phone]);
      }

      const suppliersList = [
        { name: 'الشركة المصرية للأغذية', contact: 'حسن محمود', phone: '01112223334' },
        { name: 'موردي الخضار والفاكهة', contact: 'محمد جابر', phone: '01555556666' }
      ];
      for (const sup of suppliersList) {
        await client.query("INSERT INTO suppliers (name, contact_person, phone) VALUES ($1, $2, $3)", [sup.name, sup.contact, sup.phone]);
      }

      // 7. Seed Employees & their payrolls
      const employeesList = [
        { name: 'أحمد عبد الله', dept: 'المطبخ', job: 'شيف رئيسي', salary: 8000.00 },
        { name: 'كريم محمود', dept: 'الصالة', job: 'كابتن صالة', salary: 4500.00 },
        { name: 'سارة أحمد', dept: 'الإدارة', job: 'أخصائي محاسبة', salary: 6000.00 },
        { name: 'عمرو مصطفى', dept: 'الدليفري', job: 'طيار ديليفري', salary: 3500.00 }
      ];
      for (const emp of employeesList) {
        const deptId = deptsMap[emp.dept] || (Object.values(deptsMap)[0] as number) || null;
        const empRes = await client.query(
          `INSERT INTO employees (name, department_id, job_title, branch_id, salary_type, basic_salary, work_days) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [emp.name, deptId, emp.job, branchId, 'monthly', emp.salary, 30]
        );
        const empId = empRes.rows[0].id;

        // Seed some payroll records
        await client.query(
          `INSERT INTO payroll (user_id, month, year, basic_salary, bonuses, deductions, net_salary, status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [empId, 6, 2026, emp.salary, 500.00, 100.00, emp.salary + 400.00, 'paid']
        );
      }

      // 8. Seed Complaints & Reservations
      await client.query(
        "INSERT INTO complaints (branch_id, customer_name, phone, complaint_text, status, resolution_text) VALUES ($1, $2, $3, $4, $5, $6)",
        [branchId, 'العميل هاني', '01099998888', 'تأخير في توصيل الأوردر لأكثر من ساعة ومكتبي في الدور الرابع', 'resolved', 'تم تعويض العميل بوجبة مجانية وتنبيه طيار التوصيل بالالتزام بالوقت المبرم']
      );
      await client.query(
        "INSERT INTO complaints (branch_id, customer_name, phone, complaint_text, status) VALUES ($1, $2, $3, $4, $5)",
        [branchId, 'العميل ياسر', '01222223333', 'البيتزا وصلت باردة وكان هناك نقص في الصوص المطلوب', 'pending']
      );

      await client.query(
        "INSERT INTO reservations (branch_id, customer_name, customer_phone, reservation_date, reservation_time, guests_count, table_number, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
        [branchId, 'طارق حامد', '01020304050', '2026-06-25', '19:00:00', 4, 5, 'confirmed', 'طاولة بجانب النافذة العائلية']
      );
      await client.query(
        "INSERT INTO reservations (branch_id, customer_name, customer_phone, reservation_date, reservation_time, guests_count, status) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [branchId, 'أميرة يوسف', '01515151515', '2026-06-26', '21:00:00', 2, 'pending']
      );

      // 9. Seed Journal Entries (General Ledger Chart of Accounts integration)
      const accountsRes = await client.query("SELECT id, code FROM accounts");
      const accountsMap = accountsRes.rows.reduce((acc: any, row: any) => {
        acc[row.code] = row.id;
        return acc;
      }, {});

      // Capital injection: Debit Bank (112), Credit Capital (31)
      if (accountsMap['112'] && accountsMap['31']) {
        const je1 = await client.query(
          "INSERT INTO journal_entries (description, reference) VALUES ($1, $2) RETURNING id",
          ['إيداع رأس المال التأسيسي للأعمال التوسيعية للمطعم الرئيسي', 'JE-2026-001']
        );
        const je1Id = je1.rows[0].id;
        await client.query(
          "INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id) VALUES ($1, $2, 120000.00, 0, $3, $4)",
          [je1Id, accountsMap['112'], 'إيداع رأس مال بالبنك الأهلي المصري', ccResults['مركز تكلفة الصالة'] || null]
        );
        await client.query(
          "INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES ($1, $2, 0, 120000.00, $3)",
          [je1Id, accountsMap['31'], 'رأس المال المكتتب به']
        );
      }

      // Record Daily POS Sales: Debit Cash (111), Credit POS Sales (41)
      if (accountsMap['111'] && accountsMap['41']) {
        const je2 = await client.query(
          "INSERT INTO journal_entries (description, reference) VALUES ($1, $2) RETURNING id",
          ['قيد مبيعات نقاط البيع POS وتغذية كاشير الصالة الرئيسي', 'JE-2026-002']
        );
        const je2Id = je2.rows[0].id;
        await client.query(
          "INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id) VALUES ($1, $2, 1450.00, 0, $3, $4)",
          [je2Id, accountsMap['111'], 'مبيعات الكاش الإجمالية اليومية', ccResults['مركز تكلفة المطبخ'] || null]
        );
        await client.query(
          "INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES ($1, $2, 0, 1450.00, $3)",
          [je2Id, accountsMap['41'], 'إيرادات مبيعات النشاط الجارية']
        );
      }

      // Record Operating Expenses: Debit Expenses (52), Credit Cash (111)
      if (accountsMap['52'] && accountsMap['111']) {
        const je3 = await client.query(
          "INSERT INTO journal_entries (description, reference) VALUES ($1, $2) RETURNING id",
          ['قيد تسوية وصرف رواتب الموظفين والعمال النقدي المباشر', 'JE-2026-003']
        );
        const je3Id = je3.rows[0].id;
        await client.query(
          "INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes, cost_center_id) VALUES ($1, $2, 22000.00, 0, $3, $4)",
          [je3Id, accountsMap['52'], 'سداد مراتب موظفي المطبخ والصالة', ccResults['مركز تكلفة المطبخ'] || null]
        );
        await client.query(
          "INSERT INTO journal_items (journal_entry_id, account_id, debit, credit, notes) VALUES ($1, $2, 0, 22000.00, $3)",
          [je3Id, accountsMap['111'], 'المنصرف من الصندوق للمرتبات']
        );
      }

      // 10. Seed POS/Dine-In Orders
      const order1 = await client.query(
        "INSERT INTO orders (branch_id, table_number, customer_name, order_type, total, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [branchId, 3, 'أحمد جمال', 'dine_in', 295.00, 'completed']
      );
      const o1Id = order1.rows[0].id;
      if (prodResults['بيتزا مارجريتا'] && prodResults['عصير مانجو فريش']) {
        await client.query("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, 1, $3)", [o1Id, prodResults['بيتزا مارجريتا'].id, prodResults['بيتزا مارجريتا'].price]);
        await client.query("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, 2, $3)", [o1Id, prodResults['عصير مانجو فريش'].id, prodResults['عصير مانجو فريش'].price]);
        await client.query("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, 1, $3)", [o1Id, prodResults['أم علي'].id, prodResults['أم علي'].price]);
      }

      const order2 = await client.query(
        "INSERT INTO orders (branch_id, customer_name, customer_phone, customer_address, order_type, delivery_fee, total, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id",
        [branchId, 'منى السيد', '01234567890', 'القاهرة، المعادي رقم 256', 'delivery', 20.00, 200.00, 'completed']
      );
      const o2Id = order2.rows[0].id;
      if (prodResults['برجر كلاسيك'] && prodResults['كابتشينو']) {
        await client.query("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, 1, $3)", [o2Id, prodResults['برجر كلاسيك'].id, prodResults['برجر كلاسيك'].price]);
        await client.query("INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, 1, $3)", [o2Id, prodResults['كابتشينو'].id, prodResults['كابتشينو'].price]);
      }

      await client.query("COMMIT");
      res.json({ success: true, message: "تم توليد وتغذية قاعدة البيانات بكافة البيانات التجريبية المتكاملة بنجاح!" });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Seeding error:", error);
      res.status(500).json({ error: "Failed to seed demo data", details: error.message });
    } finally {
      client.release();
    }
  });

  router.post("/api/db/clear-all", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const tablesToClear = [
        'order_items', 'orders', 'sales_order_items', 'sales_orders', 'sales_returns', 'sales_return_items',
        'sales_quotations', 'sales_quotation_items', 'inventory_transactions', 'inventory_movements',
        'inventory_items', 'product_ingredients', 'products', 'categories', 'ingredients',
        'complaints', 'reservations', 'payroll', 'employees', 'customers', 'suppliers',
        'journal_items', 'journal_entries', 'production_runs'
      ];

      for (const table of tablesToClear) {
        try {
          await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        } catch (e: any) {
          try {
            await client.query(`DELETE FROM ${table}`);
          } catch (delErr: any) {
            console.log(`Error clearing ${table}:`, delErr.message);
          }
        }
      }

      await client.query("COMMIT");
      res.json({ success: true, message: "تم مسح كافة البيانات التجريبية الوهمية بنجاح وتجهيز قاعدة البيانات للعمل الحقيقي!" });
    } catch (error: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: "Failed to clear database", details: error.message });
    } finally {
      client.release();
    }
  });

  router.get("/api/backup", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    try {
      const data: any = {
        tables: {},
        timestamp: new Date().toISOString()
      };
      
      const tablesResult = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      for (const row of tablesResult.rows) {
        const tableName = row.table_name;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          console.warn(`Skipping invalid table name in backup: ${tableName}`);
          continue;
        }
        const tableData = await pool.query(`SELECT * FROM "${tableName}"`);
        data.tables[tableName] = tableData.rows;
      }

      res.json(data);
    } catch (error) {
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  router.get("/api/backups/list", authenticateToken, requireAdminRoute, (req: any, res: any) => {
    try {
      const files = fs.readdirSync(path.join(process.cwd(), 'backups'));
      const backups = files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const stats = fs.statSync(path.join(process.cwd(), 'backups', file));
          return {
            filename: file,
            size: stats.size,
            created_at: stats.birthtime
          };
        });
      res.json(backups);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch backups" });
    }
  });

  router.post("/api/backups/create", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    try {
      const data: any = {
        tables: {},
        timestamp: new Date().toISOString()
      };
      
      const tablesResult = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      for (const row of tablesResult.rows) {
        const tableName = row.table_name;
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          console.warn(`Skipping invalid table name in backup: ${tableName}`);
          continue;
        }
        const tableData = await pool.query(`SELECT * FROM "${tableName}"`);
        data.tables[tableName] = tableData.rows;
      }

      const filename = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      fs.writeFileSync(path.join(process.cwd(), 'backups', filename), JSON.stringify(data));
      await logAction(req.user?.id || 0, "create_backup", "backups", 0, JSON.stringify({ filename }));
      res.json({ success: true, filename });
    } catch (error) {
      console.error("Backup creation error:", error);
      res.status(500).json({ error: "Failed to create backup" });
    }
  });

  router.post("/api/backups/restore/:filename", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    const { filename } = req.params;
    const client = await pool.connect();
    try {
      if (req.body?.confirmRestore !== true) {
        return res.status(400).json({ error: "RESTORE_CONFIRMATION_REQUIRED", message: "يجب تأكيد عملية الاستعادة صراحة قبل التنفيذ" });
      }
      const backupFile = safeBackupFilename(filename);
      const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'backups', backupFile), 'utf8'));
      
      await client.query("BEGIN");
      
      const existingTablesResult = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
      const existingTables = existingTablesResult.rows.map((r: any) => r.table_name);
      
      for (const [tableName, rows] of Object.entries(data.tables)) {
        // Validate table name to prevent SQL injection
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          console.warn(`Skipping invalid table name in backup: ${tableName}`);
          continue;
        }
        if (!existingTables.includes(tableName)) continue;
        
        try {
          await client.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
          if ((rows as any[]).length > 0) {
            const columnsResult = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'", [tableName]);
            const currentColumns = columnsResult.rows.map((c: any) => c.column_name);
            
            const backupColumns = Object.keys((rows as any[])[0]);
            const validColumns = backupColumns.filter(c => currentColumns.includes(c));
            
            if (validColumns.length > 0) {
              const columnsStr = validColumns.join(",");
              const placeholders = validColumns.map((_, i) => `$${i + 1}`).join(",");
              const query = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${placeholders})`;
              
              for (const row of rows as any[]) {
                const values = validColumns.map(col => row[col]);
                await client.query(query, values);
              }
            }
          }
        } catch (err) {
          console.error(`Error restoring table ${tableName}:`, err);
          throw err;
        }
      }
      
      await client.query("COMMIT");
      await logAction(req.user?.id || 0, "restore_backup", "backups", 0, JSON.stringify({ filename }));
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Restore error:", error);
      res.status(500).json({ error: "Failed to restore backup" });
    } finally {
      client.release();
    }
  });

  // Restore Endpoint
  const TABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  router.post("/api/restore", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    const { tables, targetBranchId, confirmRestore } = req.body;
    if (!tables) return res.status(400).json({ error: "No data provided" });
    if (confirmRestore !== true) {
      return res.status(400).json({ error: "RESTORE_CONFIRMATION_REQUIRED", message: "يجب تأكيد عملية الاستعادة صراحة قبل التنفيذ" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // In PostgreSQL, we can't easily turn off foreign keys for a session without superuser.
      // Instead, we'll use TRUNCATE ... CASCADE or just rely on correct order if possible.
      // For a full restore, TRUNCATE CASCADE is often better.
      
      const existingTablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      const existingTables = existingTablesResult.rows.map((t: any) => t.table_name);
      
      for (const [tableName, rows] of Object.entries(tables)) {
        if (!existingTables.includes(tableName)) continue;
        if (!TABLE_NAME_REGEX.test(tableName)) {
          return res.status(400).json({ error: `اسم جدول غير صالح: ${tableName}` });
        }
        
        // If targetBranchId is provided, skip restoring the branches table to keep current branches
        if (targetBranchId && tableName === 'branches') continue;
        
        try {
          await client.query(`TRUNCATE TABLE ${tableName} RESTART IDENTITY CASCADE`);
          if ((rows as any[]).length > 0) {
            const columnsResult = await client.query(`
              SELECT column_name 
              FROM information_schema.columns 
              WHERE table_name = $1
            `, [tableName]);
            const currentColumns = columnsResult.rows.map((c: any) => c.column_name);
            
            const backupColumns = Object.keys((rows as any[])[0]);
            const validColumns = backupColumns.filter(c => currentColumns.includes(c));
            
            if (validColumns.length > 0) {
              const columnsStr = validColumns.join(",");
              const placeholders = validColumns.map((_, i) => `$${i + 1}`).join(",");
              const query = `INSERT INTO ${tableName} (${columnsStr}) VALUES (${placeholders})`;
              
              for (const row of rows as any[]) {
                const values = validColumns.map(col => {
                  if (targetBranchId && col === 'branch_id') {
                    return targetBranchId;
                  }
                  return row[col];
                });
                await client.query(query, values);
              }
            }
          }
        } catch (err) {
          console.error(`Error restoring table ${tableName}:`, err);
          throw err;
        }
      }
      
      await client.query("COMMIT");
      await logAction(req.user?.id || 0, "restore_uploaded_backup", "backups", 0, JSON.stringify({ targetBranchId: targetBranchId || null }));
      res.json({ success: true });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Restore error:", error);
      res.status(500).json({ error: "Failed to restore backup" });
    } finally {
      client.release();
    }
  });

  router.get("/api/reports/branch/complaints", authenticateToken, async (req: any, res: any) => {
    const { startDate, endDate, branchId } = req.query;
    const user = req.user;
    try {
      let query = `
        SELECT 
          c.id as "رقم الشكوى",
          b.name as "الفرع",
          c.customer_name as "اسم العميل",
          c.phone as "رقم الهاتف",
          c.complaint_text as "نص الشكوى",
          CASE c.status WHEN 'resolved' THEN 'تم الحل' ELSE 'قيد الانتظار' END as "الحالة",
          c.resolution_text as "طريقة الحل",
          TO_CHAR(c.created_at, 'YYYY-MM-DD HH24:MI:SS') as "تاريخ الشكوى",
          TO_CHAR(c.resolved_at, 'YYYY-MM-DD HH24:MI:SS') as "تاريخ الحل"
        FROM complaints c
        LEFT JOIN branches b ON c.branch_id = b.id
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (startDate) {
        params.push(startDate);
        query += ` AND c.created_at::date >= $${params.length}`;
      }
      if (endDate) {
        params.push(endDate);
        query += ` AND c.created_at::date <= $${params.length}`;
      }

      // Branch filtering
      if (user.role !== 'admin' && user.branch_id) {
        params.push(user.branch_id);
        query += ` AND c.branch_id = $${params.length}`;
      } else if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        params.push(branchId);
        query += ` AND c.branch_id = $${params.length}`;
      }

      query += ` ORDER BY c.created_at DESC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch complaints report" });
    }
  });

  // Complaints Endpoints
  router.get("/api/complaints", authenticateToken, requireAdminRoute, async (req, res) => {
    const { branchId, status } = req.query;
    try {
      let query = `
        SELECT c.*, b.name as branch_name 
        FROM complaints c
        LEFT JOIN branches b ON c.branch_id = b.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (branchId && branchId !== 'all' && branchId !== 'undefined' && branchId !== 'null') {
        query += ` AND c.branch_id = $` + (params.length + 1);
        params.push(branchId);
      }
      
      if (status && status !== 'all') {
        query += ` AND c.status = $` + (params.length + 1);
        params.push(status);
      }

      query += ` ORDER BY c.created_at DESC`;

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch complaints" });
    }
  });

  router.post("/api/complaints", authenticateToken, requireAdminRoute, async (req, res) => {
    const { branch_id, customer_name, phone, complaint_text } = req.body;
    try {
      const result = await pool.query(`
        INSERT INTO complaints (branch_id, customer_name, phone, complaint_text)
        VALUES ($1, $2, $3, $4) RETURNING id
      `, [branch_id, customer_name, phone, complaint_text]);
      res.json({ success: true, id: result.rows[0].id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to create complaint" });
    }
  });

  router.put("/api/complaints/:id/resolve", authenticateToken, requireAdminRoute, async (req, res) => {
    const { resolution_text } = req.body;
    try {
      await pool.query(`
        UPDATE complaints 
        SET status = 'resolved', resolution_text = $1, resolved_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [resolution_text, req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to resolve complaint" });
    }
  });

  router.delete("/api/complaints/:id", authenticateToken, requireAdminRoute, async (req, res) => {
    try {
      await pool.query("DELETE FROM complaints WHERE id = $1", [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to delete complaint" });
    }
  });

  // ==========================================
  // ERP ENTERPRISE CORE SYSTEM ENDPOINTS
  // ==========================================
  
  // Real-time Event bus feed
  router.get("/api/erp/events", authenticateToken, async (req: any, res: any) => {
    try {
      const history = ERPEventBus.getInstance().getEventHistory();
      res.json({ success: true, events: history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Cache stats control
  router.get("/api/erp/cache", authenticateToken, async (req: any, res: any) => {
    try {
      res.json({ success: true, stats: ERPCache.getStats() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/erp/cache/clear", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    try {
      ERPCache.clear();
      ERPEventBus.getInstance().emitEvent("CacheCleared", { clearedBy: req.user?.username || "Admin" });
      res.json({ success: true, message: "تم تفريغ ذاكرة التخزين المؤقت بنجاح" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Job Queue endpoint
  router.get("/api/erp/queues", authenticateToken, async (req: any, res: any) => {
    try {
      res.json({ success: true, status: ERPJobQueue.getQueueStatus() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/api/erp/queues/add", authenticateToken, requireAdminRoute, async (req: any, res: any) => {
    const { queueType, label } = req.body;
    try {
      const jobId = ERPJobQueue.enqueue(
        queueType, 
        label, 
        { triggeredBy: req.user?.username || "Admin" }, 
        async () => {
          // Asynchronous execution simulation (such as PDF rendering or backup compilation)
          await new Promise(resolve => setTimeout(resolve, 2500));
          return { status: "success", executedAt: new Date().toISOString() };
        }
      );
      ERPEventBus.getInstance().emitEvent("JobEnqueued", { jobId, queueType, label });
      res.json({ success: true, jobId });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ERP System Analytics & Pool statuses
  router.get("/api/erp/stats", authenticateToken, async (req: any, res: any) => {
    try {
      const ramUsage = process.memoryUsage();
      const poolStats = {
        totalConnections: pool.totalCount,
        idleConnections: pool.idleCount,
        waitingRequests: pool.waitingCount
      };

      res.json({
        success: true,
        cpu: process.cpuUsage(),
        ram: {
          heapTotal: `${Math.round(ramUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(ramUsage.heapUsed / 1024 / 1024)} MB`,
          rss: `${Math.round(ramUsage.rss / 1024 / 1024)} MB`
        },
        databasePool: poolStats,
        uptime: process.uptime(),
        platform: process.platform,
        nodeVersion: process.version
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Intelligent AI Analyser & Predictive Planner (Stage 16)
  router.get("/api/erp/ai/predict", authenticateToken, async (req: any, res: any) => {
    try {
      const analysis = await ERPAIAssistant.analyzeEnterpriseData();
      ERPEventBus.getInstance().emitEvent("AIEngineQueried", { user: req.user?.username });
      res.json({ success: true, analysis });
    } catch (err: any) {
      console.error("AI Prediction Error", err);
      res.status(500).json({ success: false, error: err.message || "حدث خطأ أثناء إجراء التحليل الذكي" });
    }
  });

export default router;
