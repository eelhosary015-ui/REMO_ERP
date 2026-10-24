import { ERPEventBus } from "../../../server-erp-core.js";

export function initFingerprintEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("FingerprintDeviceRegistered", (data: any) => {
    console.log(`[Fingerprint Event] Device registered: "${data.name}" at IP: ${data.ip}. Assigned ID: ${data.deviceId}`);
  });

  eventBus.on("FingerprintLogsSynced", (data: any) => {
    console.log(`[Fingerprint Event] Sync logs pulled successfully from biometric device ID #${data.deviceId}.`);
  });
}
