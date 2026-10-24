import { FingerprintService } from "../services/fingerprint.service.js";
import { io } from "../../../server.js";

// === Real-time polling intervals ===
// Production: 30 seconds (near-instant pickup of new punches)
// Dev mode: 2 minutes (lighter load for sandbox testing)
const SYNC_INTERVAL_MS = process.env.NODE_ENV === "production" ? 30 * 1000 : 120 * 1000;
const INITIAL_DELAY_MS = process.env.NODE_ENV === "production" ? 15000 : 45000;

let syncTimer: ReturnType<typeof setInterval> | null = null;
let activePolling = false;

export function initFingerprintJobs() {
  console.log("[Fingerprint Jobs] Registering automated biometric polling cron background queues...");
  console.log(`[Fingerprint Jobs] Real-time auto-sync will run every ${SYNC_INTERVAL_MS / 1000} seconds for all active devices.`);

  // Allow enabling background polling in dev/preview by setting ENABLE_DEV_POLLING=true
  const isDevMode = process.env.NODE_ENV !== "production" || process.env.DISABLE_BACKGROUND_JOBS === "true";
  if (isDevMode && process.env.ENABLE_DEV_POLLING !== "true") {
    console.log("[Fingerprint Jobs] Background polling disabled in dev mode.");
    console.log("[Fingerprint Jobs] To enable polling in dev/preview, set ENABLE_DEV_POLLING=true in .env");
    return;
  }

  if (isDevMode) {
    console.log("[Fingerprint Jobs] Dev polling explicitly ENABLED via ENABLE_DEV_POLLING=true");
  }

  const service = new FingerprintService();

  // Run initial sync after the startup delay
  setTimeout(async () => {
    await runAutoSync(service);
  }, INITIAL_DELAY_MS);

  // Schedule recurring real-time polling
  syncTimer = setInterval(async () => {
    await runAutoSync(service);
  }, SYNC_INTERVAL_MS);

  console.log(`[Fingerprint Jobs] ✅ Real-time polling scheduled (every ${SYNC_INTERVAL_MS / 1000}s, initial delay ${INITIAL_DELAY_MS / 1000}s)`);
}

async function runAutoSync(service: FingerprintService) {
  // Prevent overlapping cycles if a previous sync is still running
  if (activePolling) {
    console.log("[Fingerprint AutoSync] Skipping cycle - previous sync still running");
    return;
  }
  activePolling = true;

  try {
    console.log("[Fingerprint AutoSync] Starting real-time sync for all active devices...");
    const results = await service.syncAllActiveDevices();

    let totalPulled = 0;
    let totalMatched = 0;
    let totalInserted = 0;
    let failedCount = 0;
    let totalUpdated = 0;
    const allUpdatedRecords: any[] = [];

    results.forEach((result, deviceId) => {
      if (result.success) {
        totalPulled += result.pulled;
        totalMatched += result.matched;
        totalInserted += result.inserted;
        if (result.updatedRecords && result.updatedRecords.length > 0) {
          totalUpdated += result.updatedRecords.length;
          allUpdatedRecords.push(...result.updatedRecords);
        }
      } else {
        failedCount++;
      }
    });

    // === Emit real-time socket events for new/updated attendance records ===
    // This is the key mechanism that pushes instant updates to all connected HR dashboards
    // when an employee punches their finger on the device.
    if (allUpdatedRecords.length > 0 && io) {
      io.emit('attendance:realtime', {
        events: allUpdatedRecords,
        source: 'auto_sync',
        timestamp: new Date().toISOString()
      });
      console.log(`[Fingerprint AutoSync] 📡 Emitted ${allUpdatedRecords.length} real-time attendance events via socket.io`);
    }

    console.log(
      `[Fingerprint AutoSync] Cycle complete: ${results.size} devices checked, ` +
      `${results.size - failedCount} OK, ${failedCount} failed | ` +
      `Pulled: ${totalPulled}, Matched: ${totalMatched}, Inserted: ${totalInserted}, Updated: ${totalUpdated}`
    );
  } catch (err: any) {
    console.error("[Fingerprint AutoSync] Auto-sync cycle failed:", err.message);
  } finally {
    activePolling = false;
  }
}

export function stopFingerprintJobs() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log("[Fingerprint Jobs] Auto-sync timer stopped.");
  }
  activePolling = false;
}

