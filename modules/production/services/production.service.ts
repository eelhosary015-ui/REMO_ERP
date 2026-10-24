import { ProductionRepository } from "../repositories/production.repository.js";
import { CreateProductionRunDTO, ExecuteProductionOrderDTO, CheckAvailabilityResponse } from "../dto/production.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class ProductionService {
  private repository: ProductionRepository;

  constructor() {
    this.repository = new ProductionRepository();
  }

  async getProductionRuns(): Promise<any[]> {
    const cacheKey = "production:runs:all";
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const runs = await this.repository.getAll();
    ERPCache.set(cacheKey, runs, 60);
    return runs;
  }

  async recordProductionRun(dto: CreateProductionRunDTO): Promise<any> {
    const run = await this.repository.create(dto);
    
    ERPCache.delete("production:runs:all");
    ERPCache.delete("production:orders:all");

    ERPEventBus.getInstance().emitEvent("ProductionRunCompleted", {
      runId: run.id,
      productId: run.product_id,
      producedQuantity: run.quantity,
      warehouseId: run.warehouse_id,
      timestamp: new Date()
    });

    return run;
  }

  async getOrders(): Promise<any[]> {
    return this.repository.getOrders();
  }

  async getSharedProducts(): Promise<any[]> {
    return this.repository.getSharedProducts();
  }

  async saveOrder(order: any): Promise<any> {
    const saved = await this.repository.saveOrder(order);
    ERPCache.delete("production:orders:all");
    return saved;
  }

  async checkAvailability(
    productId: string | number,
    bomId: string | undefined,
    quantity: number,
    rawWarehouseId: number
  ): Promise<CheckAvailabilityResponse> {
    return this.repository.checkAvailability(productId, bomId, quantity, rawWarehouseId);
  }

  async executeOrder(dto: ExecuteProductionOrderDTO): Promise<any> {
    const result = await this.repository.executeProductionOrder(dto);

    // Invalidate caches
    ERPCache.delete("production:runs:all");
    ERPCache.delete("production:orders:all");
    ERPCache.delete("inventory:stock:all");

    // Emit official ERP Event — include orderId so GL listeners can skip
    // the re-post (already posted inside the repository transaction) but
    // still use orderId for any other consumers (costs, audit, etc.)
    ERPEventBus.getInstance().emitEvent("ProductionOrderExecuted", {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      productName: result.productName,
      quantity: result.producedQuantity,
      rawWarehouseId: result.rawWarehouseId,
      finishedWarehouseId: result.finishedWarehouseId,
      totalCost: result.totalMaterialCost,
      costPerUnit: result.costPerUnit,
      deductedMaterialsCount: result.deductedMaterialsCount,
      executedBy: result.executedBy,
      journalEntryId: result.journalEntryId,
      timestamp: new Date()
    });

    return result;
  }

  async getBOMs(): Promise<any[]> {
    return this.repository.getBOMs();
  }

  async saveBOM(bom: any): Promise<any> {
    const saved = await this.repository.saveBOM(bom);
    ERPCache.delete("production:boms:all");
    return saved;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const success = await this.repository.deleteOrder(id);
    ERPCache.delete("production:orders:all");
    return success;
  }

  async clearOrders(): Promise<boolean> {
    const success = await this.repository.clearOrders();
    ERPCache.delete("production:orders:all");
    ERPCache.delete("production:runs:all");
    return success;
  }

  async deleteBOM(id: string): Promise<boolean> {
    const success = await this.repository.deleteBOM(id);
    ERPCache.delete("production:boms:all");
    return success;
  }

  async clearBOMs(): Promise<boolean> {
    const success = await this.repository.clearBOMs();
    ERPCache.delete("production:boms:all");
    return success;
  }
}
