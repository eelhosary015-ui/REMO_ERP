import { KitchenRepository } from "../repositories/kitchen.repository.js";
import { UpdateKitchenItemStatusDTO } from "../dto/kitchen.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class KitchenService {
  private repository: KitchenRepository;

  constructor() {
    this.repository = new KitchenRepository();
  }

  async getActiveOrders(): Promise<any[]> {
    const cached = ERPCache.get("kitchen:orders:active");
    if (cached) return cached;

    const orders = await this.repository.getActiveKitchenOrders();
    ERPCache.set("kitchen:orders:active", orders, 15); // kitchen updates every 15 seconds
    return orders;
  }

  async updateItemStatus(dto: UpdateKitchenItemStatusDTO): Promise<any> {
    const item = await this.repository.updateItemStatus(dto);
    ERPCache.delete("kitchen:orders:active");

    ERPEventBus.getInstance().emitEvent("KitchenItemUpdated", {
      orderId: dto.order_id,
      itemId: dto.item_id,
      status: dto.status,
      timestamp: new Date()
    });

    return item;
  }
}
