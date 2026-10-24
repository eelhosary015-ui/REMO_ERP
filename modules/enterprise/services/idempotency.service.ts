import { createHash } from 'crypto';
import { pool } from '../../../server-db.js';

export type IdempotencyResult = {
  replay: boolean;
  status?: number;
  body?: any;
};

/**
 * Persistent idempotency guard for business write endpoints.
 *
 * Usage:
 *   const guard = await beginIdempotency(scope, key, body, userId);
 *   if (guard.replay) return res.status(guard.status!).json(guard.body);
 *   ... perform the business transaction ...
 *   await completeIdempotency(scope, key, status, body);
 *
 * A unique DB constraint arbitrates concurrent requests from multiple workers.
 */
export async function beginIdempotency(
  scope: string,
  key: string | null | undefined,
  body: any,
  createdBy?: number | null,
  companyId?: number | null,
  branchId?: number | null,
  db: any = pool,
): Promise<IdempotencyResult & { key: string | null }> {
  const normalizedKey = String(key ?? '').trim();
  if (!normalizedKey) return { replay: false, key: null };
  if (normalizedKey.length > 200) throw new Error('Idempotency-Key is too long');
  if (!scope || scope.length > 120) throw new Error('Invalid idempotency scope');

  const requestHash = createHash('sha256').update(stableStringify(body)).digest('hex');

  const inserted = await db.query(
    `INSERT INTO erp_idempotency_keys
      (idempotency_key, scope, request_hash, status, created_by, company_id, branch_id, expires_at)
     VALUES ($1,$2,$3,'processing',$4,$5,$6,CURRENT_TIMESTAMP + INTERVAL '24 hours')
     ON CONFLICT (scope, idempotency_key) DO NOTHING
     RETURNING id`,
    [normalizedKey, scope, requestHash, createdBy ?? null, companyId ?? null, branchId ?? null]
  );

  if (inserted.rows?.length) return { replay: false, key: normalizedKey };

  const existing = await db.query(
    `SELECT status, response_status, response_body, request_hash, expires_at
       FROM erp_idempotency_keys
      WHERE scope=$1 AND idempotency_key=$2 LIMIT 1`,
    [scope, normalizedKey]
  );
  const row = existing.rows?.[0];
  if (!row) return { replay: false, key: normalizedKey };

  if (row.request_hash && row.request_hash !== requestHash) {
    throw new Error('Idempotency-Key was already used with a different request payload');
  }
  if (row.status === 'completed') {
    return { replay: true, status: Number(row.response_status || 200), body: row.response_body, key: normalizedKey };
  }

  // A processing key means another worker owns the operation. Do not execute
  // it twice; callers should retry after a short delay.
  throw Object.assign(new Error('The same operation is already being processed'), { status: 409, code: 'IDEMPOTENCY_IN_PROGRESS' });
}

export async function completeIdempotency(scope: string, key: string | null | undefined, status: number, body: any, db: any = pool) {
  const normalizedKey = String(key ?? '').trim();
  if (!normalizedKey) return;
  await db.query(
    `UPDATE erp_idempotency_keys
        SET status='completed', response_status=$1, response_body=$2::jsonb, completed_at=CURRENT_TIMESTAMP
      WHERE scope=$3 AND idempotency_key=$4`,
    [status, JSON.stringify(body ?? null), scope, normalizedKey]
  );
}

export async function failIdempotency(scope: string, key: string | null | undefined, db: any = pool) {
  const normalizedKey = String(key ?? '').trim();
  if (!normalizedKey) return;
  // Remove an uncompleted key so a failed transaction can safely be retried.
  await db.query(
    `DELETE FROM erp_idempotency_keys WHERE scope=$1 AND idempotency_key=$2 AND status='processing'`,
    [scope, normalizedKey]
  );
}

function stableStringify(value: any): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
