import { ERPEventBus } from "../../../server-erp-core.js";

export function initReportEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("ReportGenerated", (data: any) => {
    console.log(`[Reports Event] Detailed operational profitability reports compiled for range ${data.startDate} - ${data.endDate}`);
  });
}
