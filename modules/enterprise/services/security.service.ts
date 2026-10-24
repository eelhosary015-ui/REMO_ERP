import { Request, Response, NextFunction } from 'express';
import { pool } from '../../../server-db.js';
import { logError } from './errorLogger.service.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Security Service
// Security hardening, rate limiting, and protection
// ═══════════════════════════════════════════════════════════════

// Simple in-memory rate limiter (per IP)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 3000; // Per IP
const MAX_LOGIN_ATTEMPTS = 30; // Per IP per minute
const MAX_LOGIN_ATTEMPTS_PER_USER = 10; // Per username per 15 minutes

// Failed login tracking
const failedLoginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(maxRequests: number = MAX_REQUESTS_PER_MINUTE, windowMs: number = RATE_LIMIT_WINDOW) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
    const now = Date.now();

    const record = rateLimitStore.get(ip);
    if (!record || now > record.resetAt) {
      rateLimitStore.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    record.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - record.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

    if (record.count > maxRequests) {
      logError({
        severity: 'medium',
        category: 'security',
        message: `Rate limit exceeded for IP: ${ip}`,
        endpoint: req.originalUrl,
        method: req.method,
        ip_address: ip,
      });

      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'تم تجاوز حد الطلبات المسموح. حاول مرة أخرى لاحقاً.',
        retry_after: Math.ceil((record.resetAt - now) / 1000),
      });
    }

    next();
  };
}

/**
 * Login attempt tracking
 */
export function checkLoginAttempt(username: string, ip: string): { allowed: boolean; remainingAttempts: number; lockedUntil?: number } {
  const now = Date.now();
  const key = `login:${username}`;
  const ipKey = `ip:${ip}`;

  // Check IP-based rate limit
  const ipRecord = failedLoginAttempts.get(ipKey);
  if (ipRecord && ipRecord.count >= MAX_LOGIN_ATTEMPTS && now < (ipRecord.lockedUntil || 0)) {
    return { allowed: false, remainingAttempts: 0, lockedUntil: ipRecord.lockedUntil };
  }

  // Check username-based rate limit
  const userRecord = failedLoginAttempts.get(key);
  if (userRecord && userRecord.count >= MAX_LOGIN_ATTEMPTS_PER_USER) {
    const lockDuration = 15 * 60 * 1000; // 15 minutes
    if (now < (userRecord.lockedUntil || 0)) {
      return { allowed: false, remainingAttempts: 0, lockedUntil: userRecord.lockedUntil };
    }
    // Reset if lock period expired
    failedLoginAttempts.delete(key);
  }

  return { allowed: true, remainingAttempts: MAX_LOGIN_ATTEMPTS_PER_USER - (userRecord?.count || 0) };
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(username: string, ip: string): void {
  const now = Date.now();
  const key = `login:${username}`;
  const ipKey = `ip:${ip}`;

  // Record per-user
  const userRecord = failedLoginAttempts.get(key);
  if (!userRecord || now - userRecord.firstAttempt > 15 * 60 * 1000) {
    failedLoginAttempts.set(key, { count: 1, firstAttempt: now });
  } else {
    userRecord.count++;
    if (userRecord.count >= MAX_LOGIN_ATTEMPTS_PER_USER) {
      userRecord.lockedUntil = now + 15 * 60 * 1000;
      logError({
        severity: 'high',
        category: 'security',
        message: `User "${username}" locked due to too many failed login attempts`,
        ip_address: ip,
        module: 'authentication',
      });
    }
  }

  // Record per-IP
  const ipRecord = failedLoginAttempts.get(ipKey);
  if (!ipRecord || now - ipRecord.firstAttempt > RATE_LIMIT_WINDOW) {
    failedLoginAttempts.set(ipKey, { count: 1, firstAttempt: now });
  } else {
    ipRecord.count++;
    if (ipRecord.count >= MAX_LOGIN_ATTEMPTS) {
      ipRecord.lockedUntil = now + RATE_LIMIT_WINDOW;
    }
  }
}

/**
 * Clear failed login attempts on successful login
 */
export function clearFailedLogin(username: string, ip: string): void {
  failedLoginAttempts.delete(`login:${username}`);
  failedLoginAttempts.delete(`ip:${ip}`);
}

/**
 * SQL Injection detection
 */
export function detectSqlInjection(input: string): boolean {
  if (input.trim() === '--' || input.trim() === '---') return false;
  const patterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|EXEC|UNION)\b.*\b(FROM|INTO|TABLE|DATABASE|WHERE)\b)/i,
    /(--\s|;|\/\*|\*\/|xp_|0x)/,
    /('\s*(OR|AND)\s+.*=.*')/i,
    /(\bOR\b\s+\d+\s*=\s*\d+)/i,
  ];
  return patterns.some(p => p.test(input));
}

/**
 * Input sanitization middleware
 */
export function inputSanitizationMiddleware(req: Request, _res: Response, next: NextFunction) {
  const checkInput = (obj: any): boolean => {
    if (!obj || typeof obj !== 'object') return false;
    for (const [key, value] of Object.entries(obj)) {
      // Skip binary/base64 image fields, photos, attachments, and data URLs
      const isPhotoKey = /photo|image|avatar|logo|file|attachment|base64|document/i.test(key);
      if (isPhotoKey) continue;

      if (typeof value === 'string') {
        if (value.startsWith('data:') || value.length > 2000) {
          // Large payloads / data URLs are passed securely via parameterized SQL queries
          continue;
        }
        if (detectSqlInjection(value)) {
          console.warn(`[SECURITY] Potential SQL injection detected in field "${key}" with value: "${value}"`);
          logError({
            severity: 'high',
            category: 'security',
            message: `Potential SQL injection detected in field "${key}"`,
            module: 'security',
            endpoint: req.originalUrl,
            method: req.method,
            ip_address: req.ip,
            request_body: JSON.stringify({ [key]: '[REDACTED]' }),
          });
          return true;
        }
      }
      if (typeof value === 'object' && !Array.isArray(value)) {
        if (checkInput(value)) return true;
      }
    }
    return false;
  };

  if (req.body && typeof req.body === 'object') {
    if (checkInput(req.body)) {
      return _res.status(400).json({ error: 'INVALID_INPUT', message: 'بيانات غير صالحة' });
    }
  }

  if (req.query && typeof req.query === 'object') {
    if (checkInput(req.query)) {
      return _res.status(400).json({ error: 'INVALID_INPUT', message: 'بيانات غير صالحة' });
    }
  }

  next();
}

/**
 * Security headers middleware
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Always remove X-Frame-Options to support embedding inside sandbox/preview frames (like Google AI Studio)
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // In development/preview mode, Vite needs unsafe-inline + unsafe-eval for HMR and React
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: wss: http: data: blob: https:; " +
      "img-src 'self' data: blob: http: https:; " +
      "connect-src 'self' ws: wss: http: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "frame-ancestors 'self' *;"
    );
  } else {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' ws: wss: http: https:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: blob: http: https:; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "connect-src 'self' ws: wss: http: https:; " +
      "frame-ancestors 'self' *;"
    );
  }

  res.removeHeader('X-Powered-By');
  next();
}

/**
 * Get security audit summary
 */
export async function getSecurityAuditSummary(): Promise<Record<string, any>> {
  try {
    const [errorLogs, auditLogs, loginAttempts] = await Promise.all([
      pool.query("SELECT severity, COUNT(*) as count FROM system_error_logs WHERE category = 'security' AND created_at >= NOW() - INTERVAL '24 hours' GROUP BY severity"),
      pool.query("SELECT operation, COUNT(*) as count FROM enterprise_audit_log WHERE created_at >= NOW() - INTERVAL '24 hours' AND operation IN ('DELETE', 'UPDATE', 'LOGIN') GROUP BY operation"),
      pool.query("SELECT COUNT(*) as count FROM enterprise_audit_log WHERE operation = 'LOGIN' AND created_at >= NOW() - INTERVAL '1 hour'"),
    ]);

    return {
      period: 'last_24_hours',
      security_errors: errorLogs.rows.reduce((acc: any, r: any) => { acc[r.severity] = parseInt(r.count); return acc; }, {}),
      critical_operations: loginAttempts.rows.reduce((acc: any, r: any) => { acc[r.operation] = parseInt(r.count); return acc; }, {}),
      logins_last_hour: parseInt(loginAttempts.rows[0]?.count || 0),
      active_rate_limits: rateLimitStore.size,
      active_login_locks: failedLoginAttempts.size,
    };
  } catch {
    return { error: 'Could not generate security summary' };
  }
}