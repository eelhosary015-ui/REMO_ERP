import { runHistoricalSyncBackground as runHistoricalSync } from "./sync-historical.js";

export async function runHistoricalSyncBackground(deviceId: number) {
  await runHistoricalSync(deviceId);
}
