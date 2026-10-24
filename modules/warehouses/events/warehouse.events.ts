import { ERPEventBus } from "../../../server-erp-core.js";

export function initWarehouseEvents() {
  const eventBus = ERPEventBus.getInstance();
  eventBus.on("InventoryAdjusted", (data: any) => {
    console.log(`[Warehouse Event] Stock manual adjustment recorded in warehouse #${data.warehouseId}. Ingredient #${data.ingredientId}, Quantity: ${data.quantity}, Mode: ${data.type}`);
  });
}
