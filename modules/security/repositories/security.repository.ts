import { erpPool } from "../../../server-erp-core.js";
import { UpdateUserPermissionsDTO } from "../dto/security.dto.js";

export class SecurityRepository {
  async getUserPermissions(userId: number): Promise<string[]> {
    const result = await erpPool.query("SELECT permissions FROM users WHERE id = $1", [userId]);
    if (result.rows.length === 0) return [];
    return result.rows[0].permissions || [];
  }

  async updateUserPermissions(update: UpdateUserPermissionsDTO): Promise<boolean> {
    const result = await erpPool.query(
      "UPDATE users SET permissions = $1 WHERE id = $2 RETURNING id",
      [update.permissions, update.user_id]
    );
    return result.rows.length > 0;
  }

  async logSecurityAction(userId: number, action: string, details: string): Promise<void> {
    const ddl = `
      CREATE TABLE IF NOT EXISTS security_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    await erpPool.query(ddl);
    await erpPool.query(
      "INSERT INTO security_logs (user_id, action, details) VALUES ($1, $2, $3)",
      [userId, action, details]
    );
  }
}
