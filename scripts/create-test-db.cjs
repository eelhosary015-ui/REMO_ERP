#!/usr/bin/env node
/**
 * Creates the isolated database used by the behavioural test suite.
 *
 * The schema is copied from the live database in STRUCTURE-ONLY mode: the test
 * database gets the same 300+ tables but none of the production rows, so the
 * tests exercise the real schema without ever reading or writing real data.
 *
 *   node scripts/create-test-db.cjs           # create if missing, keep existing data
 *   node scripts/create-test-db.cjs --reset   # drop and rebuild from scratch
 *
 * Environment:
 *   DATABASE_URL       source database (default database is replaced with <name>_test)
 *   TEST_DATABASE_URL  full override for the test database connection string
 *   PG_BIN             directory holding pg_dump/psql (defaults to PATH,
 *                      then to the standard Windows PostgreSQL 18 install)
 */
const { config: loadEnv } = require("dotenv");
const { Client } = require("pg");
const { execFileSync } = require("child_process");
const path = require("path");

loadEnv({ quiet: true });

const reset = process.argv.includes("--reset");

function resolveTestUrl() {
  const explicit = process.env.TEST_DATABASE_URL?.trim();
  if (explicit) return explicit;
  const base = process.env.DATABASE_URL?.trim();
  if (!base) throw new Error("DATABASE_URL is not set");
  const url = new URL(base);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}_test`;
  return url.toString();
}

function resolveTool(name) {
  const candidates = [
    process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : null,
    name,
    `C:/Program Files/PostgreSQL/18/bin/${name}`,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error(`Could not find ${name}. Set PG_BIN to the PostgreSQL bin directory.`);
}

async function main() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  const testUrl = resolveTestUrl();
  const testDb = decodeURIComponent(new URL(testUrl).pathname.replace(/^\//, ""));
  const sourceDb = decodeURIComponent(new URL(base).pathname.replace(/^\//, ""));

  if (!/_test$/.test(testDb)) {
    throw new Error(`Refusing to work on "${testDb}": the test database name must end in "_test".`);
  }

  const parsed = new URL(base);
  const password = decodeURIComponent(parsed.password || "");
  const user = decodeURIComponent(parsed.username);
  const host = parsed.hostname;
  const port = parsed.port || "5432";

  const admin = new Client({ connectionString: base.replace(/\/[^/?]+(\?|$)/, "/postgres$1") });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [testDb]);
    if (existing.rows.length && reset) {
      await admin.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [testDb],
      );
      await admin.query(`DROP DATABASE ${testDb}`);
      console.log(`dropped database: ${testDb}`);
    }
    if (reset || existing.rows.length === 0) {
      await admin.query(`CREATE DATABASE ${testDb} TEMPLATE template0 ENCODING 'UTF8'`);
      console.log(`created database: ${testDb}`);
    } else {
      console.log(`database already exists: ${testDb} (use --reset to rebuild)`);
      return;
    }
  } finally {
    await admin.end();
  }

  const env = { ...process.env, PGPASSWORD: password };
  const pgDump = resolveTool("pg_dump");
  const psql = resolveTool("psql");

  // The workspace path may contain non-ASCII characters, which pg_dump cannot
  // open through `-f`; pipe the dump over stdin instead of using a temp file.
  const dump = execFileSync(
    pgDump,
    ["-h", host, "-p", port, "-U", user, "--schema-only", "--no-owner", "--no-privileges", "--quote-all-identifiers", "-d", sourceDb],
    { env, encoding: "buffer", maxBuffer: 512 * 1024 * 1024 },
  );
  console.log(`dumped schema of ${sourceDb}: ${(dump.length / 1024).toFixed(0)} KB`);

  execFileSync(psql, [testUrl, "-v", "ON_ERROR_STOP=1", "-q", "-f", "-"], {
    env,
    input: dump,
    maxBuffer: 64 * 1024 * 1024,
  });

  const check = new Client({ connectionString: testUrl });
  await check.connect();
  const tables = await check.query("SELECT COUNT(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
  const rows = await check.query("SELECT COUNT(*)::int AS n FROM journal_entries");
  await check.end();

  console.log(`ready: ${testDb} — ${tables.rows[0].n} tables, ${rows.rows[0].n} journal entries`);
}

main().catch((error) => {
  console.error(`FAILED: ${error.message}`);
  process.exit(1);
});
