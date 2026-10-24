import { SecurityRepository } from "../repositories/security.repository.js";
import { UpdateUserPermissionsDTO } from "../dto/security.dto.js";
import { ERPCache, ERPEventBus } from "../../../server-erp-core.js";

export class SecurityService {
  private repository: SecurityRepository;

  constructor() {
    this.repository = new SecurityRepository();
  }

  async getUserPermissions(userId: number): Promise<string[]> {
    const cacheKey = `user:${userId}:permissions`;
    const cached = ERPCache.get(cacheKey);
    if (cached) return cached;

    const perms = await this.repository.getUserPermissions(userId);
    ERPCache.set(cacheKey, perms, 300); // cache for 5 minutes
    return perms;
  }

  async updateUserPermissions(dto: UpdateUserPermissionsDTO, operatorId: number): Promise<boolean> {
    const success = await this.repository.updateUserPermissions(dto);
    if (success) {
      ERPCache.delete(`user:${dto.user_id}:permissions`);
      await this.repository.logSecurityAction(operatorId, "update_permissions", `Perms modified for user ID ${dto.user_id}`);

      ERPEventBus.getInstance().emitEvent("SecurityPermissionsUpdated2", {
        targetUserId: dto.user_id,
        operatorId,
        timestamp: new Date()
      });
    }
    return success;
  }
}
