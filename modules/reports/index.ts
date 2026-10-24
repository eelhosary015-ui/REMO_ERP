import reportRoutes from "./routes/report.routes.js";
import { initReportEvents } from "./events/report.events.js";
import { initReportJobs } from "./jobs/report.jobs.js";

export function bootstrapReportsModule() {
  console.log("⚡ Bootstrapping Reports Module...");
  initReportEvents();
  initReportJobs();
}

export { reportRoutes };
export * from "./dto/report.dto.js";
export * from "./validators/report.validator.js";
export * from "./services/report.service.js";
export * from "./controllers/report.controller.js";
