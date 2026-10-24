import { pool } from '../../../server-db.js';

export type DbClient = {
  query: (sql: string, params?: any[]) => Promise<any>;
  release?: () => void;
};

/**
 * Enterprise transaction boundary.
 * All database mutations belonging to one business operation should use the
 * same client returned here. This prevents partial commits and makes future
 * idempotency/locking upgrades consistent across modules.
 */
export async function withTransaction<T>(
  work: (client: DbClient) => Promise<T>,
  options?: { isolation?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'; readOnly?: boolean }
): Promise<T> {
  const client = await pool.connect();
  let committed = false;
  try {
    await client.query('BEGIN');
    if (options?.isolation) {
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${options.isolation}`);
    }
    if (options?.readOnly) {
      await client.query('SET TRANSACTION READ ONLY');
    }

    const result = await work(client);
    await client.query('COMMIT');
    committed = true;
    return result;
  } catch (error) {
    if (!committed) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    throw error;
  } finally {
    client.release?.();
  }
}

/** Lock a row for an update inside an existing transaction. */
export async function lockOne(
  client: DbClient,
  sql: string,
  params: any[] = []
): Promise<any | null> {
  const result = await client.query(`${sql.trim()} FOR UPDATE`, params);
  return result.rows?.[0] ?? null;
}

/**
 * Safe idempotency lookup/insert primitive. The caller supplies the target
 * table and SELECT projection; values are always parameterized.
 */
export async function findByIdempotencyKey(
  client: DbClient,
  table: string,
  key: string
): Promise<any | null> {
  if (!key) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) throw new Error('Invalid idempotency table');
  const result = await client.query(
    `SELECT * FROM ${table} WHERE idempotency_key = $1 LIMIT 1 FOR UPDATE`,
    [key]
  );
  return result.rows?.[0] ?? null;
}

export function getIdempotencyKey(req: any): string | null {
  const raw = req?.get?.('Idempotency-Key') ?? req?.body?.idempotency_key;
  const key = String(raw ?? '').trim();
  if (!key) return null;
  if (key.length > 200) throw new Error('Idempotency-Key is too long');
  return key;
}
