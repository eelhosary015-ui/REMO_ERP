/**
 * Proves initDb no longer swallows a failure: it must reject with the original
 * error so startServer() aborts instead of serving a half-initialized database.
 * Uses a stub pool, so no real database is touched.
 */
const boom = new Error("simulated schema failure");
const failingPool = {
  query: async () => {
    throw boom;
  },
};

const { initDb } = await import("../server-db-init.js");

let rejected: unknown = null;
try {
  await initDb(failingPool as any);
} catch (error) {
  rejected = error;
}

if (rejected !== boom) {
  console.error("FAIL: initDb resolved/returned a different error instead of rejecting:", rejected);
  process.exitCode = 1;
} else {
  console.log("PASS: initDb rejects with the original error, so startup can abort.");
}
