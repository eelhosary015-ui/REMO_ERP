import { ERPEventBus } from "../../../server-erp-core.js";

export function initAccountingEvents() {
  const eventBus = ERPEventBus.getInstance();

  eventBus.on("FinancialTransactionRecorded", (data: any) => {
    console.log(`[Accounting Event] Recorded ${data.type} transaction on safe #${data.safeId} of value ${data.amount} EGP.`);
  });
}
