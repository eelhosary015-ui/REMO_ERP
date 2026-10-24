import { ERPEventBus } from "../../../server-erp-core.js";

export function initComplaintEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("ComplaintCreated", (data: any) => {
    console.log(`[Complaints Event] New customer complaint received! Topic: ${data.category}. ID: ${data.complaintId}`);
  });

  eventBus.on("ComplaintResolved", (data: any) => {
    console.log(`[Complaints Event] Complaint ID #${data.complaintId} has been resolved: ${data.resolutionNotes}`);
  });
}
