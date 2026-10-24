/**
 * Proves the exact statement that used to throw "require is not defined"
 * (server-db-init.ts admin seed, random-password branch) now executes.
 *
 * Runs initDb end-to-end against the TEST database only. DEFAULT_ADMIN_PASSWORD
 * is intentionally unset so the `randomBytes(...)` branch is evaluated.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ quiet: true });

const base = process.env.DATABASE_URL;
if (!base) throw new Error("DATABASE_URL is not set");
const testUrl = new URL(base);
testUrl.pathname = "/erp_system2_test";
process.env.DATABASE_URL = testUrl.toString();
delete process.env.DEFAULT_ADMIN_PASSWORD;

if (!/_test$/.test(decodeURIComponent(testUrl.pathname))) {
  throw new Error("Refusing to run: target database must end with _test");
}

const { initDb } = await import("../server-db-init.js");
const { pool } = await import("../server-db.js");

try {
  await initDb(pool);
  const admin = await pool.query("SELECT username, role FROM users WHERE username = 'admin'");
  if (admin.rowCount !== 1) throw new Error("admin user was not seeded");
  console.log(
    `PASS: initDb completed on ${decodeURIComponent(testUrl.pathname)} with the random admin password branch; admin row present.`,
  );
} catch (error: any) {
  console.error("FAIL: initDb did not complete:", error?.message || error);
  process.exitCode = 1;
} finally {
  await pool.end().catch(() => {});
}
