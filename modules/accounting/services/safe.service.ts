import { SafeRepository } from "../repositories/safe.repository.js";
import { CreateSafeDTO, AdjustBalanceDTO } from "../dto/safe.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class SafeService {
  private repository: SafeRepository;

  constructor() {
    this.repository = new SafeRepository();
  }

  async getSafes(): Promise<any[]> {
    const cacheKey = "accounting:safes:all";
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const safes = await this.repository.getAll();
    ERPCache.set(cacheKey, safes, 60); // cache for 1 minute
    return safes;
  }

  async createSafe(dto: CreateSafeDTO): Promise<any> {
    const safe = await this.repository.create(dto);
    ERPCache.delete("accounting:safes:all");
    
    ERPEventBus.getInstance().emitEvent("SafeCreated", {
      safeId: safe.id,
      name: safe.name,
      initialBalance: safe.balance
    });
    
    return safe;
  }

  async adjustSafeBalance(safeId: number, dto: AdjustBalanceDTO): Promise<any> {
    const transaction = await this.repository.recordTransaction(safeId, dto);
    
    // Clear caches
    ERPCache.delete("accounting:safes:all");
    ERPCache.delete(`safe:${safeId}`);

    ERPEventBus.getInstance().emitEvent("FinancialTransactionRecorded", {
      safeId,
      amount: dto.amount,
      type: dto.type,
      timestamp: new Date()
    });

    return transaction;
  }
}
