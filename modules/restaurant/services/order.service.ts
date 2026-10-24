import { OrderRepository } from "../repositories/order.repository.js";
import { CreateOrderDTO, UpdateOrderDTO } from "../dto/order.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class OrderService {
  private repository: OrderRepository;

  constructor() {
    this.repository = new OrderRepository();
  }

  async placeOrder(dto: CreateOrderDTO): Promise<any> {
    const order = await this.repository.create(dto);
    
    // Invalidate caches if needed or cache specific queries
    ERPCache.set(`order:${order.id}`, order, 600); // Cache for 10 minutes

    // Trigger an internal ERP Event
    ERPEventBus.getInstance().emitEvent("OrderCreated", {
      orderId: order.id,
      branchId: order.branch_id,
      total: order.total,
      timestamp: new Date()
    });

    return order;
  }

  async getOrder(id: number): Promise<any> {
    // Attempt cache read
    const cached = ERPCache.get(`order:${id}`);
    if (cached) return cached;

    // Fetch database
    const order = await this.repository.findById(id);
    if (order) {
      ERPCache.set(`order:${id}`, order, 600);
    }
    return order;
  }

  async updateOrderStatus(id: number, dto: UpdateOrderDTO): Promise<any> {
    const updated = await this.repository.update(id, dto);
    
    if (updated) {
      ERPCache.set(`order:${id}`, updated, 600);
      
      // Trigger status update events
      ERPEventBus.getInstance().emitEvent("OrderStatusUpdated", {
        orderId: id,
        status: dto.status,
        timestamp: new Date()
      });
    }
    
    return updated;
  }
}
