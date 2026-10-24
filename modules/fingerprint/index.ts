import fingerprintRoutes from "./routes/fingerprint.routes.js";
import { initFingerprintEvents } from "./events/fingerprint.events.js";
import { initFingerprintJobs } from "./jobs/fingerprint.jobs.js";

export function bootstrapFingerprintModule() {
  console.log("⚡ Bootstrapping Fingerprint Module...");
  initFingerprintEvents();
  initFingerprintJobs();
}

export { fingerprintRoutes };
export * from "./dto/fingerprint.dto.js";
export * from "./validators/fingerprint.validator.js";
export * from "./services/fingerprint.service.js";
export * from "./controllers/fingerprint.controller.js";
