import { SystemRepository } from "../repositories/system.repository.js";
import { UpdateSettingDTO, SystemStatusDTO } from "../dto/system.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";
import os from "os";

export class SystemService {
  private repository: SystemRepository;

  constructor() {
    this.repository = new SystemRepository();
  }

  async getHealthStatus(): Promise<SystemStatusDTO> {
    return {
      uptime: process.uptime(),
      db_connection: "online",
      cpu_usage: os.loadavg()[0],
      memory_usage: process.memoryUsage()
    };
  }

  async getSettings(): Promise<any[]> {
    const cacheKey = "system:settings:all";
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const settings = await this.repository.getSettings();
    ERPCache.set(cacheKey, settings, 600); // 10 mins cache
    return settings;
  }

  async saveSetting(dto: UpdateSettingDTO): Promise<any> {
    const setting = await this.repository.setSetting(dto);
    
    // Invalidate cache
    ERPCache.delete("system:settings:all");

    ERPEventBus.getInstance().emitEvent("SettingUpdated", {
      key: dto.key,
      value: dto.value,
      timestamp: new Date()
    });

    return setting;
  }
}
