import { ERPEventBus } from "../../../server-erp-core.js";

export function initRestaurantEvents() {
  const eventBus = ERPEventBus.getInstance();

  // Listen to order created events
  eventBus.on("OrderCreated", (data: any) => {
    console.log(`[Restaurant Event] Order #${data.orderId} created for branch #${data.branchId}. Total: ${data.total} EGP.`);
    // Here we can trigger socket.io notifications, physical printer queues, etc.
  });

  // Listen to order status updates
  eventBus.on("OrderStatusUpdated", (data: any) => {
    console.log(`[Restaurant Event] Order #${data.orderId} status changed to: ${data.status}.`);
  });
}
