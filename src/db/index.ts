import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from './schema.ts';

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: pkg.Pool | undefined;
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!globalThis._postgresPool) {
    globalThis._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: Number(process.env.PG_DRIZZLE_POOL_MAX || 4),
      min: 0,
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
      connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
    });

    // Prevent unhandled pool-level errors from crashing the application
    globalThis._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return globalThis._postgresPool;
};

// Create or retrieve the pool instance.
let db: any;
try {
  if (!process.env.SQL_HOST && !process.env.DATABASE_URL) {
    throw new Error('Database environment variables not configured');
  }
  const pool = createPool();
  db = drizzle(pool, { schema });
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d: any) => d?.data ?? {},
    update: async (d: any) => d?.data ?? {},
    delete: async () => ({}),
  };
  db = new Proxy({}, {
    get: (_, prop) => prop === 'query'
      ? new Proxy({}, { get: () => noOp }) : async () => [],
  });
}

export { db };
