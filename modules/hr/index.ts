import employeeRoutes from "./routes/employee.routes.js";
import { initHREvents } from "./events/employee.events.js";
import { initHRJobs } from "./jobs/employee.jobs.js";
import { startWhatsAppClient } from "./whatsapp_client.js";
import path from "path";
import fs from "fs";

export function bootstrapHRModule() {
  console.log("⚡ Bootstrapping HR Module...");
  initHREvents();
  initHRJobs();

  // Auto-connect WhatsApp background client if auth info exists
  const authFolder = path.join(process.cwd(), "wa_auth_info");
  if (fs.existsSync(authFolder) && fs.readdirSync(authFolder).length > 0) {
    console.log("📱 Found WhatsApp session data, auto-connecting...");
    startWhatsAppClient().catch((err) => {
      console.error("[WhatsApp AutoConnect Error]:", err);
    });
  }
}

export { employeeRoutes };
export * from "./dto/employee.dto.js";
export * from "./validators/employee.validator.js";
export * from "./services/employee.service.js";
export * from "./controllers/employee.controller.js";

