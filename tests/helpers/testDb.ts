/**
 * Behavioural test bootstrap.
 *
 * It is registered as a vitest `setupFile`, so it runs *before* any test file is
 * imported. That ordering is the whole point: `server-db` reads DATABASE_URL the
 * moment it is loaded, so the redirect below has to happen first.
 *
 * Safety rule: these tests only ever target a database whose name ends in
 * `_test`. Anything else aborts the run instead of writing to live data.
 */
import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

loadEnv({ quiet: true });

export const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Derive `<database>_test` from DATABASE_URL, unless TEST_DATABASE_URL overrides it. */
function resolveTestUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL?.trim();
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL?.trim();
  if (!base) {
    throw new Error(
      "DATABASE_URL is not set. Set DATABASE_URL (or TEST_DATABASE_URL) before running the behavioural tests.",
    );
  }
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}_test`;
  return url.toString();
}

const testUrl = resolveTestUrl();
export const testDbName = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ""));

if (!/_test$/.test(testDbName)) {
  throw new Error(
    `Refusing to run: the behavioural tests may only target a database whose name ends in "_test" (resolved "${testDbName}").`,
  );
}

process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = "test";
process.env.DISABLE_BACKGROUND_JOBS = process.env.DISABLE_BACKGROUND_JOBS ?? "true";

// `server-db` clamps its pool to at least 20 clients and there is no env var to
// lower it below that. When the live ERP server is running it already holds most
// of the server's connection budget (100), so a 20-client pool would be rejected
// with "too many clients already". `server-db` reads `globalThis.__remoPgPool` if
// one is already registered, so provide a deliberately tiny pool here — the
// application code itself stays untouched.
const { default: pgModule } = await import("pg");
const pg = (pgModule as any).default ?? pgModule;
const testPool = new pg.Pool({
  connectionString: testUrl,
  max: 2,
  idleTimeoutMillis: 5_000,
  connectionTimeoutMillis: 15_000,
});
globalThis.__remoPgPool = testPool;

// A static import would be hoisted above the overrides above, so load it here.
const { pool } = await import("../../server-db.js");
export { pool };

// Prove we reached the test database (and not the offline JSON fallback) before
// a single test runs.
const identity = await pool.query("SELECT current_database() AS db");
if (identity.rows[0]?.db !== testDbName) {
  throw new Error(
    `Expected to be connected to "${testDbName}" but the pool reports "${identity.rows[0]?.db}". Aborting to protect live data.`,
  );
}

// اختبارات السلوك تستخدم تواريخ ثابتة (يوليو/أكتوبر). قاعدة الاختبار قد تكون نسخة
// من قاعدة تشغيل فتراتها مقفلة، فيفشل الاختبار لسبب بيئي لا لخلل في الكود.
// نفتح كل الفترات داخل قاعدة الاختبار فقط (اسمها ينتهي بـ _test).
if (/_test$/.test(testDbName)) {
  // The behavioural suite is run against a STRUCTURE-ONLY copy of the schema, so
  // no financial period rows exist. The GL engine refuses to post into a period
  // it cannot find, which used to surface as PERIOD_NOT_FOUND for every fixture
  // that posts today's date. Create synthetic open periods for the years the
  // suite uses (no production rows are read or copied).
  await pool.query(`
    INSERT INTO financial_periods (month, year, start_date, end_date, status)
    SELECT m, y, make_date(y, m, 1), (make_date(y, m, 1) + interval '1 month - 1 day')::date, 'open'
    FROM generate_series(2024, 2027) AS y, generate_series(1, 12) AS m
    WHERE NOT EXISTS (
      SELECT 1 FROM financial_periods p WHERE p.month = m AND p.year = y
    )
  `);
  await pool.query("UPDATE financial_periods SET status = 'open' WHERE COALESCE(status, '') <> 'open'");
}

/** Run `work` inside a transaction that is always rolled back. */export async function withRollback<T>(work: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return await work(client);
  } finally {
    try {
      await client.query("ROLLBACK");
    } catch {
      // The connection is already gone; nothing left to roll back.
    }
    client.release();
  }
}

/** Run `work` inside a transaction that is committed on success. */
export async function withCommit<T>(work: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    client.release();
  }
}

let fixtureSeq = 0;
/** Unique suffix so parallel-ish fixtures and reruns never collide. */
export function uniqueTag(prefix: string): string {
  fixtureSeq += 1;
  return `${prefix}-${Date.now().toString(36)}-${process.pid}-${fixtureSeq}`;
}

export interface SeededAccounts {
  cash: number;
  bank: number;
  receivable: number;
  inventory: number;
  taxPayable: number;
  salesRevenue: number;
  expense: number;
  cogs: number;
}

const SEED_ACCOUNTS: Array<{ key: keyof SeededAccounts; code: string; name: string; type: string; nature: "DEBIT" | "CREDIT" }> = [
  { key: "cash", code: "1110", name: "الصندوق", type: "asset", nature: "DEBIT" },
  { key: "bank", code: "1120", name: "البنك", type: "asset", nature: "DEBIT" },
  { key: "receivable", code: "1130", name: "ذمم العملاء", type: "asset", nature: "DEBIT" },
  { key: "inventory", code: "1140", name: "مخزون", type: "asset", nature: "DEBIT" },
  { key: "taxPayable", code: "2130", name: "ضريبة مستحقة", type: "liability", nature: "CREDIT" },
  { key: "salesRevenue", code: "4000", name: "إيراد مبيعات", type: "revenue", nature: "CREDIT" },
  { key: "expense", code: "5000", name: "مصروفات تشغيل", type: "expense", nature: "DEBIT" },
  { key: "cogs", code: "5100", name: "تكلفة المبيعات", type: "expense", nature: "DEBIT" },
];

/** Insert the chart of accounts the GL engine needs, reusing existing codes. */
export async function ensureChartOfAccounts(client: any): Promise<SeededAccounts> {
  const result = {} as SeededAccounts;
  for (const account of SEED_ACCOUNTS) {
    const existing = await client.query("SELECT id FROM accounts WHERE code = $1 LIMIT 1", [account.code]);
    if (existing.rows.length) {
      result[account.key] = Number(existing.rows[0].id);
      continue;
    }
    const inserted = await client.query(
      `INSERT INTO accounts (code, name, name_ar, type, account_type, account_nature, level, is_leaf, allow_posting, status, is_active, balance)
       VALUES ($1, $2, $6, $3, $4, $5, 1, true, true, true, true, 0)
       RETURNING id`,
      [
        account.code,
        account.name,
        account.type,
        account.nature,
        account.nature.toLowerCase(),
        account.name,
      ],
    );
    result[account.key] = Number(inserted.rows[0].id);
  }
  return result;
}

export async function ensureWarehouse(client: any, tag: string): Promise<number> {
  const existing = await client.query("SELECT id FROM warehouses WHERE name = $1 LIMIT 1", [tag]);
  if (existing.rows.length) return Number(existing.rows[0].id);
  const inserted = await client.query(
    `INSERT INTO warehouses (name, type, activity, status, allow_negative_stock)
     VALUES ($1, 'branch', 'factory_raw', 'active', false)
     RETURNING id`,
    [tag],
  );
  return Number(inserted.rows[0].id);
}

export async function ensureIngredient(client: any, tag: string): Promise<number> {
  const existing = await client.query("SELECT id FROM ingredients WHERE name = $1 LIMIT 1", [tag]);
  if (existing.rows.length) return Number(existing.rows[0].id);
  const inserted = await client.query(
    `INSERT INTO ingredients (name, unit, cost, current_stock, is_active, is_stock_item)
     VALUES ($1, 'قطعة', 0, 0, true, 1)
     RETURNING id`,
    [tag],
  );
  return Number(inserted.rows[0].id);
}

export async function ensureCustomer(client: any, tag: string): Promise<number> {
  const existing = await client.query("SELECT id FROM customers WHERE name = $1 LIMIT 1", [tag]);
  if (existing.rows.length) return Number(existing.rows[0].id);
  // `customers.phone` is unique, so the tag doubles as the phone number.
  const inserted = await client.query(
    `INSERT INTO customers (name, phone, total_orders, total_spent)
     VALUES ($1, $2, 0, 0)
     RETURNING id`,
    [tag, tag],
  );
  return Number(inserted.rows[0].id);
}

/**
 * Several GL tables carry `created_by` foreign keys pointing at `users`, and the
 * services default to user id 1, so a user row must exist before posting.
 */
export async function ensureUser(client: any): Promise<number> {
  const existing = await client.query("SELECT id FROM users WHERE id = 1 LIMIT 1");
  if (existing.rows.length) return 1;
  await client.query(
    `INSERT INTO users (id, username, password, role, status)
     VALUES (1, 'behaviour-test-runner', 'not-a-real-password', 'admin', 'active')`,
  );
  await client.query(
    "SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1))",
  );
  return 1;
}

/**
 * Cash movements are rejected unless an active treasury account exists, so make
 * sure one is present before a test posts a cash transaction.
 */
export async function ensureTreasuryAccount(client: any, tag: string): Promise<number> {
  const existing = await client.query(
    "SELECT id FROM treasury_accounts WHERE status = 'active' ORDER BY id LIMIT 1",
  );
  if (existing.rows.length) return Number(existing.rows[0].id);
  const inserted = await client.query(
    `INSERT INTO treasury_accounts (name, type, currency, current_balance, opening_balance, status, is_main)
     VALUES ($1, 'cash', 'EGP', 0, 0, 'active', true)
     RETURNING id`,
    [tag],
  );
  return Number(inserted.rows[0].id);
}
