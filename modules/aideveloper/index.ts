import aiDeveloperRoutes from "./aideveloper_api.routes.js";
import { ensureAIDeveloperTables } from "./aideveloper.service.js";

export function bootstrapAIDeveloperModule() {
  console.log("  🤖 AI Developer Center module bootstrapped (real code analysis, bug detector, security scanner, sandbox)");
  ensureAIDeveloperTables().catch((e) => console.warn("AI Developer init error:", e));
}

export { aiDeveloperRoutes };
