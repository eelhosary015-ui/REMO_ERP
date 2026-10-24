import { erpPool } from "../../../server-erp-core.js";
import { CreateComplaintDTO, ResolveComplaintDTO } from "../dto/complaint.dto.js";

export class ComplaintRepository {
  private static tableEnsured = false;
  private static ensurePromise: Promise<void> | null = null;

  constructor() {
    this.ensureTableExists();
  }

  private async ensureTableExists(): Promise<void> {
    if (ComplaintRepository.tableEnsured) return;
    if (ComplaintRepository.ensurePromise) return ComplaintRepository.ensurePromise;

    const ddl = `
      CREATE TABLE IF NOT EXISTS complaints (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(100),
        customer_phone VARCHAR(20),
        category VARCHAR(100) NOT NULL,
        details TEXT NOT NULL,
        branch_id INTEGER,
        status VARCHAR(20) DEFAULT 'pending',
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMP
      )
    `;
    ComplaintRepository.ensurePromise = (async () => {
      try {
        await erpPool.query(ddl);
        ComplaintRepository.tableEnsured = true;
      } catch (err: any) {
        // Handled via pool
      } finally {
        ComplaintRepository.ensurePromise = null;
      }
    })();
    return ComplaintRepository.ensurePromise;
  }

  async getAll(): Promise<any[]> {
    await this.ensureTableExists();
    const result = await erpPool.query("SELECT * FROM complaints ORDER BY created_at DESC");
    return result.rows;
  }

  async create(complaint: CreateComplaintDTO): Promise<any> {
    await this.ensureTableExists();
    const query = `
      INSERT INTO complaints (customer_name, customer_phone, category, details, branch_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      complaint.customer_name || null,
      complaint.customer_phone || null,
      complaint.category,
      complaint.details,
      complaint.branch_id || null
    ]);
    return result.rows[0];
  }

  async resolve(id: number, notes: string): Promise<any> {
    await this.ensureTableExists();
    const query = `
      UPDATE complaints 
      SET status = 'resolved', resolution_notes = $1, resolved_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `;
    const result = await erpPool.query(query, [notes, id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
}
