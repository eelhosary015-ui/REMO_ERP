import { ERPEventBus } from "../../../server-erp-core.js";

export function initKitchenEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("KitchenItemUpdated", (data: any) => {
    console.log(`[Kitchen Event] Item status changed in order #${data.orderId}: Item #${data.itemId} is now: ${data.status}`);
  });
}
