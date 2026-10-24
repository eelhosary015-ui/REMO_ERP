import { ERPEventBus } from "../../../server-erp-core.js";

export function initProductionEvents() {
  const eventBus = ERPEventBus.getInstance();

  eventBus.on("ProductionRunCompleted", (data: any) => {
    console.log(`[Production Event] Completed production run #${data.runId} for product #${data.productId}. Produced: ${data.producedQuantity} units.`);
  });
}
