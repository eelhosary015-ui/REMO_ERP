import { pool } from '../../../server-db.js';

// ═══════════════════════════════════════════════════════════════
// Enterprise Error Logger Service
// Centralized error logging, performance monitoring, and security
// ═══════════════════════════════════════════════════════════════

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'database' | 'validation' | 'authentication' | 'authorization' | 'business_logic' | 'external_service' | 'system' | 'network' | 'security';

export interface ErrorLogEntry {
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  stack?: string;
  module?: string;
  endpoint?: string;
  method?: string;
  user_id?: number;
  company_id?: number;
  branch_id?: number;
  ip_address?: string;
  user_agent?: string;
  request_body?: string;
  request_params?: string;
  additional_data?: Record<string, any>;
}

// In-memory error buffer (flushed to DB periodically)
const errorBuffer: ErrorLogEntry[] = [];
const BUFFER_SIZE = 50;
const FLUSH_INTERVAL = 30000; // 30 seconds
let flushTimer: NodeJS.Timeout | null = null;

// Performance metrics
const performanceMetrics = new Map<string, { count: number; totalMs: number; maxMs: number; minMs: number }>();

/**
 * Log an error to the system
 */
export function logError(entry: ErrorLogEntry): void {
  // Always log to console
  const emoji = entry.severity === 'critical' ? '🔴' : entry.severity === 'high' ? '🟠' : entry.severity === 'medium' ? '🟡' : '⚪';
  console.error(`${emoji} [${entry.category.toUpperCase()}] ${entry.message}${entry.module ? ` (${entry.module})` : ''}`);

  // Buffer for DB write
  errorBuffer.push({
    ...entry,
    request_body: entry.request_body ? truncate(entry.request_body, 500) : undefined,
  });

  if (errorBuffer.length >= BUFFER_SIZE) {
    flushErrors();
  }
}

/**
 * Log a warning
 */
export function logWarning(message: string, module?: string, additionalData?: Record<string, any>): void {
  logError({
    severity: 'low',
    category: 'system',
    message,
    module,
    additional_data: additionalData,
  });
}

/**
 * Record a performance metric for an API endpoint
 */
export function recordPerformance(endpoint: string, durationMs: number): void {
  const existing = performanceMetrics.get(endpoint);
  if (existing) {
    existing.count++;
    existing.totalMs += durationMs;
    existing.maxMs = Math.max(existing.maxMs, durationMs);
    existing.minMs = Math.min(existing.minMs, durationMs);
  } else {
    performanceMetrics.set(endpoint, { count: 1, totalMs: durationMs, maxMs: durationMs, minMs: durationMs });
  }

  // Alert on slow requests (> 5 seconds)
  if (durationMs > 5000) {
    logError({
      severity: 'medium',
      category: 'system',
      message: `Slow request: ${endpoint} took ${durationMs}ms`,
      module: 'performance',
      additional_data: { endpoint, durationMs },
    });
  }
}

/**
 * Get performance metrics summary
 */
export function getPerformanceMetrics(): Record<string, any> {
  const summary: Record<string, any> = {};
  for (const [endpoint, data] of performanceMetrics) {
    summary[endpoint] = {
      count: data.count,
      avg_ms: Math.round(data.totalMs / data.count),
      max_ms: data.maxMs,
      min_ms: data.minMs,
      total_ms: data.totalMs,
    };
  }
  return summary;
}

/**
 * Express middleware for error handling and performance monitoring
 */
export function errorHandlingMiddleware(err: any, req: any, res: any, _next: any) {
  const startTime = req._startTime || Date.now();
  const duration = Date.now() - startTime;

  // Record performance
  if (req.originalUrl) {
    recordPerformance(`${req.method} ${req.originalUrl}`, duration);
  }

  // Log the error
  logError({
    severity: err.status >= 500 ? 'high' : 'medium',
    category: categorizeError(err),
    message: err.message || 'Unknown error',
    stack: err.stack,
    module: 'express',
    endpoint: req.originalUrl,
    method: req.method,
    user_id: req.user?.id,
    company_id: req.user?.company_id,
    branch_id: req.user?.branch_id,
    ip_address: req.ip,
    user_agent: req.headers?.['user-agent'],
    additional_data: {
      status: err.status,
      statusCode: res.statusCode,
      duration_ms: duration,
    },
  });

  // Send response
  res.status(err.status || 500).json({
    error: err.error || 'INTERNAL_ERROR',
    message: err.message || 'حدث خطأ في النظام',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}

/**
 * Express middleware for performance timing
 */
export function performanceMiddleware(req: any, _res: any, next: any) {
  req._startTime = Date.now();
  next();
}

// ═══════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════

function categorizeError(err: any): ErrorCategory {
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('permission') || msg.includes('403') || msg.includes('denied')) return 'authorization';
  if (msg.includes('auth') || msg.includes('token') || msg.includes('jwt') || msg.includes('401')) return 'authentication';
  if (msg.includes('validation') || msg.includes('required') || msg.includes('invalid')) return 'validation';
  if (msg.includes('connection') || msg.includes('pool') || msg.includes('query') || msg.includes('econnrefused')) return 'database';
  if (msg.includes('timeout') || msg.includes('network') || msg.includes('econn')) return 'network';
  return 'system';
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

async function flushErrors(): Promise<void> {
  if (errorBuffer.length === 0) return;

  const batch = errorBuffer.splice(0, errorBuffer.length);

  try {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_error_logs (
        id SERIAL PRIMARY KEY,
        severity VARCHAR(20) DEFAULT 'medium',
        category VARCHAR(50),
        message TEXT,
        stack_trace TEXT,
        module VARCHAR(50),
        endpoint VARCHAR(200),
        method VARCHAR(10),
        user_id INTEGER,
        company_id INTEGER,
        branch_id INTEGER,
        ip_address VARCHAR(45),
        user_agent TEXT,
        request_body TEXT,
        additional_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON system_error_logs(severity);
      CREATE INDEX IF NOT EXISTS idx_error_logs_category ON system_error_logs(category);
      CREATE INDEX IF NOT EXISTS idx_error_logs_created ON system_error_logs(created_at);
    `);

    for (const entry of batch) {
      await pool.query(
        `INSERT INTO system_error_logs (severity, category, message, stack_trace, module, endpoint, method, user_id, company_id, branch_id, ip_address, user_agent, request_body, additional_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          entry.severity, entry.category, entry.message, entry.stack, entry.module,
          entry.endpoint, entry.method, entry.user_id, entry.company_id, entry.branch_id,
          entry.ip_address, entry.user_agent, entry.request_body,
          entry.additional_data ? JSON.stringify(entry.additional_data) : null,
        ]
      );
    }
  } catch (error: any) {
    // Don't let error logging errors crash the app
    console.error('[ERROR LOGGER FLUSH ERROR]', error.message);
  }
}

// Auto-flush every 30 seconds
if (typeof setInterval !== 'undefined') {
  flushTimer = setInterval(flushErrors, FLUSH_INTERVAL);
  // Don't prevent process exit
  if (flushTimer.unref) flushTimer.unref();
}

// Flush on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => {
    if (flushTimer) clearInterval(flushTimer);
    // Synchronous flush not possible, best-effort
  });
}