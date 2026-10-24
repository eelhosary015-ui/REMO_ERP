import { WarehouseRepository } from "../repositories/warehouse.repository.js";
import { CreateWarehouseDTO, AdjustStockDTO } from "../dto/warehouse.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class WarehouseService {
  private repository: WarehouseRepository;

  constructor() {
    this.repository = new WarehouseRepository();
  }

  async getWarehouses(): Promise<any[]> {
    const cached = ERPCache.get("warehouses:all");
    if (cached) return cached;

    const warehouses = await this.repository.getAll();
    ERPCache.set("warehouses:all", warehouses, 120);
    return warehouses;
  }

  async createWarehouse(dto: CreateWarehouseDTO): Promise<any> {
    const warehouse = await this.repository.create(dto);
    ERPCache.delete("warehouses:all");
    return warehouse;
  }

  async getInventory(warehouseId: number): Promise<any[]> {
    const cacheKey = `warehouse:${warehouseId}:inventory`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const inventory = await this.repository.getInventory(warehouseId);
    ERPCache.set(cacheKey, inventory, 30);
    return inventory;
  }

  async adjustStock(dto: AdjustStockDTO): Promise<void> {
    await this.repository.adjustStock(dto);
    ERPCache.delete(`warehouse:${dto.warehouse_id}:inventory`);

    ERPEventBus.getInstance().emitEvent("InventoryAdjusted", {
      warehouseId: dto.warehouse_id,
      ingredientId: dto.ingredient_id,
      quantity: dto.quantity,
      type: dto.type,
      timestamp: new Date()
    });
  }
}
