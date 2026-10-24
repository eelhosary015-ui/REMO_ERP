import { pool } from "./server-db.js";
import { runHistoricalSyncBackground } from "./modules/fingerprint/jobs/sync-historical.js";

async function main() {
  try {
    const { rows } = await pool.query("SELECT id FROM fingerprint_devices");
    console.log(`[FullSync] Found ${rows.length} devices.`);
    for (const row of rows) {
      console.log(`[FullSync] Executing full historical sync for device ${row.id}...`);
      await runHistoricalSyncBackground(row.id);
    }
    console.log("[FullSync] ✅ All devices synced successfully!");
  } catch (error) {
    console.error("[FullSync] ❌ Error:", error);
  } finally {
    await pool.end();
  }
}

main();
