import { pool } from "../../../server-db.js";
import { RegisterDeviceDTO } from "../dto/fingerprint.dto.js";

export class FingerprintRepository {
  constructor() {
    this.ensureTableExists();
  }

  private async ensureTableExists(): Promise<void> {
    // DDL must match server-db-init.ts schema to avoid conflicts (is_active INTEGER instead of status VARCHAR)
    const ddl = `
      CREATE TABLE IF NOT EXISTS fingerprint_devices (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        port INTEGER DEFAULT 4370,
        is_active INTEGER DEFAULT 1,
        branch_id INTEGER,
        last_sync TIMESTAMP
      )
    `;
    try {
      await pool.query(ddl);
      // Ensure is_active column exists for older DBs created by the divergent DDL
      await pool.query(`
        ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1
      `);
      await pool.query(`
        ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS last_sync TIMESTAMP
      `);
      await pool.query(`
        ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS branch_id INTEGER
      `);
      // HikVision support: device_type, protocol, and credentials for ISAPI auth
      await pool.query(`
        ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS device_type VARCHAR(20) DEFAULT 'zkteco'
      `);
      await pool.query(`
        ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS protocol VARCHAR(10) DEFAULT 'tcp'
      `);
      await pool.query(`
        ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS username TEXT
      `);
      await pool.query(`
        ALTER TABLE fingerprint_devices ADD COLUMN IF NOT EXISTS password TEXT
      `);
    } catch (err: any) {
      console.error("Failed to ensure fingerprint_devices table exists:", err.message);
    }
  }

  async getAll(): Promise<any[]> {
    await this.ensureTableExists();
    const result = await pool.query("SELECT * FROM fingerprint_devices ORDER BY name ASC");
    return result.rows;
  }

  async getById(id: number): Promise<any> {
    await this.ensureTableExists();
    const result = await pool.query("SELECT * FROM fingerprint_devices WHERE id = $1", [id]);
    return result.rows[0];
  }

  async create(device: RegisterDeviceDTO): Promise<any> {
    await this.ensureTableExists();
    const query = `
      INSERT INTO fingerprint_devices (name, ip_address, port, branch_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await pool.query(query, [
      device.name,
      device.ip_address,
      device.port || 4370,
      device.branch_id || null
    ]);
    return result.rows[0];
  }

  async update(id: number, fields: Partial<RegisterDeviceDTO> & { is_active?: number }): Promise<any> {
    await this.ensureTableExists();
    const result = await pool.query(
      `UPDATE fingerprint_devices
       SET name = COALESCE($1, name),
           ip_address = COALESCE($2, ip_address),
           port = COALESCE($3, port),
           branch_id = COALESCE($4, branch_id),
           is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [fields.name, fields.ip_address, fields.port, fields.branch_id, fields.is_active, id]
    );
    return result.rows[0];
  }

  async setActive(id: number, isActive: boolean): Promise<boolean> {
    await this.ensureTableExists();
    const result = await pool.query(
      "UPDATE fingerprint_devices SET is_active = $1, last_sync = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id",
      [isActive ? 1 : 0, id]
    );
    return result.rows.length > 0;
  }

  async delete(id: number): Promise<boolean> {
    await this.ensureTableExists();
    const result = await pool.query("DELETE FROM fingerprint_devices WHERE id = $1 RETURNING id", [id]);
    return result.rows.length > 0;
  }
}
