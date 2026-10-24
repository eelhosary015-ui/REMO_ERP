import complaintRoutes from "./routes/complaint.routes.js";
import { initComplaintEvents } from "./events/complaint.events.js";
import { initComplaintJobs } from "./jobs/complaint.jobs.js";

export function bootstrapComplaintsModule() {
  console.log("⚡ Bootstrapping Complaints Module...");
  initComplaintEvents();
  initComplaintJobs();
}

export { complaintRoutes };
export * from "./dto/complaint.dto.js";
export * from "./validators/complaint.validator.js";
export * from "./services/complaint.service.js";
import { ComplaintController } from "./routes/complaint.routes.js";
export { ComplaintController };
