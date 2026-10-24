import { erpPool } from "../../../server-erp-core.js";
import { CreateSafeDTO, AdjustBalanceDTO } from "../dto/safe.dto.js";

export class SafeRepository {
  async getAll(): Promise<any[]> {
    const result = await erpPool.query("SELECT * FROM safes ORDER BY id ASC");
    return result.rows;
  }

  async findById(id: number): Promise<any> {
    const result = await erpPool.query("SELECT * FROM safes WHERE id = $1", [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  async create(safe: CreateSafeDTO): Promise<any> {
    const query = `
      INSERT INTO safes (name, branch_id, balance) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `;
    const result = await erpPool.query(query, [
      safe.name,
      safe.branch_id === undefined ? null : safe.branch_id,
      safe.balance || 0
    ]);
    return result.rows[0];
  }

  async recordTransaction(safeId: number, dto: AdjustBalanceDTO): Promise<any> {
    const client = await erpPool.connect();
    try {
      await client.query("BEGIN");

      // Verify the safe exists and update balance
      const safeCheck = await client.query("SELECT balance FROM safes WHERE id = $1", [safeId]);
      if (safeCheck.rows.length === 0) {
        throw new Error("Target safe not found");
      }

      // Compute new balance
      let modifier = 0;
      if (["in", "surplus", "cash_drop"].includes(dto.type)) {
        modifier = dto.amount;
      } else if (["out", "deficit", "transfer"].includes(dto.type)) {
        modifier = -dto.amount;
      }

      await client.query("UPDATE safes SET balance = balance + $1 WHERE id = $2", [modifier, safeId]);

      // Record in safe_transactions table
      const insertQuery = `
        INSERT INTO safe_transactions (safe_id, amount, type, notes, user_id) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING *
      `;
      const transResult = await client.query(insertQuery, [
        safeId,
        dto.amount,
        dto.type,
        dto.notes || null,
        dto.user_id || null
      ]);

      // If it is a transfer, also update the target safe
      if (dto.type === "transfer" && dto.target_safe_id) {
        await client.query("UPDATE safes SET balance = balance + $1 WHERE id = $2", [dto.amount, dto.target_safe_id]);
        await client.query(
          "INSERT INTO safe_transactions (safe_id, amount, type, notes, user_id) VALUES ($1, $2, 'in', $3, $4)",
          [dto.target_safe_id, dto.amount, `تحويل مستلم من خزينة #${safeId}: ${dto.notes || ""}`, dto.user_id || null]
        );
      }

      await client.query("COMMIT");
      return transResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
