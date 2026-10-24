import { erpPool } from "../../../server-erp-core.js";
import { UpdateSettingDTO } from "../dto/system.dto.js";

export class SystemRepository {
  async getSettings(): Promise<any[]> {
    const result = await erpPool.query("SELECT * FROM settings");
    return result.rows;
  }

  async setSetting(dto: UpdateSettingDTO): Promise<any> {
    const query = `
      INSERT INTO settings (key, value) 
      VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      RETURNING *
    `;
    const result = await erpPool.query(query, [dto.key, dto.value]);
    return result.rows[0];
  }
}
