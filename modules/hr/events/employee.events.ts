import { ERPEventBus } from "../../../server-erp-core.js";

export function initHREvents() {
  const eventBus = ERPEventBus.getInstance();

  eventBus.on("EmployeeOnboarded", (data: any) => {
    console.log(`[HR Event] Welcome employee ${data.name} onboarded under role ${data.role}!`);
  });

  eventBus.on("EmployeeClocked", (data: any) => {
    console.log(`[HR Event] Employee #${data.employeeId} registered clock-${data.type} event.`);
  });
}
