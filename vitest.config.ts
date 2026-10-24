import { defineConfig } from "vitest/config";

/**
 * Behavioural test suite.
 *
 * Only `tests/behavior/**` is collected: the legacy files in `tests/*.test.ts`
 * assert against source text and are not executed here.
 *
 * `tests/helpers/testDb.ts` is loaded as a setup file so that it can redirect
 * DATABASE_URL to the dedicated test database *before* `server-db` is imported.
 */
export default defineConfig({
  test: {
    include: ["tests/behavior/**/*.test.ts"],
    setupFiles: ["tests/helpers/testDb.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Every file shares the same PostgreSQL test database.
    fileParallelism: false,
    // A single worker keeps the connection footprint at 1-2 clients. The app pool
    // clamps its size to at least 20, and the running ERP server already holds
    // most of the server's connection budget, so parallel workers would be
    // rejected with "too many clients already".
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
