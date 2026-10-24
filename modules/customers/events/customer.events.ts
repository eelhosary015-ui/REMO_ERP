import { ERPEventBus } from "../../../server-erp-core.js";

export function initCustomerEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("CustomerTransactionRecorded", (data: any) => {
    console.log(`[Customer Event] Transaction recorded for Customer #${data.customerId}: Amount ${data.amount} EGP, Type: ${data.type}`);
  });
}
